import type { OcrDocumentType } from "@prisma/client";
import type { OcrResult } from "./vision.client";
import { parseMrz, type MrzCheck } from "./mrz";
import { OCR_CONF } from "./ocr.constants";

export interface ExtractedField {
  field: string;
  value: string | null;
  confidence: number;
  low: boolean;
  overriddenValue?: string | null;
}
export interface Extraction {
  fields: ExtractedField[];
  confidenceScore: number;
  mrzDiscrepancy: boolean;
  provider: string;
  meta: Record<string, unknown>;
}

/** Confidence for a field read from the printed visual zone (not validated by
 * an MRZ check digit). Kept above OCR_CONF.LOW so it isn't flagged red — the
 * mrzDiscrepancy banner already tells the reviewer to confirm every field. */
const VISUAL_CONF = 0.75;

/** The canonical passenger fields, in display order. */
const CANON_KEYS = [
  "name",
  "passportNo",
  "nationality",
  "dob",
  "sex",
  "passportExpiry",
  "issuingCountry",
  "personalNumber",
] as const;

function mkField(field: string, value: string | null, confidence: number): ExtractedField {
  return { field, value, confidence, low: value != null && confidence < OCR_CONF.LOW };
}

/** Canonical Nusuk Groups List fields (T001-07). */
export const NUSUK_GROUP_LIST_KEYS = [
  "nusukGroupNumber",
  "groupName",
  "consulate",
  "paxCount",
  "agentCode",
  "departDate",
  "returnDate",
] as const;

/** Route to a per-type extractor. Passport is precise (MRZ); Nusuk Group List
 * is structured/regex; the rest are generic best-effort text. */
export function extract(type: OcrDocumentType, ocr: OcrResult): Extraction {
  if (type === "PASSPORT") return extractPassport(ocr);
  if (type === "NUSUK_GROUP_LIST") return extractNusukGroupList(ocr);
  return extractGeneric(ocr);
}

function checkOk(checks: MrzCheck[], field: string): boolean {
  return checks.find((c) => c.field === field)?.ok ?? false;
}

/** Build the canonical fields straight from a provider's visual-zone read. Used
 * when there's no parseable MRZ so the reviewer still gets pre-filled values. */
function fieldsFromStructured(s: Record<string, string | null>): ExtractedField[] {
  return CANON_KEYS.map((k) => mkField(k, s[k] ?? null, VISUAL_CONF));
}

function extractPassport(ocr: OcrResult): Extraction {
  const mrz = parseMrz(ocr.fullText);
  const structured = ocr.structured;

  if (!mrz) {
    // No parseable MRZ. Prefer the provider's structured visual read (some
    // e-passports defeat MRZ OCR) so the reviewer gets pre-filled fields to
    // confirm; only fall back to bare raw text when nothing structured exists.
    if (structured && Object.values(structured).some((v) => v)) {
      const rawRef = mkField("rawText", ocr.fullText.slice(0, 4000) || null, ocr.meanConfidence);
      return {
        fields: [...fieldsFromStructured(structured), rawRef],
        confidenceScore: VISUAL_CONF,
        mrzDiscrepancy: true, // no MRZ checksum -> reviewer confirms every field
        provider: ocr.provider,
        meta: { mrz: false, visual: true },
      };
    }
    return {
      fields: [mkField("rawText", ocr.fullText.slice(0, 4000) || null, ocr.meanConfidence)],
      confidenceScore: ocr.meanConfidence,
      mrzDiscrepancy: true, // no MRZ recognised -> needs a human
      provider: ocr.provider,
      meta: { mrz: false },
    };
  }

  const c = mrz.confidence;
  const f = mrz.fields;
  const name = [f.givenNames, f.surname].filter(Boolean).join(" ") || null;
  const half = (field: string) => (checkOk(mrz.checks, field) ? c : c * 0.5);
  // The MRZ (with ICAO check digits) is authoritative. Where a MRZ field is
  // blank, fall back to the provider's visual read so nothing readable is lost.
  const vis = (key: string) => (structured ? structured[key] ?? null : null);
  const merge = (mrzVal: string | null, key: string, conf: number): ExtractedField =>
    mrzVal != null ? mkField(key, mrzVal, conf) : mkField(key, vis(key), vis(key) ? VISUAL_CONF : conf);
  const fields: ExtractedField[] = [
    merge(name, "name", c),
    merge(f.passportNo, "passportNo", half("passportNo")),
    merge(f.nationality, "nationality", c),
    merge(f.dob, "dob", half("dob")),
    merge(f.sex, "sex", c),
    merge(f.expiry, "passportExpiry", half("expiry")),
    merge(f.issuingCountry, "issuingCountry", c),
    merge(f.personalNumber, "personalNumber", c),
  ];
  const confidenceScore = Math.min(1, mrz.confidence * 0.7 + ocr.meanConfidence * 0.3);
  return {
    fields,
    confidenceScore,
    mrzDiscrepancy: !mrz.valid,
    provider: ocr.provider,
    meta: { mrz: true, mrzLines: mrz.lines, checks: mrz.checks },
  };
}

/**
 * T001-07 — Nusuk Groups List image.
 * Prefer provider structured JSON; fall back to labelled / heuristic regex on fullText.
 */
function extractNusukGroupList(ocr: OcrResult): Extraction {
  const structured = ocr.structured ?? {};
  const text = ocr.fullText ?? "";

  const fromLabel = (labels: string[]): string | null => {
    for (const label of labels) {
      const re = new RegExp(`${label}\\s*[:#]?\\s*([^\\n\\r]+)`, "i");
      const m = text.match(re);
      if (m?.[1]?.trim()) return m[1].trim().replace(/\s{2,}/g, " ");
    }
    return null;
  };

  const pick = (key: string, labels: string[], heuristic?: () => string | null): string | null => {
    const s = structured[key];
    if (s != null && String(s).trim()) return String(s).trim();
    const labelled = fromLabel(labels);
    if (labelled) return labelled;
    return heuristic?.() ?? null;
  };

  const nusukGroupNumber = pick(
    "nusukGroupNumber",
    ["Group Number", "Nusuk Group Number", "Group No", "Nusuk No", "Group ID"],
    () => {
      const tagged = text.match(/\b((?:NUSUK|GRP)[- ]?[A-Z0-9-]{4,})\b/i);
      if (tagged?.[1]) return tagged[1];
      const labelled = text.match(/\bGroup\s*(?:Number|No\.?|#)\s*[:#]?\s*([A-Z0-9-]{4,})\b/i);
      return labelled?.[1] ?? null;
    },
  );
  const groupName = pick("groupName", ["Group Name", "Name", "Mutamer Group", "Agency Group"]);
  const consulate = pick("consulate", ["Consulate", "Embassy", "Visa Center"]);
  const paxRaw = pick("paxCount", ["Pax", "Pax Count", "Pilgrims", "Mutamers", "Capacity", "No of Pilgrims"], () => {
    const m = text.match(/\b(\d{1,3})\s*(?:pax|pilgrims|mutamers)\b/i);
    return m?.[1] ?? null;
  });
  const agentCode = pick("agentCode", ["Agent Code", "EA Code", "Main EA", "Agency Code", "External Agent"]);
  const departDate = pick("departDate", ["Depart", "Departure", "Travel Date", "Start Date"]);
  const returnDate = pick("returnDate", ["Return", "Arrival Back", "End Date"]);

  const normDate = (v: string | null): string | null => {
    if (!v) return null;
    const t = v.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const m = t.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    if (!m) return null;
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const d = String(m[1]).padStart(2, "0");
    const mo = String(m[2]).padStart(2, "0");
    // Prefer ISO if day-first ambiguous; keep as YYYY-MM-DD when year last
    if (m[3].length === 4 || Number(m[3]) > 31) return `${y}-${mo}-${d}`;
    return `${y}-${mo}-${d}`;
  };

  const fields: ExtractedField[] = [
    mkField("nusukGroupNumber", nusukGroupNumber ? nusukGroupNumber.toUpperCase().replace(/\s+/g, "") : null, VISUAL_CONF),
    mkField("groupName", groupName, VISUAL_CONF),
    mkField("consulate", consulate, VISUAL_CONF),
    mkField("paxCount", paxRaw ? String(Number.parseInt(paxRaw.replace(/\D/g, ""), 10) || paxRaw) : null, VISUAL_CONF),
    mkField("agentCode", agentCode, VISUAL_CONF),
    mkField("departDate", normDate(departDate), VISUAL_CONF),
    mkField("returnDate", normDate(returnDate), VISUAL_CONF),
    mkField("rawText", text.slice(0, 4000) || null, ocr.meanConfidence),
  ];

  const present = fields.filter((f) => f.field !== "rawText" && f.value).length;
  const confidenceScore = Math.min(1, (present / 4) * 0.5 + ocr.meanConfidence * 0.5);
  return {
    fields,
    confidenceScore,
    mrzDiscrepancy: false,
    provider: ocr.provider,
    meta: { mrz: false, nusukGroupList: true, present },
  };
}

function extractGeneric(ocr: OcrResult): Extraction {
  const text = ocr.fullText;
  const date = text.match(/\b(\d{2,4}[/.\-]\d{1,2}[/.\-]\d{2,4})\b/);
  const id = text.match(/\b([A-Z]{1,3}\d{5,})\b/);
  const amount = text.match(/\b(\d{1,3}(?:[, ]\d{3})+(?:\.\d{2})?|\d+\.\d{2})\b/);
  const fields: ExtractedField[] = [
    mkField("rawText", text.slice(0, 4000) || null, ocr.meanConfidence),
    mkField("date", date?.[1] ?? null, ocr.meanConfidence),
    mkField("documentNumber", id?.[1] ?? null, ocr.meanConfidence),
    mkField("amount", amount?.[1] ?? null, ocr.meanConfidence),
  ];
  return {
    fields,
    confidenceScore: ocr.meanConfidence,
    mrzDiscrepancy: false,
    provider: ocr.provider,
    meta: { mrz: false, generic: true },
  };
}
