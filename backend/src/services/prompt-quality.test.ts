import assert from "node:assert/strict";
import { scorePromptQuality } from "./prompt-quality.js";

function testQuality() {
  const q = scorePromptQuality({
    prompt: "Analise o contrato de prestação de serviços considerando cláusula de rescisão.",
    analysisType: "contrato",
    route: "hybrid",
    sources: ["knowledge"],
    toolsCalled: ["search"],
  });
  assert.ok(q.score >= 50);
  assert.ok(q.clarity >= 40);
  console.log("prompt-quality.test ok");
}

testQuality();
