import { prisma } from "../db";
import { extractSnippet } from "./text-search";

export async function searchKnowledgeDocuments(query: string, limit = 50) {
  const q = query.trim();
  if (q.length < 2) return { documents: [], query: q };

  const docs = await prisma.knowledgeDocument.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { extractedPreview: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 100),
  });

  return {
    query: q,
    documents: docs.map((d) => {
      const haystack = [d.title, d.extractedPreview, d.extractedText].filter(Boolean).join("\n");
      const titleMatch = d.title.toLowerCase().includes(q.toLowerCase());
      return {
        id: d.id,
        title: d.title,
        mimeType: d.mimeType,
        byteSize: d.byteSize,
        status: d.status,
        vfsSyncStatus: d.vfsSyncStatus,
        vfsSyncError: d.vfsSyncError,
        error: d.error,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        matchField: titleMatch ? "title" : "content",
        snippet: extractSnippet(haystack, q),
      };
    }),
  };
}
