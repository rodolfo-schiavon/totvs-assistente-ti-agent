import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { requireManagement } from "../middleware/auth";
import { saveBlob, deleteBlob } from "../knowledge/storage";
import { scheduleIngestion, healKnowledgeDocuments } from "../knowledge/ingestion";
import { notifyVfsSync } from "../knowledge/vfs-notify";
import { readBlob } from "../knowledge/storage";
import { assertAttachmentAccess, filterAccessibleAttachmentIds } from "../services/attachment-access";
import { resolveDbUserId } from "../services/resolve-user";
import { searchKnowledgeDocuments } from "../services/knowledge-search";
import {
  mapAttachmentResponse,
  scheduleAttachmentExtraction,
} from "../services/attachment-extraction";

export async function knowledgeRoutes(app: FastifyInstance) {
  app.get("/api/v1/knowledge/documents/search", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const q = request.query as { q?: string; limit?: string };
    const limit = parseInt(q.limit || "50", 10) || 50;
    return searchKnowledgeDocuments(q.q || "", limit);
  });

  app.get("/api/v1/knowledge/documents", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const docs = await prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        mimeType: d.mimeType,
        byteSize: d.byteSize,
        status: d.status,
        vfsSyncStatus: d.vfsSyncStatus,
        vfsSyncError: d.vfsSyncError,
        error: d.error,
        preview: d.extractedPreview?.slice(0, 300),
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    };
  });

  app.post("/api/v1/knowledge/documents", async (request, reply) => {
    if (!requireManagement(request, reply)) return;

    const mp = await request.file();
    if (!mp) return reply.code(400).send({ error: "Arquivo obrigatório" });

    const buffer = await mp.toBuffer();
    const fileName = mp.filename || "documento";
    const mimeType = mp.mimetype || "application/octet-stream";
    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const storageKey = await saveBlob(buffer, ext);

    const kb = await prisma.knowledgeBase.findFirst({ where: { active: true } });
    if (!kb) return reply.code(500).send({ error: "Base de conhecimento não configurada" });

    const doc = await prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId: kb.id,
        title: fileName,
        mimeType,
        storageKey,
        byteSize: buffer.length,
        uploadedBy: request.auth?.username,
        status: "pending",
        vfsSyncStatus: "pending",
      },
    });

    scheduleIngestion(doc.id);

    return { id: doc.id, status: doc.status, title: doc.title };
  });

  app.delete("/api/v1/knowledge/documents/:id", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { id } = request.params as { id: string };
    const doc = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) return reply.code(404).send({ error: "Documento não encontrado" });

    await prisma.ingestionJob.deleteMany({ where: { documentId: id } });
    await prisma.knowledgeDocument.delete({ where: { id } });
    await deleteBlob(doc.storageKey);
    notifyVfsSync().catch(console.error);

    return { ok: true };
  });

  app.post("/api/v1/knowledge/documents/:id/reindex", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { id } = request.params as { id: string };
    const doc = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) return reply.code(404).send({ error: "Documento não encontrado" });
    scheduleIngestion(id);
    return { ok: true, status: "processing" };
  });

  app.post("/api/v1/knowledge/sync-vfs", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const healed = await healKnowledgeDocuments();
    const result = await notifyVfsSync();
    if (!result.ok) {
      return reply.code(502).send({
        error: result.error || "Falha ao sincronizar VFS",
        detail: result.body,
        healed,
      });
    }
    let counts: unknown = null;
    try {
      counts = result.body ? JSON.parse(result.body) : null;
    } catch {
      counts = result.body;
    }
    return { ok: true, healed, counts };
  });

  app.get("/api/v1/knowledge/documents/vfs-export", async (request, reply) => {
    if (!request.auth?.service) {
      return reply.code(401).send({ error: "Não autorizado" });
    }
    const docs = await prisma.knowledgeDocument.findMany({
      where: { status: "ready" },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return {
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        mimeType: d.mimeType,
        extractedPreview: d.extractedPreview,
        extractedText: d.extractedText,
        updatedAt: d.updatedAt.toISOString(),
      })),
    };
  });

  app.post("/api/v1/knowledge/documents/:id/vfs-sync-status", async (request, reply) => {
    if (!request.auth?.service) {
      return reply.code(401).send({ error: "Não autorizado" });
    }
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { status?: string; error?: string | null };
    await prisma.knowledgeDocument.update({
      where: { id },
      data: {
        vfsSyncStatus: body.status || "synced",
        vfsSyncError: body.error || null,
        updatedAt: new Date(),
      },
    });
    return { ok: true };
  });

  app.get("/api/v1/knowledge/documents/summary", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const docs = await prisma.knowledgeDocument.findMany({
      where: { status: "ready" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, mimeType: true, byteSize: true, vfsSyncStatus: true, createdAt: true },
    });
    return {
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        mimeType: d.mimeType,
        byteSize: d.byteSize,
        vfsSyncStatus: d.vfsSyncStatus,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  });

  app.get("/api/v1/knowledge/base", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const kb = await prisma.knowledgeBase.findFirst({ where: { active: true } });
    return kb || {};
  });

  app.patch("/api/v1/knowledge/base", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const body = (request.body || {}) as { name?: string; description?: string };
    const kb = await prisma.knowledgeBase.findFirst({ where: { active: true } });
    if (!kb) return reply.code(404).send({ error: "Base não encontrada" });

    const updated = await prisma.knowledgeBase.update({
      where: { id: kb.id },
      data: {
        name: body.name ?? kb.name,
        description: body.description ?? kb.description,
        updatedAt: new Date(),
      },
    });
    return updated;
  });
}

export async function agentAttachmentRoutes(app: FastifyInstance) {
  app.get("/api/v1/agent/attachments", async (request, reply) => {
    if (!request.auth?.userId && !request.auth?.service) {
      return reply.code(401).send({ error: "Não autorizado" });
    }
    const q = request.query as { ids?: string };
    const ids = q.ids?.split(",").filter(Boolean) ?? [];
    if (!ids.length) return reply.code(400).send({ error: "Parâmetro ids obrigatório" });

    const allowed = await filterAccessibleAttachmentIds(request, reply, ids);
    if (!allowed) return;

    const rows = await prisma.agentMessageAttachment.findMany({
      where: { id: { in: allowed } },
    });
    return {
      attachments: rows.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        byteSize: a.byteSize,
        extractedText: a.extractedText,
        extractionStatus: a.extractionStatus,
        extractionError: a.extractionError,
        previewUrl: a.mimeType.startsWith("image/") ? `/api/v1/agent/attachments/${a.id}/file` : null,
      })),
    };
  });

  app.get("/api/v1/agent/attachments/:id/file", async (request, reply) => {
    if (!request.auth?.userId && !request.auth?.service) {
      return reply.code(401).send({ error: "Não autorizado" });
    }
    const { id } = request.params as { id: string };
    const att = await assertAttachmentAccess(request, reply, id);
    if (!att) return;

    const buffer = await readBlob(att.storageKey);
    return reply.type(att.mimeType).send(buffer);
  });

  app.get("/api/v1/agent/attachments/:id", async (request, reply) => {
    if (!request.auth?.userId && !request.auth?.service) {
      return reply.code(401).send({ error: "Não autorizado" });
    }
    const { id } = request.params as { id: string };
    const att = await assertAttachmentAccess(request, reply, id);
    if (!att) return;
    return mapAttachmentResponse(att);
  });

  app.post("/api/v1/agent/attachments", async (request, reply) => {
    if (!request.auth?.userId && !request.auth?.service) {
      return reply.code(401).send({ error: "Não autorizado" });
    }

    const mp = await request.file();
    if (!mp) return reply.code(400).send({ error: "Arquivo obrigatório" });

    const buffer = await mp.toBuffer();
    const fileName = mp.filename || "anexo";
    const mimeType = mp.mimetype || "application/octet-stream";
    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const storageKey = await saveBlob(buffer, ext);

    const fields = mp.fields as Record<string, { value?: string }>;
    const conversationId = fields.conversationId?.value;
    const uploaderId = request.auth?.service ? undefined : await resolveDbUserId(request.auth);
    if (!request.auth?.service && !uploaderId) {
      return reply.code(401).send({ error: "Não autorizado" });
    }

    const att = await prisma.agentMessageAttachment.create({
      data: {
        conversationId: conversationId || null,
        uploadedByUserId: uploaderId || null,
        storageKey,
        mimeType,
        fileName,
        byteSize: buffer.length,
        thumbnailKey: mimeType.startsWith("image/") ? storageKey : null,
        extractionStatus: "pending",
      },
    });

    scheduleAttachmentExtraction(att.id);

    return mapAttachmentResponse(att);
  });
}
