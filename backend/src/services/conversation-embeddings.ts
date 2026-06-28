import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { resolveOpenAiConfig } from "./openai-config";
import { messagePlainText } from "./text-search";

const EMBED_MODEL = process.env.CONVERSATION_EMBED_MODEL || "text-embedding-3-small";

export async function embedMessage(messageId: string, conversationId: string, content: string): Promise<void> {
  const cfg = await resolveOpenAiConfig();
  if (!cfg?.apiKey) return;

  const text = messagePlainText(content).trim().slice(0, 8000);
  if (text.length < 3) return;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) return;

  const data = (await res.json()) as { data?: { embedding: number[] }[] };
  const vector = data.data?.[0]?.embedding;
  if (!vector?.length) return;

  const id = randomUUID();
  const vecLiteral = `[${vector.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ConversationMessageEmbedding" ("id", "messageId", "conversationId", "model", "embedding", "createdAt")
     VALUES ($1, $2, $3, $4, $5::vector, NOW())
     ON CONFLICT ("messageId") DO UPDATE SET "embedding" = EXCLUDED."embedding", "model" = EXCLUDED."model"`,
    id,
    messageId,
    conversationId,
    EMBED_MODEL,
    vecLiteral
  );
}

export async function backfillEmbeddings(limit = 50): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; conversationId: string; content: string }>>(`
    SELECT m."id", m."conversationId", m."content"
    FROM "AgentMessage" m
    LEFT JOIN "ConversationMessageEmbedding" e ON e."messageId" = m."id"
    WHERE e."id" IS NULL
    ORDER BY m."createdAt" DESC
    LIMIT ${Math.min(limit, 200)}
  `);
  for (const row of rows) {
    await embedMessage(row.id, row.conversationId, row.content).catch(() => undefined);
  }
  return rows.length;
}

export async function semanticSearch(query: string, limit = 30): Promise<
  Array<{ messageId: string; conversationId: string; score: number }>
> {
  const cfg = await resolveOpenAiConfig();
  if (!cfg?.apiKey || query.trim().length < 2) return [];

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: query.trim().slice(0, 2000) }),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { data?: { embedding: number[] }[] };
  const vector = data.data?.[0]?.embedding;
  if (!vector?.length) return [];

  const vecLiteral = `[${vector.join(",")}]`;
  const rows = await prisma.$queryRawUnsafe<
    Array<{ messageId: string; conversationId: string; score: number }>
  >(
    `SELECT e."messageId", e."conversationId", (1 - (e."embedding" <=> $1::vector))::float AS score
     FROM "ConversationMessageEmbedding" e
     WHERE e."embedding" IS NOT NULL
     ORDER BY e."embedding" <=> $1::vector
     LIMIT $2`,
    vecLiteral,
    Math.min(limit, 100)
  );
  return rows;
}
