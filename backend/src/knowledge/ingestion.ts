import { prisma } from "../db";
import { extractFromStorageKey } from "./extractor";
import { looksLikeExtractionRefusal } from "./openai-pdf";
import { blobExists } from "./storage";
import { notifyVfsSync } from "./vfs-notify";

type TextSource = "blob" | "db_cache" | "db_preview";

/** Lógica pura: escolhe texto do blob ou cache DB. */
export function pickDocumentText(
  blobText: string | null | undefined,
  extractedText: string | null | undefined,
  extractedPreview: string | null | undefined,
  storageKey: string
): { text: string; source: TextSource } {
  if (blobText?.trim()) {
    return { text: blobText, source: "blob" };
  }
  if (extractedText?.trim()) {
    return { text: extractedText, source: "db_cache" };
  }
  if (extractedPreview?.trim()) {
    return { text: extractedPreview, source: "db_preview" };
  }
  throw new Error(
    `Arquivo não encontrado no storage (${storageKey}). ` +
      "O blob foi perdido (redeploy sem volume). Refaça o upload do documento."
  );
}

export async function resolveDocumentText(doc: {
  storageKey: string;
  mimeType: string;
  title: string;
  extractedText: string | null;
  extractedPreview: string | null;
}): Promise<{ text: string; source: TextSource }> {
  const hasBlob = await blobExists(doc.storageKey);
  if (hasBlob) {
    const text = await extractFromStorageKey(doc.storageKey, doc.mimeType, doc.title);
    return pickDocumentText(text, doc.extractedText, doc.extractedPreview, doc.storageKey);
  }
  return pickDocumentText(null, doc.extractedText, doc.extractedPreview, doc.storageKey);
}

export async function processDocument(documentId: string): Promise<void> {
  const doc = await prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
  if (!doc) return;

  const job = await prisma.ingestionJob.create({
    data: { documentId, status: "processing", startedAt: new Date() },
  });

  try {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "processing", vfsSyncStatus: "pending", vfsSyncError: null, error: null },
    });

    const { text, source } = await resolveDocumentText(doc);
    if (!text.trim()) throw new Error("Não foi possível extrair texto do documento.");
    if (looksLikeExtractionRefusal(text)) {
      throw new Error(
        "Extração retornou recusa do modelo (não é conteúdo do PDF). Reindexe após verificar OpenAI (gpt-4o-mini)."
      );
    }

    const warning =
      source !== "blob"
        ? "Texto recuperado do cache DB — blob ausente no storage. Configure Railway Volume ou refaça upload."
        : null;

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: "ready",
        error: warning,
        extractedPreview: text.slice(0, 2000),
        extractedText: source === "blob" ? text : doc.extractedText || text,
        vfsSyncStatus: "pending",
        updatedAt: new Date(),
      },
    });

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "done", finishedAt: new Date() },
    });

    const syncResult = await notifyVfsSync();
    if (!syncResult.ok) {
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          vfsSyncStatus: "error",
          vfsSyncError: (syncResult.error || "Falha ao sincronizar VFS").slice(0, 500),
        },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na ingestão";
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "failed", error: msg, vfsSyncStatus: "error", vfsSyncError: msg, updatedAt: new Date() },
    });
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "failed", error: msg, finishedAt: new Date() },
    });
  }
}

/** Marca como failed documentos indexados com texto de recusa do modelo e reenfileira ingestão. */
export async function quarantineRefusalDocuments(): Promise<number> {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { status: { in: ["ready", "failed"] } },
    take: 200,
  });

  let quarantined = 0;
  for (const doc of docs) {
    const text = doc.extractedText || doc.extractedPreview || "";
    if (!text.trim() || !looksLikeExtractionRefusal(text)) continue;

    await prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: {
        status: "failed",
        error:
          "Texto indexado era recusa do modelo, não conteúdo do PDF. Clique em reindexar após o deploy.",
        vfsSyncStatus: "error",
        vfsSyncError: "Conteúdo inválido (recusa do modelo)",
        extractedText: null,
        extractedPreview: null,
        updatedAt: new Date(),
      },
    });
    scheduleIngestion(doc.id);
    quarantined += 1;
  }

  if (quarantined > 0) {
    console.info(`quarantineRefusalDocuments: ${quarantined} documento(s) reenfileirado(s)`);
  }
  return quarantined;
}

/** Recupera documentos com texto em DB mas status failed (blob perdido após redeploy). */
export async function healKnowledgeDocuments(): Promise<number> {
  const broken = await prisma.knowledgeDocument.findMany({
    where: {
      OR: [{ status: "failed" }, { vfsSyncStatus: "error" }],
      AND: [
        {
          OR: [
            { extractedText: { not: null } },
            { extractedPreview: { not: null } },
          ],
        },
      ],
    },
    take: 100,
  });

  let healed = 0;
  for (const doc of broken) {
    try {
      const { text, source } = await resolveDocumentText(doc);
      if (!text.trim() || looksLikeExtractionRefusal(text)) continue;
      await prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: {
          status: "ready",
          error:
            source !== "blob"
              ? "Recuperado do cache DB — configure Railway Volume em /data/storage."
              : null,
          vfsSyncStatus: "pending",
          vfsSyncError: null,
          updatedAt: new Date(),
        },
      });
      healed += 1;
    } catch {
      /* skip */
    }
  }
  if (healed > 0) {
    console.info(`healKnowledgeDocuments: ${healed} documento(s) recuperado(s)`);
    notifyVfsSync().catch(console.error);
  }
  return healed;
}

export function scheduleIngestion(documentId: string): void {
  setImmediate(() => {
    processDocument(documentId).catch(async (err) => {
      console.error("processDocument unhandled:", documentId, err);
      try {
        await prisma.knowledgeDocument.update({
          where: { id: documentId },
          data: {
            status: "failed",
            error: err instanceof Error ? err.message : "Erro na ingestão",
            vfsSyncStatus: "error",
            vfsSyncError: "Ingestão interrompida",
          },
        });
      } catch {
        /* ignore */
      }
    });
  });
}

/** Reprocessa documentos presos em pending (ex.: crash durante ingestão). */
export async function requeueStalePendingDocuments(): Promise<number> {
  const cutoff = new Date(Date.now() - 45_000);
  const stale = await prisma.knowledgeDocument.findMany({
    where: { status: "pending", createdAt: { lt: cutoff } },
    take: 50,
  });
  for (const doc of stale) {
    console.info("requeue stale pending doc:", doc.id, doc.title);
    scheduleIngestion(doc.id);
  }
  return stale.length;
}

/** Dispara sync VFS para documentos ready com vfs pendente/erro. */
export async function syncPendingVfsDocuments(): Promise<void> {
  const pending = await prisma.knowledgeDocument.count({
    where: {
      status: "ready",
      vfsSyncStatus: { in: ["pending", "error"] },
    },
  });
  if (pending > 0) {
    console.info("syncPendingVfsDocuments: %d doc(s) aguardando VFS", pending);
    await notifyVfsSync();
  }
}
