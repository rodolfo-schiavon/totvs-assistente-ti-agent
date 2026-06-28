import type { CSSProperties } from "react";

/** Cores do tooltip (espelham CHART em theme.ts — sem import circular) */
const TOOLTIP_BG = "#f8faf8";
const TOOLTIP_BORDER = "#22c55e";
const TOOLTIP_TEXT = "#111827";

/** Estilos inline — garantem contraste mesmo se o CSS global falhar */
export const TOOLTIP_PANEL_STYLE: CSSProperties = {
  minWidth: 148,
  maxWidth: 300,
  backgroundColor: TOOLTIP_BG,
  border: `2px solid ${TOOLTIP_BORDER}`,
  borderRadius: 10,
  padding: "10px 12px",
  boxShadow: "0 14px 32px rgba(0, 0, 0, 0.6)",
  color: TOOLTIP_TEXT,
};

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  margin: "0 0 8px",
  paddingBottom: 6,
  borderBottom: "1px solid #d1d5db",
  fontSize: 12,
  fontWeight: 600,
  color: "#111827",
};

export const TOOLTIP_NAME_STYLE: CSSProperties = {
  flex: 1,
  fontWeight: 500,
  color: "#374151",
  fontSize: 12,
};

export const TOOLTIP_VALUE_STYLE: CSSProperties = {
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "#111827",
  fontSize: 12,
};

/** Fallback Recharts: se o tooltip nativo aparecer, ainda fica legível */
export const rechartsTooltipFallback = {
  contentStyle: {
    backgroundColor: TOOLTIP_BG,
    border: `2px solid ${TOOLTIP_BORDER}`,
    borderRadius: 10,
    padding: "10px 12px",
    boxShadow: "0 14px 32px rgba(0, 0, 0, 0.6)",
  },
  labelStyle: {
    color: "#111827",
    fontWeight: 600,
    fontSize: 12,
    marginBottom: 4,
  },
  itemStyle: {
    color: "#111827",
    fontSize: 12,
    fontWeight: 500,
  },
};

export const tooltipPieWrapper = {
  outline: "none",
  zIndex: 100,
  pointerEvents: "none" as const,
};

export const tooltipCartesianWrapper = {
  outline: "none",
  zIndex: 100,
  pointerEvents: "none" as const,
};
