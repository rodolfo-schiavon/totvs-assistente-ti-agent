import type { Prisma } from "@prisma/client";
import { periodToSince } from "./governance-period";

export type ConversationListQuery = {
  page?: string;
  limit?: string;
  sort?: string;
  order?: string;
  period?: string;
  from?: string;
  to?: string;
  userId?: string;
  department?: string;
  userRole?: string;
  tenantId?: string;
  model?: string;
  status?: string;
  ragUsed?: string;
  negativeFeedback?: string;
  q?: string;
};

export function parseListQuery(q: ConversationListQuery) {
  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit || 20)));
  const skip = (page - 1) * limit;
  const sort = q.sort || "lastActivityAt";
  const order = q.order === "asc" ? "asc" : "desc";

  const from = q.from ? new Date(q.from) : periodToSince(q.period || "30d");
  const to = q.to ? new Date(q.to) : new Date();

  const where: Prisma.ConversationMetricsWhereInput = {
    lastActivityAt: { gte: from, lte: to },
  };

  if (q.userId) where.userId = q.userId;
  if (q.department) where.department = q.department;
  if (q.userRole) where.userRole = q.userRole;
  if (q.tenantId) where.tenantId = q.tenantId;
  if (q.model) where.primaryModel = { contains: q.model, mode: "insensitive" };
  if (q.status) where.status = q.status;
  if (q.ragUsed === "true") where.ragUsed = true;
  if (q.ragUsed === "false") where.ragUsed = false;
  if (q.negativeFeedback === "true") where.negativeFeedback = true;

  if (q.q && q.q.trim().length >= 2) {
    where.OR = [
      { title: { contains: q.q.trim(), mode: "insensitive" } },
      { searchText: { contains: q.q.trim(), mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.ConversationMetricsOrderByWithRelationInput = {
    [sort]: order,
  } as Prisma.ConversationMetricsOrderByWithRelationInput;

  return { page, limit, skip, where, orderBy, from, to };
}
