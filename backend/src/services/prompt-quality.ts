export type QualityInput = {
  prompt: string;
  analysisType?: string | null;
  route?: string | null;
  sources?: string[];
  toolsCalled?: string[];
  hasDataLimitations?: boolean;
};

export type QualityResult = {
  score: number;
  clarity: number;
  context: number;
  ragUsage: number;
  toolUsage: number;
  details: Record<string, unknown>;
};

export function scorePromptQuality(input: QualityInput): QualityResult {
  const prompt = (input.prompt || "").trim();
  const len = prompt.length;

  let clarity = 40;
  if (len >= 40 && len <= 2000) clarity += 25;
  else if (len >= 20) clarity += 10;
  if (/[?.!]/.test(prompt)) clarity += 10;
  if (prompt.split(/\s+/).length >= 8) clarity += 15;
  clarity = Math.min(100, clarity);

  let context = 30;
  if (input.analysisType && input.analysisType !== "geral") context += 25;
  if (/(contexto|considerando|com base|referente|sobre o|cliente|parte)/i.test(prompt)) context += 25;
  if (len > 120) context += 10;
  context = Math.min(100, context);

  const sourceCount = input.sources?.length ?? 0;
  const toolCount = input.toolsCalled?.length ?? 0;
  const route = (input.route || "").toLowerCase();

  let ragUsage = route.includes("document") || route.includes("hybrid") ? 30 : 50;
  if (sourceCount > 0) ragUsage += Math.min(40, sourceCount * 15);
  if (input.hasDataLimitations) ragUsage += 10;
  ragUsage = Math.min(100, ragUsage);

  let toolUsage = toolCount > 0 ? Math.min(100, 40 + toolCount * 15) : 35;

  const score = Math.round((clarity + context + ragUsage + toolUsage) / 4);

  return {
    score,
    clarity,
    context,
    ragUsage,
    toolUsage,
    details: {
      promptLength: len,
      sourceCount,
      toolCount,
      route: input.route ?? null,
    },
  };
}
