import assert from "node:assert/strict";
import {
  parseOpenAiPdfText,
  parseOpenAiResponsesText,
  looksLikeExtractionRefusal,
  resolvePdfVisionModel,
  pdfRawBytesSuggestImages,
} from "./openai-pdf.js";
import { assertAllowedProvider, normalizeProvider } from "../services/llm-config.js";

function testParseOpenAiPdfText() {
  const text = parseOpenAiPdfText({
    choices: [{ message: { content: "Texto extraído do PDF." }, finish_reason: "stop" }],
  });
  assert.equal(text, "Texto extraído do PDF.");
}

function testParseOpenAiTruncationWarning() {
  const text = parseOpenAiPdfText({
    choices: [{ message: { content: "Parcial" }, finish_reason: "length" }],
  });
  assert.match(text, /truncada pelo limite de tokens/);
}

function testParseOpenAiError() {
  assert.throws(() => parseOpenAiPdfText({ error: { message: "invalid" } }), /OpenAI: invalid/);
}

function testAllowedProviders() {
  assert.equal(assertAllowedProvider("openai"), "openai");
  assert.equal(assertAllowedProvider("anthropic"), "anthropic");
  assert.throws(() => assertAllowedProvider("google"), /não é mais suportado/);
  assert.throws(() => assertAllowedProvider("gemini"), /não é mais suportado/);
  assert.equal(normalizeProvider(" OpenAI "), "openai");
}

function testParseOpenAiResponsesText() {
  const fromOutputText = parseOpenAiResponsesText({ output_text: "Texto via Responses API." });
  assert.equal(fromOutputText, "Texto via Responses API.");
  const fromBlocks = parseOpenAiResponsesText({
    output: [{ content: [{ type: "output_text", text: "Bloco 1" }, { text: "Bloco 2" }] }],
  });
  assert.equal(fromBlocks, "Bloco 1\n\nBloco 2");
  const fromMessage = parseOpenAiResponsesText({
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Conteúdo do PDF" }],
      },
    ],
  });
  assert.equal(fromMessage, "Conteúdo do PDF");
}

function testResolvePdfVisionModel() {
  assert.equal(resolvePdfVisionModel("gpt-4o-mini"), "gpt-4o-mini");
  assert.equal(resolvePdfVisionModel("claude-3-5-sonnet"), "gpt-4o-mini");
}

function testPdfImageHeuristic() {
  const withImage = Buffer.from("%PDF-1.4\n<< /Subtype /Image /Filter /DCTDecode >>", "latin1");
  assert.equal(pdfRawBytesSuggestImages(withImage), true);
  const textOnly = Buffer.from("%PDF-1.4\n<< /Type /Catalog /Pages 2 0 R >>", "latin1");
  assert.equal(pdfRawBytesSuggestImages(textOnly), false);
}

function testRefusalDetection() {
  assert.equal(
    looksLikeExtractionRefusal("Não consigo acessar ou analisar arquivos diretamente."),
    true
  );
  assert.equal(
    looksLikeExtractionRefusal(
      "Não posso acessar ou processar arquivos diretamente. No entanto, posso ajudar com perguntas, resumos ou elaboração de conteúdo baseado nas informações que você fornece. Se puder compartilhar o texto ou as seções que deseja analisar, ficarei feliz em ajudar!"
    ),
    true
  );
  assert.equal(
    looksLikeExtractionRefusal("Desculpe, mas não posso processar ou transcrever arquivos."),
    true
  );
  assert.equal(looksLikeExtractionRefusal("Desculpe, não posso ajudar com isso."), true);
  assert.equal(
    looksLikeExtractionRefusal(
      "## Páginas 1-2\n\nDesculpe, não posso ajudar com isso.\n\n## Páginas 3-4\n\n# Introdução ao estudo"
    ),
    true
  );
  assert.equal(looksLikeExtractionRefusal("# Capítulo 1\nConteúdo real do documento."), false);
}

testParseOpenAiPdfText();
testParseOpenAiTruncationWarning();
testParseOpenAiError();
testParseOpenAiResponsesText();
testResolvePdfVisionModel();
testPdfImageHeuristic();
testRefusalDetection();
testAllowedProviders();
console.log("openai-pdf.test.ts: ok");
