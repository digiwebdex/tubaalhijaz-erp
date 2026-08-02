import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Job, Worker } from "bullmq";
import { spawn } from "child_process";
import * as QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { InvoiceService } from "../finance/invoice.service";
import { ServicesService } from "../services/services.service";
import type { ServiceKey } from "../services/service-types";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { FleetService } from "../fleet/fleet.service";
import { ExpiryService } from "../fleet/expiry.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AutomationService } from "./automation.service";
import { AUTOMATION_QUEUE, BULL_PREFIX, QUEUE_NAME, SCHED, SYS_RULE_CODE, makeConnection, type SchedName } from "./automation.constants";
import { buildEvent, EV } from "./events";
import type { JobData } from "./actions";
import { OpsService } from "../ops/ops.service";
import { ensureIntakeNotificationPack, isIntakeDomainEvent } from "./intake-notification.pack";
import {
  ensureVisaNotificationPack,
  isLongStayDomainEvent,
  isVisaDomainEvent,
} from "./visa-notification.pack";

/** Non-fatal "this action didn't apply" → logged as WARN, not ERROR. */
class SkipError extends Error {}

const SYSTEM_ACTOR = { sub: "system", email: "automation@tubalhijaz.com" } as unknown as AuthUser;

/**
 * The BullMQ worker. Consumes automation jobs (one per rule action), executes
 * the real effect, and writes an AutomationRunLog for every attempt. Runs in the
 * same process as the API for this deployment; can be split into a dedicated
 * worker process later with zero code change (same queue name + Redis).
 */
@Injectable()
export class AutomationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("AutomationWorker");
  private worker?: Worker<JobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly invoices: InvoiceService,
    private readonly services: ServicesService,
    private readonly automation: AutomationService,
    private readonly fleet: FleetService,
    private readonly expiry: ExpiryService,
    private readonly ops: OpsService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    // T001-08 — ensure intake NotificationEvent / rules / templates exist (idempotent).
    try {
      await ensureIntakeNotificationPack(this.prisma);
      this.log.log("intake notification pack ready (AR-GRP-01…04)");
    } catch (e) {
      this.log.warn(`intake notification pack ensure failed: ${(e as Error).message}`);
    }

    // T002-04/05/08 — wire visa + day-85 events, rules and templates (idempotent).
    try {
      await ensureVisaNotificationPack(this.prisma);
      this.log.log("visa notification pack ready (AR-VISA-01…03, AR-LS-85/90)");
    } catch (e) {
      this.log.warn(`visa notification pack ensure failed: ${(e as Error).message}`);
    }

    this.worker = new Worker<JobData>(QUEUE_NAME, (job) => this.run(job), {
      connection: makeConnection(true),
      prefix: BULL_PREFIX,
      concurrency: 5,
    });
    this.worker.on("failed", (job, err) =>
      this.log.warn(`job ${job?.id} (${job?.name}) failed: ${err.message}`),
    );
    this.log.log(`worker listening on ${QUEUE_NAME}`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  /** Execute one job and record the run. Errors here are caught by BullMQ (retry). */
  private async run(job: Job<JobData>) {
    // Repeatable system jobs carry no rule action — handle them separately.
    if ((Object.values(SCHED) as string[]).includes(job.name)) {
      return this.runScheduled(job.name as SchedName);
    }
    const { ruleId, action, eventKey } = job.data;
    const started = Date.now();
    try {
      const message = await this.dispatch(job);
      await this.automation.logRun({
        ruleId, eventKey, action: action.type, jobId: job.id,
        status: "OK", durationMs: Date.now() - started, message,
      });
      return message;
    } catch (err) {
      const skip = err instanceof SkipError;
      await this.automation.logRun({
        ruleId, eventKey, action: action.type, jobId: job.id,
        status: skip ? "WARN" : "ERROR", durationMs: Date.now() - started,
        message: (err as Error).message,
      });
      if (skip) return `skipped: ${(err as Error).message}`;
      throw err; // real failure → BullMQ retries per job opts
    }
  }

  private dispatch(job: Job<JobData>): Promise<string> {
    switch (job.data.action.type) {
      case "SEND_NOTIFICATION": return this.sendNotification(job.data);
      case "ESCALATE": return this.escalate(job.data);
      case "GENERATE_QR": return this.generateQr(job.data);
      case "GENERATE_PDF": return this.generatePdf(job.data);
      case "GENERATE_INVOICE": return this.generateInvoice(job.data);
      case "GENERATE_VOUCHER": return this.generateVoucher(job.data);
      case "RUN_BACKUP": return this.runBackup(job.data);
      default: return Promise.reject(new SkipError(`unknown action ${job.data.action.type}`));
    }
  }

  // ── SEND_NOTIFICATION — hand to the real delivery engine (Phase 11) ──────────
  private async sendNotification(d: JobData): Promise<string> {
    const p = d.action.params ?? {};
    const ev = d.event;
    const eventKey = (p.eventKey as string) ?? undefined;
    const title = (p.title as string) ?? ev.title;
    const body = (p.body as string) ?? this.renderBody(d);
    const vars = this.notificationVars(d, title, body);
    const notifyPolicy =
      (p.notifyPolicy as string) ??
      (isIntakeDomainEvent(ev.key) || isVisaDomainEvent(ev.key)
        ? "intake"
        : isLongStayDomainEvent(ev.key)
          ? "longstay"
          : "default");
    // Deterministic per-recipient codes (day-85 sweep) make replays no-ops.
    const notifyCode = (ev.data.notifyCode as string | undefined) ?? undefined;

    const agent = await this.notifications.dispatch({
      eventKey,
      channels: p.channel ? [p.channel as "WHATSAPP" | "EMAIL" | "IN_APP"] : undefined,
      priority: (p.priority as "LOW" | "NORMAL" | "EMERGENCY") ?? "NORMAL",
      tenantId: ev.tenantId ?? ev.companyId ?? null,
      recipientUserId: ev.recipientUserId ?? null,
      title,
      body,
      vars,
      code: notifyCode ? `${notifyCode}-AGENT` : undefined,
    });

    let staffLogs = 0;
    // intake / visa / long-stay — Agent matrix channels + Admin/Ops IN_APP bell (§9).
    if (notifyPolicy === "intake" || notifyPolicy === "visa" || notifyPolicy === "longstay") {
      const staff = await this.prisma.user.findMany({
        where: {
          status: "ACTIVE",
          role: { key: { in: ["SUPER_ADMIN", "OPS_STAFF"] } },
          ...(ev.recipientUserId ? { id: { not: ev.recipientUserId } } : {}),
        },
        select: { id: true },
        take: 50,
      });
      for (const s of staff) {
        const r = await this.notifications.dispatch({
          eventKey,
          channels: ["IN_APP"],
          priority: (p.priority as "LOW" | "NORMAL" | "EMERGENCY") ?? "NORMAL",
          tenantId: null,
          recipientUserId: s.id,
          title,
          body,
          vars,
          code: notifyCode ? `${notifyCode}-STAFF-${s.id}` : undefined,
        });
        staffLogs += r.logIds.length;
      }
    }

    // External recipient leg — the Long Stay Host is not a login user (§8), so
    // day-85 reaches them on the registered WhatsApp number carried by the event.
    let externalLogs = 0;
    if (ev.recipientAddress) {
      const external = String(ev.recipientAddress);
      const isEmail = external.includes("@");
      const r = await this.notifications.dispatch({
        eventKey,
        channels: [isEmail ? "EMAIL" : "WHATSAPP"],
        priority: (p.priority as "LOW" | "NORMAL" | "EMERGENCY") ?? "NORMAL",
        tenantId: null,
        ...(isEmail ? { email: external } : { phone: external }),
        title,
        body,
        vars,
        code: notifyCode ? `${notifyCode}-EXT` : undefined,
      });
      externalLogs += r.logIds.length;
    }

    return `dispatched agent=${agent.logIds.length} staff=${staffLogs} external=${externalLogs} (${agent.channels.join(",")})`;
  }

  private notificationVars(d: JobData, title?: string, body?: string): Record<string, unknown> {
    const ev = d.event;
    const after = (ev.data.after as Record<string, unknown> | undefined) ?? {};
    return {
      ...ev.data,
      title,
      body,
      // Flatten gate snapshot for {{gateVisa}} templates (interpolate is flat-key only).
      gateVisa: after.gateVisa ?? ev.data.gateVisa,
      gatePackage: after.gatePackage ?? ev.data.gatePackage,
      gatePayment: after.gatePayment ?? ev.data.gatePayment,
      gateBill: after.gateBill ?? ev.data.gateBill,
    };
  }

  private renderBody(d: JobData): string {
    const ev = d.event;
    const name = (ev.data.name as string) ?? (ev.data.code as string) ?? "";
    const code = (ev.data.code as string) ?? "";
    switch (ev.key) {
      case "agent.approved": return `Welcome to TUBA AL HIJAZ${name ? `, ${name}` : ""}! Your account is verified and portal access is active.`;
      case "agent.rejected": return `Your application was not approved. ${(ev.data.reason as string) ?? ""}`.trim();
      case "booking.confirmed": return `Booking ${(ev.data.code as string) ?? ev.entityId} confirmed.`;
      case "invoice.generated": return `Invoice ${(ev.data.invoiceNo as string) ?? ""} generated.`;
      case "group.created": return `Group ${code} created${name ? ` (${name})` : ""}.`;
      case "group.gates.changed": return `Group ${code} readiness gates updated by ${(ev.data.changedBy as string) ?? "staff"}.`;
      case "group.import.completed": return `${(ev.data.count as number) ?? 0} mutamer(s) imported into group ${code}.`;
      case "group.ocr.committed": return `Nusuk group-list OCR committed for group ${code} (${(ev.data.mode as string) ?? "commit"}).`;
      case "visa.approved":
        return `Visa issued for ${(ev.data.code as string) ?? ev.entityId} (group ${(ev.data.groupCode as string) ?? ""}).`;
      case "visa.rejected":
        return `Visa rejected for ${(ev.data.code as string) ?? ev.entityId}. ${(ev.data.reason as string) ?? ""}`.trim();
      case "visa.passport.returned":
        return `Passport returned for ${(ev.data.code as string) ?? ev.entityId} (group ${(ev.data.groupCode as string) ?? ""}).`;
      case "longstay.day85": {
        const day = (ev.data.dayCount as number) ?? 85;
        const stay = (ev.data.code as string) ?? ev.entityId;
        const grp = (ev.data.groupCode as string) ?? "";
        return ev.data.stage === "ESCALATED"
          ? `OVERSTAY RISK: Long Stay ${stay} (group ${grp}) is on day ${day} of ~90. Exit or renewal must be actioned now.`
          : `Long Stay ${stay} (group ${grp}) reached day ${day}. Day-85 compliance action is due before day 90.`;
      }
      default: return `Event ${ev.key} processed.`;
    }
  }

  // ── ESCALATE — high-priority alert. Internal (no external recipient) → IN_APP,
  //    but at EMERGENCY priority so it jumps the send queue. A true cross-channel
  //    emergency uses a rule with priority EMERGENCY and no explicit channel.
  private async escalate(d: JobData): Promise<string> {
    const ev = d.event;
    const res = await this.notifications.dispatch({
      channels: (d.action.params?.channels as ("WHATSAPP" | "EMAIL" | "IN_APP")[]) ?? ["IN_APP"],
      priority: "EMERGENCY",
      tenantId: ev.tenantId ?? null,
      recipientUserId: ev.recipientUserId ?? null,
      title: (d.action.params?.title as string) ?? ev.title ?? `ESCALATION: ${ev.key}`,
      body: (d.action.params?.body as string) ?? this.renderBody(d),
      vars: { ...ev.data, title: ev.title, body: this.renderBody(d) },
    });
    return `escalation raised (${res.channels.join(",")})`;
  }

  // ── GENERATE_QR — encode voucher/BRN code → PNG → object storage ──────────────
  private async generateQr(d: JobData): Promise<string> {
    const ev = d.event;
    const text =
      (d.action.params?.text as string) ??
      (ev.data.voucherCode as string) ?? (ev.data.code as string) ?? ev.entityId;
    if (!text) throw new SkipError("no text/code to encode");
    const png = await QRCode.toBuffer(String(text), { width: 320, margin: 1 });
    const stored = await this.storage.store(`qr-${text}.png`, png, "image/png");
    const file = await this.prisma.uploadedFile.create({
      data: {
        bucket: stored.bucket, storageKey: stored.storageKey,
        fileName: `qr-${text}.png`, mimeType: "image/png", sizeBytes: png.length,
        kind: "OTHER", companyId: ev.tenantId ?? ev.companyId ?? null,
        // linkage lives in meta.voucherId (Voucher has no dedicated qr column)
        meta: { qr: true, encodes: String(text), voucherId: ev.data.voucherId ?? null },
      },
    });
    return `QR ${file.id} for "${text}"`;
  }

  // ── GENERATE_PDF — a generic stored PDF artifact ──────────────────────────────
  private async generatePdf(d: JobData): Promise<string> {
    const ev = d.event;
    const title = (d.action.params?.title as string) ?? `TUBA AL HIJAZ — ${ev.key}`;
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, "-"); // WinAnsi only
    page.drawText(safe(title), { x: 48, y: 780, size: 18, font: bold, color: rgb(0.04, 0.12, 0.25) });
    page.drawText(safe(`Generated ${ev.at}`), { x: 48, y: 756, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    let y = 720;
    for (const [k, v] of Object.entries(ev.data).slice(0, 20)) {
      page.drawText(safe(`${k}: ${JSON.stringify(v)}`).slice(0, 90), { x: 48, y, size: 10, font });
      y -= 18;
    }
    const bytes = Buffer.from(await doc.save());
    const stored = await this.storage.store(`doc-${ev.key}-${Date.now()}.pdf`, bytes, "application/pdf");
    const file = await this.prisma.uploadedFile.create({
      data: {
        bucket: stored.bucket, storageKey: stored.storageKey,
        fileName: `doc-${ev.key}.pdf`, mimeType: "application/pdf", sizeBytes: bytes.length,
        kind: "OTHER", companyId: ev.tenantId ?? ev.companyId ?? null, meta: { generatedPdf: true },
      },
    });
    return `PDF ${file.id} (${bytes.length}B)`;
  }

  // ── GENERATE_INVOICE — delegate to the Finance engine ─────────────────────────
  private async generateInvoice(d: JobData): Promise<string> {
    const service = (d.action.params?.service ?? d.event.data.service) as ServiceKey | undefined;
    const bookingId = (d.action.params?.bookingId ?? d.event.data.bookingId ?? d.event.entityId) as string | undefined;
    if (!service || !bookingId) throw new SkipError("missing service/bookingId");
    const inv = await this.invoices.autoInvoiceOnCompletion(service, bookingId);
    if (!inv) throw new SkipError("invoice already exists or not applicable");
    return `invoice ${inv.code ?? inv.id} generated`;
  }

  // ── GENERATE_VOUCHER — delegate to the Services voucher pipeline ──────────────
  private async generateVoucher(d: JobData): Promise<string> {
    const service = (d.action.params?.service ?? d.event.data.service) as ServiceKey | undefined;
    const bookingId = (d.action.params?.bookingId ?? d.event.data.bookingId ?? d.event.entityId) as string | undefined;
    if (!service || !bookingId) throw new SkipError("missing service/bookingId");
    const voucher = await this.services.ensureVoucher(service, bookingId, SYSTEM_ACTOR);
    return `voucher ${voucher.code} ready`;
  }

  // ── RUN_BACKUP — pg_dump if available, else a logical JSON snapshot ───────────
  private runBackup(d: JobData): Promise<string> {
    return this.runBackupImpl(Boolean(d.action.params?.cloud));
  }

  private async runBackupImpl(cloud: boolean): Promise<string> {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    let body: Buffer;
    let name: string;
    let mode: string;
    try {
      body = await this.pgDump();
      name = `backup-${stamp}.sql`;
      mode = "pg_dump";
    } catch {
      body = await this.jsonSnapshot();
      name = `backup-${stamp}.json`;
      mode = "manifest"; // pg_dump unavailable — logical snapshot fallback
    }
    const bucket = cloud ? "tuba-backups-cloud" : "tuba-backups";
    const stored = await this.storage.store(`${bucket}/${name}`, body, mode === "pg_dump" ? "application/sql" : "application/json");
    await this.prisma.uploadedFile.create({
      data: {
        bucket: stored.bucket, storageKey: stored.storageKey,
        fileName: name, mimeType: mode === "pg_dump" ? "application/sql" : "application/json",
        sizeBytes: body.length, kind: "OTHER", meta: { backup: true, cloud, mode },
      },
    });
    return `${cloud ? "cloud " : ""}backup ${name} (${mode}, ${body.length}B)`;
  }

  private pgDump(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const url = process.env.DATABASE_URL;
      if (!url) return reject(new Error("no DATABASE_URL"));
      const proc = spawn("pg_dump", [url, "--no-owner", "--no-privileges"], { windowsHide: true });
      const chunks: Buffer[] = [];
      let err = "";
      proc.stdout.on("data", (c) => chunks.push(c as Buffer));
      proc.stderr.on("data", (c) => (err += c));
      proc.on("error", reject); // ENOENT when pg_dump isn't installed → triggers fallback
      proc.on("close", (code) =>
        code === 0 && chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error(err || `pg_dump exit ${code}`)),
      );
    });
  }

  private async jsonSnapshot(): Promise<Buffer> {
    const [companies, groups, passengers, invoices, vehicles] = await Promise.all([
      this.prisma.company.count(), this.prisma.group.count(), this.prisma.passenger.count(),
      this.prisma.invoice.count(), this.prisma.vehicle.count(),
    ]);
    return Buffer.from(JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: "Logical manifest backup (pg_dump unavailable on host). Production uses pg_dump.",
      counts: { companies, groups, passengers, invoices, vehicles },
    }, null, 2));
  }

  // ── Scheduled (BullMQ repeatable) system jobs ────────────────────────────────
  private async runScheduled(name: SchedName): Promise<string> {
    const started = Date.now();
    const rule = await this.prisma.automationRule.findUnique({ where: { code: SYS_RULE_CODE[name] } });
    try {
      const message =
        name === SCHED.DAILY_BACKUP ? await this.runBackupImpl(false) :
        name === SCHED.CLOUD_BACKUP ? await this.runBackupImpl(true) :
        // T002-08 — domain logic stays in OpsService; the worker only schedules.
        name === SCHED.DAY85 ? await this.ops.day85Sweep() :
        await this.runExpiryEscalation();
      if (rule) await this.automation.logRun({ ruleId: rule.id, eventKey: "cron", action: name, status: "OK", durationMs: Date.now() - started, message });
      return message;
    } catch (err) {
      if (rule) await this.automation.logRun({ ruleId: rule.id, eventKey: "cron", action: name, status: "ERROR", durationMs: Date.now() - started, message: (err as Error).message });
      throw err;
    }
  }

  /**
   * Daily compliance sweep. Runs the Phase-9 watchdog (creates in-app alerts for
   * every expiring licence/doc/policy), then emits a `document.expiring` domain
   * event for each CRITICAL/EXPIRED item so escalation rules (→ ESCALATE) fire.
   */
  private async runExpiryEscalation(): Promise<string> {
    const scan = await this.expiry.runScan(30);
    const critical = (await this.fleet.expiring(7)).filter((i) => i.severity !== "WARNING");
    for (const item of critical) {
      this.events.emit(
        EV.DOCUMENT_EXPIRING,
        buildEvent(EV.DOCUMENT_EXPIRING, {
          entityType: item.kind, entityId: item.refId,
          title: `${item.subject}: ${item.detail} ${item.daysLeft < 0 ? "EXPIRED" : `expires in ${item.daysLeft}d`}`,
          data: { subject: item.subject, kind: item.kind, daysLeft: item.daysLeft, severity: item.severity },
        }),
      );
    }
    return `expiry sweep: ${scan.created} new alerts, ${critical.length} escalation event(s)`;
  }
}
