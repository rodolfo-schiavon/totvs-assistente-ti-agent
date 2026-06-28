import assert from "node:assert/strict";
import { extractSnippet, messagePlainText } from "./text-search.js";

function testExtractSnippet() {
  const text = "Este contrato estabelece cláusulas de confidencialidade entre as partes.";
  const s = extractSnippet(text, "confidencialidade");
  assert.ok(s.includes("confidencialidade"));
  console.log("text-search.test ok");
}

function testMessagePlainText() {
  const raw = JSON.stringify({ type: "mixed_response", markdown: "# Título\nCorpo" });
  assert.ok(messagePlainText(raw).includes("Título"));
}

testExtractSnippet();
testMessagePlainText();
