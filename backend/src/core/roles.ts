/** Perfis do workspace — admin configura; gerencia vê relatórios consolidados; advogado uso operacional. */
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

/** Relatórios consolidados e visão gerencial (sem acesso à configuração admin). */
export function canViewManagementReports(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === "admin" || r === "gerencia";
}

export function isValidRole(value?: string | null): value is LegalRole {
  return LEGAL_ROLES.includes(normalizeRole(value));
}

export const ROLE_LABELS: Record<LegalRole, string> = {
  admin: "Administrador",
  advogado: "Advogado",
  gerencia: "Gerência",
};
