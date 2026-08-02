/**
 * T001-03 — Group foundation UI helpers (pure).
 * Backend remains source of truth; these only shape UX and request payloads.
 */

export type VisaTypeUi = "umrah" | "hajj" | "longstay";

export const VISA_TYPE_LABEL: Record<string, string> = {
  UMRAH: "Umrah Visa",
  HAJJ: "Hajj Visa",
  LONG_STAY: "Long Stay",
};

export const VISA_UI_TO_ENUM: Record<VisaTypeUi, "UMRAH" | "HAJJ" | "LONG_STAY"> = {
  umrah: "UMRAH",
  hajj: "HAJJ",
  longstay: "LONG_STAY",
};

export const PKG_LABEL: Record<string, string> = {
  ECONOMY: "Economy",
  STANDARD: "Standard",
  PREMIUM: "Premium",
};

export const PKG_ENUM: Record<string, "ECONOMY" | "STANDARD" | "PREMIUM"> = {
  Economy: "ECONOMY",
  Standard: "STANDARD",
  Premium: "PREMIUM",
};

/** UX: WhatsApp expected for Hajj/Umrah (backend enforces when REQUIRE_HAJI_WHATSAPP=true). */
export function whatsappRecommendedForVisa(visa: VisaTypeUi | string | null | undefined): boolean {
  if (!visa) return false;
  const v = String(visa).toUpperCase();
  if (v === "UMRAH" || v === "HAJJ" || v === "umrah" || v === "hajj") return true;
  return false;
}

export function formatNusuk(value?: string | null): string {
  const t = (value ?? "").trim();
  return t.length ? t : "—";
}

export type GateKey = "gateVisa" | "gatePackage" | "gatePayment" | "gateBill";

export const GATE_LABELS: { key: GateKey; label: string }[] = [
  { key: "gateVisa", label: "Visa Ready" },
  { key: "gatePackage", label: "Package Ready" },
  { key: "gatePayment", label: "Payment Ready" },
  { key: "gateBill", label: "Bill Ready" },
];

/** T001-09 — Excel-like Group Master column headers (Operation Map readiness board). */
export const GATE_BOARD_COLS: { key: GateKey; short: string; title: string }[] = [
  { key: "gateVisa", short: "VISA", title: "Visa Ready" },
  { key: "gatePackage", short: "PKG", title: "Package Ready" },
  { key: "gatePayment", short: "PAY", title: "Payment Ready" },
  { key: "gateBill", short: "BILL", title: "Bill Ready" },
];

/** Single-gate PATCH body for inline board toggles. */
export function singleGatePatch(key: GateKey, value: boolean): Record<GateKey, boolean> {
  return { [key]: value } as Record<GateKey, boolean>;
}

export interface GateState {
  gateVisa: boolean;
  gatePackage: boolean;
  gatePayment: boolean;
  gateBill: boolean;
}

export function gatesFromApi(g: Partial<GateState> | null | undefined): GateState {
  return {
    gateVisa: !!g?.gateVisa,
    gatePackage: !!g?.gatePackage,
    gatePayment: !!g?.gatePayment,
    gateBill: !!g?.gateBill,
  };
}

export function gateSummary(g: GateState): string {
  const n = [g.gateVisa, g.gatePackage, g.gatePayment, g.gateBill].filter(Boolean).length;
  return `${n}/4`;
}

/** Build POST/PATCH body fields for foundation spine (omit empty optionals). */
export function foundationPayload(input: {
  nusukGroupNumber?: string;
  hajiWhatsapp?: string;
  consulate?: string;
  /** T002-01 — Company id of verified UMRAH_COMPANY supplier; null clears on PATCH. */
  umrahCompanyId?: string | null;
  packageTypeDisplay?: string;
  visaTypeUi?: VisaTypeUi | null;
  gates?: Partial<GateState>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.visaTypeUi) body.visaType = VISA_UI_TO_ENUM[input.visaTypeUi];
  if (input.packageTypeDisplay && PKG_ENUM[input.packageTypeDisplay]) {
    body.packageType = PKG_ENUM[input.packageTypeDisplay];
  }
  const nusuk = (input.nusukGroupNumber ?? "").trim();
  if (nusuk) body.nusukGroupNumber = nusuk;
  const wa = (input.hajiWhatsapp ?? "").trim();
  if (wa) body.hajiWhatsapp = wa;
  const cons = (input.consulate ?? "").trim();
  if (cons) body.consulate = cons;
  if (input.umrahCompanyId !== undefined) {
    const id = (input.umrahCompanyId ?? "").trim();
    body.umrahCompanyId = id.length ? id : null;
  }
  if (input.gates) {
    for (const { key } of GATE_LABELS) {
      if (typeof input.gates[key] === "boolean") body[key] = input.gates[key];
    }
  }
  return body;
}

/** UX guard before create/update when visa is Hajj/Umrah. */
export function validateWhatsappUx(
  visa: VisaTypeUi | string | null | undefined,
  whatsapp: string,
): string | null {
  if (!whatsappRecommendedForVisa(visa)) return null;
  if (whatsapp.trim().length < 5) {
    return "Enter Haji WhatsApp (at least 5 characters) for Hajj / Umrah groups";
  }
  return null;
}
