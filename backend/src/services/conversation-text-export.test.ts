import assert from "node:assert/strict";
import { conversationExportFilename, formatConversationAsText } from "./conversation-text-export.js";

function testExport() {
  const text = formatConversationAsText({
    id: "abc-123",
    title: "Contrato X",
    createdAt: new Date("2026-06-09T10:00:00Z"),
    updatedAt: new Date("2026-06-09T10:05:00Z"),
    channel: "web",
    user: { username: "maria", role: "advogado", department: "Cível" },
    metrics: { messageCount: 2, totalTokens: 100, estimatedCostUsd: 0.01, primaryModel: "gpt-4" },
    messages: [
      { role: "user", content: "Olá", createdAt: new Date("2026-06-09T10:00:00Z") },
      {
        role: "assistant",
        content: JSON.stringify({ markdown: "Resposta da IA" }),
        createdAt: new Date("2026-06-09T10:01:00Z"),
      },
    ],
  });
  assert.ok(text.includes("AUDITORIA DE CONVERSA"));
  assert.ok(text.includes("USUÁRIO"));
  assert.ok(text.includes("ASSISTENTE"));
  assert.ok(text.includes("Resposta da IA"));
  assert.ok(conversationExportFilename("Contrato X", "abc-123").endsWith(".txt"));
  console.log("conversation-text-export.test ok");
}

testExport();
