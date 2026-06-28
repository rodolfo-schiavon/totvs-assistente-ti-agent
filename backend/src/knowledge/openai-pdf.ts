import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import pdf from "pdf-parse";
import { resolveOpenAiConfig } from "../services/openai-config";

const execFileAsync = promisify(execFile);

/** Limite inline PDF (bytes) — alinhado ao multipart do servidor. */
export const MAX_INLINE_PDF_BYTES = 25 * 1024 * 1024;

const PDF_VISION_MODELS = new Set(["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"]);

/** Operadores pdf.js que pintam imagens raster no page stream. */
const PDFJS_IMAGE_OPS = new Set([
  "paintImageXObject",
  "paintImageXObjectRepeat",
  "paintJpegXObject",
  "paintInlineImageXObject",
  "paintInlineImageXObjectGroup",
]);

type PdfJsModule = {
  getDocument: (params: Record<string, unknown>) => { promise: Promise<PdfJsDocument> };
  OPS: Record<string, number>;
};

type PdfJsDocument = {
  numPages: number;
  getPage: (n: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
};

type PdfJsPage = {
  getOperatorList: () => Promise<{ fnArray: number[] }>;
};

let pdfJsModule: PdfJsModule | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsModule) {
    pdfJsModule = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModule;
  }
  return pdfJsModule;
}

/** Heurística rápida no binário — complementa pdf.js (evita falso negativo em PDFs comprimidos). */
export function pdfRawBytesSuggestImages(buffer: Buffer): boolean {
  const raw = buffer.toString("latin1");
  if (/\/Subtype\s*\/Image\b/.test(raw)) return true;
  if (/\/Subtype\/Image\b/.test(raw)) return true;
  if (/\/Filter\s*\/DCTDecode\b/.test(raw)) return true;
  if (/\/Filter\s*\/JPXDecode\b/.test(raw)) return true;
  if (/\/Filter\s*\/CCITTFaxDecode\b/.test(raw)) return true;
  if (/\/Filter\s*\/JBIG2Decode\b/.test(raw)) return true;
  return false;
}

/**
 * Detecta imagens embutidas no PDF via operator list do pdf.js.
 * Qualquer imagem encontrada → extração deve passar pela OpenAI (OCR/visão).
 */
export async function pdfContainsEmbeddedImages(buffer: Buffer): Promise<boolean> {
  if (pdfRawBytesSuggestImages(buffer)) return true;

  try {
    const pdfjs = await loadPdfJs();
    const imageOpIds = new Set<number>();
    for (const name of PDFJS_IMAGE_OPS) {
      const id = pdfjs.OPS[name];
      if (typeof id === "number") imageOpIds.add(id);
    }

    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
    }).promise;

    try {
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const ops = await page.getOperatorList();
        for (const fn of ops.fnArray) {
          if (imageOpIds.has(fn)) return true;
        }
      }
      return false;
    } finally {
      await doc.destroy();
    }
  } catch (err) {
    console.warn("pdfContainsEmbeddedImages: falha ao analisar PDF, assumindo imagens presentes:", err);
    return true;
  }
}

export const PDF_EXTRACTION_PROMPT = `TAREFA: transcrever integralmente o PDF anexado para indexação (RAG).

Devolva TODO o conteúdo útil:
- Texto digitado e texto em imagens (OCR)
- Tabelas (markdown simples)
- Legendas, rodapés, títulos, listas

PROIBIDO:
- Dizer que não pode acessar, ler ou processar arquivos
- Pedir ao usuário para enviar o texto ou o PDF
- Responder de forma conversacional ou com ofertas de ajuda genéricas

Saída: somente o texto extraído do documento (markdown leve permitido).`;

const REFUSAL_PATTERNS = [
  /não\s+(consigo|posso)\s+(acessar|processar|ler|analisar|abrir)/i,
  /não\s+tenho\s+acesso/i,
  /no\s+entanto,?\s+posso\s+ajudar/i,
  /se\s+puder\s+compartilhar\s+o\s+texto/i,
  /compartilhe\s+o\s+texto/i,
  /ficarei\s+feliz\s+em\s+ajudar/i,
  /based\s+on\s+the\s+information\s+you\s+provide/i,
  /please\s+provide\s+the\s+(text|content|file|pdf)/i,
  /forneça\s+o\s+(texto|conteúdo|arquivo|pdf)/i,
  /unable\s+to\s+(access|read|process|open)/i,
  /i\s+(can't|cannot)\s+(access|read|process|open)/i,
  /as\s+an\s+ai,?\s+i\s+cannot/i,
  /como\s+assistente,?\s+não\s+posso/i,
  /desculpe,?\s+mas\s+não\s+posso/i,
  /desculpe,?\s+não\s+posso/i,
  /não\s+posso\s+ajudar/i,
  /não\s+posso\s+processar\s+ou\s+transcrever/i,
  /sorry,?\s+i\s+can'?t\s+help/i,
];

type OpenAiChatResponse = {
  choices?: {
    message?: { content?: string | { type?: string; text?: string }[] };
    finish_reason?: string;
  }[];
  error?: { message?: string };
};

type OpenAiResponsesOutputBlock = {
  type?: string;
  role?: string;
  text?: string;
  content?: { type?: string; text?: string }[];
};

type OpenAiResponsesResponse = {
  output?: OpenAiResponsesOutputBlock[];
  output_text?: string;
  error?: { message?: string };
};

type OpenAiFileResponse = {
  id?: string;
  status?: string;
  error?: { message?: string };
};

export function parseOpenAiPdfText(data: OpenAiChatResponse): string {
  if (data.error?.message) {
    throw new Error(`OpenAI: ${data.error.message}`);
  }
  const raw = data.choices?.[0]?.message?.content;
  let content = "";
  if (typeof raw === "string") {
    content = raw.trim();
  } else if (Array.isArray(raw)) {
    content = raw
      .map((part) => (typeof part === "string" ? part : part.text || ""))
      .join("\n")
      .trim();
  }
  let text = content;
  const finish = data.choices?.[0]?.finish_reason;
  if (finish === "length" && text) {
    text +=
      "\n\n[AVISO: extração truncada pelo limite de tokens do modelo — considere dividir o PDF ou aumentar OPENAI_PDF_MAX_OUTPUT_TOKENS.]";
  }
  return text;
}

export function parseOpenAiResponsesText(data: OpenAiResponsesResponse): string {
  if (data.error?.message) {
    throw new Error(`OpenAI: ${data.error.message}`);
  }
  if (data.output_text?.trim()) return data.output_text.trim();

  const parts: string[] = [];
  const push = (value?: string | null) => {
    const t = value?.trim();
    if (t) parts.push(t);
  };

  for (const block of data.output || []) {
    push(block.text);
    for (const c of block.content || []) {
      push(c.text);
    }
  }

  return parts.join("\n\n").trim();
}

function pdfMaxOutputTokens(configured: number): number {
  const floor = parseInt(process.env.OPENAI_PDF_MAX_OUTPUT_TOKENS_MIN || "16384", 10);
  const cap = parseInt(process.env.OPENAI_PDF_MAX_OUTPUT_TOKENS || "32768", 10);
  const base = Number.isFinite(configured) && configured > 0 ? configured : floor;
  return Math.min(Math.max(base, floor), cap);
}

function lineLooksLikeRefusal(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 400) return false;
  return REFUSAL_PATTERNS.some((re) => re.test(t));
}

/** Detecta recusa do modelo no texto inteiro ou em linhas curtas (OCR parcial). */
export function looksLikeExtractionRefusal(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (t.length <= 500 && REFUSAL_PATTERNS.some((re) => re.test(t))) return true;

  for (const line of t.split(/\n+/)) {
    if (lineLooksLikeRefusal(line)) return true;
  }

  const sample = t.length <= 4000 ? t : `${t.slice(0, 800)}\n${t.slice(-600)}`;
  return REFUSAL_PATTERNS.some((re) => re.test(sample));
}

export function assertUsableExtractedText(text: string, context = "documento"): void {
  const t = text.trim();
  if (!t) {
    throw new Error(`Não foi possível extrair texto do ${context}.`);
  }
  if (looksLikeExtractionRefusal(t)) {
    throw new Error(
      `Extração do ${context} retornou recusa do modelo em vez do conteúdo do PDF. ` +
        "Verifique a chave e o modelo OpenAI (gpt-4o-mini) e reindexe."
    );
  }
}

export function resolvePdfVisionModel(configuredModel: string): string {
  const fromEnv = process.env.OPENAI_PDF_MODEL?.trim();
  if (fromEnv) return fromEnv;
  const m = configuredModel.trim().toLowerCase();
  for (const allowed of PDF_VISION_MODELS) {
    if (m === allowed || m.startsWith(allowed)) return configuredModel.trim();
  }
  return "gpt-4o-mini";
}

export async function extractPdfTextLocally(buffer: Buffer): Promise<string> {
  try {
    const parsed = await pdf(buffer);
    return parsed.text?.replace(/\s+\n/g, "\n").trim() || "";
  } catch {
    return "";
  }
}

async function uploadPdfFile(
  apiKey: string,
  buffer: Buffer,
  fileName: string,
  purpose: "assistants" | "user_data" = "user_data"
): Promise<string> {
  const form = new FormData();
  const bytes = Uint8Array.from(buffer);
  const blob = new Blob([bytes], { type: "application/pdf" });
  form.append("file", blob, fileName);
  form.append("purpose", purpose);

  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(parseInt(process.env.OPENAI_PDF_TIMEOUT_MS || "180000", 10)),
  });

  const raw = (await res.json()) as OpenAiFileResponse;
  if (!res.ok || !raw.id) {
    const msg = raw.error?.message || `HTTP ${res.status}`;
    throw new Error(`Falha ao enviar PDF para OpenAI Files API: ${msg}`);
  }
  return raw.id;
}

async function waitForFileProcessed(apiKey: string, fileId: string): Promise<void> {
  const timeoutMs = parseInt(process.env.OPENAI_PDF_TIMEOUT_MS || "180000", 10);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const raw = (await res.json()) as OpenAiFileResponse;
    if (!res.ok) {
      throw new Error(raw.error?.message || `HTTP ${res.status} ao consultar arquivo OpenAI`);
    }
    if (raw.status === "processed") return;
    if (raw.status === "error") {
      throw new Error("OpenAI não conseguiu processar o PDF (status error).");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timeout aguardando processamento do PDF na OpenAI.");
}

async function deletePdfFile(apiKey: string, fileId: string): Promise<void> {
  try {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    /* best effort */
  }
}

async function extractWithBase64Responses(
  apiKey: string,
  model: string,
  buffer: Buffer,
  fileName: string,
  maxOutputTokens: number
): Promise<string> {
  const b64 = buffer.toString("base64");
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(parseInt(process.env.OPENAI_PDF_TIMEOUT_MS || "180000", 10)),
    body: JSON.stringify({
      model,
      max_output_tokens: maxOutputTokens,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: PDF_EXTRACTION_PROMPT },
            {
              type: "input_file",
              filename: fileName,
              file_data: `data:application/pdf;base64,${b64}`,
            },
            { type: "input_text", text: `Nome do arquivo: ${fileName}` },
          ],
        },
      ],
    }),
  });

  const raw = (await res.json()) as OpenAiResponsesResponse;
  if (!res.ok) {
    const msg = raw.error?.message || `HTTP ${res.status}`;
    throw new Error(`Falha na extração OpenAI (Responses base64): ${msg}`);
  }
  const text = parseOpenAiResponsesText(raw);
  if (!text) {
    throw new Error("OpenAI (Responses base64) retornou resposta vazia.");
  }
  return text;
}

async function extractWithResponsesApi(
  apiKey: string,
  model: string,
  fileId: string,
  fileName: string,
  maxOutputTokens: number
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(parseInt(process.env.OPENAI_PDF_TIMEOUT_MS || "180000", 10)),
    body: JSON.stringify({
      model,
      max_output_tokens: maxOutputTokens,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: PDF_EXTRACTION_PROMPT },
            { type: "input_file", file_id: fileId },
            { type: "input_text", text: `Nome do arquivo: ${fileName}` },
          ],
        },
      ],
    }),
  });

  const raw = (await res.json()) as OpenAiResponsesResponse;
  if (!res.ok) {
    const msg = raw.error?.message || `HTTP ${res.status}`;
    throw new Error(`Falha na extração OpenAI (Responses API): ${msg}`);
  }
  const text = parseOpenAiResponsesText(raw);
  if (!text) {
    throw new Error("OpenAI (Responses file_id) retornou resposta vazia.");
  }
  return text;
}

async function extractWithChatCompletions(
  apiKey: string,
  model: string,
  fileId: string,
  fileName: string,
  maxOutputTokens: number
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(parseInt(process.env.OPENAI_PDF_TIMEOUT_MS || "180000", 10)),
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: maxOutputTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PDF_EXTRACTION_PROMPT },
            { type: "file", file: { file_id: fileId } },
            { type: "text", text: `Nome do arquivo: ${fileName}` },
          ],
        },
      ],
    }),
  });

  const raw = (await res.json()) as OpenAiChatResponse;
  if (!res.ok) {
    const msg = raw.error?.message || `HTTP ${res.status}`;
    throw new Error(`Falha na extração OpenAI (Chat): ${msg}`);
  }
  const text = parseOpenAiPdfText(raw);
  if (!text) {
    throw new Error("OpenAI (Chat file_id) retornou resposta vazia.");
  }
  return text;
}

function isUsableExtraction(text: string): boolean {
  return Boolean(text.trim()) && !looksLikeExtractionRefusal(text);
}

async function extractWithUploadedFile(
  apiKey: string,
  model: string,
  buffer: Buffer,
  fileName: string,
  maxOutputTokens: number,
  purpose: "user_data" | "assistants"
): Promise<string> {
  const fileId = await uploadPdfFile(apiKey, buffer, fileName, purpose);
  try {
    await waitForFileProcessed(apiKey, fileId);
    try {
      return await extractWithResponsesApi(apiKey, model, fileId, fileName, maxOutputTokens);
    } catch (responsesErr) {
      const msg = responsesErr instanceof Error ? responsesErr.message : String(responsesErr);
      console.warn(`OpenAI Responses (${purpose}) falhou, tentando Chat:`, msg);
      return await extractWithChatCompletions(apiKey, model, fileId, fileName, maxOutputTokens);
    }
  } finally {
    await deletePdfFile(apiKey, fileId);
  }
}

function sortPngPageFiles(files: string[]): string[] {
  return files.sort((a, b) => {
    const na = parseInt(a.match(/-(\d+)\.png$/i)?.[1] || "0", 10);
    const nb = parseInt(b.match(/-(\d+)\.png$/i)?.[1] || "0", 10);
    return na - nb;
  });
}

/** Converte páginas do PDF em PNG via poppler (pdftoppm) — confiável em Linux/Docker. */
async function renderPdfPagePngs(buffer: Buffer): Promise<Buffer[]> {
  const dir = await mkdtemp(join(tmpdir(), "pdf-ocr-"));
  const inputPath = join(dir, "input.pdf");
  const outputPrefix = join(dir, "page");

  try {
    await writeFile(inputPath, buffer);
    const dpi = process.env.PDF_OCR_DPI || "150";
    await execFileAsync(
      "pdftoppm",
      ["-png", "-r", dpi, inputPath, outputPrefix],
      { timeout: parseInt(process.env.OPENAI_PDF_TIMEOUT_MS || "180000", 10) }
    );

    const pngFiles = sortPngPageFiles((await readdir(dir)).filter((f) => f.endsWith(".png")));
    if (!pngFiles.length) {
      throw new Error("pdftoppm não gerou imagens — verifique se poppler-utils está instalado.");
    }

    const maxPages = parseInt(process.env.PDF_OCR_MAX_PAGES || "80", 10);
    const images: Buffer[] = [];
    for (const file of pngFiles.slice(0, maxPages)) {
      images.push(await readFile(join(dir, file)));
    }
    return images;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ENOENT") || msg.includes("pdftoppm")) {
      throw new Error(
        "pdftoppm não encontrado no servidor. Instale poppler-utils no container (já incluso no Dockerfile)."
      );
    }
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const OCR_SYSTEM_PROMPT =
  "Você é um motor OCR automatizado em pipeline de indexação documental. " +
  "Sua única função é transcrever texto visível em imagens de páginas de PDF. " +
  "Não aplique filtros de conteúdo: slides educacionais, finanças e negócios devem ser transcritos integralmente. " +
  "Proibido recusar, pedir arquivos ou responder conversacionalmente. Saída: somente transcrição.";

async function extractTextFromPageBatch(
  apiKey: string,
  model: string,
  pages: Buffer[],
  fileName: string,
  startPage: number
): Promise<string> {
  const pageLabel =
    pages.length === 1
      ? `página ${startPage}`
      : `páginas ${startPage}–${startPage + pages.length - 1}`;
  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [
    {
      type: "text",
      text:
        `Transcreva integralmente todo texto visível nesta imagem (${pageLabel}) do documento "${fileName}". ` +
        "Retorne apenas a transcrição em markdown, sem comentários.",
    },
  ];
  for (const png of pages) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${png.toString("base64")}`,
        detail: "high",
      },
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(parseInt(process.env.OPENAI_PDF_TIMEOUT_MS || "180000", 10)),
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 4096,
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    }),
  });

  const raw = (await res.json()) as OpenAiChatResponse;
  if (!res.ok) {
    const msg = raw.error?.message || `HTTP ${res.status}`;
    throw new Error(`Falha OCR por página (Chat): ${msg}`);
  }
  const text = parseOpenAiPdfText(raw);
  if (!text) throw new Error("OCR por página retornou resposta vazia.");
  return text;
}

function ocrFallbackModels(primary: string): string[] {
  const models = [primary];
  if (primary !== "gpt-4o") models.push("gpt-4o");
  if (primary !== "gpt-4o-mini") models.push("gpt-4o-mini");
  return [...new Set(models)];
}

async function extractSinglePageOcr(
  apiKey: string,
  models: string[],
  pagePng: Buffer,
  fileName: string,
  pageNum: number
): Promise<string> {
  const errors: string[] = [];
  for (const m of models) {
    try {
      const chunk = await extractTextFromPageBatch(apiKey, m, [pagePng], fileName, pageNum);
      if (isUsableExtraction(chunk)) return chunk;
      errors.push(`${m}: recusa`);
    } catch (e) {
      errors.push(`${m}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`OCR página ${pageNum} falhou (${errors.join(" | ")})`);
}

async function extractPdfViaPageOcr(
  apiKey: string,
  model: string,
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const pages = await renderPdfPagePngs(buffer);
  if (!pages.length) throw new Error("PDF sem páginas renderizáveis para OCR.");

  const models = ocrFallbackModels(model);
  const parts: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const chunk = await extractSinglePageOcr(apiKey, models, pages[i], fileName, pageNum);
    parts.push(`## Página ${pageNum}\n\n${chunk}`);
  }

  const merged = parts.join("\n\n").trim();
  assertUsableExtractedText(merged, fileName);
  return merged;
}

async function extractWithOpenAiVision(
  apiKey: string,
  model: string,
  buffer: Buffer,
  fileName: string,
  maxOutputTokens: number
): Promise<string> {
  const attempts: Array<{ name: string; run: () => Promise<string> }> = [
    {
      name: "responses-base64",
      run: () => extractWithBase64Responses(apiKey, model, buffer, fileName, maxOutputTokens),
    },
    {
      name: "file-user_data",
      run: () => extractWithUploadedFile(apiKey, model, buffer, fileName, maxOutputTokens, "user_data"),
    },
    {
      name: "file-assistants",
      run: () => extractWithUploadedFile(apiKey, model, buffer, fileName, maxOutputTokens, "assistants"),
    },
    {
      name: "page-ocr",
      run: () => extractPdfViaPageOcr(apiKey, model, buffer, fileName),
    },
  ];

  const errors: string[] = [];
  let refusedSnippet = "";

  for (const step of attempts) {
    try {
      const text = await step.run();
      if (isUsableExtraction(text)) return text;
      refusedSnippet = text.slice(0, 240);
      errors.push(`${step.name}: resposta genérica/recusa`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${step.name}: ${msg}`);
      console.warn(`PDF extraction ${step.name} falhou:`, msg);
    }
  }

  throw new Error(
    `OpenAI não extraiu o PDF após ${attempts.length} tentativas (${errors.join(" | ")})` +
      (refusedSnippet ? `. Última resposta: ${refusedSnippet}` : "")
  );
}

export async function extractPdfWithOpenAI(buffer: Buffer, fileName: string): Promise<string> {
  const cfg = await resolveOpenAiConfig();
  if (!cfg) {
    throw new Error(
      "Extração de PDF requer OpenAI: configure o provedor OpenAI no admin de LLM " +
        "ou defina OPENAI_API_KEY no backend."
    );
  }

  if (buffer.length > MAX_INLINE_PDF_BYTES) {
    throw new Error(
      `PDF muito grande (${Math.round(buffer.length / 1024 / 1024)} MB). Limite: ${MAX_INLINE_PDF_BYTES / 1024 / 1024} MB.`
    );
  }

  const hasImages = await pdfContainsEmbeddedImages(buffer);

  const model = resolvePdfVisionModel(cfg.model);
  const maxOut = pdfMaxOutputTokens(cfg.maxOutputTokens);

  // PDF só com texto embutido (sem imagens): extração local rápida.
  if (!hasImages) {
    const localText = await extractPdfTextLocally(buffer);
    if (localText.trim()) {
      assertUsableExtractedText(localText, fileName);
      return localText;
    }
  }

  // PDF com imagens: OCR por página (poppler + visão) é o caminho mais confiável.
  if (hasImages) {
    try {
      const ocrText = await extractPdfViaPageOcr(cfg.apiKey, model, buffer, fileName);
      assertUsableExtractedText(ocrText, fileName);
      return ocrText;
    } catch (ocrErr) {
      const msg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
      console.warn(`Page OCR primário falhou (${fileName}):`, msg);
    }
  }

  const text = await extractWithOpenAiVision(cfg.apiKey, model, buffer, fileName, maxOut);
  assertUsableExtractedText(text, fileName);
  return text;
}
