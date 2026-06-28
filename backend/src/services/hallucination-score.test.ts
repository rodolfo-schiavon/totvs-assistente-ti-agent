import assert from "node:assert/strict";
import { scoreHallucinationRisk } from "./hallucination-score.js";

function testHallucination() {
  const high = scoreHallucinationRisk({
    route: "documental",
    sources: [],
    markdown: "Resposta sem citação",
  });
  assert.ok(high.riskScore >= 40);

  const low = scoreHallucinationRisk({
    route: "documental",
    sources: ["knowledge", "hybrid"],
    markdown: "Conforme [Doc: contrato.pdf]",
    dataLimitations: "Base parcial",
  });
  assert.ok(low.riskScore < high.riskScore);
  console.log("hallucination-score.test ok");
}

testHallucination();
