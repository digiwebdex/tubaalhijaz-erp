import { AsyncLocalStorage } from "async_hooks";

/**
 * Per-request tenancy context, seeded by the auth guard and read by the
 * Prisma tenant-scoping extension. Living in AsyncLocalStorage means the
 * scoping applies to EVERY query in the request — services cannot forget it.
 */
export interface TenantContextStore {
  userId?: string;
  roleKey?: string;
  /** Company the user belongs to; null/undefined ⇒ TUBA platform staff. */
  companyId?: string | null;
  companyType?: "AGENT" | "SUPPLIER" | null;
}

export const tenantContext = new AsyncLocalStorage<TenantContextStore>();

/** True when the current request must be restricted to its own company rows. */
export function isTenantScoped(): boolean {
  const store = tenantContext.getStore();
  return !!store?.userId && !!store?.companyId;
}
