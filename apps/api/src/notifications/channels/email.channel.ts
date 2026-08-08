import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { ChannelResult } from "../notifications.constants";
import { PrismaService } from "../../prisma/prisma.service";
import { decSecret } from "../../common/crypto";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface EffectiveConfig {
  host: string | null; port: number; user: string | null;
  pass: string | null; from: string; secure: boolean; fromEnv: boolean;
}

/**
 * Email delivery via SMTP (nodemailer). Effective config is resolved per-send:
 * DB IntegrationConfig("email") (Settings → Integrations) is preferred, falling
 * back to SMTP_* env vars; with neither the channel runs in stub mode (SKIPPED).
 * Extends the original env-only backend — env still works unchanged.
 */
@Injectable()
export class EmailChannel {
  private readonly log = new Logger("EmailChannel");
  constructor(private readonly prisma: PrismaService) {}

  private async resolve(): Promise<EffectiveConfig> {
    const row = await this.prisma.integrationConfig.findUnique({ where: { provider: "email" } }).catch(() => null);
    const host = row?.smtpHost || process.env.SMTP_HOST || null;
    return {
      host,
      port: row?.smtpPort ?? Number(process.env.SMTP_PORT ?? 587),
      user: row?.smtpUser || process.env.SMTP_USER || null,
      pass: row?.smtpPassEnc ? decSecret(row.smtpPassEnc) : (process.env.SMTP_PASS || null),
      from: row?.smtpFrom || process.env.SMTP_FROM || "TUBA AL HIJAZ <no-reply@tubalhijaz.com>",
      secure: row?.smtpSecure ?? (process.env.SMTP_SECURE === "true"),
      fromEnv: !row?.smtpHost,
    };
  }

  private build(c: EffectiveConfig): Transporter | null {
    if (!c.host) return null;
    return nodemailer.createTransport({
      host: c.host, port: c.port, secure: c.secure,
      auth: c.user ? { user: c.user, pass: c.pass ?? undefined } : undefined,
    });
  }

  /** Safe status for Settings → Integrations (never returns the password). */
  async status() {
    const c = await this.resolve();
    return {
      host: c.host, port: c.port, user: c.user, from: c.from, secure: c.secure,
      configured: !!c.host, mode: c.host ? "live" : "stub",
      passMasked: c.pass ? `••••••••${c.pass.slice(-2)}` : null, keyFromEnv: c.fromEnv,
    };
  }

  async sendTest(to: string): Promise<{ ok: boolean; message: string }> {
    const c = await this.resolve();
    const t = this.build(c);
    if (!t) return { ok: false, message: "SMTP not configured (stub mode)" };
    if (!to) return { ok: false, message: "No recipient address" };
    try {
      const info = await t.sendMail({ from: c.from, to, subject: "TUBA AL HIJAZ — SMTP test", html: `<p>SMTP connection test at ${new Date().toISOString()}.</p>` });
      return { ok: true, message: `Sent (${info.messageId})` };
    } catch (e) { return { ok: false, message: (e as Error).message }; }
  }

  async send(to: string | null | undefined, subject: string, html: string, attachments?: MailAttachment[]): Promise<ChannelResult> {
    const c = await this.resolve();
    const t = this.build(c);
    if (!t) return { status: "SKIPPED", error: "SMTP not configured" };
    if (!to) return { status: "FAILED", error: "no recipient email" };
    try {
      const info = await t.sendMail({ from: c.from, to, subject, html, attachments });
      return { status: "SENT", providerId: info.messageId };
    } catch (e) { return { status: "FAILED", error: (e as Error).message }; }
  }
}
