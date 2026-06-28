import { prisma } from "../db";
import { extractText } from "../knowledge/extractor";
import { looksLikeExtractionRefusal } from "../knowledge/openai-pdf";
import { readBlob } from "../knowledge/storage";

export type AttachmentExtractionStatus = "pending" | "processing" | "ready" | "failed" | "empty";

export function mapAttachmentResponse(att: {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  extractedText: string | null;
  extractionStatus: string;
  extractionError: string | null;
}) {
  const status = (att.extractionStatus || "pending") as AttachmentExtractionStatus;
  return {
    id: att.id,
    fileName: att.fileName,
    mimeType: att.mimeType,
    byteSize: att.byteSize,
    extractionStatus: status,
    extractionError: att.extractionError,
    previewUrl: att.mimeType.startsWith("image/") ? `/api/v1/agent/attachments/${att.id}/file` : null,
  };
}

export async function processAttachmentExtraction(attachmentId: string): Promise<void> {
  const att = await prisma.agentMessageAttachment.findUnique({ where: { id: attachmentId } });
  if (!att) return;

  await prisma.agentMessageAttachment.update({
    where: { id: attachmentId },
    data: { extractionStatus: "processing", extractionError: null },
  });

  try {
    const buffer = await readBlob(att.storageKey);
    const extractedText = (await extractText(buffer, att.mimeType, att.fileName)).slice(0, 50000);

    if (!extractedText?.trim()) {
      await prisma.agentMessageAttachment.update({
        where: { id: attachmentId },
        data: {
          extractionStatus: "failed",
          extractionError: "Nenhum texto extraído do arquivo.",
        },
      });
      return;
    }

    if (looksLikeExtractionRefusal(extractedText)) {
      await prisma.agentMessageAttachment.update({
        where: { id: attachmentId },
        data: {
          extractionStatus: "failed",
          extractionError: "Extração retornou recusa do modelo — verifique OpenAI (gpt-4o-mini).",
        },
      });
      return;
    }

    await prisma.agentMessageAttachment.update({
      where: { id: attachmentId },
      data: {
        extractedText,
        extractionStatus: "ready",
        extractionError: null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na extração";
    await prisma.agentMessageAttachment.update({
      where: { id: attachmentId },
      data: { extractionStatus: "failed", extractionError: msg },
    });
  }
}

/** Extração em background — evita timeout HTTP em PDFs com OCR (2–3 min). */
export function scheduleAttachmentExtraction(attachmentId: string): void {
  setImmediate(() => {
    processAttachmentExtraction(attachmentId).catch(async (err) => {
      console.error("processAttachmentExtraction unhandled:", attachmentId, err);
      try {
        await prisma.agentMessageAttachment.update({
          where: { id: attachmentId },
          data: {
            extractionStatus: "failed",
            extractionError: err instanceof Error ? err.message : "Falha na extração",
          },
        });
      } catch {
        /* ignore */
      }
    });
  });
}
