import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Shared secret encryption (AES-256-GCM) for integration credentials at rest.
 * Extracted so integrations.service + email.channel share one implementation
 * (no duplicated crypto). Key derives from JWT_SECRET.
 */
const KEY = createHash("sha256").update(process.env.JWT_SECRET ?? "dev-secret").digest();

export function encSecret(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const e = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), e]).toString("base64");
}

export function decSecret(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", KEY, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}
