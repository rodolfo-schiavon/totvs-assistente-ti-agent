import { createHash } from "node:crypto";

const CATEGORY_RULES: { category: string; patterns: RegExp[] }[] = [
  { category: "Contratos", patterns: [/contrato/i, /cláusula/i, /clausula/i, /aditivo/i] },
  { category: "Pareceres", patterns: [/parecer/i, /opinião jurídica/i, /opiniao juridica/i] },
  { category: "Revisão", patterns: [/revisar/i, /revisão/i, /revisao/i, /minuta/i] },
  { category: "Pesquisa Jurídica", patterns: [/jurisprud/i, /súmula/i, /sumula/i, /stf|stj|tst/i] },
  { category: "Análise Documental", patterns: [/documento/i, /pdf/i, /anex/i, /extrair/i] },
  { category: "RAG", patterns: [/base de conhecimento/i, /kb\b/i, /documentos da base/i] },
  { category: "Processos Judiciais", patterns: [/processo/i, /petição/i, /peticao/i, /recurso/i, /ação/i] },
];

const ANALYSIS_MAP: Record<string, string> = {
  contrato: "Contratos",
  parecer: "Pareceres",
  revisao: "Revisão",
  pesquisa: "Pesquisa Jurídica",
  documental: "Análise Documental",
  processo: "Processos Judiciais",
  geral: "Outros",
};

export function normalizePrompt(text: string): string {
  return (text || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 4000);
}

export function hashPrompt(text: string): string {
  return createHash("sha256").update(normalizePrompt(text)).digest("hex").slice(0, 32);
}

export function classifyPrompt(prompt: string, analysisType?: string | null): string {
  const mapped = analysisType ? ANALYSIS_MAP[analysisType.toLowerCase()] : undefined;
  if (mapped && mapped !== "Outros") return mapped;

  const low = prompt.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(low))) return rule.category;
  }
  return "Outros";
}

const PII_PATTERNS = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
  /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/,
];

export function detectPiiFlag(text: string): boolean {
  return PII_PATTERNS.some((p) => p.test(text || ""));
}
