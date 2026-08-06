import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFY_QUEUE } from "./notifications.constants";

export interface HistoryFilter { channel?: string; status?: string; q?: string; take?: number; skip?: number }

/** Notification Center — admin-wide history across all channels + retry + export. */
@Injectable()
export class NotificationAdminService {
  constructor(private readonly prisma: PrismaService, @Inject(NOTIFY_QUEUE) private readonly queue: Queue) {}

  private where(f: HistoryFilter): Prisma.NotificationLogWhereInput {
    const w: Prisma.NotificationLogWhereInput = {};
    if (f.channel) w.channel = f.channel as never;
    if (f.status) w.status = f.status as never;
    if (f.q) w.OR = [
      { title: { contains: f.q, mode: "insensitive" } },
      { body: { contains: f.q, mode: "insensitive" } },
      { recipientAddress: { contains: f.q, mode: "insensitive" } },
    ];
    return w;
  }

  async history(f: HistoryFilter) {
    const where = this.where(f);
    const take = Math.min(f.take ?? 50, 200);
    const [rows, total, stats] = await Promise.all([
      this.prisma.notificationLog.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: f.skip ?? 0 }),
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = {};
    for (const s of stats) counts[s.status] = s._count._all;
    return { rows, total, counts };
  }

  async retry(id: string) {
    const log = await this.prisma.notificationLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException("Notification not found");
    await this.prisma.notificationLog.update({ where: { id }, data: { status: "PENDING", error: null } });
    await this.queue.add("send", { logId: id }, { attempts: 4, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: 500, removeOnFail: 1000 });
    return { ok: true, id, requeued: true };
  }

  /** Retry every FAILED log (bulk). */
  async retryAllFailed() {
    const failed = await this.prisma.notificationLog.findMany({ where: { status: "FAILED" }, select: { id: true } });
    await Promise.all(failed.map((f) => this.retry(f.id)));
    return { requeued: failed.length };
  }

  async exportCsv(f: HistoryFilter): Promise<string> {
    const rows = await this.prisma.notificationLog.findMany({ where: this.where(f), orderBy: { createdAt: "desc" }, take: 5000 });
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["createdAt", "channel", "status", "priority", "recipientUserId", "recipientAddress", "title", "providerId", "attempts", "sentAt", "error"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([r.createdAt.toISOString(), r.channel, r.status, r.priority, r.recipientUserId, r.recipientAddress, r.title, r.providerId, r.attempts, r.sentAt?.toISOString() ?? "", r.error].map(esc).join(","));
    }
    return lines.join("\n");
  }
}
