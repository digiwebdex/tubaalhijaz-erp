/**
 * T001-03 / T002-01 self-test — run with:
 *   pnpm exec ts-node --transpile-only -O '{"module":"commonjs"}' src/app/lib/group-foundation.selftest.ts
 * (from apps/web). Pure helpers; no DOM.
 */
import assert from "node:assert/strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  GATE_BOARD_COLS,
  VISA_UI_TO_ENUM,
  formatNusuk,
  foundationPayload,
  gateSummary,
  gatesFromApi,
  singleGatePatch,
  validateWhatsappUx,
  whatsappRecommendedForVisa,
} = require("./group-foundation") as typeof import("./group-foundation");

assert.equal(VISA_UI_TO_ENUM.hajj, "HAJJ");
assert.equal(VISA_UI_TO_ENUM.umrah, "UMRAH");
assert.equal(VISA_UI_TO_ENUM.longstay, "LONG_STAY");

assert.equal(formatNusuk(null), "—");
assert.equal(formatNusuk("  "), "—");
assert.equal(formatNusuk("NUSUK-1"), "NUSUK-1");

assert.equal(whatsappRecommendedForVisa("hajj"), true);
assert.equal(whatsappRecommendedForVisa("UMRAH"), true);
assert.equal(whatsappRecommendedForVisa("longstay"), false);

assert.ok(validateWhatsappUx("hajj", ""));
assert.equal(validateWhatsappUx("hajj", "+966501112233"), null);
assert.equal(validateWhatsappUx("longstay", ""), null);

const gates = gatesFromApi({ gateVisa: true, gatePackage: false });
assert.equal(gates.gateVisa, true);
assert.equal(gates.gatePayment, false);
assert.equal(gateSummary(gates), "1/4");

const body = foundationPayload({
  visaTypeUi: "hajj",
  packageTypeDisplay: "Premium",
  nusukGroupNumber: "  NG-1  ",
  hajiWhatsapp: "+9665",
  gates: { gateVisa: true, gatePackage: true, gatePayment: false, gateBill: false },
});
assert.equal(body.visaType, "HAJJ");
assert.equal(body.packageType, "PREMIUM");
assert.equal(body.nusukGroupNumber, "NG-1");
assert.equal(body.gateVisa, true);
assert.equal(body.gateBill, false);

// Legacy UMRAH payload still maps
const umrah = foundationPayload({ visaTypeUi: "umrah", packageTypeDisplay: "Economy" });
assert.equal(umrah.visaType, "UMRAH");
assert.equal(umrah.packageType, "ECONOMY");

// T002-01 — Umrah Co on foundation payload
const withCo = foundationPayload({ umrahCompanyId: "  co-1  " });
assert.equal(withCo.umrahCompanyId, "co-1");
const clearCo = foundationPayload({ umrahCompanyId: "" });
assert.equal(clearCo.umrahCompanyId, null);

// T001-09 — Excel board columns + single-gate patch
assert.equal(GATE_BOARD_COLS.length, 4);
assert.deepEqual(
  GATE_BOARD_COLS.map((c) => c.short),
  ["VISA", "PKG", "PAY", "BILL"],
);
const patch = singleGatePatch("gatePayment", true);
assert.equal(patch.gatePayment, true);
assert.equal(Object.keys(patch).length, 1);

console.log("group-foundation.selftest: OK");
