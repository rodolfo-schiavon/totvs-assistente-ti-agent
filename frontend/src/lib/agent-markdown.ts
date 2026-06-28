const DOC_CITATION_RE = /\[Doc:\s*([^\]]+)\]/gi;
const VFS_INLINE_RE = /`?\/platform-kb\/[^`\s,)]+`?(?:\s*,?\s*linha\s+\d+)?/gi;
const TABLE_BLOCK_RE = /(^|\n)(\|.+\|\n\|[-:\s|]+\|\n(?:\|.+\|\n?)+)/g;

export function extractDocCitations(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(DOC_CITATION_RE)) {
    const title = match[1]?.trim();
    if (title) found.add(title);
  }
  return [...found];
}

export function stripDocCitations(content: string): string {
  return content
    .replace(DOC_CITATION_RE, "")
    .replace(VFS_INLINE_RE, "")
    .replace(/\s*\(\s*conforme\s*\)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function protectMarkdownTables(text: string): { text: string; tables: string[] } {
  const tables: string[] = [];
  const protectedText = text.replace(TABLE_BLOCK_RE, (_, prefix: string, table: string) => {
    const idx = tables.length;
    tables.push(table);
    return `${prefix}@@TABLE_${idx}@@`;
  });
  return { text: protectedText, tables };
}

function restoreMarkdownTables(text: string, tables: string[]): string {
  let out = text;
  tables.forEach((block, i) => {
    out = out.replace(`@@TABLE_${i}@@`, block);
  });
  return out;
}

/** Melhora legibilidade de respostas longas do agente antes do markdown. */
export function normalizeAgentMarkdown(content: string, opts?: { streaming?: boolean }): string {
  let text = stripDocCitations(content);

  if (opts?.streaming) {
    return text;
  }

  const { text: shielded, tables } = protectMarkdownTables(text);
  text = shielded;

  // Quebra seções "**Título** :" ou "**Título:**"
  text = text.replace(/\s+\*\*([^*]+)\*\*\s*:/g, "\n\n**$1:**\n");

  // Itens de lista inline após pontuação
  text = text.replace(/([.:;])\s+-\s+\*\*/g, "$1\n\n- **");
  text = text.replace(/([.:;])\s+-\s+(?!\*\*)/g, "$1\n\n- ");

  // Garante linha própria para bullets (fora de tabelas — já protegidas)
  text = text.replace(/(?<![\n|])- \*\*/g, "\n- **");

  text = restoreMarkdownTables(text, tables);
  return text.trim();
}
