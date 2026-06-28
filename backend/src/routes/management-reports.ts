import type { FastifyInstance } from "fastify";
import { requireManagement } from "../middleware/auth";
import { buildUsageReport } from "../services/usage-reports";

export async function managementReportsRoutes(app: FastifyInstance) {
  app.get("/api/v1/management/reports/usage", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const q = request.query as { days?: string };
    const days = Math.max(1, Math.min(365, parseInt(q.days || "30", 10) || 30));
    return buildUsageReport(days);
  });
}
