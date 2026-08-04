/**
 * Frontend permission helpers (S1-05) — UX only.
 *
 * Backend `@RequirePermissions` / tenancy remain the sole authorization layer.
 * These helpers only hide menus, pages, and actions. Never trust this for security.
 *
 * Staff modules are gated by `ApiUser.permissions` from `/auth/login` / `/auth/me`.
 * Agent/supplier portals use `company.type` from the same session (tenancy context),
 * not hardcoded staff role names.
 */

import { getStoredUser, type ApiUser } from "./api";

/** Permission keys (must match API seed / Permission table). */
export const P = {
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  MANAGE_USERS: "MANAGE_USERS",
  APPROVE_COMPANIES: "APPROVE_COMPANIES",
  FINANCIAL_REPORTS: "FINANCIAL_REPORTS",
  EDIT_FINANCIAL_RECORDS: "EDIT_FINANCIAL_RECORDS",
  CONFIGURE_WORKFLOWS: "CONFIGURE_WORKFLOWS",
  REVIEW_OCR_QUEUE: "REVIEW_OCR_QUEUE",
  ACCESS_AUDIT_LOGS: "ACCESS_AUDIT_LOGS",
  MANAGE_SYSTEM_SETTINGS: "MANAGE_SYSTEM_SETTINGS",
  API_KEY_ACCESS: "API_KEY_ACCESS",
  MANAGE_FLEET: "MANAGE_FLEET",
} as const;

export type PermKey = (typeof P)[keyof typeof P];

/** Path → any-of permission keys required to show/enter that route (UX). */
const PATH_ANY_OF: Record<string, readonly string[]> = {
  "/dashboards": [P.VIEW_DASHBOARD],
  "/ops-control": [P.VIEW_DASHBOARD],
  "/ops-departments": [P.VIEW_DASHBOARD],
  "/fleet-erp": [P.MANAGE_FLEET],
  "/ocr-center": [P.REVIEW_OCR_QUEUE],
  "/finance-erp": [P.FINANCIAL_REPORTS],
  "/automation": [P.CONFIGURE_WORKFLOWS],
  "/workflow-map": [P.VIEW_DASHBOARD],
  "/rate-cards": [P.MANAGE_SYSTEM_SETTINGS],
  "/super-admin": [
    P.MANAGE_USERS,
    P.APPROVE_COMPANIES,
    P.MANAGE_SYSTEM_SETTINGS,
    P.ACCESS_AUDIT_LOGS,
    P.CONFIGURE_WORKFLOWS,
  ],
};

export function sessionUser(): ApiUser | null {
  return getStoredUser();
}

export function permissionsOf(user: ApiUser | null | undefined): string[] {
  return user?.permissions ?? [];
}

export function hasPermission(permission: string, user: ApiUser | null = sessionUser()): boolean {
  if (!user) return false;
  return permissionsOf(user).includes(permission);
}

export function hasAnyPermission(
  permissions: readonly string[],
  user: ApiUser | null = sessionUser(),
): boolean {
  if (!user || permissions.length === 0) return false;
  const held = new Set(permissionsOf(user));
  return permissions.some((p) => held.has(p));
}

/** Tenant agency user (portal UX — from backend company.type). */
export function isAgentCompany(user: ApiUser | null = sessionUser()): boolean {
  return user?.company?.type === "AGENT";
}

/** Tenant supplier user (portal UX — from backend company.type). */
export function isSupplierCompany(user: ApiUser | null = sessionUser()): boolean {
  return user?.company?.type === "SUPPLIER";
}

/** Platform staff (no tenant company on the JWT/session). */
export function isPlatformStaff(user: ApiUser | null = sessionUser()): boolean {
  return !!user && !user.companyId;
}

/**
 * Whether the SPA should show/enter a path for this user (UX gate).
 * Does not authorize API calls.
 */
export function canAccessPath(path: string, user: ApiUser | null = sessionUser()): boolean {
  if (!user) return false;
  const base = path.split("?")[0].replace(/\/$/, "") || "/";

  if (base === "/agent-portal") return isAgentCompany(user);
  if (base === "/supplier-portal") return isSupplierCompany(user);

  const need = PATH_ANY_OF[base];
  if (need) return hasAnyPermission(need, user);

  // Public marketing / login — always OK for UX helper callers
  if (
    base === "/" ||
    base === "/login" ||
    base === "/auth-onboarding" ||
    base === "/services" ||
    base === "/about" ||
    base === "/contact"
  ) {
    return true;
  }

  // Unknown private paths: hide unless user holds any staff permission
  return isPlatformStaff(user) && permissionsOf(user).length > 0;
}

/** First sensible landing path after login (permission-aware). */
export function homePathForUser(user: ApiUser | null = sessionUser()): string {
  if (!user) return "/login";
  if (isAgentCompany(user)) return "/agent-portal";
  if (isSupplierCompany(user)) return "/supplier-portal";

  const candidates = [
    "/dashboards",
    "/ops-control",
    "/fleet-erp",
    "/ocr-center",
    "/finance-erp",
    "/automation",
    "/super-admin",
  ];
  for (const p of candidates) {
    if (canAccessPath(p, user)) return p;
  }
  return "/login";
}

/** GLOBAL_MODS / cross-module switcher entry. */
export type ModLink = { id: string; path: string };

export function filterModsByPermission<T extends ModLink>(
  mods: T[],
  user: ApiUser | null = sessionUser(),
): T[] {
  if (!user) return [];
  // Tenants stay in their portal — hide staff module switcher entirely.
  if (isAgentCompany(user) || isSupplierCompany(user)) return [];
  return mods.filter((m) => canAccessPath(m.path, user));
}

/** Super-admin sidebar item id → permission(s). */
export const SA_NAV_PERMS: Record<string, readonly string[]> = {
  dashboard: [P.MANAGE_USERS, P.APPROVE_COMPANIES, P.MANAGE_SYSTEM_SETTINGS],
  companies: [P.APPROVE_COMPANIES],
  users: [P.MANAGE_USERS],
  workflows: [P.CONFIGURE_WORKFLOWS],
  automation: [P.CONFIGURE_WORKFLOWS],
  "ai-engine": [P.MANAGE_SYSTEM_SETTINGS],
  ocr: [P.REVIEW_OCR_QUEUE],
  notifications: [P.MANAGE_SYSTEM_SETTINGS],
  audit: [P.ACCESS_AUDIT_LOGS],
  settings: [P.MANAGE_SYSTEM_SETTINGS],
};

/** Dashboards sidebar id → permission(s). */
export const DASH_NAV_PERMS: Record<string, readonly string[]> = {
  /** UI-03 — default Operations Today board. */
  today: [P.VIEW_DASHBOARD],
  /** UI-08 — Executive (CEO) board. */
  ceo: [P.VIEW_DASHBOARD],
  /** UI-08 — Reports / management tables (same APIs as executive). */
  reports: [P.VIEW_DASHBOARD, P.FINANCIAL_REPORTS],
  ops: [P.VIEW_DASHBOARD],
  /** T002-09 — Visa / MOFA / Long-Stay backlog widgets (architecture §12). */
  visa: [P.VIEW_DASHBOARD],
  finance: [P.FINANCIAL_REPORTS],
  dispatch: [P.VIEW_DASHBOARD],
  arrival: [P.VIEW_DASHBOARD],
  departure: [P.VIEW_DASHBOARD],
  agent: [P.VIEW_DASHBOARD], // staff view of agent KPIs
  supplier: [P.VIEW_DASHBOARD],
};

export function filterNavByPerms<T extends { id: string }>(
  items: T[],
  map: Record<string, readonly string[]>,
  user: ApiUser | null = sessionUser(),
): T[] {
  return items.filter((item) => {
    const need = map[item.id];
    if (!need) return false;
    return hasAnyPermission(need, user);
  });
}
