// ─── Rule actions + conditions ───────────────────────────────────────────────
// An AutomationRule.actions is a structured list of these. The dispatcher
// enqueues one BullMQ job per action (job name = action.type).

import type { DomainPayload } from "./events";

export const ACTION_TYPES = [
  "SEND_NOTIFICATION",
  "GENERATE_VOUCHER",
  "GENERATE_INVOICE",
  "GENERATE_PDF",
  "GENERATE_QR",
  "RUN_BACKUP",
  "ESCALATE",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const isActionType = (t: unknown): t is ActionType =>
  typeof t === "string" && (ACTION_TYPES as readonly string[]).includes(t);

export interface AutomationAction {
  type: ActionType;
  params?: Record<string, unknown>;
}

/** Coerce a rule's stored `actions` JSON into typed actions, dropping junk. */
export function parseActions(raw: unknown): AutomationAction[] {
  if (!Array.isArray(raw)) return [];
  const out: AutomationAction[] = [];
  for (const a of raw) {
    if (a && typeof a === "object" && isActionType((a as AutomationAction).type)) {
      out.push({ type: (a as AutomationAction).type, params: (a as AutomationAction).params ?? {} });
    }
    // legacy string actions ("send approval email") are display-only → ignored by the engine
  }
  return out;
}

// ── Conditions: [{path, op, value}] all AND-ed, evaluated against payload.data ──
export type CondOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "exists";
export interface Condition {
  path: string; // dot path into the event payload, e.g. "data.status" or "data.pax"
  op: CondOp;
  value?: unknown;
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

/** True if every condition passes. Empty/invalid conditions ⇒ true (rule always fires). */
export function evaluateConditions(raw: unknown, payload: DomainPayload): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return true;
  return raw.every((c) => {
    if (!c || typeof c !== "object") return true;
    const { path, op, value } = c as Condition;
    if (typeof path !== "string") return true;
    // allow conditions to reference either the whole payload or shorthand data.*
    const actual = getPath(payload, path.startsWith("data.") || path.includes(".") ? path : `data.${path}`);
    switch (op) {
      case "exists": return actual !== undefined && actual !== null;
      case "eq": return actual === value;
      case "ne": return actual !== value;
      case "gt": return typeof actual === "number" && actual > Number(value);
      case "gte": return typeof actual === "number" && actual >= Number(value);
      case "lt": return typeof actual === "number" && actual < Number(value);
      case "lte": return typeof actual === "number" && actual <= Number(value);
      case "in": return Array.isArray(value) && value.includes(actual as never);
      case "contains":
        return typeof actual === "string" && typeof value === "string" && actual.includes(value);
      default: return true;
    }
  });
}

/** Job payload the dispatcher puts on the queue; the worker reads it back. */
export interface JobData {
  ruleId: string;
  ruleCode: string;
  eventKey: string;
  action: AutomationAction;
  event: DomainPayload;
}
