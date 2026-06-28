import type { FastifyInstance } from "fastify";
import { platformInsights } from "../services/platform-insights";

export async function platformRoutes(app: FastifyInstance) {
  app.get("/api/v1/platform/insights", async () => platformInsights());
}
