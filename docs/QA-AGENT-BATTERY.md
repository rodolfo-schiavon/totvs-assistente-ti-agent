/**
 * Bateria QA — perguntas realistas para o Agente IA
 * Cobertura: volume, temporal, SLA, categorias, severidade, tempos, labor,
 * solicitantes, tipos ITIL, predição e executivo.
 */
export const QA_BATTERY = [
  // Volume e temporal (respostas diretas, sem gráfico)
  { id: 1, area: "volume", q: "Quantos chamados foram abertos hoje?" },
  { id: 2, area: "volume", q: "Quantos chamados foram abertos ontem?" },
  { id: 3, area: "volume", q: "Há chamados abertos agora? Quantos?" },
  { id: 4, area: "volume", q: "Qual o backlog atual?" },

  // Categorias
  { id: 5, area: "categoria", q: "Quais são as 5 categorias com mais chamados?" },
  { id: 6, area: "categoria", q: "Quantos chamados de Perfil de usuário existem?" },
  { id: 7, area: "categoria", q: "Qual a distribuição de chamados por categoria nos últimos 3 meses?" },

  // Severidade / prioridade
  { id: 8, area: "severidade", q: "Quantos chamados de prioridade alta ou crítica temos?" },
  { id: 9, area: "severidade", q: "Qual a distribuição por severidade A, B, C e D?" },
  { id: 10, area: "severidade", q: "Como está o cumprimento de SLA por severidade?" },

  // Tempos de resposta e resolução
  { id: 11, area: "tempo", q: "Qual o MTTR médio dos chamados encerrados?" },
  { id: 12, area: "tempo", q: "Qual o tempo médio de primeira resposta (MTTA)?" },
  { id: 13, area: "tempo", q: "Qual técnico tem o maior tempo médio de resolução?" },

  // Horas / labor
  { id: 14, area: "labor", q: "Quantas horas de labor foram apontadas no total?" },
  { id: 15, area: "labor", q: "Quantos chamados têm apontamento de horas?" },

  // Usuários e clientes recorrentes
  { id: 16, area: "recorrencia", q: "Quais solicitantes abriram mais chamados?" },
  { id: 17, area: "recorrencia", q: "Existem padrões de reincidência por solicitante e categoria?" },
  { id: 18, area: "recorrencia", q: "Quais organizações geram mais demanda?" },

  // Tipos ITIL
  { id: 19, area: "itil", q: "Quantos incidentes versus requisições temos?" },
  { id: 20, area: "itil", q: "Qual a distribuição por tipo ITIL?" },

  // SLA
  { id: 21, area: "sla", q: "Há chamados com SLA em risco agora?" },
  { id: 22, area: "sla", q: "Quantos chamados violaram o SLA contrato?" },
  { id: 23, area: "sla", q: "Qual a taxa de compliance de SLA contrato?" },

  // Tendências e predição
  { id: 24, area: "predicao", q: "Qual a previsão de volume de aberturas para os próximos dias?" },
  { id: 25, area: "tendencia", q: "Qual a tendência de aberturas versus encerramentos nos últimos 3 meses?" },
  { id: 26, area: "predicao", q: "Existem clientes com demanda acima da média?" },

  // Técnicos
  { id: 27, area: "tecnico", q: "Quem são os técnicos com maior carga de trabalho?" },
  { id: 28, area: "tecnico", q: "Quantos chamados cada técnico atendeu?" },

  // Casos vazios / edge cases
  { id: 29, area: "edge", q: "Quantos chamados foram reabertos?" },
  { id: 30, area: "edge", q: "Quantos chamados estão aguardando cliente?" },

  // Executivo (único que pode trazer KPIs + gráfico)
  { id: 31, area: "executivo", q: "Gere um resumo executivo da operação com KPIs principais e pontos de atenção." },
];
