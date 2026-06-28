/** Paleta e estilos compartilhados — contraste legível em fundo escuro */

import { rechartsTooltipFallback, tooltipCartesianWrapper, tooltipPieWrapper } from "@/lib/charts/tooltip-styles";

export const CHART = {
  opened: "#4ade80",
  closed: "#9ca3af",
  accent: "#22c55e",
  accentDim: "#16a34a",
  muted: "#6b7280",
  grid: "#2a2f2a",
  axis: "#b8c0b8",
  tooltipBg: "#f8faf8",
  tooltipBorder: "#22c55e",
  tooltipText: "#111827",
  legendText: "#e5e7eb",
  series: ["#4ade80", "#22c55e", "#86efac", "#9ca3af", "#6b7280", "#eab308", "#f87171", "#a3e635"],
  sla: {
    met: "#4ade80",
    atRisk: "#eab308",
    violated: "#f87171",
  },
} as const;

export const marginWithLegend = { top: 12, right: 16, left: 8, bottom: 52 };

export const marginPieWithLegend = { top: 8, right: 8, left: 8, bottom: 56 };

export const axisTick = { fill: CHART.axis, fontSize: 11 };
export const axisTickSmall = { fill: CHART.axis, fontSize: 10 };

export const gridStroke = { strokeDasharray: "3 3", stroke: CHART.grid };

export const activeBarStyle = {
  fill: CHART.accent,
  stroke: "#fff",
  strokeWidth: 1,
  opacity: 1,
};

export const cursorBarStyle = { fill: "rgba(74, 222, 128, 0.1)", stroke: "rgba(74, 222, 128, 0.35)" };

export const cursorLineStyle = {
  stroke: CHART.opened,
  strokeWidth: 1,
  strokeDasharray: "4 4",
  strokeOpacity: 0.6,
};

/** Barras / áreas — referência de função, não JSX */
export const tooltipCartesianProps = {
  ...rechartsTooltipFallback,
  cursor: cursorBarStyle,
  wrapperStyle: tooltipCartesianWrapper,
  allowEscapeViewBox: { x: true, y: true } as const,
  isAnimationActive: false,
};

export const tooltipLineProps = {
  ...rechartsTooltipFallback,
  cursor: cursorLineStyle,
  wrapperStyle: tooltipCartesianWrapper,
  allowEscapeViewBox: { x: true, y: true } as const,
  isAnimationActive: false,
};

/** Pizza / donut — sem retângulo branco do cursor */
export const tooltipPieProps = {
  ...rechartsTooltipFallback,
  cursor: false,
  wrapperStyle: tooltipPieWrapper,
  allowEscapeViewBox: { x: true, y: true } as const,
  isAnimationActive: false,
};

export const legendProps = {
  verticalAlign: "bottom" as const,
  align: "center" as const,
  iconType: "circle" as const,
  iconSize: 10,
  height: 44,
};
