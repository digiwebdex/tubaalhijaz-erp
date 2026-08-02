/**
 * Passport MRZ (TD3, 2 lines x 44 chars) parser. Extracts the machine-readable
 * zone from raw OCR text, validates ICAO 9303 check digits, and returns
 * normalised fields with a confidence derived from how many checks passed.
 */
export interface MrzFields {
  documentType: string | null;
  issuingCountry: string | null;
  surname: string | null;
  givenNames: string | null;
  passportNo: string | null;
  nationality: string | null;
  dob: string | null; // ISO yyyy-mm-dd
  sex: string | null; // M | F | X
  expiry: string | null; // ISO yyyy-mm-dd
  personalNumber: string | null;
}
export interface MrzCheck {
  field: string;
  ok: boolean;
}
export interface MrzResult {
  fields: MrzFields;
  checks: MrzCheck[];
  valid: boolean; // every check digit passed
  confidence: number; // fraction of checks that passed (0..1)
  lines: [string, string];
}

const CHAR_RE = /^[A-Z0-9<]+$/;
const WEIGHTS = [7, 3, 1];

function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55; // A=10 .. Z=35
  return 0; // '<' and anything else -> 0
}
function computeCheck(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += charValue(input[i]) * WEIGHTS[i % 3];
  return sum % 10;
}
function humanize(field: string): string {
  return field.replace(/</g, " ").replace(/\s+/g, " ").trim();
}
function splitNames(field: string): { surname: string | null; given: string | null } {
  const [sur, giv] = field.split("<<");
  return { surname: sur ? humanize(sur) : null, given: giv ? humanize(giv) : null };
}
function toIsoDate(yymmdd: string, kind: "dob" | "expiry"): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const nowYY = new Date().getFullYear() % 100;
  // dob is in the past; expiry is in the near future -> 2000s.
  const century = kind === "dob" ? (yy > nowYY ? 1900 : 2000) : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

export function parseMrz(text: string): MrzResult | null {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, "").toUpperCase())
    .filter((l) => l.length >= 30 && CHAR_RE.test(l));

  let l1 = "";
  let l2 = "";
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (a.startsWith("P") && a.includes("<") && /^[A-Z0-9<]{30,}$/.test(b)) {
      l1 = a;
      l2 = b;
      break;
    }
  }
  if (!l2) {
    const long = rows.filter((l) => l.length >= 40);
    if (long.length >= 2) {
      l1 = long[long.length - 2];
      l2 = long[long.length - 1];
    }
  }
  if (!l1 || !l2) return null;

  const pad = (s: string) => (s + "<".repeat(44)).slice(0, 44);
  l1 = pad(l1);
  l2 = pad(l2);

  const documentType = l1.slice(0, 1).replace(/</g, "") || null;
  const issuingCountry = l1.slice(2, 5).replace(/</g, "") || null;
  const nm = splitNames(l1.slice(5, 44));

  const passportNoRaw = l2.slice(0, 9);
  const passportNoCheck = l2.slice(9, 10);
  const nationality = l2.slice(10, 13).replace(/</g, "") || null;
  const dobRaw = l2.slice(13, 19);
  const dobCheck = l2.slice(19, 20);
  const sexRaw = l2.slice(20, 21);
  const expiryRaw = l2.slice(21, 27);
  const expiryCheck = l2.slice(27, 28);
  const personalRaw = l2.slice(28, 42);
  const personalCheck = l2.slice(42, 43);
  const finalCheck = l2.slice(43, 44);

  const checks: MrzCheck[] = [
    { field: "passportNo", ok: String(computeCheck(passportNoRaw)) === passportNoCheck },
    { field: "dob", ok: String(computeCheck(dobRaw)) === dobCheck },
    { field: "expiry", ok: String(computeCheck(expiryRaw)) === expiryCheck },
  ];
  if (/[A-Z0-9]/.test(personalRaw)) {
    checks.push({ field: "personalNumber", ok: String(computeCheck(personalRaw)) === personalCheck });
  }
  const composite =
    passportNoRaw + passportNoCheck + dobRaw + dobCheck + expiryRaw + expiryCheck + personalRaw + personalCheck;
  checks.push({ field: "composite", ok: String(computeCheck(composite)) === finalCheck });

  const passed = checks.filter((c) => c.ok).length;
  const sex = sexRaw === "M" || sexRaw === "F" || sexRaw === "X" ? sexRaw : null;

  const fields: MrzFields = {
    documentType,
    issuingCountry,
    surname: nm.surname,
    givenNames: nm.given,
    passportNo: passportNoRaw.replace(/</g, "") || null,
    nationality,
    dob: toIsoDate(dobRaw, "dob"),
    sex,
    expiry: toIsoDate(expiryRaw, "expiry"),
    personalNumber: personalRaw.replace(/</g, "") || null,
  };
  return {
    fields,
    checks,
    valid: passed === checks.length,
    confidence: checks.length ? passed / checks.length : 0,
    lines: [l1, l2],
  };
}
