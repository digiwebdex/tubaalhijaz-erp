import { Injectable, Logger } from "@nestjs/common";
import { NotificationPriority } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { FleetService, type ExpiringItem } from "./fleet.service";

/**
 * Fleet compliance watchdog. Scans every driver licence, vehicle document, and
 * insurance policy and raises an in-app NotificationLog for each that has
 * crossed the 30-day or 7-day window (or already lapsed).
 *
 * Scheduling (S2-03): a single BullMQ repeatable `expiry-escalation` at 06:00
 * (AutomationScheduler → runExpiryEscalation → runScan). The Nest `@Cron` twin
 * was removed so alerts are not double-processed. `runScan()` remains the
 * reusable unit of work (also POST /fleet/expiry/scan for tests/ops).
 *
 * Idempotency: each alert's `code` is deterministic
 * (`FLEET-EXP-<kind>-<refId>-<bucket>`), and NotificationLog.code is unique, so
 * re-dispatch is a no-op. A document that decays 30-day → 7-day gets a *second*
 * alert (different bucket), which is the intended escalation.
 *
 * Delivery: via NotificationsService.dispatch → tuba-notify worker (IN_APP).
 */
@Injectable()
export class ExpiryService {
  private readonly log = new Logger("FleetExpiry");

  constructor(
    private readonly fleet: FleetService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The reusable unit of work — also exposed via POST /fleet/expiry/scan for tests/ops. */
  async runScan(withinDays = 30): Promise<{ scanned: number; created: number }> {
    const items = await this.fleet.expiring(withinDays);
    if (!items.length) return { scanned: 0, created: 0 };

    let created = 0;
    for (const it of items) {
      const bucket = it.daysLeft <= 7 ? "07" : "30"; // escalation tier
      const code = `FLEET-EXP-${it.kind}-${it.refId}-${bucket}`;
      const res = await this.notifications.dispatch({
        channels: ["IN_APP"],
        priority: this.priorityFor(it),
        code,
        literalContent: true,
        title: this.titleFor(it),
        body: this.bodyFor(it),
      });
      created += res.logIds.length;
    }
    this.log.debug(`expiry scan: ${items.length} at-risk, ${created} new alert(s)`);
    return { scanned: items.length, created };
  }

  private priorityFor(it: ExpiringItem): NotificationPriority {
    return it.severity === "WARNING" ? "NORMAL" : "EMERGENCY";
  }

  private titleFor(it: ExpiringItem): string {
    const noun =
      it.kind === "LICENSE" ? "Driver licence" :
      it.kind === "INSURANCE" ? "Vehicle insurance" :
      it.kind === "REGISTRATION" ? "Vehicle registration" :
      it.kind === "INSPECTION" ? "Vehicle inspection" :
      it.kind === "OPERATING_CARD" ? "Operating card" :
      "Vehicle document";
    if (it.daysLeft < 0) return `${noun} EXPIRED — ${it.subject}`;
    return `${noun} expiring in ${it.daysLeft}d — ${it.subject}`;
  }

  private bodyFor(it: ExpiringItem): string {
    const when = it.expiryDate.toISOString().slice(0, 10);
    return it.daysLeft < 0
      ? `${it.detail} lapsed on ${when} (${-it.daysLeft} day(s) ago). Renew before dispatch.`
      : `${it.detail} expires ${when} (${it.daysLeft} day(s) left).`;
  }
}
