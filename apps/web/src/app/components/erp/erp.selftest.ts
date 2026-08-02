/**
 * UI-04 component kit self-test — run:
 *   pnpm run test:erp
 * (from apps/web)
 */
import assert from "node:assert/strict";
import {
  ERP,
  STATUS_META,
  SEARCH_PLACEHOLDER_BN,
  SEARCH_PLACEHOLDER_EN,
} from "./tokens";

assert.equal(ERP.navy, "#0B1E3F");
assert.equal(ERP.gold, "#C9A24B");
assert.equal(ERP.destructive, "#DC2626");
assert.equal(ERP.success, "#16A34A");
assert.equal(ERP.warning, "#D97706");
assert.equal(ERP.drawerMaxWidth, 720);
assert.equal(ERP.touchMin, 44);

const kinds = ["pending", "warning", "approved", "completed", "rejected", "cancelled", "info"] as const;
for (const k of kinds) {
  assert.ok(STATUS_META[k].color);
  assert.ok(STATUS_META[k].labelBn.length > 0);
  assert.ok(STATUS_META[k].labelEn.length > 0);
}

assert.ok(SEARCH_PLACEHOLDER_BN.includes("পাসপোর্ট"));
assert.ok(SEARCH_PLACEHOLDER_EN.toLowerCase().includes("passport"));

// Variant contract — buttons / table rules documented in tokens
assert.ok(ERP.radius.sm >= 6);
assert.ok(ERP.radius.md >= ERP.radius.sm);

console.log("erp.selftest: OK");
