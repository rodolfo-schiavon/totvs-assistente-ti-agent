import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { prisma } from "../db";
import { periodToSince } from "./governance-period";

type ExportRow = Record<string, unknown>;

export async function fetchSectionRows(section: string, period: string): Promise<ExportRow[]> {
  const since = periodToSince(period);

  switch (section) {
    case "observability":
      return prisma.llmObservability.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }) as unknown as ExportRow[];
    case "security":
      return prisma.promptSecurityEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }) as unknown as ExportRow[];
    case "costs":
      return prisma.llmCostMetric.findMany({
        where: { metricDate: { gte: since } },
        orderBy: { metricDate: "desc" },
        take: 5000,
      }) as unknown as ExportRow[];
    case "feedback":
      return prisma.llmFeedback.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }) as unknown as ExportRow[];
    case "alerts":
      return prisma.llmAlert.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }) as unknown as ExportRow[];
    case "prompts":
      return prisma.promptAnalytics.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }) as unknown as ExportRow[];
    case "rag":
      return prisma.ragMetrics.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }) as unknown as ExportRow[];
    default:
      return prisma.aiGovernanceMetric.findMany({
        where: { period },
      }) as unknown as ExportRow[];
  }
}

export function rowsToCsv(rows: ExportRow[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h];
          const s = v == null ? "" : String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    );
  }
  return lines.join("\n");
}

export function rowsToXlsxBuffer(rows: ExportRow[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: "Sem dados" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Governanca");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function rowsToPdfBuffer(title: string, rows: ExportRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title, { underline: true });
    doc.moveDown();
    doc.fontSize(10).text(`Gerado em ${new Date().toLocaleString("pt-BR")}`);
    doc.moveDown();

    if (!rows.length) {
      doc.text("Nenhum registro no período.");
    } else {
      const keys = Object.keys(rows[0]).slice(0, 6);
      for (const row of rows.slice(0, 80)) {
        for (const k of keys) {
          doc.text(`${k}: ${row[k] ?? ""}`);
        }
        doc.moveDown(0.5);
      }
      if (rows.length > 80) doc.text(`… e mais ${rows.length - 80} registros.`);
    }
    doc.end();
  });
}
