import type { LegalRole } from "./roles";
import { isAdmin, normalizeRole } from "./roles";

export type ConversationPermission =
  | "view_conversations"
  | "view_all_tenants"
  | "export_conversations"
  | "delete_conversations"
  | "anonymize_conversations"
  | "audit_conversations"
  | "compliance_actions";

const MATRIX: Record<LegalRole, Set<ConversationPermission>> = {
  admin: new Set([
    "view_conversations",
    "view_all_tenants",
    "export_conversations",
    "delete_conversations",
    "anonymize_conversations",
    "audit_conversations",
    "compliance_actions",
  ]),
  gerencia: new Set([
    "view_conversations",
    "export_conversations",
    "audit_conversations",
  ]),
  advogado: new Set(["view_conversations"]),
};

export function hasConversationPermission(
  role: string | null | undefined,
  permission: ConversationPermission
): boolean {
  const r = normalizeRole(role);
  return MATRIX[r]?.has(permission) ?? false;
}

export function canAuditAllConversations(role: string | null | undefined): boolean {
  return hasConversationPermission(role, "audit_conversations");
}

export function canViewOwnConversationsOnly(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "advogado";
}

export function canExportConversations(role: string | null | undefined): boolean {
  return hasConversationPermission(role, "export_conversations");
}

export function canDeleteConversations(role: string | null | undefined): boolean {
  return isAdmin(role);
}

export function canAnonymizeConversations(role: string | null | undefined): boolean {
  return hasConversationPermission(role, "anonymize_conversations");
}
