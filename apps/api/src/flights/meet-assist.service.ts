import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";

/**
 * Canonical 7-step checklist. Names mirror OpsControl's MA_STEPS (frozen M5) —
 * the backend previously had no step names at all, so this is now the canonical home.
 */
export const MA_STEPS = [
  "Flight Landed", "Greeter at Gate", "Pax Count Verified", "Special Needs Handled",
  "Baggage Collected", "Bus Loaded", "Departed to Hotel",
] as const;

/** Derived status — MeetAssistTask has NO status enum; `done` stays authoritative. */
export type MaStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "EXCEPTION";
type TaskRow = { done: boolean; assignedToId: string | null; startedAt: Date | null; skippedAt: Date | null; exceptionAt: Date | null };
export function deriveStatus(t: TaskRow): MaStatus {
  if (t.exceptionAt) return "EXCEPTION";
  if (t.skippedAt) return "SKIPPED";
  if (t.done) return "COMPLETED";
  if (t.startedAt) return "IN_PROGRESS";
  if (t.assignedToId) return "ASSIGNED";
  return "PENDING";
}
/** Legal transitions over the derived states. */
const TX: Record<MaStatus, MaStatus[]> = {
  PENDING: ["ASSIGNED", "IN_PROGRESS", "SKIPPED", "EXCEPTION"],
  ASSIGNED: ["IN_PROGRESS", "COMPLETED", "SKIPPED", "EXCEPTION", "PENDING"],
  IN_PROGRESS: ["COMPLETED", "EXCEPTION", "SKIPPED"],
  COMPLETED: ["IN_PROGRESS", "EXCEPTION"],
  SKIPPED: ["PENDING", "IN_PROGRESS"],
  EXCEPTION: ["IN_PROGRESS", "COMPLETED", "SKIPPED"],
};

@Injectable()
export class MeetAssistService {
  constructor(private readonly prisma: PrismaService) {}

  /** Board rows never load passenger records — only the group's paxCount. */
  private readonly include = {
    assignedTo: { select: { id: true, name: true, email: true } },
    flightInfo: {
      select: {
        id: true, code: true, airline: true, flightNo: true, direction: true, scheduledAt: true,
        terminal: true, gate: true, paxCount: true, status: true,
        group: { select: { id: true, code: true, paxCount: true, tenant: { select: { id: true, name: true, code: true } } } },
      },
    },
  } satisfies Prisma.MeetAssistTaskInclude;

  private audit(actor: AuthUser, action: "CREATE" | "UPDATE", id: string, payload: Record<string, unknown>, ip?: string) {
    return this.prisma.auditLog.create({
      data: { actorUserId: actor.sub, action, module: "MeetAssist", entityType: "MeetAssistTask", entityId: id, after: payload as unknown as Prisma.InputJsonValue, ip },
    });
  }

  private shape(t: Prisma.MeetAssistTaskGetPayload<{ include: typeof MeetAssistService.prototype.include }>) {
    return {
      id: t.id, stepNo: t.stepNo, task: MA_STEPS[t.stepNo - 1] ?? `Step ${t.stepNo}`,
      status: deriveStatus(t), done: t.done, completedAt: t.completedAt,
      scheduledAt: t.scheduledAt, startedAt: t.startedAt, skippedAt: t.skippedAt, exceptionAt: t.exceptionAt,
      note: t.note, updatedAt: t.updatedAt,
      assignedTo: t.assignedTo, flightInfo: t.flightInfo,
    };
  }

  private async get(id: string) {
    const t = await this.prisma.meetAssistTask.findUnique({ where: { id }, include: this.include });
    if (!t) throw new NotFoundException("Meet & Assist task not found");
    return t;
  }

  async list(q: {
    flightInfoId?: string; date?: string; status?: string; airport?: string;
    groupId?: string; tenantId?: string; assignedToId?: string; search?: string; page?: string; pageSize?: string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(q.pageSize) || 25));
    const where: Prisma.MeetAssistTaskWhereInput = {};
    const flight: Prisma.FlightInfoWhereInput = {};
    if (q.flightInfoId && q.flightInfoId !== "all") where.flightInfoId = q.flightInfoId;
    if (q.date) { const d = new Date(q.date); if (!isNaN(d.getTime())) { const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); flight.scheduledAt = { gte: s, lt: new Date(s.getTime() + 86_400_000) }; } }
    if (q.airport && q.airport !== "all") flight.OR = [{ originAirport: q.airport }, { destAirport: q.airport }];
    if (q.groupId && q.groupId !== "all") flight.groupId = q.groupId;
    if (q.tenantId && q.tenantId !== "all") flight.tenantId = q.tenantId;
    if (Object.keys(flight).length) where.flightInfo = flight;
    if (q.assignedToId && q.assignedToId !== "all") where.assignedToId = q.assignedToId === "none" ? null : q.assignedToId;
    if (q.search?.trim()) {
      const s = q.search.trim();
      // Task names are DERIVED from stepNo (not stored), so translate a name match into stepNo.
      const stepHits = MA_STEPS.map((n, i) => (n.toLowerCase().includes(s.toLowerCase()) ? i + 1 : 0)).filter(Boolean);
      where.OR = [
        ...(stepHits.length ? [{ stepNo: { in: stepHits } }] : []),
        { note: { contains: s, mode: "insensitive" } },
        { flightInfo: { flightNo: { contains: s, mode: "insensitive" } } },
        { flightInfo: { airline: { contains: s, mode: "insensitive" } } },
        { flightInfo: { code: { contains: s, mode: "insensitive" } } },
        { flightInfo: { group: { code: { contains: s, mode: "insensitive" } } } },
        { assignedTo: { name: { contains: s, mode: "insensitive" } } },
      ];
    }
    // Derived status is not a column — translate it into the real field predicates.
    const st = q.status && q.status !== "all" ? (q.status as MaStatus) : null;
    if (st === "COMPLETED") Object.assign(where, { done: true, skippedAt: null, exceptionAt: null });
    else if (st === "SKIPPED") where.skippedAt = { not: null };
    else if (st === "EXCEPTION") where.exceptionAt = { not: null };
    else if (st === "IN_PROGRESS") Object.assign(where, { done: false, startedAt: { not: null }, skippedAt: null, exceptionAt: null });
    else if (st === "ASSIGNED") Object.assign(where, { done: false, startedAt: null, skippedAt: null, exceptionAt: null, assignedToId: { not: null } });
    else if (st === "PENDING") Object.assign(where, { done: false, startedAt: null, skippedAt: null, exceptionAt: null, assignedToId: null });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.meetAssistTask.findMany({ where, include: this.include, orderBy: [{ flightInfoId: "asc" }, { stepNo: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.meetAssistTask.count({ where }),
    ]);
    return { rows: rows.map((r) => this.shape(r)), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /** KPIs from real counts — derived states expressed as field predicates. */
  async dashboard(date?: string) {
    const flight: Prisma.FlightInfoWhereInput = {};
    let iso: string | null = null;
    if (date) { const d = new Date(date); if (!isNaN(d.getTime())) { const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); flight.scheduledAt = { gte: s, lt: new Date(s.getTime() + 86_400_000) }; iso = s.toISOString().slice(0, 10); } }
    const scoped: Prisma.MeetAssistTaskWhereInput = Object.keys(flight).length ? { flightInfo: flight } : {};
    const open = { done: false, skippedAt: null, exceptionAt: null };
    const [total, completed, skipped, exception, inProgress, assigned, pending] = await this.prisma.$transaction([
      this.prisma.meetAssistTask.count({ where: scoped }),
      this.prisma.meetAssistTask.count({ where: { ...scoped, done: true, skippedAt: null, exceptionAt: null } }),
      this.prisma.meetAssistTask.count({ where: { ...scoped, skippedAt: { not: null } } }),
      this.prisma.meetAssistTask.count({ where: { ...scoped, exceptionAt: { not: null } } }),
      this.prisma.meetAssistTask.count({ where: { ...scoped, ...open, startedAt: { not: null } } }),
      this.prisma.meetAssistTask.count({ where: { ...scoped, ...open, startedAt: null, assignedToId: { not: null } } }),
      this.prisma.meetAssistTask.count({ where: { ...scoped, ...open, startedAt: null, assignedToId: null } }),
    ]);
    return { date: iso, total, pending, assigned, inProgress, completed, skipped, exceptions: exception };
  }

  /** Staff who may actually perform airport assistance: ACTIVE platform users whose role grants MANAGE_FLIGHTS or MANAGE_OPS. */
  async staff() {
    const users = await this.prisma.user.findMany({
      where: {
        status: "ACTIVE", companyId: null,
        role: { permissions: { some: { permission: { key: { in: ["MANAGE_FLIGHTS", "MANAGE_OPS"] } } } } },
      },
      select: { id: true, name: true, email: true, role: { select: { key: true } } },
      orderBy: { name: "asc" },
    });
    return users;
  }

  private async assertAssignable(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, status: true, companyId: true, role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } },
    });
    if (!u) throw new BadRequestException("User not found");
    if (u.status !== "ACTIVE") throw new BadRequestException(`User ${u.name} is ${u.status} — only ACTIVE users can be assigned`);
    if (u.companyId) throw new ForbiddenException(`User ${u.name} belongs to an agent/supplier company — not eligible for airport assistance`);
    const keys = u.role.permissions.map((p) => p.permission.key);
    if (!keys.includes("MANAGE_FLIGHTS") && !keys.includes("MANAGE_OPS")) {
      throw new ForbiddenException(`Role ${u.role.key} lacks MANAGE_FLIGHTS/MANAGE_OPS — cannot perform Meet & Assist`);
    }
    return u;
  }

  /** Ensure the 7-step checklist exists for an arrival — mirrors ops.service's lazy creation. */
  async ensureChecklist(flightInfoId: string, actor: AuthUser, ip?: string) {
    const flight = await this.prisma.flightInfo.findUnique({ where: { id: flightInfoId }, select: { id: true, code: true, direction: true } });
    if (!flight) throw new BadRequestException("Flight not found");
    const existing = await this.prisma.meetAssistTask.count({ where: { flightInfoId } });
    if (existing === 0) {
      await this.prisma.meetAssistTask.createMany({ data: Array.from({ length: MA_STEPS.length }, (_, i) => ({ flightInfoId, stepNo: i + 1, done: false })) });
      const first = await this.prisma.meetAssistTask.findFirst({ where: { flightInfoId }, orderBy: { stepNo: "asc" } });
      if (first) await this.audit(actor, "CREATE", first.id, { operation: "CREATE", flight: flight.code, steps: MA_STEPS.length }, ip);
    }
    const rows = await this.prisma.meetAssistTask.findMany({ where: { flightInfoId }, include: this.include, orderBy: { stepNo: "asc" } });
    return rows.map((r) => this.shape(r));
  }

  async assign(id: string, assignedToId: string | null, actor: AuthUser, ip?: string) {
    const before = await this.get(id);
    if (assignedToId) await this.assertAssignable(assignedToId);
    const row = await this.prisma.meetAssistTask.update({ where: { id }, data: { assignedToId }, include: this.include });
    const operation = !assignedToId ? "UNASSIGN" : before.assignedToId ? "REASSIGN" : "ASSIGN";
    await this.audit(actor, "UPDATE", id, { operation, stepNo: row.stepNo, task: MA_STEPS[row.stepNo - 1], before: { assignedToId: before.assignedToId }, after: { assignedToId } }, ip);
    return this.shape(row);
  }

  async changeStatus(id: string, next: MaStatus, note: string | undefined, actor: AuthUser, ip?: string) {
    const before = await this.get(id);
    const current = deriveStatus(before);
    const allowed = TX[current] ?? [];
    if (!allowed.includes(next)) throw new BadRequestException(`Illegal transition ${current} → ${next}. Allowed: ${allowed.join(", ") || "none"}`);
    if (next === "IN_PROGRESS" && !before.assignedToId) throw new BadRequestException("Assign a staff member before starting the task");
    const now = new Date();
    const data: Prisma.MeetAssistTaskUpdateInput = { note: note !== undefined ? note : before.note };
    // `done` stays authoritative for completion so OpsControl/ops.service remain consistent.
    switch (next) {
      case "PENDING": Object.assign(data, { done: false, completedAt: null, startedAt: null, skippedAt: null, exceptionAt: null }); break;
      case "ASSIGNED": Object.assign(data, { done: false, completedAt: null, startedAt: null, skippedAt: null, exceptionAt: null }); break;
      case "IN_PROGRESS": Object.assign(data, { done: false, completedAt: null, startedAt: before.startedAt ?? now, skippedAt: null, exceptionAt: null }); break;
      case "COMPLETED": Object.assign(data, { done: true, completedAt: now, skippedAt: null, exceptionAt: null }); break;
      case "SKIPPED": Object.assign(data, { done: false, completedAt: null, skippedAt: now, exceptionAt: null }); break;
      case "EXCEPTION": Object.assign(data, { done: false, completedAt: null, exceptionAt: now, skippedAt: null }); break;
    }
    const row = await this.prisma.meetAssistTask.update({ where: { id }, data, include: this.include });
    const operation = next === "COMPLETED" ? "COMPLETE" : next === "EXCEPTION" ? "EXCEPTION" : next === "SKIPPED" ? "SKIP" : "STATUS_CHANGE";
    await this.audit(actor, "UPDATE", id, { operation, stepNo: row.stepNo, task: MA_STEPS[row.stepNo - 1], from: current, to: next, ...(note ? { note } : {}) }, ip);
    return this.shape(row);
  }

  /** Checklist context + audit history for one task — loaded only when the drawer opens. */
  async detail(id: string) {
    const t = await this.get(id);
    const [siblings, logs] = await this.prisma.$transaction([
      this.prisma.meetAssistTask.findMany({ where: { flightInfoId: t.flightInfoId }, orderBy: { stepNo: "asc" }, select: { id: true, stepNo: true, done: true, assignedToId: true, startedAt: true, skippedAt: true, exceptionAt: true, completedAt: true } }),
      this.prisma.auditLog.findMany({
        where: { module: "MeetAssist", entityType: "MeetAssistTask", entityId: id },
        orderBy: { createdAt: "asc" },
        select: { action: true, after: true, createdAt: true, actorUserId: true, actor: { select: { name: true, email: true } } },
      }),
    ]);
    return {
      task: this.shape(t),
      checklist: siblings.map((s) => ({ id: s.id, stepNo: s.stepNo, task: MA_STEPS[s.stepNo - 1] ?? `Step ${s.stepNo}`, status: deriveStatus(s), completedAt: s.completedAt })),
      history: logs.map((l) => {
        const a = (l.after ?? {}) as Record<string, unknown>;
        return { operation: String(a.operation ?? l.action), from: a.from as string | undefined, to: a.to as string | undefined, at: l.createdAt, actor: l.actor?.name ?? l.actor?.email ?? l.actorUserId };
      }),
      allowedNext: TX[deriveStatus(t)] ?? [],
    };
  }

  /** Filter dimensions backed by real data only. */
  async options() {
    const [flights, groups, tenants] = await this.prisma.$transaction([
      this.prisma.flightInfo.findMany({ where: { meetAssist: { some: {} } }, select: { id: true, code: true, flightNo: true, airline: true, scheduledAt: true }, orderBy: { scheduledAt: "asc" } }),
      this.prisma.group.findMany({ where: { flightInfos: { some: { meetAssist: { some: {} } } } }, select: { id: true, code: true } }),
      this.prisma.company.findMany({ where: { type: "AGENT", flightInfos: { some: { meetAssist: { some: {} } } } }, select: { id: true, code: true, name: true } }),
    ]);
    const airports = [...new Set((await this.prisma.flightInfo.findMany({ where: { meetAssist: { some: {} } }, select: { originAirport: true, destAirport: true } })).flatMap((f) => [f.originAirport, f.destAirport]))].filter(Boolean).sort();
    return { flights, groups, agents: tenants, airports };
  }
}
