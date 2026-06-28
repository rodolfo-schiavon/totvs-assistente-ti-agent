/** @param {import('playwright').Page} page */
export default async function runQaBattery(page) {
  const BASE = process.env.QA_BASE_URL || "https://ia-dma.zerotouch.tec.br";
  const USER = "admin";
  const PASS = "5yhlNq8OrRTWXnfSFiFz+znm";

  const questions = [
    { id: 1, area: "volume", q: "Quantos chamados foram abertos hoje?" },
    { id: 2, area: "volume", q: "Quantos chamados foram abertos ontem?" },
    { id: 3, area: "volume", q: "Há chamados abertos agora? Quantos?" },
    { id: 4, area: "volume", q: "Qual o backlog atual?" },
    { id: 5, area: "categoria", q: "Quais são as 5 categorias com mais chamados?" },
    { id: 6, area: "categoria", q: "Quantos chamados de Perfil de usuário existem?" },
    { id: 7, area: "categoria", q: "Qual a distribuição de chamados por categoria nos últimos 3 meses?" },
    { id: 8, area: "severidade", q: "Quantos chamados de prioridade alta ou crítica temos?" },
    { id: 9, area: "severidade", q: "Qual a distribuição por severidade A, B, C e D?" },
    { id: 10, area: "severidade", q: "Como está o cumprimento de SLA por severidade?" },
    { id: 11, area: "tempo", q: "Qual o MTTR médio dos chamados encerrados?" },
    { id: 12, area: "tempo", q: "Qual o tempo médio de primeira resposta (MTTA)?" },
    { id: 13, area: "tempo", q: "Qual técnico tem o maior tempo médio de resolução?" },
    { id: 14, area: "labor", q: "Quantas horas de labor foram apontadas no total?" },
    { id: 15, area: "labor", q: "Quantos chamados têm apontamento de horas?" },
    { id: 16, area: "recorrencia", q: "Quais solicitantes abriram mais chamados?" },
    { id: 17, area: "recorrencia", q: "Existem padrões de reincidência por solicitante e categoria?" },
    { id: 18, area: "recorrencia", q: "Quais organizações geram mais demanda?" },
    { id: 19, area: "itil", q: "Quantos incidentes versus requisições temos?" },
    { id: 20, area: "itil", q: "Qual a distribuição por tipo ITIL?" },
    { id: 21, area: "sla", q: "Há chamados com SLA em risco agora?" },
    { id: 22, area: "sla", q: "Quantos chamados violaram o SLA contrato?" },
    { id: 23, area: "sla", q: "Qual a taxa de compliance de SLA contrato?" },
    { id: 24, area: "predicao", q: "Qual a previsão de volume de aberturas para os próximos dias?" },
    { id: 25, area: "tendencia", q: "Qual a tendência de aberturas versus encerramentos nos últimos 3 meses?" },
    { id: 26, area: "predicao", q: "Existem clientes com demanda acima da média?" },
    { id: 27, area: "tecnico", q: "Quem são os técnicos com maior carga de trabalho?" },
    { id: 28, area: "tecnico", q: "Quantos chamados cada técnico atendeu?" },
    { id: 29, area: "edge", q: "Quantos chamados foram reabertos?" },
    { id: 30, area: "edge", q: "Quantos chamados estão aguardando cliente?" },
    { id: 31, area: "executivo", q: "Gere um resumo executivo da operação com KPIs principais e pontos de atenção." },
  ];

  await page.goto(`${BASE}/dashboard/agent`, { waitUntil: "networkidle", timeout: 60000 });
  if (page.url().includes("/login")) {
    await page.locator("input").first().fill(USER);
    await page.locator('input[type="password"]').fill(PASS);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 30000 });
    await page.goto(`${BASE}/dashboard/agent`, { waitUntil: "networkidle" });
  }

  const results = [];

  for (const item of questions) {
    const started = Date.now();
    try {
      await page.getByRole("button", { name: /Nova conversa/i }).click();
      await page.waitForTimeout(400);

      const input = page.locator('form input[placeholder*="chamados"]');
      await input.fill(item.q);
      await page.locator("form button[type='submit']").click();

      await page.getByText("Analisando dados").waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
      await page.getByText("Analisando dados").waitFor({ state: "hidden", timeout: 120000 });

      const errEl = page.locator("p").filter({ hasText: /Erro|Falha de conexão/i });
      const error = (await errEl.count()) > 0 ? (await errEl.first().textContent())?.trim() : null;

      const bubbles = page.locator(".flex.justify-start > .max-w-\\[95\\%\\]");
      const last = bubbles.last();
      const text = ((await last.textContent()) || "").replace(/\s+/g, " ").trim();

      const hasKpi = /\bTOTAL\b|\bABERTOS\b|\bFECHADOS\b|\bCOMPLIANCE\b/i.test(text) &&
        (await last.locator(".grid").count()) > 0;
      const hasChart = /Chamados por|Aberturas por|Tipos ITIL|SLA por severidade/i.test(text);

      const jsonLeak = text.includes("'type': 'text'") || text.startsWith("[{");

      results.push({
        id: item.id,
        area: item.area,
        q: item.q,
        ok: !error && !jsonLeak && text.length > 10,
        error: error || (jsonLeak ? "Markdown JSON vazado" : null),
        hasKpi,
        hasChart,
        ms: Date.now() - started,
        snippet: text.slice(0, 220),
      });
    } catch (e) {
      results.push({
        id: item.id,
        area: item.area,
        q: item.q,
        ok: false,
        error: String(e.message || e).slice(0, 200),
        hasKpi: false,
        hasChart: false,
        ms: Date.now() - started,
        snippet: "",
      });
    }
  }

  return results;
}
