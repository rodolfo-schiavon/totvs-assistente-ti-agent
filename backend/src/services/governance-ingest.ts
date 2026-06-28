import type { GovernanceSeverity } from "@prisma/client";
import { prisma } from "../db";
import { scoreHallucinationRisk } from "./hallucination-score";
import {
  classifyPrompt,
  detectPiiFlag,
  hashPrompt,
  normalizePrompt,
} from "./prompt-classifier";
import { scorePromptQuality } from "./prompt-quality";
import { evaluateGovernanceAlerts } from "./governance-alerts";

export type IngestTurnEvent = {
  type: "turn";
  userId?: string;
  conversationId?: string;
  messageId?: string;
  prompt?: string;
  analysisType?: string;
  model?: string;
  provider?: string;
  route?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  status?: "success" | "error";
  toolsCalled?: string[];
  sources?: string[];
  recordsReturned?: number;
  vfsFilesCount?: number;
  error?: string;
  dataLimitations?: string;
  markdown?: string;
};

export type IngestSecurityEvent = {
  type: "security";
  userId?: string;
  conversationId?: string;
  severity?: GovernanceSeverity | string;
  pattern?: string;
  blocked?: boolean;
  promptSnippet?: string;
};

export type IngestEvent = IngestTurnEvent | IngestSecurityEvent;

function parseSeverity(raw?: string): GovernanceSeverity {
  const v = (raw || "media").toLowerCase();
  if (v === "baixa" || v === "media" || v === "alta" || v === "critica") return v;
  return "media";
}

export async function ingestGovernanceEvents(events: IngestEvent[]): Promise<{ processed: number }> {
  let processed = 0;

  for (const event of events) {
    if (event.type === "security") {
      await prisma.promptSecurityEvent.create({
        data: {
          userId: event.userId,
          conversationId: event.conversationId,
          severity: parseSeverity(event.severity),
          pattern: event.pattern,
          blocked: Boolean(event.blocked),
          promptSnippet: event.promptSnippet?.slice(0, 500),
        },
      });
      processed += 1;
      continue;
    }

    const prompt = event.prompt || "";
    const observability = await prisma.llmObservability.create({
      data: {
        userId: event.userId,
        conversationId: event.conversationId,
        messageId: event.messageId,
        model: event.model,
        provider: event.provider,
        analysisType: event.analysisType,
        route: event.route,
        inputTokens: event.inputTokens ?? 0,
        outputTokens: event.outputTokens ?? 0,
        totalTokens: event.totalTokens ?? 0,
        estimatedCostUsd: event.estimatedCostUsd ?? 0,
        latencyMs: event.latencyMs,
        status: event.status ?? "success",
        toolsJson: event.toolsCalled?.length ? JSON.stringify(event.toolsCalled) : null,
        error: event.error?.slice(0, 500),
      },
    });

    if (prompt) {
      await prisma.promptAnalytics.create({
        data: {
          userId: event.userId,
          conversationId: event.conversationId,
          promptHash: hashPrompt(prompt),
          promptNormalized: normalizePrompt(prompt),
          promptCategory: classifyPrompt(prompt, event.analysisType),
          analysisType: event.analysisType,
          containsPii: detectPiiFlag(prompt),
        },
      });
    }

    const quality = scorePromptQuality({
      prompt,
      analysisType: event.analysisType,
      route: event.route,
      sources: event.sources,
      toolsCalled: event.toolsCalled,
      hasDataLimitations: Boolean(event.dataLimitations),
    });

    await prisma.promptQualityScore.create({
      data: {
        userId: event.userId,
        conversationId: event.conversationId,
        observabilityId: observability.id,
        score: quality.score,
        clarity: quality.clarity,
        context: quality.context,
        ragUsage: quality.ragUsage,
        toolUsage: quality.toolUsage,
        detailsJson: JSON.stringify(quality.details),
      },
    });

    const route = (event.route || "").toLowerCase();
    const ragRelevant = route.includes("document") || route.includes("hybrid") || route.includes("rag");
    if (ragRelevant || (event.vfsFilesCount ?? 0) > 0) {
      await prisma.ragMetrics.create({
        data: {
          userId: event.userId,
          conversationId: event.conversationId,
          docsRetrieved: event.recordsReturned ?? event.sources?.length ?? 0,
          chunksRetrieved: event.recordsReturned ?? 0,
          fallbackUsed: (event.sources?.length ?? 0) === 0 && (event.vfsFilesCount ?? 0) > 0,
          route: event.route,
          vfsFilesCount: event.vfsFilesCount ?? 0,
          success: (event.status ?? "success") === "success" && (event.sources?.length ?? 0) > 0,
        },
      });
    }

    const hallucination = scoreHallucinationRisk({
      route: event.route,
      sources: event.sources,
      markdown: event.markdown,
      dataLimitations: event.dataLimitations,
      recordsReturned: event.recordsReturned,
    });

    if (hallucination.riskScore >= 25) {
      await prisma.hallucinationEvent.create({
        data: {
          userId: event.userId,
          conversationId: event.conversationId,
          riskScore: hallucination.riskScore,
          riskLevel: hallucination.riskLevel,
          evidenceJson: JSON.stringify(hallucination.evidence),
        },
      });
    }

    processed += 1;
  }

  if (processed > 0) {
    evaluateGovernanceAlerts().catch((err) => console.error("governance alerts:", err));
  }

  return { processed };
}
