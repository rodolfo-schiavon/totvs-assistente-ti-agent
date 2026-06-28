import { messagePlainText } from "./text-search";

export type ConversationTextExportInput = {
  id: string;
  title?: string | null;
  createdAt: Date;
  updatedAt: Date;
  clientIp?: string | null;
  userAgent?: string | null;
  channel?: string | null;
  user?: { username?: string; role?: string; department?: string | null } | null;
  metrics?: {
    messageCount?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    primaryModel?: string | null;
  } | null;
  messages: Array<{ role: string; content: string; createdAt: Date }>;
};

function roleLabel(role: string): string {
  if (role === "user") return "USUÁRIO";
  if (role === "assistant") return "ASSISTENTE";
  return role.toUpperCase();
}

export function formatConversationAsText(conv: ConversationTextExportInput): string {
  const divider = "=".repeat(80);
  const section = "-".repeat(80);
  const lines: string[] = [];

  lines.push(divider);
  lines.push("AUDITORIA DE CONVERSA — Exportação para leitura");
  lines.push(divider);
  lines.push("");
  lines.push(`ID: ${conv.id}`);
  lines.push(`Título: ${conv.title || "Sem título"}`);
  if (conv.user) {
    lines.push(`Usuário: ${conv.user.username || "—"}`);
    lines.push(`Departamento: ${conv.user.department || conv.user.role || "—"}`);
  }
  lines.push(`Organização: default`);
  lines.push(`Canal: ${conv.channel || "web"}`);
  if (conv.clientIp) lines.push(`IP: ${conv.clientIp}`);
  if (conv.userAgent) lines.push(`Dispositivo: ${conv.userAgent}`);
  lines.push(`Criada em: ${conv.createdAt.toLocaleString("pt-BR")}`);
  lines.push(`Atualizada em: ${conv.updatedAt.toLocaleString("pt-BR")}`);
  if (conv.metrics) {
    lines.push(`Mensagens: ${conv.metrics.messageCount ?? conv.messages.length}`);
    lines.push(`Tokens: ${conv.metrics.totalTokens ?? 0}`);
    lines.push(`Custo estimado: USD ${Number(conv.metrics.estimatedCostUsd ?? 0).toFixed(4)}`);
    if (conv.metrics.primaryModel) lines.push(`Modelo principal: ${conv.metrics.primaryModel}`);
  }
  lines.push("");
  lines.push(divider);
  lines.push("TRANSCRIÇÃO");
  lines.push(divider);
  lines.push("");

  conv.messages.forEach((m, index) => {
    lines.push(section);
    lines.push(`[${index + 1}] ${roleLabel(m.role)} — ${new Date(m.createdAt).toLocaleString("pt-BR")}`);
    lines.push(section);
    lines.push(messagePlainText(m.content));
    lines.push("");
  });

  lines.push(divider);
  lines.push(`Exportado em: ${new Date().toLocaleString("pt-BR")}`);
  lines.push(divider);

  return lines.join("\n");
}

export function conversationExportFilename(title: string | null | undefined, id: string): string {
  const slug = (title || "conversa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40)
    .toLowerCase();
  return `conversa-${slug || "sem-titulo"}-${id.slice(0, 8)}.txt`;
}
