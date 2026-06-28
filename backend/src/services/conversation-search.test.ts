import assert from "node:assert/strict";

function buildFtsQuery(q: string): string {
  const terms = q.trim().split(/\s+/).filter(Boolean);
  return terms.map((t) => `${t}:*`).join(" & ");
}

function testSearchHelpers() {
  assert.equal(buildFtsQuery("contrato rescisão"), "contrato:* & rescisão:*");
  assert.equal(buildFtsQuery("  "), "");
  console.log("conversation-search.test ok");
}

testSearchHelpers();
