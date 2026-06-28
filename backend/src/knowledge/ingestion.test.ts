import assert from "node:assert/strict";
import { pickDocumentText } from "./ingestion.js";

function testBlobPreferred() {
  const r = pickDocumentText("blob text", "cache", "preview", "k.txt");
  assert.equal(r.source, "blob");
  assert.equal(r.text, "blob text");
}

function testDbCacheWhenNoBlob() {
  const r = pickDocumentText(null, "cache full", "preview", "k.txt");
  assert.equal(r.source, "db_cache");
}

function testPreviewFallback() {
  const r = pickDocumentText(null, null, "preview only", "k.txt");
  assert.equal(r.source, "db_preview");
}

function testThrowsWhenEmpty() {
  assert.throws(() => pickDocumentText(null, null, null, "missing.txt"), /Arquivo não encontrado/);
}

testBlobPreferred();
testDbCacheWhenNoBlob();
testPreviewFallback();
testThrowsWhenEmpty();
console.log("ingestion.test.ts: ok");
