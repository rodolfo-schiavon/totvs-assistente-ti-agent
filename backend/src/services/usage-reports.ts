import { prisma } from "../db";
import { applyUsageBaseline } from "./usage-baseline";

export type ParsedUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  model?: string;
  provider?: string;
};

export function parseUsageJson(raw: string | null | undefined): ParsedUsage | null {
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as Record<string, unknown>;
    const input = Number(u.input_tokens ?? 0);
    const output = Number(u.output_tokens ?? 0);
    const total = Number(u.total_tokens ?? input + output);
    const cost = Number(u.estimated_cost_usd ?? 0);
    if (!input && !output && !total && !cost) return null;
    return {
      inputTokens: input,
      outputTokens: output,
      totalTokens: total || input + output,
      estimatedCostUsd: cost,
      model: typeof u.model === "string" ? u.model : undefined,
      provider: typeof u.provider === "string" ? u.provider : undefined,
    };
  } catch {
    return null;
  }
}

function emptyUsage(): ParsedUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
}

function addUsage(a: ParsedUsage, b: ParsedUsage): ParsedUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    estimatedCostUsd: Math.round((a.estimatedCostUsd + b.estimatedCostUsd) * 1_000_000) / 1_000_000,
    model: b.model || a.model,
    provider: b.provider || a.provider,
  };
}

export async function buildUsageReport(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, Math.min(days, 365)));
  const effectiveSince = applyUsageBaseline(since);

  const messages = await prisma.agentMessage.findMany({
    where: {
      role: "assistant",
      createdAt: { gte: effectiveSince },
      usageJson: { not: null },
    },
    select: {
      conversationId: true,
      usageJson: true,
      createdAt: true,
      conversation: {
        select: {
          id: true,
          title: true,
          userId: true,
          updatedAt: true,
          user: { select: { id: true, username: true, role: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const byUserMap = new Map<
    string,
    {
      userId: string;
      username: string;
      role: string;
      assistantMessages: number;
      usage: ParsedUsage;
      conversationIds: Set<string>;
    }
  >();

  const byConvMap = new Map<
    string,
    {
      conversationId: string;
      title: string;
      userId: string;
      username: string;
      role: string;
      assistantMessages: number;
      usage: ParsedUsage;
      lastActivityAt: Date;
    }
  >();

  let summary = emptyUsage();
  let assistantMessages = 0;

  for (const msg of messages) {
    const usage = parseUsageJson(msg.usageJson);
    if (!usage) continue;
    assistantMessages += 1;
    summary = addUsage(summary, usage);

    const conv = msg.conversation;
    if (!conv?.user) continue;

    const uid = conv.user.id;
    let userRow = byUserMap.get(uid);
    if (!userRow) {
      userRow = {
        userId: uid,
        username: conv.user.username,
        role: conv.user.role,
        assistantMessages: 0,
        usage: emptyUsage(),
        conversationIds: new Set(),
      };
      byUserMap.set(uid, userRow);
    }
    userRow.assistantMessages += 1;
    userRow.usage = addUsage(userRow.usage, usage);
    userRow.conversationIds.add(conv.id);

    let convRow = byConvMap.get(conv.id);
    if (!convRow) {
      convRow = {
        conversationId: conv.id,
        title: conv.title || "Nova conversa",
        userId: uid,
        username: conv.user.username,
        role: conv.user.role,
        assistantMessages: 0,
        usage: emptyUsage(),
        lastActivityAt: msg.createdAt,
      };
      byConvMap.set(conv.id, convRow);
    }
    convRow.assistantMessages += 1;
    convRow.usage = addUsage(convRow.usage, usage);
    if (msg.createdAt > convRow.lastActivityAt) convRow.lastActivityAt = msg.createdAt;
  }

  const byUser = [...byUserMap.values()]
    .map((u) => ({
      userId: u.userId,
      username: u.username,
      role: u.role,
      conversations: u.conversationIds.size,
      assistantMessages: u.assistantMessages,
      inputTokens: u.usage.inputTokens,
      outputTokens: u.usage.outputTokens,
      totalTokens: u.usage.totalTokens,
      estimatedCostUsd: u.usage.estimatedCostUsd,
    }))
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd || b.totalTokens - a.totalTokens);

  const byConversation = [...byConvMap.values()]
    .map((c) => ({
      conversationId: c.conversationId,
      title: c.title,
      userId: c.userId,
      username: c.username,
      role: c.role,
      assistantMessages: c.assistantMessages,
      inputTokens: c.usage.inputTokens,
      outputTokens: c.usage.outputTokens,
      totalTokens: c.usage.totalTokens,
      estimatedCostUsd: c.usage.estimatedCostUsd,
      lastActivityAt: c.lastActivityAt.toISOString(),
    }))
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd || b.totalTokens - a.totalTokens);

  return {
    periodDays: days,
    since: effectiveSince.toISOString(),
    summary: {
      assistantMessages,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      totalTokens: summary.totalTokens,
      estimatedCostUsd: summary.estimatedCostUsd,
      activeUsers: byUser.length,
      activeConversations: byConversation.length,
    },
    byUser,
    byConversation,
  };
}

export async function buildUserUsageSummary(userId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, Math.min(days, 365)));
  const effectiveSince = applyUsageBaseline(since);

  const messages = await prisma.agentMessage.findMany({
    where: {
      role: "assistant",
      createdAt: { gte: effectiveSince },
      usageJson: { not: null },
      conversation: { userId },
    },
    select: { usageJson: true, conversationId: true },
  });

  let usage = emptyUsage();
  const convIds = new Set<string>();
  for (const msg of messages) {
    const parsed = parseUsageJson(msg.usageJson);
    if (!parsed) continue;
    usage = addUsage(usage, parsed);
    convIds.add(msg.conversationId);
  }

  const [conversations, userMessages] = await Promise.all([
    prisma.agentConversation.count({ where: { userId } }),
    prisma.agentMessage.count({
      where: { role: "user", conversation: { userId }, createdAt: { gte: effectiveSince } },
    }),
  ]);

  return {
    conversations,
    conversationsInPeriod: convIds.size,
    userMessagesInPeriod: userMessages,
    assistantMessagesInPeriod: messages.length,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
  };
}
