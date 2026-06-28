import { prisma } from "../db";
import { extractSnippet, messagePlainText } from "./text-search";

export async function searchUserConversations(userId: string, query: string, limit = 30) {
  const q = query.trim();
  if (q.length < 2) return { conversations: [], query: q };

  const convs = await prisma.agentConversation.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 50),
    select: {
      id: true,
      title: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { messages: true } },
      messages: {
        where: { content: { contains: q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true },
      },
    },
  });

  const ql = q.toLowerCase();

  return {
    query: q,
    conversations: convs.map((c) => {
      const titleMatch = (c.title || "").toLowerCase().includes(ql);
      let matchField: "title" | "message" = titleMatch ? "title" : "message";
      let snippet = c.title || "Nova conversa";

      if (!titleMatch && c.messages[0]) {
        const plain = messagePlainText(c.messages[0].content);
        snippet = extractSnippet(plain, q);
        matchField = "message";
      } else if (titleMatch) {
        snippet = c.title || snippet;
      }

      return {
        id: c.id,
        title: c.title || "Nova conversa",
        updatedAt: c.updatedAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
        messageCount: c._count.messages,
        matchField,
        snippet,
      };
    }),
  };
}
