/**
 * UI-02 nav visibility — run with:
 *   npm run test:nav -C apps/web
 * or: npx tsx src/app/lib/navConfig.selftest.ts
 */
import assert from "node:assert/strict";
import type { ApiUser } from "./api";
import { P } from "./rbac";
import {
  ADVANCED_TOOLS,
  filterAdvancedTools,
  filterNavGroups,
  groupsForUser,
  STAFF_NAV_GROUPS,
} from "./navConfig";

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

const admin = user({ role: "SUPER_ADMIN", permissions: Object.values(P) });
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

const opsIds = filterNavGroups(STAFF_NAV_GROUPS, ops).flatMap((g) => g.items.map((i) => i.id));
assert.ok(opsIds.includes("dashboard"));
assert.ok(opsIds.includes("visa-desk"));
assert.ok(opsIds.includes("long-stay"));
assert.ok(!opsIds.includes("finance"), "Finance hidden for ops without FINANCIAL_REPORTS");

const finIds = filterNavGroups(STAFF_NAV_GROUPS, finance).flatMap((g) => g.items.map((i) => i.id));
assert.ok(finIds.includes("finance"));
assert.ok(finIds.includes("reports"));
assert.ok(finIds.includes("dashboard"));

const advOps = filterAdvancedTools(ops).map((i) => i.id);
assert.ok(advOps.includes("adv-ocr"));
assert.ok(advOps.includes("adv-automation"));
assert.ok(!advOps.includes("adv-audit"));

const advFin = filterAdvancedTools(finance).map((i) => i.id);
assert.ok(advFin.includes("adv-audit"));
assert.ok(!advFin.includes("adv-ocr"));

// Advanced tools must not sit in top-level staff groups
const topLevelIds = STAFF_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
for (const adv of ADVANCED_TOOLS) {
  assert.ok(!topLevelIds.includes(adv.id));
}

const agentGroups = groupsForUser(agent);
assert.ok(agentGroups.some((g) => g.items.some((i) => i.portalTab === "groups")));
assert.equal(
  agentGroups.flatMap((g) => g.items).every((i) => i.path === "/agent-portal"),
  true,
);

assert.ok(groupsForUser(admin).length > 0);

console.log("navConfig.selftest: OK");
