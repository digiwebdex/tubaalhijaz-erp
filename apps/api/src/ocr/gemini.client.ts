import { Injectable, Logger } from "@nestjs/common";
import { request as httpsRequest } from "https";
import type { AnnotateOpts, OcrProvider, OcrResult } from "./vision.client";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { totalTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

/**
 * OCR via Google Gemini (Generative Language API, AI-Studio key). Used as a
 * drop-in OcrProvider.
 *
 * For passports Gemini returns a single JSON object holding BOTH the two MRZ
 * lines (transcribed verbatim) AND the printed visual-inspection-zone fields.
 * Downstream, parseMrz + ICAO check digits stay authoritative whenever the MRZ
 * parses; when it doesn't (some e-passports defeat MRZ OCR) the visual-zone
 * fields become the fallback source of passenger data — so the reviewer gets
 * pre-filled fields to confirm instead of bare raw text. For non-passports we
 * still just transcribe to raw text.
 *
 * No SDK dependency (raw HTTPS). Auth via the `x-goog-api-key` header. Runs on
 * the free tier, so it works without Google Cloud billing.
 */
@Injectable()
export class GeminiClient implements OcrProvider {
  private readonly log = new Logger("GeminiClient");

  get configured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  private model(): string {
    return process.env.GEMINI_MODEL || "gemini-flash-latest";
  }

  async annotate(image: Buffer, opts: AnnotateOpts = {}): Promise<OcrResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const mime = opts.mimeType || sniffMime(image);
    const isPassport = opts.documentType === "PASSPORT";
    const isNusukList = opts.documentType === "NUSUK_GROUP_LIST";
    const prompt = isPassport
      ? PASSPORT_PROMPT
      : isNusukList
        ? NUSUK_GROUP_LIST_PROMPT
        : GENERIC_PROMPT;
    // A generous token budget leaves room for the model's internal reasoning
    // without truncating the payload. Structured types force JSON responses.
    const generationConfig: Record<string, unknown> = { temperature: 0, maxOutputTokens: 4096 };
    if (isPassport || isNusukList) generationConfig.responseMimeType = "application/json";
    const body = {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: image.toString("base64") } }] }],
      generationConfig,
    };
    const res = await this.post(this.model(), key, body);
    if (res.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request: ${res.promptFeedback.blockReason}`);
    }
    const raw = (res.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    this.log.log(`gemini OCR ok (${res.usageMetadata?.totalTokenCount ?? "?"} tokens, ${raw.length} chars)`);

    if (isPassport) {
      const parsed = parsePassportJson(raw);
      if (parsed) {
        // MRZ lines first so parseMrz + ICAO check digits still run and stay
        // authoritative; the labelled visual dump follows for the reviewer's
        // raw-text reference (the ':' labels keep it out of MRZ line detection).
        const mrzText = [parsed.mrzLine1, parsed.mrzLine2].filter(Boolean).join("\n");
        const dump = visualDump(parsed.structured);
        const fullText = [mrzText, dump].filter(Boolean).join("\n\n");
        return {
          fullText: fullText || raw,
          words: [],
          meanConfidence: fullText ? 0.9 : 0,
          provider: "gemini",
          structured: parsed.structured,
        };
      }
      this.log.warn("gemini passport JSON parse failed; falling back to raw transcription");
    }

    if (isNusukList) {
      const parsed = parseNusukGroupListJson(raw);
      if (parsed) {
        const dump = nusukDump(parsed);
        return {
          fullText: dump || raw,
          words: [],
          meanConfidence: dump ? 0.9 : 0,
          provider: "gemini",
          structured: parsed,
        };
      }
      this.log.warn("gemini Nusuk Group List JSON parse failed; falling back to raw transcription");
    }

    // Gemini gives no per-word confidence; MRZ check digits drive real passport
    // confidence downstream. Use a neutral prior for the generic path.
    return { fullText: raw, words: [], meanConfidence: raw ? 0.9 : 0, provider: "gemini" };
  }

  private post(model: string, key: string, body: unknown): Promise<GeminiResponse> {
    const payload = JSON.stringify(body);
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString();
            if ((res.statusCode ?? 0) >= 400) {
              return reject(new Error(`Gemini API ${res.statusCode}: ${text.slice(0, 300)}`));
            }
            try {
              resolve(JSON.parse(text) as GeminiResponse);
            } catch (e) {
              reject(e as Error);
            }
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }
}

const PASSPORT_PROMPT = `You are a passport data-extraction engine. Read this passport image and return ONLY a single JSON object (no markdown, no commentary) with EXACTLY these keys:
"mrzLine1","mrzLine2": the two Machine Readable Zone lines at the bottom, transcribed EXACTLY character-for-character including every '<' filler, with no spaces added or removed and NO corrections or guessing. Use "" if a line is not visible.
"surname","givenNames": the holder name from the printed visual inspection zone.
"passportNumber": the passport/document number.
"nationality": nationality as printed (country name or 3-letter code).
"dateOfBirth","dateOfExpiry": ISO format YYYY-MM-DD.
"sex": "M", "F" or "X".
"issuingCountry": issuing country/authority as printed.
"personalNumber": the personal number if present, else null.
Read the visual-zone fields from the PRINTED text, not only the MRZ. For any field you cannot read use null (use "" for the MRZ lines). Output the JSON object only.`;

const GENERIC_PROMPT =
  "You are a strict OCR engine. Transcribe ALL visible text from this document image exactly as printed, " +
  "preserving line breaks and reading order. Output only the raw text, no commentary, no markdown.";

/** T001-07 — Nusuk Groups List image → Group Number spine fields. */
const NUSUK_GROUP_LIST_PROMPT = `You are a Nusuk Umrah/Hajj Groups List extraction engine. Read this Groups List / Nusuk group register image and return ONLY a single JSON object (no markdown, no commentary) with EXACTLY these keys:
"nusukGroupNumber": the Nusuk / official Group Number as printed (string).
"groupName": group or party name if shown, else null.
"consulate": consulate / visa center / embassy name if shown, else null.
"paxCount": number of pilgrims/mutamers/pax as an integer string (e.g. "45"), else null.
"agentCode": external agent / EA / agency code if shown, else null.
"departDate","returnDate": ISO YYYY-MM-DD when printed, else null.
For any field you cannot read use null. Output the JSON object only.`;

interface PassportJson {
  mrzLine1: string;
  mrzLine2: string;
  structured: Record<string, string | null>;
}

/** Map Gemini's passport JSON onto the canonical extraction field keys. Returns
 * null when the response isn't parseable JSON (caller falls back to raw text). */
function parsePassportJson(text: string): PassportJson | null {
  const obj = looseJson(text);
  if (!obj) return null;
  const s = (v: unknown): string | null => {
    if (v == null) return null;
    const t = String(v).trim();
    return t && t.toLowerCase() !== "null" ? t : null;
  };
  const given = s(obj.givenNames);
  const surname = s(obj.surname);
  const name = [given, surname].filter(Boolean).join(" ") || null;
  const structured: Record<string, string | null> = {
    name,
    passportNo: s(obj.passportNumber),
    nationality: s(obj.nationality),
    dob: s(obj.dateOfBirth),
    sex: normSex(s(obj.sex)),
    passportExpiry: s(obj.dateOfExpiry),
    issuingCountry: s(obj.issuingCountry),
    personalNumber: s(obj.personalNumber),
  };
  return {
    mrzLine1: String(obj.mrzLine1 ?? "").replace(/\s+/g, "").toUpperCase(),
    mrzLine2: String(obj.mrzLine2 ?? "").replace(/\s+/g, "").toUpperCase(),
    structured,
  };
}

function normSex(v: string | null): string | null {
  if (!v) return null;
  const u = v.toUpperCase();
  if (u.startsWith("M")) return "M";
  if (u.startsWith("F")) return "F";
  if (u === "X") return "X";
  return null;
}

/** Best-effort JSON extraction: strip any markdown fence, then parse the object
 * between the first '{' and last '}'. */
function looseJson(text: string): Record<string, unknown> | null {
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    const o = JSON.parse(t);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Human-readable labelled dump of the visual fields for the reviewer's raw-text
 * reference. The ':' labels guarantee these lines fail MRZ line detection. */
function visualDump(s: Record<string, string | null>): string {
  const labels: [string, string][] = [
    ["Name", s.name ?? ""],
    ["Passport No", s.passportNo ?? ""],
    ["Nationality", s.nationality ?? ""],
    ["Date of Birth", s.dob ?? ""],
    ["Sex", s.sex ?? ""],
    ["Expiry", s.passportExpiry ?? ""],
    ["Issuing Country", s.issuingCountry ?? ""],
    ["Personal No", s.personalNumber ?? ""],
  ];
  return labels.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
}

function parseNusukGroupListJson(text: string): Record<string, string | null> | null {
  const obj = looseJson(text);
  if (!obj) return null;
  const s = (v: unknown): string | null => {
    if (v == null) return null;
    const t = String(v).trim();
    return t && t.toLowerCase() !== "null" ? t : null;
  };
  return {
    nusukGroupNumber: s(obj.nusukGroupNumber),
    groupName: s(obj.groupName),
    consulate: s(obj.consulate),
    paxCount: s(obj.paxCount),
    agentCode: s(obj.agentCode),
    departDate: s(obj.departDate),
    returnDate: s(obj.returnDate),
  };
}

function nusukDump(s: Record<string, string | null>): string {
  const labels: [string, string][] = [
    ["Group Number", s.nusukGroupNumber ?? ""],
    ["Group Name", s.groupName ?? ""],
    ["Consulate", s.consulate ?? ""],
    ["Pax Count", s.paxCount ?? ""],
    ["Agent Code", s.agentCode ?? ""],
    ["Depart", s.departDate ?? ""],
    ["Return", s.returnDate ?? ""],
  ];
  return labels.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
}

/** Detect an image/pdf MIME type from magic bytes (Gemini needs a correct type). */
function sniffMime(buf: Buffer): string {
  if (buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
    if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  }
  return "image/jpeg";
}
