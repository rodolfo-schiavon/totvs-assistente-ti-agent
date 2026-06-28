import assert from "node:assert/strict";
import { classifyPrompt, detectPiiFlag, hashPrompt } from "./prompt-classifier.js";

function testClassifier() {
  assert.equal(classifyPrompt("Revisar cláusula do contrato de locação", "geral"), "Contratos");
  assert.equal(classifyPrompt("Qual a jurisprudência do STJ?", null), "Pesquisa Jurídica");
  assert.equal(detectPiiFlag("CPF 123.456.789-00"), true);
  assert.equal(hashPrompt("abc"), hashPrompt("abc"));
  console.log("prompt-classifier.test ok");
}

testClassifier();
