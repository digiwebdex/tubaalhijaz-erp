import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NotificationChannel, NotificationPriority, Prisma } from "@prisma/client";
import type { Queue } from "bullmq";
import type { Lang } from "@tuba/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { TemplateService } from "./templates.service";
import { WhatsAppChannel } from "./channels/whatsapp.channel";
import { EmailChannel, type MailAttachment } from "./channels/email.channel";
import { NotificationsGateway } from "./notifications.gateway";
import {
  CHANNEL_STATUS, NOTIFY_QUEUE, type ChannelResult, type DispatchSpec, jobPriority,
} from "./notifications.constants";

export interface SendJob {
  logId: string;
  attachments?: { fileId?: string; filename?: string }[];
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger("Notifications");

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly templates: TemplateService,
    private readonly whatsapp: WhatsAppChannel,
    private readonly email: EmailChannel,
    private readonly gateway: NotificationsGateway,
    @Inject(NOTIFY_QUEUE) private readonly queue: Queue<SendJob>,
  ) {}

  // ── Dispatch: fan an event out to its channels (creates logs + enqueues sends) ─
  async dispatch(spec: DispatchSpec): Promise<{ logIds: string[]; channels: NotificationChannel[] }> {
    const { lang, phone, email } = await this.resolveRecipient(spec);
    const channels = await this.resolveChannels(spec);
    const priority = spec.priority ?? "NORMAL";
    const vars = { title: spec.title ?? "", body: spec.body ?? "", ...(spec.vars ?? {}) };
    const eventId = spec.eventKey
      ? (await this.prisma.notificationEvent.findUnique({ where: { key: spec.eventKey }, select: { id: true } }))?.id
      : undefined;

    const logIds: string[] = [];
    for (const channel of channels) {
      const tpl = spec.literalContent
        ? { subject: spec.title ?? "Notification", body: spec.body ?? "" }
        : await this.templates.render(spec.eventKey, channel, lang, vars);
      const address = channel === "WHATSAPP" ? phone : channel === "EMAIL" ? email : null;
      let log;
      try {
        log = await this.prisma.notificationLog.create({
          data: {
            code: spec.code ?? undefined,
            eventId,
            channel,
            priority,
            tenantId: spec.tenantId ?? null,
            recipientUserId: spec.recipientUserId ?? null,
            recipientAddress: address,
            title: tpl.subject || spec.title || "Notification",
            body: tpl.body,
            lang,
            status: "PENDING",
          },
        });
      } catch (e) {
        // Idempotent re-dispatch (fleet expiry codes, etc.) — do not enqueue again.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && spec.code) {
          this.log.debug(`dispatch skip duplicate code=${spec.code}`);
          continue;
        }
        throw e;
      }
      logIds.push(log.id);
      await this.queue.add(
        "send",
        { logId: log.id, attachments: channel === "EMAIL" ? spec.attachments : undefined },
        {
          priority: jobPriority(priority),
          attempts: 4,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      );
    }
    this.log.debug(`dispatch ${spec.eventKey ?? "(adhoc)"} → ${channels.join(",")} (${priority})`);
    return { logIds, channels };
  }

  // ── Deliver one log (called by the worker; retried by BullMQ on FAILED) ───────
  async deliverLog(job: SendJob): Promise<string> {
    const log = await this.prisma.notificationLog.findUnique({
      where: { id: job.logId },
      include: { event: { select: { key: true } } },
    });
    if (!log) return "log removed";

    let result: ChannelResult;
    if (log.channel === "WHATSAPP") {
      result = await this.whatsapp.send(log.recipientAddress, log.body ?? log.title);
    } else if (log.channel === "EMAIL") {
      result = await this.email.send(
        log.recipientAddress,
        log.title,
        this.htmlWrap(log.body ?? log.title),
        await this.resolveAttachments(job.attachments),
      );
    } else {
      // IN_APP — the log IS the persistence; push it live to the bell dropdown.
      const payload = {
        id: log.id, title: log.title, body: log.body, priority: log.priority,
        eventKey: log.event?.key ?? null, createdAt: log.createdAt.toISOString(),
      };
      if (log.recipientUserId) this.gateway.pushToUser(log.recipientUserId, payload);
      if (log.tenantId) this.gateway.pushToTenant(log.tenantId, payload);
      result = { status: "SENT" };
    }

    await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: CHANNEL_STATUS[result.status],
        providerId: result.providerId,
        error: result.error ?? null,
        attempts: { increment: 1 },
        ...(result.status === "SENT" ? { sentAt: new Date() } : {}),
      },
    });
    if (result.status === "FAILED") {
      throw new Error(`${log.channel} send failed: ${result.error}`); // → BullMQ retry
    }
    return `${log.channel} ${result.status}`;
  }

  // ── Bell feed (any authenticated user: their own + their tenant's) ────────────
  feed(userId: string, companyId: string | null, limit = 30) {
    return this.prisma.notificationLog.findMany({
      where: { OR: [{ recipientUserId: userId }, ...(companyId ? [{ tenantId: companyId }] : [])] },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, limit),
      include: { event: { select: { key: true, labelEn: true } } },
    });
  }

  async unreadCount(userId: string, companyId: string | null) {
    return this.prisma.notificationLog.count({
      where: {
        readAt: null,
        OR: [{ recipientUserId: userId }, ...(companyId ? [{ tenantId: companyId }] : [])],
      },
    });
  }

  async markRead(id: string, userId: string, companyId: string | null) {
    // Ownership guard: a caller may only mark their OWN / their tenant's
    // notifications read. Without it, `PATCH /notifications/:id/read` was an
    // IDOR — it updated and RETURNED the full record (title/body) of any
    // tenant's notification to whoever guessed the id.
    const owned = await this.prisma.notificationLog.findFirst({
      where: {
        id,
        OR: [{ recipientUserId: userId }, ...(companyId ? [{ tenantId: companyId }] : [])],
      },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException("Notification not found");
    const log = await this.prisma.notificationLog.update({
      where: { id },
      data: { readAt: new Date(), status: "READ" },
    });
    return log;
  }

  markAllRead(userId: string, companyId: string | null) {
    return this.prisma.notificationLog.updateMany({
      where: {
        readAt: null,
        OR: [{ recipientUserId: userId }, ...(companyId ? [{ tenantId: companyId }] : [])],
      },
      data: { readAt: new Date(), status: "READ" },
    });
  }

  // ── Config: event channel matrix + templates ─────────────────────────────────
  events() {
    return this.prisma.notificationEvent.findMany({
      orderBy: { key: "asc" },
      include: { _count: { select: { templates: true, logs: true } } },
    });
  }

  toggleEvent(key: string, patch: { whatsapp?: boolean; email?: boolean; inApp?: boolean; priority?: NotificationPriority }) {
    return this.prisma.notificationEvent.update({ where: { key }, data: patch });
  }

  listTemplates(eventKey?: string) {
    return this.prisma.messageTemplate.findMany({
      where: eventKey ? { event: { key: eventKey } } : undefined,
      include: { event: { select: { key: true } } },
      orderBy: [{ eventId: "asc" }, { channel: "asc" }, { lang: "asc" }],
    });
  }

  async upsertTemplate(input: { eventKey: string; channel: NotificationChannel; lang: string; subject?: string; body: string }) {
    const ev = await this.prisma.notificationEvent.findUniqueOrThrow({ where: { key: input.eventKey }, select: { id: true } });
    return this.prisma.messageTemplate.upsert({
      where: { eventId_channel_lang: { eventId: ev.id, channel: input.channel, lang: input.lang } },
      create: { eventId: ev.id, channel: input.channel, lang: input.lang, subject: input.subject, body: input.body },
      update: { subject: input.subject, body: input.body },
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private async resolveRecipient(spec: DispatchSpec): Promise<{ lang: Lang; phone: string | null; email: string | null }> {
    let lang = spec.lang;
    let phone = spec.phone ?? null;
    let email = spec.email ?? null;
    if (spec.recipientUserId) {
      const u = await this.prisma.user.findUnique({
        where: { id: spec.recipientUserId }, select: { phone: true, email: true, preferredLang: true },
      });
      if (u) { phone ??= u.phone; email ??= u.email; lang ??= u.preferredLang as Lang; }
    }
    if ((!phone || !email || !lang) && spec.tenantId) {
      const c = await this.prisma.company.findUnique({
        where: { id: spec.tenantId }, select: { phone: true, email: true, preferredLang: true },
      });
      if (c) { phone ??= c.phone; email ??= c.email; lang ??= c.preferredLang as Lang; }
    }
    return { lang: lang ?? "bn", phone, email };
  }

  private async resolveChannels(spec: DispatchSpec): Promise<NotificationChannel[]> {
    if (spec.channels?.length) return spec.channels; // explicit wins (internal escalations, tests)
    if (spec.priority === "EMERGENCY") return ["WHATSAPP", "EMAIL", "IN_APP"]; // else fan out everywhere
    if (spec.eventKey) {
      const ev = await this.prisma.notificationEvent.findUnique({ where: { key: spec.eventKey } });
      if (ev) {
        const ch: NotificationChannel[] = [];
        if (ev.whatsapp) ch.push("WHATSAPP");
        if (ev.email) ch.push("EMAIL");
        if (ev.inApp) ch.push("IN_APP");
        if (ch.length) return ch;
      }
    }
    return ["IN_APP"];
  }

  private async resolveAttachments(attachments?: SendJob["attachments"]): Promise<MailAttachment[] | undefined> {
    if (!attachments?.length) return undefined;
    const out: MailAttachment[] = [];
    for (const a of attachments) {
      if (!a.fileId) continue;
      const file = await this.prisma.uploadedFile.findUnique({ where: { id: a.fileId } });
      if (!file) continue;
      try {
        const content = await this.storage.read(file.bucket, file.storageKey);
        out.push({ filename: a.filename ?? file.fileName, content, contentType: file.mimeType });
      } catch (e) {
        this.log.warn(`attachment ${a.fileId} read failed: ${(e as Error).message}`);
      }
    }
    return out.length ? out : undefined;
  }

  private htmlWrap(body: string): string {
    const esc = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0B1E3F;line-height:1.6">${esc}<hr style="border:none;border-top:1px solid #eee;margin:16px 0"><div style="font-size:11px;color:#999">TUBA AL HIJAZ · Hajj & Umrah Operations</div></div>`;
  }
}
