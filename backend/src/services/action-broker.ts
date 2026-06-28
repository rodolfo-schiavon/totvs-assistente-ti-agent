import type { PendingAction } from "@prisma/client";

const BROKER_URL = (process.env.ACTION_BROKER_URL || "http://platform-action-broker.platform.svc:8080").replace(
  /\/$/,
  ""
);
const BROKER_TOKEN = process.env.ACTION_BROKER_TOKEN || "";

export async function executeApprovedAction(
  action: PendingAction,
  approvedBy: string
): Promise<unknown> {
  const params = JSON.parse(action.paramsJson || "{}") as Record<string, unknown>;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (BROKER_TOKEN) {
    headers.Authorization = `Bearer ${BROKER_TOKEN}`;
  }
  const res = await fetch(`${BROKER_URL}/api/v1/execute`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action_type: action.actionType,
      params,
      action_id: action.id,
      approved_by: approvedBy,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { detail?: string }).detail || `Broker HTTP ${res.status}`);
  }
  return data;
}
