import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { apiAuth } from "./middleware/auth";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { usersRoutes } from "./routes/users";
import { llmAdminRoutes } from "./routes/llm-admin";
import { internalRoutes } from "./routes/internal";
import { agentAuditRoutes } from "./routes/agent-audit";
import { agentConversationRoutes } from "./routes/agent-conversations";
import { knowledgeRoutes, agentAttachmentRoutes } from "./routes/knowledge";
import { platformRoutes } from "./routes/platform";
import { managementReportsRoutes } from "./routes/management-reports";
import { consentRoutes } from "./routes/consent";
import { conversationIntelligenceRoutes } from "./routes/conversation-intelligence";
import { governanceIngestRoutes, governanceRoutes } from "./routes/governance";
import { ensureIncrementalSchema } from "./schema-sync";
import { ensureStorageReady } from "./knowledge/storage";
import {
  healKnowledgeDocuments,
  quarantineRefusalDocuments,
  requeueStalePendingDocuments,
  syncPendingVfsDocuments,
} from "./knowledge/ingestion";
import { hydrateOpenAiRuntimeEnv } from "./services/openai-config";
import { migrateLowMaxTokens, migrateRetiredLlmModels, DEFAULT_CHAT_MAX_TOKENS } from "./services/llm-config";
import { purgePreBaselineCostRollups } from "./services/usage-baseline";
import { startConversationIntelligenceScheduler } from "./jobs/conversation-metrics-rollup";
import { startGovernanceAggregateScheduler } from "./jobs/governance-aggregate";
import { resolveCorsOrigins } from "./utils/cors-origins";

const port = Number(process.env.PORT || 8000);

const execAsync = promisify(exec);

async function runStartup() {
  try {
    if (process.env.RUN_PRISMA_DB_PUSH === "true") {
      const acceptLoss = process.env.PRISMA_ACCEPT_DATA_LOSS === "true";
      const pushCmd = acceptLoss
        ? "npx prisma db push --skip-generate --accept-data-loss"
        : "npx prisma db push --skip-generate";
      await execAsync(pushCmd);
    }
    await ensureIncrementalSchema();
    await ensureStorageReady();
    await execAsync("npm run seed");
    const migratedModels = await migrateRetiredLlmModels();
    if (migratedModels > 0) {
      console.log(`Migrated ${migratedModels} retired LLM model(s) to active replacements`);
    }
    const migratedTokens = await migrateLowMaxTokens();
    if (migratedTokens > 0) {
      console.log(`Migrated ${migratedTokens} Anthropic config(s) to maxTokens=${DEFAULT_CHAT_MAX_TOKENS}`);
    }
    const purgedRollups = await purgePreBaselineCostRollups();
    if (purgedRollups > 0) {
      console.log(`Token usage baseline: removed ${purgedRollups} pre-baseline cost rollup row(s)`);
    }
    await hydrateOpenAiRuntimeEnv();
    await requeueStalePendingDocuments();
    const quarantined = await quarantineRefusalDocuments();
    const healed = await healKnowledgeDocuments();
    await syncPendingVfsDocuments();
    if (quarantined > 0 || healed > 0) {
      const { notifyVfsSync } = await import("./knowledge/vfs-notify");
      await notifyVfsSync();
    }
  } catch (e) {
    console.error("Schema sync / seed failed:", e);
    throw e;
  }
}

async function main() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    bodyLimit: 25 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  app.addHook("onRequest", apiAuth);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(llmAdminRoutes);
  await app.register(internalRoutes);
  await app.register(governanceIngestRoutes);
  await app.register(agentAuditRoutes);
  await app.register(agentConversationRoutes);
  await app.register(knowledgeRoutes);
  await app.register(agentAttachmentRoutes);
  await app.register(platformRoutes);
  await app.register(managementReportsRoutes);
  await app.register(consentRoutes);
  await app.register(governanceRoutes);
  await app.register(conversationIntelligenceRoutes);

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API listening on ${port}`);

  runStartup()
    .then(() => {
      startGovernanceAggregateScheduler();
      startConversationIntelligenceScheduler();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
