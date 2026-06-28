import type { RiskLevel } from "@prisma/client";

export type HallucinationInput = {
  route?: string | null;
  sources?: string[];
  markdown?: string | null;
  dataLimitations?: string | null;
  recordsReturned?: number;
};

export type HallucinationResult = {
  riskScore: number;
  riskLevel: RiskLevel;
  evidence: Record<string, unknown>;
};

function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return "critico";
  if (score >= 50) return "alto";
  if (score >= 25) return "medio";
  return "baixo";
}

export function scoreHallucinationRisk(input: HallucinationInput): HallucinationResult {
  const route = (input.route || "").toLowerCase();
  const sources = input.sources ?? [];
  const markdown = input.markdown || "";
  const hasDocCitation = /\[Doc:/i.test(markdown);
  const needsSources = route.includes("document") || route.includes("hybrid") || route.includes("rag");

  let risk = 0;
  const evidence: Record<string, unknown> = {
    route: input.route ?? null,
    sourceCount: sources.length,
    hasDocCitation,
    recordsReturned: input.recordsReturned ?? 0,
  };

  if (needsSources && sources.length === 0 && !hasDocCitation) {
    risk += 45;
    evidence.reason = "documental_sem_fontes";
  }
  if (needsSources && (input.recordsReturned ?? 0) === 0 && sources.length === 0) {
    risk += 20;
  }
  if (input.dataLimitations) {
    risk -= 15;
    evidence.dataLimitations = true;
  }
  if (sources.length >= 2) {
    risk -= 20;
  }

  risk = Math.max(0, Math.min(100, risk));

  return {
    riskScore: risk,
    riskLevel: levelFromScore(risk),
    evidence,
  };
}
