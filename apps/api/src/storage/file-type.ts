// ─── Upload content validation (Phase 13) ────────────────────────────────────
// Basic virus/type scanning: verify a file's real bytes (magic number) rather
// than trusting the client-declared Content-Type — the minimum bar before we
// accept and persist a file. A declared image/png that is actually an executable
// is rejected. `scanBuffer` is the hook a real AV (ClamAV) plugs into later.

const ALLOWED = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/tiff",
]);

/** Detect the MIME type from the leading bytes; null if unrecognized. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  const b = buf;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf"; // %PDF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png"; // \x89PNG
  if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) return "image/tiff"; // II*\0
  if (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a) return "image/tiff"; // MM\0*
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  const head = b.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "image/svg+xml";
  return null;
}

export interface ScanResult {
  ok: boolean;
  detected: string | null;
  reason?: string;
}

/**
 * Validate an uploaded buffer: recognized signature, in the allow-list, and the
 * declared type matches the real content. (Content-Type spoofing → rejected.)
 */
export function validateUpload(buf: Buffer, declaredMime?: string): ScanResult {
  const detected = sniffMime(buf);
  if (!detected) return { ok: false, detected: null, reason: "unrecognized or disallowed file signature" };
  if (!ALLOWED.has(detected)) return { ok: false, detected, reason: `content type ${detected} is not allowed` };
  // SVG is text/XML — declared may be image/svg+xml or text/*; don't over-enforce.
  if (declaredMime && detected !== "image/svg+xml" && declaredMime !== detected) {
    return { ok: false, detected, reason: `declared ${declaredMime} but file content is ${detected}` };
  }
  return { ok: true, detected };
}

/** AV hook — real ClamAV integration plugs in here later. Today: content check only. */
export async function scanBuffer(buf: Buffer, declaredMime?: string): Promise<ScanResult> {
  return validateUpload(buf, declaredMime);
}
