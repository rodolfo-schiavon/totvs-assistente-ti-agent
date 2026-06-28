import assert from "node:assert/strict";
import { parseUsageJson } from "./usage-reports.js";

function testParseUsageJson() {
  const u = parseUsageJson(
    JSON.stringify({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      estimated_cost_usd: 0.0025,
    })
  );
  assert.equal(u?.totalTokens, 150);
  assert.equal(u?.estimatedCostUsd, 0.0025);
  assert.equal(parseUsageJson(null), null);
  assert.equal(parseUsageJson("{}"), null);
  console.log("usage-reports.test ok");
}

testParseUsageJson();
