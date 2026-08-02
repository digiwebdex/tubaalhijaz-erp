/**
 * S1-05 self-test — run with:
 *   node --experimental-strip-types src/app/lib/rbac.selftest.ts
 * (from apps/web). Pure permission matrix; no DOM / sessionStorage.
 */
import assert from "node:assert/strict";
import type { ApiUser } from "./api";
import {
  canAccessPath,
  filterModsByPermission,
  filterNavByPerms,
  hasPermission,
  homePathForUser,
  P,
  SA_NAV_PERMS,
  DASH_NAV_PERMS,
} from "./rbac";

function user(partial: Partial<ApiUser> & Pick<ApiUser, "permissions">): ApiUser {
  return {
    id: "u",
    email: "t@test",
    name: "Test",
    nameBn: null,
    role: partial.role ?? "TEST",
    roleName: "Test",
    permissions: partial.permissions,
    companyId: partial.companyId ?? null,
    company: partial.company ?? null,
  };
}

const admin = user({
  role: "SUPER_ADMIN",
  permissions: Object.values(P),
});
const ops = user({
  role: "OPS_STAFF",
  permissions: [P.VIEW_DASHBOARD, P.APPROVE_COMPANIES, P.CONFIGURE_WORKFLOWS, P.REVIEW_OCR_QUEUE],
});
const finance = user({
  role: "FINANCE_STAFF",
  permissions: [P.VIEW_DASHBOARD, P.FINANCIAL_REPORTS, P.EDIT_FINANCIAL_RECORDS, P.ACCESS_AUDIT_LOGS],
});
const agent = user({
  role: "AGENT",
  permissions: [],
  companyId: "c1",
  company: {
    id: "c1",
    code: "A",
    type: "AGENT",
    name: "Agency",
    nameBn: null,
    verificationStatus: "VERIFIED",
    rejectionReason: null,
    joinedAt: "",
    supplierType: null,
    platformRating: null,
  },
});
const supplier = user({
  role: "SUPPLIER",
  permissions: [],
  companyId: "c2",
  company: {
    id: "c2",
    code: "S",
    type: "SUPPLIER",
    name: "Hotel",
    nameBn: null,
    verificationStatus: "VERIFIED",
    rejectionReason: null,
    joinedAt: "",
    supplierType: "HOTEL",
    platformRating: null,
  },
});

assert.equal(canAccessPath("/ops-control", ops), true);
assert.equal(canAccessPath("/fleet-erp", ops), false);
assert.equal(canAccessPath("/ocr-center", ops), true);

// S2-04 — Finance ERP UX gate (FINANCIAL_REPORTS). API remains the real boundary.
assert.equal(canAccessPath("/finance-erp", admin), true); // SUPER_ADMIN
assert.equal(canAccessPath("/finance-erp", finance), true); // FINANCE_STAFF
assert.equal(canAccessPath("/finance-erp", ops), false); // OPS_STAFF
assert.equal(canAccessPath("/finance-erp", agent), false); // AGENT tenant
assert.equal(canAccessPath("/finance-erp", supplier), false); // SUPPLIER tenant

// S2-05 — Automation Admin UX gate (CONFIGURE_WORKFLOWS).
assert.equal(canAccessPath("/automation", admin), true); // SUPER_ADMIN
assert.equal(canAccessPath("/automation", ops), true); // OPS_STAFF
assert.equal(canAccessPath("/automation", finance), false); // FINANCE_STAFF
assert.equal(canAccessPath("/automation", agent), false); // AGENT tenant
assert.equal(canAccessPath("/automation", supplier), false); // SUPPLIER tenant

assert.equal(canAccessPath("/ops-control", agent), false);
assert.equal(canAccessPath("/agent-portal", agent), true);
assert.equal(canAccessPath("/supplier-portal", agent), false);
assert.equal(canAccessPath("/supplier-portal", supplier), true);
assert.equal(canAccessPath("/super-admin", agent), false);
assert.equal(canAccessPath("/super-admin", ops), true); // APPROVE_COMPANIES
assert.equal(canAccessPath("/super-admin", finance), true); // ACCESS_AUDIT_LOGS
assert.equal(homePathForUser(agent), "/agent-portal");
assert.equal(homePathForUser(supplier), "/supplier-portal");
assert.equal(homePathForUser(finance), "/dashboards"); // VIEW_DASHBOARD before finance in homePathForUser
assert.equal(hasPermission(P.REVIEW_OCR_QUEUE, ops), true);
assert.equal(hasPermission(P.REVIEW_OCR_QUEUE, agent), false);

const mods = filterModsByPermission(
  [
    { id: "ops", path: "/ops-control" },
    { id: "fleet", path: "/fleet-erp" },
    { id: "docs", path: "/ocr-center" },
    { id: "finance", path: "/finance-erp" },
  ],
  ops,
);
assert.deepEqual(mods.map((m) => m.id).sort(), ["docs", "ops"]);

const financeMods = filterModsByPermission(
  [
    { id: "ops", path: "/ops-control" },
    { id: "finance", path: "/finance-erp" },
  ],
  finance,
);
assert.deepEqual(financeMods.map((m) => m.id).sort(), ["finance", "ops"]);

assert.equal(filterModsByPermission([{ id: "ops", path: "/ops-control" }], agent).length, 0);
assert.equal(filterModsByPermission([{ id: "finance", path: "/finance-erp" }], supplier).length, 0);

const sa = filterNavByPerms(
  [{ id: "companies" }, { id: "users" }, { id: "audit" }, { id: "automation" }],
  SA_NAV_PERMS,
  ops,
);
assert.deepEqual(sa.map((n) => n.id).sort(), ["automation", "companies"]);

const saFinance = filterNavByPerms(
  [{ id: "automation" }, { id: "audit" }],
  SA_NAV_PERMS,
  finance,
);
assert.deepEqual(saFinance.map((n) => n.id), ["audit"]);

const dash = filterNavByPerms(
  [{ id: "today" }, { id: "ceo" }, { id: "finance" }],
  DASH_NAV_PERMS,
  finance,
);
assert.deepEqual(dash.map((n) => n.id).sort(), ["ceo", "finance", "today"]);

assert.equal(canAccessPath("/dashboards", admin), true);
assert.equal(canAccessPath("/fleet-erp", admin), true);

console.log("rbac.selftest: OK");
