import { defineConfig, devices } from "@playwright/test";
import path from "path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const backendPort = process.env.E2E_BACKEND_PORT || "8010";
const backendUrl = `http://127.0.0.1:${backendPort}`;

const sharedEnv = {
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/legal_ai",
  API_SECRET: process.env.API_SECRET || "ci-test-api-secret",
  AUTH_SECRET: process.env.AUTH_SECRET || "ci-auth-secret-with-enough-length-32",
  AGENT_SERVICE_SECRET: process.env.AGENT_SERVICE_SECRET || "ci-agent-secret",
  CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY || "ci-encryption-key-32-characters!!",
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "ci-password",
  FRONTEND_URL: "http://localhost:3000",
  RUN_PRISMA_DB_PUSH: "false",
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CI
    ? [
        {
          command: "npm run start",
          cwd: path.join(__dirname, "../backend"),
          url: `${backendUrl}/api/v1/health`,
          timeout: 180_000,
          reuseExistingServer: false,
          env: { ...sharedEnv, PORT: backendPort },
        },
        {
          command: "npm run start",
          url: "http://127.0.0.1:3000/api/health",
          timeout: 180_000,
          reuseExistingServer: false,
          env: {
            ...sharedEnv,
            PORT: "3000",
            API_URL: backendUrl,
            AI_AGENT_URL: process.env.AI_AGENT_URL || "http://localhost:8100",
            NEXT_PUBLIC_APP_NAME: "Assistente de TI — TOTVS AI Lab",
          },
        },
      ]
    : undefined,
});
