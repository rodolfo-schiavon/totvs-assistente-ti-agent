import { chromium } from "playwright";
import { writeFileSync } from "fs";
import runQaBattery from "./run-qa-battery.mjs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(120000);

console.log("Iniciando bateria QA (31 perguntas) via interface...");
const results = await runQaBattery(page);
await browser.close();

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);

writeFileSync(
  "tests/qa-battery-results.json",
  JSON.stringify({ at: new Date().toISOString(), passed, total: results.length, results }, null, 2)
);

console.log(`\n=== RESULTADO: ${passed}/${results.length} OK ===\n`);
for (const r of results) {
  const icon = r.ok ? "OK" : "FAIL";
  const vis = r.hasKpi || r.hasChart ? `[KPI:${r.hasKpi} CH:${r.hasChart}]` : "[texto]";
  console.log(`${icon} #${String(r.id).padStart(2)} ${r.area.padEnd(12)} ${vis} ${(r.ms / 1000).toFixed(1)}s`);
  if (!r.ok) console.log(`     ERRO: ${r.error}`);
  console.log(`     → ${r.snippet.slice(0, 120)}`);
}

if (failed.length) process.exit(1);
