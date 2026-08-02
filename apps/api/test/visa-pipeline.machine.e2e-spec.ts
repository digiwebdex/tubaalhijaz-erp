import {
  TRANSITION_MATRIX,
  allowedTargets,
  excelEchoForState,
  gateAssistSuggest,
  validateTransition,
} from "../src/groups/visa-pipeline.machine";

describe("T002-03 visa-pipeline.machine", () => {
  it("happy-path edges exist in the matrix", () => {
    const path = [
      ["NEW", "MOFA"],
      ["MOFA", "EMBASSY"],
      ["EMBASSY", "BIOMETRIC"],
      ["BIOMETRIC", "SUBMITTED"],
      ["SUBMITTED", "PROCESSING"],
      ["PROCESSING", "ISSUED"],
      ["ISSUED", "PASSPORT_RETURNED"],
      ["PASSPORT_RETURNED", "COMPLETED"],
    ] as const;
    for (const [from, to] of path) {
      expect(TRANSITION_MATRIX.some((t) => t.from === from && t.to === to)).toBe(true);
    }
  });

  it("Scenario 1 — NEW → MOFA PASS", () => {
    const v = validateTransition({
      from: "NEW",
      to: "MOFA",
      requirePassportReturn: false,
      hasVisaType: true,
    });
    expect(v.ok).toBe(true);
  });

  it("Scenario 2 — MOFA → EMBASSY PASS (with embassy context)", () => {
    expect(
      validateTransition({
        from: "MOFA",
        to: "EMBASSY",
        requirePassportReturn: false,
        hasEmbassyContext: true,
      }).ok,
    ).toBe(true);
    expect(
      validateTransition({
        from: "MOFA",
        to: "EMBASSY",
        requirePassportReturn: false,
        embassyRef: "EMB-1",
      }).ok,
    ).toBe(true);
    expect(
      validateTransition({
        from: "MOFA",
        to: "EMBASSY",
        requirePassportReturn: false,
      }).ok,
    ).toBe(false);
  });

  it("allowedTargets hides ISSUED→COMPLETED when SOP requirePassportReturn", () => {
    expect(allowedTargets("ISSUED", { requirePassportReturn: true })).not.toContain("COMPLETED");
    expect(allowedTargets("ISSUED", { requirePassportReturn: false })).toContain("COMPLETED");
  });

  it("Scenario 3 — PROCESSING → ISSUED requires visa number", () => {
    expect(
      validateTransition({
        from: "PROCESSING",
        to: "ISSUED",
        requirePassportReturn: false,
        visaNumber: null,
      }).ok,
    ).toBe(false);
    expect(
      validateTransition({
        from: "PROCESSING",
        to: "ISSUED",
        requirePassportReturn: false,
        visaNumber: "V-1",
      }).ok,
    ).toBe(true);
  });

  it("Scenario 4 — ISSUED → PASSPORT_RETURNED requires custody", () => {
    expect(
      validateTransition({
        from: "ISSUED",
        to: "PASSPORT_RETURNED",
        requirePassportReturn: false,
        custodyConfirmed: false,
      }).ok,
    ).toBe(false);
    expect(
      validateTransition({
        from: "ISSUED",
        to: "PASSPORT_RETURNED",
        requirePassportReturn: false,
        custodyConfirmed: true,
      }).ok,
    ).toBe(true);
  });

  it("Scenario 5 — invalid NEW → ISSUED REJECT", () => {
    const v = validateTransition({
      from: "NEW",
      to: "ISSUED",
      requirePassportReturn: false,
      visaNumber: "X",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("FORBIDDEN");
  });

  it("flag blocks ISSUED → COMPLETED when passport return required", () => {
    expect(
      validateTransition({
        from: "ISSUED",
        to: "COMPLETED",
        requirePassportReturn: true,
      }).ok,
    ).toBe(false);
    expect(
      validateTransition({
        from: "ISSUED",
        to: "COMPLETED",
        requirePassportReturn: false,
      }).ok,
    ).toBe(true);
  });

  it("rework + REJECTED_CLOSED edges", () => {
    expect(allowedTargets("REJECTED")).toEqual(
      expect.arrayContaining(["BIOMETRIC", "SUBMITTED", "PROCESSING", "REJECTED_CLOSED"]),
    );
  });

  it("excel echo for ISSUED / REJECTED", () => {
    expect(excelEchoForState("ISSUED", { visaNumber: "V" }).visaStatus).toBe("APPROVED");
    expect(excelEchoForState("REJECTED", { reason: "docs" }).visaRejectReason).toBe("docs");
  });

  it("gate assist threshold", () => {
    expect(gateAssistSuggest({ total: 10, ready: 8 }).suggestGateVisa).toBe(true);
    expect(gateAssistSuggest({ total: 10, ready: 7 }).suggestGateVisa).toBe(false);
  });
});
