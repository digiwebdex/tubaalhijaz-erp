import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { ChannelResult } from "../notifications.constants";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/**
 * Email delivery via SMTP (nodemailer). Configured from SMTP_* env vars; with no
 * SMTP_HOST the channel reports SKIPPED (dev/test stub). Supports PDF attachments
 * (vouchers/invoices/statements) pulled from storage by the orchestrator.
 */
@Injectable()
export class EmailChannel implements OnModuleInit {
  private readonly log = new Logger("EmailChannel");
  private transport?: Transporter;
  private readonly from = process.env.SMTP_FROM ?? "TUBA AL HIJAZ <no-reply@tubalhijaz.com>";

  onModuleInit() {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.log.warn("SMTP_HOST not set — email channel runs in stub mode");
      return;
    }
    this.transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587/STARTTLS
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    this.log.log(`email channel ready (${host})`);
  }

  get configured() {
    return !!this.transport;
  }

  async send(
    to: string | null | undefined,
    subject: string,
    html: string,
    attachments?: MailAttachment[],
  ): Promise<ChannelResult> {
    if (!this.transport) return { status: "SKIPPED", error: "SMTP not configured" };
    if (!to) return { status: "FAILED", error: "no recipient email" };
    try {
      const info = await this.transport.sendMail({ from: this.from, to, subject, html, attachments });
      return { status: "SENT", providerId: info.messageId };
    } catch (e) {
      return { status: "FAILED", error: (e as Error).message };
    }
  }
}
