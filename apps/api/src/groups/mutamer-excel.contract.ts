/**
 * T001-04/05 — Mutamer Excel column contract + header resolution.
 * Source of truth for import mapping (Business Discovery sample sheet).
 */

export type MutamerExcelApiField =
  | "name"
  | "age"
  | "passportNo"
  | "nationality"
  | "mainEaCode"
  | "mainEaName"
  | "subEaCode"
  | "subEaName"
  | "visaStatusLabel"
  | "biometricStatus"
  | "visaNumber"
  | "mofaNumber"
  | "mutamerType"
  | "gender"
  | "dob"
  | "passportExpiry"
  | "phone";

export interface MutamerExcelColumn {
  header: string;
  apiField: MutamerExcelApiField;
  required: boolean;
  aliases?: string[];
}

/** Official business sample → Passenger field map. */
export const MUTAMER_EXCEL_COLUMNS: readonly MutamerExcelColumn[] = [
  { header: "Mutamer Name", apiField: "name", required: true, aliases: ["Name", "Full Name", "Mutamer name", "Passenger Name"] },
  { header: "Age", apiField: "age", required: false },
  { header: "Passport", apiField: "passportNo", required: true, aliases: ["Passport No", "Passport Number"] },
  { header: "Nationality", apiField: "nationality", required: true },
  {
    header: "Main External Agent Code",
    apiField: "mainEaCode",
    required: true,
    aliases: ["Main EA Code", "Main External Agent", "Main EA"],
  },
  {
    header: "Main External Agent Name",
    apiField: "mainEaName",
    required: false,
    aliases: ["Main EA Name"],
  },
  {
    header: "Sub External Agent Code",
    apiField: "subEaCode",
    required: true,
    aliases: ["Sub EA Code", "Sub External Agent", "Sub EA"],
  },
  {
    header: "Sub External Agent Name",
    apiField: "subEaName",
    required: false,
    aliases: ["Sub EA Name"],
  },
  {
    header: "Visa Status",
    apiField: "visaStatusLabel",
    required: true,
    aliases: ["Visa status", "Visa Type", "Visa type"],
  },
  {
    header: "Biometric Status",
    apiField: "biometricStatus",
    required: false,
    aliases: ["Biometric status", "Biometric"],
  },
  { header: "Visa Number", apiField: "visaNumber", required: false, aliases: ["Visa No"] },
  { header: "MOFA Number", apiField: "mofaNumber", required: false, aliases: ["MOFA No", "MOFA"] },
  {
    header: "Mutamer Type",
    apiField: "mutamerType",
    required: false,
    aliases: ["Type", "Mutamer type"],
  },
  // Legacy agent-portal template columns.
  { header: "Gender", apiField: "gender", required: false, aliases: ["Sex"] },
  { header: "Date of Birth", apiField: "dob", required: false, aliases: ["DOB"] },
  { header: "Passport Expiry", apiField: "passportExpiry", required: false },
  { header: "Phone", apiField: "phone", required: false, aliases: ["Mobile", "Contact"] },
] as const;

export const MUTAMER_IMPORT_MAX_ROWS = 1000;

/** Fields always required on every import mode. */
export const ALWAYS_REQUIRED_FIELDS: readonly MutamerExcelApiField[] = [
  "name",
  "passportNo",
  "nationality",
];

/** Extra required fields when the workbook is a business Mutamer sheet. */
export const BUSINESS_REQUIRED_FIELDS: readonly MutamerExcelApiField[] = [
  "mainEaCode",
  "subEaCode",
  "visaStatusLabel",
];

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve a sheet header to an API field using contract headers + aliases. */
export function resolveHeaderToField(header: string): MutamerExcelApiField | null {
  const n = normalizeHeader(header);
  if (!n) return null;
  for (const col of MUTAMER_EXCEL_COLUMNS) {
    const candidates = [col.header, ...(col.aliases ?? [])].map(normalizeHeader);
    if (candidates.includes(n)) return col.apiField;
  }
  // Fuzzy fallbacks for common variants
  if (n.includes("nation")) return "nationality";
  if (n.includes("mutamer") && n.includes("name")) return "name";
  if (n === "name" || n.includes("full name") || n.includes("passenger name")) return "name";
  if (n.includes("passport") && (n.includes("expir") || n.includes("expiry"))) return "passportExpiry";
  if (n.includes("passport")) return "passportNo";
  if (n.includes("main") && n.includes("code")) return "mainEaCode";
  if (n.includes("main") && n.includes("name")) return "mainEaName";
  if (n.includes("sub") && n.includes("code")) return "subEaCode";
  if (n.includes("sub") && n.includes("name")) return "subEaName";
  if (n.includes("biometric")) return "biometricStatus";
  if (n.includes("mofa")) return "mofaNumber";
  if (n.includes("visa") && n.includes("number")) return "visaNumber";
  if (n.includes("visa") && (n.includes("status") || n.includes("type"))) return "visaStatusLabel";
  if (n.includes("mutamer") && n.includes("type")) return "mutamerType";
  if (n === "age") return "age";
  if (n.includes("gender") || n === "sex") return "gender";
  if (n.includes("birth") || n === "dob") return "dob";
  if (n.includes("phone") || n.includes("mobile") || n.includes("whatsapp")) return "phone";
  return null;
}

/** Business Mutamer sheet if Main/Sub EA or Visa Status columns are present. */
export function isBusinessWorkbook(mappedFields: Iterable<MutamerExcelApiField | null>): boolean {
  const set = new Set([...mappedFields].filter(Boolean) as MutamerExcelApiField[]);
  return set.has("mainEaCode") || set.has("subEaCode") || set.has("visaStatusLabel");
}

export function mapVisaStatusLabelToEnum(
  label: string | null | undefined,
): "PENDING" | "APPROVED" | "REJECTED" | null {
  if (!label?.trim()) return null;
  const t = label.trim().toLowerCase();
  if (t.includes("not issued") || t.includes("pending") || t === "visa not issued" || t.includes("await")) {
    return "PENDING";
  }
  if (t.includes("reject") || t.includes("denied") || t.includes("cancel")) {
    return "REJECTED";
  }
  if (t.includes("issued") || t.includes("approved") || t.includes("granted") || t === "ready") {
    return "APPROVED";
  }
  return null;
}

export function mapVisaStatusEnumToLabel(
  status: "PENDING" | "APPROVED" | "REJECTED" | string | null | undefined,
): string | null {
  if (!status) return null;
  if (status === "PENDING") return "Visa Not Issued";
  if (status === "APPROVED") return "Visa Issued";
  if (status === "REJECTED") return "Rejected";
  return null;
}
