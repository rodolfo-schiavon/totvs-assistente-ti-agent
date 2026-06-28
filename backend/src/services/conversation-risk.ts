import type { RiskLevel } from "@prisma/client";

export type RiskFinding = {
  riskType: string;
  riskLevel: RiskLevel;
  evidence: Record<string, unknown>;
};

const RULES: { type: string; level: RiskLevel; pattern: RegExp }[] = [
  { type: "cpf", level: "alto", pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/ },
  { type: "cnpj", level: "alto", pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/ },
  { type: "rg", level: "medio", pattern: /\brg[:\s]?\d{5,12}\b/i },
  { type: "phone", level: "medio", pattern: /\b(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/ },
  { type: "email", level: "baixo", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { type: "financial", level: "alto", pattern: /\b(pix|conta corrente|agência|banco|saldo|cartão)\b/i },
  { type: "health", level: "critico", pattern: /\b(cid|diagnóstico|diagnostico|prontuário|prontuario|doença)\b/i },
  { type: "secret", level: "critico", pattern: /\b(api[_-]?key|secret|password|senha|token)\s*[:=]/i },
  { type: "injection", level: "critico", pattern: /ignore\s+(all\s+)?(previous|prior)\s+instructions|reveal\s+(the\s+)?system\s+prompt|ignore\s+lgpd/i },
];

const LEVEL_RANK: Record<RiskLevel, number> = {
  baixo: 1,
  medio: 2,
  alto: 3,
  critico: 4,
};

export function analyzeTextRisk(text: string): RiskFinding[] {
  const findings: RiskFinding[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(text || "")) {
      findings.push({
        riskType: rule.type,
        riskLevel: rule.level,
        evidence: { pattern: rule.pattern.source },
      });
    }
  }
  return findings;
}

export function maxRiskLevel(findings: RiskFinding[]): RiskLevel {
  if (!findings.length) return "baixo";
  return findings.reduce(
    (max, f) => (LEVEL_RANK[f.riskLevel] > LEVEL_RANK[max] ? f.riskLevel : max),
    "baixo" as RiskLevel
  );
}

export function maskSensitiveText(text: string): string {
  return (text || "")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF ***]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ ***]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL ***]");
}
