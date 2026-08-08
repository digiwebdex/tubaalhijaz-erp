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

// Theme-aware (2026-08-07): colours are CSS custom-property refs resolved per
// theme scope at runtime (Legacy on :root, DS on .erp-theme-ds). The token layer
// only guarantees each slot points at its var; concrete palettes live in
// styles/erp-theme.css.
assert.equal(ERP.navy, "var(--erp-text-strong)");
assert.equal(ERP.gold, "var(--erp-accent)");
assert.equal(ERP.primaryBg, "var(--erp-primary-bg)");
assert.equal(ERP.primaryFg, "var(--erp-primary-fg)");
assert.equal(ERP.destructive, "var(--erp-destructive)");
assert.equal(ERP.success, "var(--erp-success)");
assert.equal(ERP.warning, "var(--erp-warning)");
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

// Variant contract — radii are now themeable CSS-var refs.
assert.equal(ERP.radius.sm, "var(--erp-radius-sm)");
assert.equal(ERP.radius.md, "var(--erp-radius-md)");
assert.equal(ERP.radius.lg, "var(--erp-radius-lg)");

console.log("erp.selftest: OK");
