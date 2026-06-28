import assert from "node:assert/strict";

process.env.FRONTEND_URL = "https://ia-dma.zerotouch.tec.br";
process.env.ALLOWED_ORIGINS = "https://www.zerotouch.tec.br";

import { resolveCorsOrigins } from "./cors-origins.js";

function testCors() {
  const origins = resolveCorsOrigins();
  assert.ok(origins.includes("https://ia-dma.zerotouch.tec.br"));
  assert.ok(origins.includes("https://www.zerotouch.tec.br"));
  assert.ok(origins.includes("http://localhost:3000"));
  console.log("cors-origins.test ok");
}

testCors();
