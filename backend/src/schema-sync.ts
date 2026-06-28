import { prisma } from "./db";

export async function ensureIncrementalSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AgentMessage" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "usageJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AgentMessage_conversationId_createdAt_idx"
    ON "AgentMessage"("conversationId", "createdAt");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AgentMessage_conversationId_fkey'
      ) THEN
        ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT 'Base organizacional',
      "description" TEXT,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "KnowledgeDocument" (
      "id" TEXT NOT NULL,
      "knowledgeBaseId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "storageKey" TEXT NOT NULL,
      "byteSize" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "error" TEXT,
      "uploadedBy" TEXT,
      "extractedPreview" TEXT,
      "extractedText" TEXT,
      "vfsSyncStatus" TEXT NOT NULL DEFAULT 'pending',
      "vfsSyncError" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeDocument" ADD COLUMN IF NOT EXISTS "extractedText" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeDocument" ADD COLUMN IF NOT EXISTS "vfsSyncStatus" TEXT NOT NULL DEFAULT 'pending';
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeDocument" ADD COLUMN IF NOT EXISTS "vfsSyncError" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "IngestionJob" (
      "id" TEXT NOT NULL,
      "documentId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "error" TEXT,
      "startedAt" TIMESTAMP(3),
      "finishedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AgentMessageAttachment" (
      "id" TEXT NOT NULL,
      "messageId" TEXT,
      "conversationId" TEXT,
      "uploadedByUserId" TEXT,
      "storageKey" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "byteSize" INTEGER NOT NULL DEFAULT 0,
      "extractedText" TEXT,
      "thumbnailKey" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AgentMessageAttachment_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "AgentMessageAttachment" ADD COLUMN IF NOT EXISTS "uploadedByUserId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AgentMessageAttachment_uploadedByUserId_idx"
    ON "AgentMessageAttachment"("uploadedByUserId");
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "AgentMessageAttachment" ADD COLUMN IF NOT EXISTS "extractionStatus" TEXT NOT NULL DEFAULT 'pending';
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "AgentMessageAttachment" ADD COLUMN IF NOT EXISTS "extractionError" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "AgentMessageAttachment"
    SET "extractionStatus" = 'ready'
    WHERE "extractedText" IS NOT NULL AND TRIM("extractedText") <> '' AND "extractionStatus" = 'pending';
  `);

  // RAG 3.0: remover tabelas pgvector legadas
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "DocumentChunkEmbedding" CASCADE;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "DocumentChunk" CASCADE;`);

  const kb = await prisma.knowledgeBase.findFirst();
  if (!kb) {
    await prisma.knowledgeBase.create({
      data: {
        name: "Base organizacional",
        description: "Documentos consultáveis pelo agente via VFS RAG 3.0.",
      },
    });
  }

  await migrateUserRolesEnum();

  const { ensureLlmProviderUniqueIndex } = await import("./services/llm-config");
  await ensureLlmProviderUniqueIndex();
  await ensureGovernanceSchema();
  await ensureConversationIntelligenceSchema();
}

async function ensureConversationIntelligenceSchema() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "department" TEXT;`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiNoticeDismissed" BOOLEAN NOT NULL DEFAULT false;`
  );
  await prisma.$executeRawUnsafe(`
    UPDATE "User" u SET "aiNoticeDismissed" = true
    WHERE EXISTS (SELECT 1 FROM "UserConsent" c WHERE c."userId" = u.id);
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AgentConversation" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AgentConversation" ADD COLUMN IF NOT EXISTS "clientIp" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AgentConversation" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AgentConversation" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'web';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AgentConversation" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationMetrics" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL DEFAULT 'default',
      "userId" TEXT NOT NULL,
      "title" TEXT,
      "department" TEXT,
      "userRole" TEXT,
      "messageCount" INTEGER NOT NULL DEFAULT 0,
      "inputTokens" INTEGER NOT NULL DEFAULT 0,
      "outputTokens" INTEGER NOT NULL DEFAULT 0,
      "totalTokens" INTEGER NOT NULL DEFAULT 0,
      "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "primaryModel" TEXT,
      "ragUsed" BOOLEAN NOT NULL DEFAULT false,
      "toolsUsed" BOOLEAN NOT NULL DEFAULT false,
      "documentsUsed" INTEGER NOT NULL DEFAULT 0,
      "negativeFeedback" BOOLEAN NOT NULL DEFAULT false,
      "avgFeedbackRating" DOUBLE PRECISION,
      "riskLevel" "RiskLevel" NOT NULL DEFAULT 'baixo',
      "durationMs" INTEGER,
      "status" TEXT NOT NULL DEFAULT 'active',
      "searchText" TEXT,
      "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ConversationMetrics_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ConversationMetrics_conversationId_key" ON "ConversationMetrics"("conversationId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConversationMetrics_lastActivityAt_idx" ON "ConversationMetrics"("lastActivityAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConversationMetrics_userId_lastActivityAt_idx" ON "ConversationMetrics"("userId", "lastActivityAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConversationMetrics_tenantId_lastActivityAt_idx" ON "ConversationMetrics"("tenantId", "lastActivityAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationAudit" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT,
      "actorUserId" TEXT,
      "action" TEXT NOT NULL,
      "detailsJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationAudit_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConversationAudit_conversationId_createdAt_idx" ON "ConversationAudit"("conversationId", "createdAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationExport" (
      "id" TEXT NOT NULL,
      "actorUserId" TEXT,
      "format" TEXT NOT NULL,
      "section" TEXT,
      "filtersJson" TEXT,
      "recordCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationExport_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationView" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "viewerUserId" TEXT NOT NULL,
      "viewerRole" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationView_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConversationView_conversationId_createdAt_idx" ON "ConversationView"("conversationId", "createdAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationSecurityEvent" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT,
      "messageId" TEXT,
      "eventType" TEXT NOT NULL,
      "severity" "GovernanceSeverity" NOT NULL DEFAULT 'media',
      "pattern" TEXT,
      "detailsJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationSecurityEvent_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationSearchHistory" (
      "id" TEXT NOT NULL,
      "actorUserId" TEXT,
      "query" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'hybrid',
      "filtersJson" TEXT,
      "resultCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationSearchHistory_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationRiskAnalysis" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT,
      "messageId" TEXT,
      "riskType" TEXT NOT NULL,
      "riskLevel" "RiskLevel" NOT NULL DEFAULT 'baixo',
      "evidenceJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationRiskAnalysis_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationCompliance" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "anonymized" BOOLEAN NOT NULL DEFAULT false,
      "masked" BOOLEAN NOT NULL DEFAULT false,
      "deletedAt" TIMESTAMP(3),
      "retentionDays" INTEGER,
      "notes" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationCompliance_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ConversationCompliance_conversationId_key" ON "ConversationCompliance"("conversationId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationMessageEmbedding" (
      "id" TEXT NOT NULL,
      "messageId" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
      "embedding" vector(1536),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationMessageEmbedding_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ConversationMessageEmbedding" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ConversationMessageEmbedding_messageId_key" ON "ConversationMessageEmbedding"("messageId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConversationMessageEmbedding_conversationId_idx" ON "ConversationMessageEmbedding"("conversationId");`);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ConversationMessageEmbedding_embedding_idx"
    ON "ConversationMessageEmbedding" USING hnsw ("embedding" vector_cosine_ops);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_conversation_daily AS
    SELECT
      date_trunc('day', "lastActivityAt") AS day,
      COUNT(*)::int AS conversations,
      COALESCE(SUM("messageCount"), 0)::int AS messages,
      COALESCE(SUM("totalTokens"), 0)::int AS tokens,
      COALESCE(SUM("estimatedCostUsd"), 0)::float AS cost_usd
    FROM "ConversationMetrics"
    WHERE "status" = 'active'
    GROUP BY 1;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS mv_conversation_daily_day_idx ON mv_conversation_daily (day);
  `);
}

async function ensureGovernanceSchema() {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "GovernanceSeverity" AS ENUM ('baixa', 'media', 'alta', 'critica');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "AlertStatus" AS ENUM ('open', 'ack', 'resolved');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "RiskLevel" AS ENUM ('baixo', 'medio', 'alto', 'critico');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LlmObservability" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "conversationId" TEXT,
      "messageId" TEXT,
      "model" TEXT,
      "provider" TEXT,
      "analysisType" TEXT,
      "route" TEXT,
      "inputTokens" INTEGER NOT NULL DEFAULT 0,
      "outputTokens" INTEGER NOT NULL DEFAULT 0,
      "totalTokens" INTEGER NOT NULL DEFAULT 0,
      "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "latencyMs" INTEGER,
      "status" TEXT NOT NULL DEFAULT 'success',
      "toolsJson" TEXT,
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LlmObservability_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmObservability_createdAt_idx" ON "LlmObservability"("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmObservability_userId_createdAt_idx" ON "LlmObservability"("userId", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmObservability_conversationId_idx" ON "LlmObservability"("conversationId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PromptAnalytics" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "conversationId" TEXT,
      "promptHash" TEXT NOT NULL,
      "promptNormalized" TEXT,
      "promptCategory" TEXT,
      "analysisType" TEXT,
      "containsPii" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PromptAnalytics_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptAnalytics_createdAt_idx" ON "PromptAnalytics"("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptAnalytics_userId_createdAt_idx" ON "PromptAnalytics"("userId", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptAnalytics_promptHash_idx" ON "PromptAnalytics"("promptHash");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptAnalytics_conversationId_idx" ON "PromptAnalytics"("conversationId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PromptSecurityEvent" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "conversationId" TEXT,
      "severity" "GovernanceSeverity" NOT NULL DEFAULT 'media',
      "pattern" TEXT,
      "blocked" BOOLEAN NOT NULL DEFAULT false,
      "promptSnippet" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PromptSecurityEvent_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptSecurityEvent_severity_createdAt_idx" ON "PromptSecurityEvent"("severity", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptSecurityEvent_userId_createdAt_idx" ON "PromptSecurityEvent"("userId", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptSecurityEvent_createdAt_idx" ON "PromptSecurityEvent"("createdAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PromptQualityScore" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "conversationId" TEXT,
      "observabilityId" TEXT,
      "score" INTEGER NOT NULL DEFAULT 0,
      "clarity" INTEGER,
      "context" INTEGER,
      "ragUsage" INTEGER,
      "toolUsage" INTEGER,
      "detailsJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PromptQualityScore_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PromptQualityScore_observabilityId_key" ON "PromptQualityScore"("observabilityId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptQualityScore_createdAt_idx" ON "PromptQualityScore"("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromptQualityScore_userId_createdAt_idx" ON "PromptQualityScore"("userId", "createdAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RagMetrics" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "conversationId" TEXT,
      "docsRetrieved" INTEGER NOT NULL DEFAULT 0,
      "chunksRetrieved" INTEGER NOT NULL DEFAULT 0,
      "avgSimilarity" DOUBLE PRECISION,
      "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
      "route" TEXT,
      "vfsFilesCount" INTEGER NOT NULL DEFAULT 0,
      "success" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RagMetrics_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RagMetrics_createdAt_idx" ON "RagMetrics"("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RagMetrics_userId_createdAt_idx" ON "RagMetrics"("userId", "createdAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HallucinationEvent" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "conversationId" TEXT,
      "riskScore" INTEGER NOT NULL DEFAULT 0,
      "riskLevel" "RiskLevel" NOT NULL DEFAULT 'baixo',
      "evidenceJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HallucinationEvent_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HallucinationEvent_createdAt_idx" ON "HallucinationEvent"("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HallucinationEvent_riskLevel_createdAt_idx" ON "HallucinationEvent"("riskLevel", "createdAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LlmCostMetric" (
      "id" TEXT NOT NULL,
      "metricDate" DATE NOT NULL,
      "metricKey" TEXT NOT NULL,
      "userId" TEXT,
      "userRole" TEXT,
      "model" TEXT,
      "inputTokens" INTEGER NOT NULL DEFAULT 0,
      "outputTokens" INTEGER NOT NULL DEFAULT 0,
      "totalTokens" INTEGER NOT NULL DEFAULT 0,
      "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "turnCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "LlmCostMetric_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LlmCostMetric_metricDate_metricKey_key" ON "LlmCostMetric"("metricDate", "metricKey");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmCostMetric_metricDate_metricKey_idx" ON "LlmCostMetric"("metricDate", "metricKey");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LlmFeedback" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "messageId" TEXT,
      "conversationId" TEXT,
      "rating" INTEGER,
      "thumbs" TEXT,
      "comment" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LlmFeedback_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmFeedback_createdAt_idx" ON "LlmFeedback"("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmFeedback_userId_createdAt_idx" ON "LlmFeedback"("userId", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmFeedback_conversationId_idx" ON "LlmFeedback"("conversationId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LlmAlert" (
      "id" TEXT NOT NULL,
      "alertType" TEXT NOT NULL,
      "severity" "GovernanceSeverity" NOT NULL DEFAULT 'media',
      "title" TEXT NOT NULL,
      "description" TEXT,
      "status" "AlertStatus" NOT NULL DEFAULT 'open',
      "metadataJson" TEXT,
      "acknowledgedAt" TIMESTAMP(3),
      "resolvedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "LlmAlert_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmAlert_status_createdAt_idx" ON "LlmAlert"("status", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmAlert_severity_createdAt_idx" ON "LlmAlert"("severity", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LlmAlert_createdAt_idx" ON "LlmAlert"("createdAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AiGovernanceMetric" (
      "id" TEXT NOT NULL,
      "period" TEXT NOT NULL,
      "metricKey" TEXT NOT NULL,
      "valueNumber" DOUBLE PRECISION,
      "valueJson" TEXT,
      "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AiGovernanceMetric_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "AiGovernanceMetric_period_metricKey_key" ON "AiGovernanceMetric"("period", "metricKey");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AiGovernanceMetric_period_metricKey_idx" ON "AiGovernanceMetric"("period", "metricKey");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LgpdRequest" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "requestType" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "notes" TEXT,
      "requestedBy" TEXT,
      "completedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "LgpdRequest_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LgpdRequest_createdAt_idx" ON "LgpdRequest"("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LgpdRequest_status_idx" ON "LgpdRequest"("status");`);

  await prisma.$executeRawUnsafe(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_governance_daily AS
    SELECT
      date_trunc('day', "createdAt") AS day,
      COUNT(*)::int AS turns,
      COALESCE(SUM("totalTokens"), 0)::int AS tokens,
      COALESCE(SUM("estimatedCostUsd"), 0)::float AS cost_usd,
      COUNT(*) FILTER (WHERE "status" = 'error')::int AS errors
    FROM "LlmObservability"
    GROUP BY 1;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS mv_governance_daily_day_idx ON mv_governance_daily (day);
  `);
}

/** Migra enum legado (lawyer, legal_assistant, readonly) para admin | advogado | gerencia. */
async function migrateUserRolesEnum() {
  const rows = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole'
  `);
  if (!rows.length) return;

  const labels = new Set(rows.map((r) => r.enumlabel));
  if (labels.has("advogado") && !labels.has("lawyer")) return;

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" RENAME TO "UserRole_old"`);
  await prisma.$executeRawUnsafe(
    `CREATE TYPE "UserRole" AS ENUM ('admin', 'advogado', 'gerencia')`
  );
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING (
      CASE "role"::text
        WHEN 'admin' THEN 'admin'
        WHEN 'lawyer' THEN 'advogado'
        WHEN 'legal_assistant' THEN 'gerencia'
        WHEN 'readonly' THEN 'gerencia'
        ELSE 'gerencia'
      END::"UserRole"
    )
  `);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'gerencia'`
  );
  await prisma.$executeRawUnsafe(`DROP TYPE "UserRole_old"`);
}
