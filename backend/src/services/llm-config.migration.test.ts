import assert from "node:assert/strict";

/** Espelho de RETIRED_MODEL_MAP — evita importar Prisma neste smoke test. */
const RETIRED_MODEL_MAP: Record<string, string> = {
  "claude-3-5-haiku-20241022": "claude-haiku-4-5-20251001",
  "claude-3-5-sonnet-20241022": "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-20250514": "claude-sonnet-4-5-20250929",
  "claude-3-haiku-20240307": "claude-haiku-4-5-20251001",
};

assert.equal(
  RETIRED_MODEL_MAP["claude-3-5-haiku-20241022"],
  "claude-haiku-4-5-20251001"
);
assert.equal(
  RETIRED_MODEL_MAP["claude-sonnet-4-20250514"],
  "claude-sonnet-4-5-20250929"
);

console.log("llm-config migration map OK");
