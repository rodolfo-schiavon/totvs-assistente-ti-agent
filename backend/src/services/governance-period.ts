import { applyUsageBaseline } from "./usage-baseline";

export type GovernancePeriod = "7d" | "30d" | "90d" | "12m";

export function periodToSince(period: string): Date {
  const since = new Date();
  switch (period) {
    case "7d":
      since.setDate(since.getDate() - 7);
      break;
    case "90d":
      since.setDate(since.getDate() - 90);
      break;
    case "12m":
      since.setFullYear(since.getFullYear() - 1);
      break;
    case "30d":
    default:
      since.setDate(since.getDate() - 30);
      break;
  }
  return applyUsageBaseline(since);
}

export function parsePagination(query: {
  page?: string;
  limit?: string;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
}

export function parseDateRange(query: {
  from?: string;
  to?: string;
  period?: string;
}): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : periodToSince(query.period || "30d");
  return { from: applyUsageBaseline(from), to };
}
