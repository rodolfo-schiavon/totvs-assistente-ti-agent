import { readBlob } from "./storage";
import { extractPdfWithOpenAI } from "./openai-pdf";
import { describeImage, transcribeMedia } from "./media";

export async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();

  if (mimeType.startsWith("image/")) {
    const desc = await describeImage(buffer, mimeType);
    return desc || `[Imagem: ${fileName}]`;
  }

  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    const transcript = await transcribeMedia(buffer, fileName, mimeType);
    return transcript ? `[Transcrição de ${fileName}]\n${transcript}` : `[Mídia: ${fileName}]`;
  }

  if (mimeType.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  if (mimeType.includes("json") || lower.endsWith(".json")) {
    return buffer.toString("utf-8");
  }

  if (mimeType.includes("csv") || lower.endsWith(".csv")) {
    return buffer.toString("utf-8");
  }

  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    return extractPdfWithOpenAI(buffer, fileName);
  }

  if (lower.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch {
      return "";
    }
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mimeType.includes("spreadsheet")) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];
      for (const sheet of wb.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
        parts.push(`# ${sheet}\n${csv}`);
      }
      return parts.join("\n\n");
    } catch {
      return "";
    }
  }

  return buffer.toString("utf-8").slice(0, 50000);
}

export async function extractFromStorageKey(storageKey: string, mimeType: string, fileName: string): Promise<string> {
  const buffer = await readBlob(storageKey);
  return extractText(buffer, mimeType, fileName);
}
