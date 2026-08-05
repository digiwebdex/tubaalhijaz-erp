import { AsyncLocalStorage } from "async_hooks";

/**
 * Per-request audit context (mirrors tenant-context). Seeded by the JWT guard
 * (identity + impersonation) and the request middleware (ip/userAgent/correlationId).
 * Read automatically by AuditService.log — callers never pass actor/ip/etc.
 */
export interface AuditContextStore {
  actualUserId?: string | null;   // real human (admin under impersonation)
  actingAsUserId?: string | null; // agent, only under impersonation
  actorLabel?: string | null;
  correlationId?: string | null;
  workflowId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;      // impersonation session id
}

export const auditContext = new AsyncLocalStorage<AuditContextStore>();

/** Attach the domain workflow id (e.g. group id) so a request's audit rows correlate. */
export function setAuditWorkflowId(id: string) {
  const s = auditContext.getStore();
  if (s) s.workflowId = id;
}

/** Run a block under an explicit audit identity — for background jobs / BullMQ / cron. */
export function runWithAudit<T>(seed: AuditContextStore, fn: () => T): T {
  return auditContext.run(seed, fn);
}
