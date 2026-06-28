import { prisma } from "../db";
import { embedMessage } from "./conversation-embeddings";
import { analyzeTextRisk, maxRiskLevel } from "./conversation-risk";

export async function processMessageSideEffects(
  messageId: string,
  conversationId: string,
  role: string,
  content: string
): Promise<void> {
  if (role !== "user" && role !== "assistant") return;

  const findings = analyzeTextRisk(content);
  for (const f of findings) {
    await prisma.conversationRiskAnalysis.create({
      data: {
        conversationId,
        messageId,
        riskType: f.riskType,
        riskLevel: f.riskLevel,
        evidenceJson: JSON.stringify(f.evidence),
      },
    });
    if (f.riskType === "injection") {
      await prisma.conversationSecurityEvent.create({
        data: {
          conversationId,
          messageId,
          eventType: "prompt_injection",
          severity: "critica",
          pattern: String(f.evidence.pattern || ""),
        },
      });
    }
  }

  if (findings.length) {
    const level = maxRiskLevel(findings);
    await prisma.conversationMetrics.updateMany({
      where: { conversationId },
      data: { riskLevel: level },
    });
  }

  embedMessage(messageId, conversationId, content).catch(() => undefined);
}
