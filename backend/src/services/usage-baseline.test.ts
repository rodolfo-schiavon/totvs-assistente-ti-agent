import assert from "node:assert/strict";
import { applyUsageBaseline, getTokenUsageBaselineAt } from "./usage-baseline.js";

function testUnsetBaseline() {
  delete process.env.TOKEN_USAGE_BASELINE_AT;
  assert.equal(getTokenUsageBaselineAt(), null);
  const since = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(applyUsageBaseline(since).toISOString(), since.toISOString());
}

function testDateOnlyBaseline() {
  process.env.TOKEN_USAGE_BASELINE_AT = "2026-06-18";
  assert.equal(getTokenUsageBaselineAt()?.toISOString(), "2026-06-18T03:00:00.000Z");
  const since = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(applyUsageBaseline(since).toISOString(), "2026-06-18T03:00:00.000Z");
  delete process.env.TOKEN_USAGE_BASELINE_AT;
}

testUnsetBaseline();
testDateOnlyBaseline();
console.log("usage-baseline.test.ts OK");
