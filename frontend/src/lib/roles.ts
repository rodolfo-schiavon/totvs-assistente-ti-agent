export const LEGAL_ROLES = ["admin", "advogado", "gerencia"] as const;
export type LegalRole = (typeof LEGAL_ROLES)[number];

const LEGACY_ROLE_MAP: Record<string, LegalRole> = {
  admin: "admin",
  advogado: "advogado",
  gerencia: "gerencia",
  lawyer: "advogado",
  legal_assistant: "gerencia",
  readonly: "gerencia",
};

export function normalizeRole(value?: string | null): LegalRole {
  if (!value) return "gerencia";
  return LEGACY_ROLE_MAP[value] ?? "gerencia";
}

export function isAdmin(role?: string | null): boolean {
  return normalizeRole(role) === "admin";
}

export function isGerencia(role?: string | null): boolean {
  return normalizeRole(role) === "gerencia";
}

export function canViewManagementReports(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === "admin" || r === "gerencia";
}

export const ROLE_LABELS: Record<LegalRole, string> = {
  admin: "Administrador",
  advogado: "Operador",
  gerencia: "Gerência",
};
