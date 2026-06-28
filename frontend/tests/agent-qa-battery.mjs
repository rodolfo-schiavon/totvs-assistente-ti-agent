/** Bateria QA — 24 perguntas realistas no Agente IA (executar via Playwright MCP ou node) */
export const QA_QUESTIONS = [
  // Relatórios operacionais
  { id: 1, category: "volume", q: "Qual o total de chamados na base?" },
  { id: 2, category: "volume", q: "Quantos chamados estão abertos no momento?" },
  { id: 3, category: "volume", q: "Quantos chamados foram encerrados?" },
  { id: 4, category: "volume", q: "Qual o backlog atual de chamados?" },
  { id: 5, category: "temporal", q: "Quantos chamados foram abertos hoje?" },
  { id: 6, category: "temporal", q: "Quantos chamados foram abertos ontem?" },
  { id: 7, category: "temporal", q: "Qual o volume de chamados nos últimos 7 dias?" },
  { id: 8, category: "temporal", q: "Qual o volume de chamados do mês passado?" },
  { id: 9, category: "temporal", q: "Quantos chamados foram abertos neste mês?" },
  { id: 10, category: "status", q: "Qual a distribuição de chamados por status?" },
  // SLA
  { id: 11, category: "sla", q: "Qual a taxa de compliance de SLA contrato?" },
  { id: 12, category: "sla", q: "Quantos chamados estão com SLA violado?" },
  { id: 13, category: "sla", q: "Há chamados com SLA em risco agora?" },
  { id: 14, category: "sla", q: "Como está o cumprimento de SLA por severidade?" },
  // Categorias e prioridade
  { id: 15, category: "categoria", q: "Quais são as 3 categorias com mais chamados?" },
  { id: 16, category: "categoria", q: "Quais categorias têm mais chamados nos últimos 3 meses?" },
  { id: 17, category: "prioridade", q: "Qual a distribuição de chamados por prioridade?" },
  // Técnicos
  { id: 18, category: "tecnico", q: "Quem são os técnicos com maior carga de trabalho?" },
  { id: 19, category: "tecnico", q: "Qual técnico atendeu mais chamados no total?" },
  // Preditivo e tendências
  { id: 20, category: "predicao", q: "Qual a previsão de volume de aberturas para os próximos dias?" },
  { id: 21, category: "predicao", q: "Existem clientes ou organizações com demanda acima da média?" },
  { id: 22, category: "predicao", q: "Quais padrões de reincidência aparecem nos dados?" },
  { id: 23, category: "tendencia", q: "Qual a tendência de aberturas versus encerramentos nos últimos 3 meses?" },
  { id: 24, category: "executivo", q: "Gere um resumo executivo da operação com KPIs principais e pontos de atenção." },
];
