import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, DispatchStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { OpsService } from "../ops/ops.service";

/** Statuses that still occupy a vehicle/driver. */
const ACTIVE_STATUSES: DispatchStatus[] = ["ASSIGNED", "EN_ROUTE", "DELAYED"];

export interface DispatchInput {
  operationalFlightId: string; groupId: string;
  vehicleId?: string | null; driverId?: string | null;
  routeFrom: string; routeTo: string; pax?: number; scheduledAt: string; note?: string | null;
}

/**
 * Phase 10D — Ground Operations / Dispatch.
 * Reuses the EXISTING DispatchOrder table, DispatchStatus enum, OpsService.DISPATCH_TX
 * transition table and AuditLog. Adds only what was missing: a link to the physical
 * OperationalFlight (10B), server-side filtering/pagination, assignment validation
 * and ground-ops aggregation. No new model, enum, audit system or permission.
 */
@Injectable()
export class GroundOpsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    operationalFlight: {
      select: {
        id: true, flightDate: true, direction: true, scheduledTime: true, status: true,
        terminal: { select: { id: true, name: true } },
        flightMaster: {
          select: {
            flightNumber: true,
            airline: { select: { code: true } },
            origin: { select: { id: true, iata: true } },
            destination: { select: { id: true, iata: true } },
          },
        },
      },
    },
    vehicle: { select: { id: true, code: true, type: true, plateNo: true, seats: true, status: true } },
    driver: { select: { id: true, name: true, phone: true, status: true } },
    group: { select: { id: true, code: true } },
  } satisfies Prisma.DispatchOrderInclude;

  private audit(actor: AuthUser, action: "CREATE" | "UPDATE" | "DELETE", id: string, payload: Record<string, unknown>, ip?: string) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub, action, module: "GroundOps", entityType: "DispatchOrder", entityId: id,
        after: payload as unknown as Prisma.InputJsonValue, ip,
      },
    });
  }

  private dayOf(v: string) { const d = new Date(v); return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }

  private async get(id: string) {
    const row = await this.prisma.dispatchOrder.findUnique({ where: { id }, include: this.include });
    if (!row) throw new NotFoundException("Dispatch not found");
    return row;
  }

  // ── validation ─────────────────────────────────────────────────────────────
  /** Vehicle must exist, be ACTIVE, have capacity, and not already be on an active dispatch that day. */
  private async assertVehicle(vehicleId: string, pax: number, dayStart: Date, exceptId?: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) throw new BadRequestException("Vehicle not found");
    if (v.status !== "ACTIVE") throw new BadRequestException(`Vehicle ${v.code} is ${v.status} — only ACTIVE vehicles can be assigned`);
    if (v.seats > 0 && pax > v.seats) throw new BadRequestException(`Vehicle ${v.code} seats ${v.seats} < ${pax} pax`);
    const clash = await this.prisma.dispatchOrder.findFirst({
      where: { vehicleId, status: { in: ACTIVE_STATUSES }, scheduledAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { code: true },
    });
    if (clash) throw new ConflictException(`Vehicle ${v.code} is already on active dispatch ${clash.code} that day`);
    return v;
  }
  /** Driver must exist, not be OFF_DUTY, and not already be on an active dispatch that day. */
  private async assertDriver(driverId: string, dayStart: Date, exceptId?: string) {
    const d = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!d) throw new BadRequestException("Driver not found");
    if (d.status === "OFF_DUTY") throw new BadRequestException(`Driver ${d.name} is OFF_DUTY — not available for assignment`);
    const clash = await this.prisma.dispatchOrder.findFirst({
      where: { driverId, status: { in: ACTIVE_STATUSES }, scheduledAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { code: true },
    });
    if (clash) throw new ConflictException(`Driver ${d.name} is already on active dispatch ${clash.code} that day`);
    return d;
  }

  // ── list (server-side filters + pagination) ────────────────────────────────
  async list(q: {
    date?: string; flightId?: string; direction?: string; airportId?: string; terminalId?: string;
    status?: string; vehicleId?: string; driverId?: string; search?: string; page?: string; pageSize?: string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(q.pageSize) || 25));
    const where: Prisma.DispatchOrderWhereInput = { operationalFlightId: { not: null } };
    const flightWhere: Prisma.OperationalFlightWhereInput = {};
    if (q.date) { const d = this.dayOf(q.date); if (d) flightWhere.flightDate = d; }
    if (q.direction && q.direction !== "all") flightWhere.direction = q.direction as "ARRIVAL" | "DEPARTURE";
    if (q.terminalId && q.terminalId !== "all") flightWhere.terminalId = q.terminalId;
    if (q.airportId && q.airportId !== "all") flightWhere.flightMaster = { OR: [{ originId: q.airportId }, { destinationId: q.airportId }] };
    if (q.flightId && q.flightId !== "all") where.operationalFlightId = q.flightId;
    if (Object.keys(flightWhere).length) where.operationalFlight = flightWhere;
    if (q.status && q.status !== "all") where.status = q.status as DispatchStatus;
    if (q.vehicleId && q.vehicleId !== "all") where.vehicleId = q.vehicleId === "none" ? null : q.vehicleId;
    if (q.driverId && q.driverId !== "all") where.driverId = q.driverId === "none" ? null : q.driverId;
    if (q.search?.trim()) {
      const s = q.search.trim();
      where.OR = [
        { code: { contains: s, mode: "insensitive" } },
        { routeFrom: { contains: s, mode: "insensitive" } },
        { routeTo: { contains: s, mode: "insensitive" } },
        { operationalFlight: { flightMaster: { flightNumber: { contains: s, mode: "insensitive" } } } },
        { vehicle: { code: { contains: s, mode: "insensitive" } } },
        { driver: { name: { contains: s, mode: "insensitive" } } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.dispatchOrder.findMany({ where, include: this.include, orderBy: { scheduledAt: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.dispatchOrder.count({ where }),
    ]);
    return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /** Ground-ops KPIs — all server-side aggregation, no rows loaded. */
  async dashboard(date?: string) {
    const day = this.dayOf(date ?? new Date().toISOString()) ?? this.dayOf(new Date().toISOString())!;
    const next = new Date(day.getTime() + 86_400_000);
    const scoped: Prisma.DispatchOrderWhereInput = { operationalFlightId: { not: null }, scheduledAt: { gte: day, lt: next } };

    // groupBy is typed separately: mixing it into a $transaction tuple collapses Prisma's result types.
    const grouped = await this.prisma.dispatchOrder.groupBy({ by: ["status"], where: scoped, _count: { _all: true } });
    const [unassignedAgg, flightsToday, dispatchedFlights, activeVehicles, busyVehicles] = await this.prisma.$transaction([
      this.prisma.dispatchOrder.count({ where: { ...scoped, status: "ASSIGNED", OR: [{ vehicleId: null }, { driverId: null }] } }),
      this.prisma.operationalFlight.count({ where: { flightDate: day } }),
      this.prisma.operationalFlight.count({ where: { flightDate: day, dispatchOrders: { some: {} } } }),
      this.prisma.vehicle.count({ where: { status: "ACTIVE" } }),
      this.prisma.dispatchOrder.findMany({ where: { status: { in: ACTIVE_STATUSES }, scheduledAt: { gte: day, lt: next }, vehicleId: { not: null } }, select: { vehicleId: true }, distinct: ["vehicleId"] }),
    ]);
    const by: Record<string, number> = {};
    for (const g of grouped) by[g.status] = g._count._all;
    const assignedTotal = by.ASSIGNED ?? 0;
    return {
      date: day.toISOString().slice(0, 10),
      todaysDispatches: grouped.reduce((a, g) => a + g._count._all, 0),
      /** No PENDING in DispatchStatus — an ASSIGNED row missing vehicle or driver is the real equivalent. */
      unassigned: unassignedAgg,
      assigned: Math.max(0, assignedTotal - unassignedAgg),
      enRoute: by.EN_ROUTE ?? 0,
      /** No ARRIVED in DispatchStatus — COMPLETED is the terminal equivalent. */
      completed: by.COMPLETED ?? 0,
      delayed: by.DELAYED ?? 0,
      cancelled: by.CANCELLED ?? 0,
      unassignedFlights: Math.max(0, flightsToday - dispatchedFlights),
      availableVehicles: Math.max(0, activeVehicles - busyVehicles.length),
    };
  }

  // ── mutations (all audited) ────────────────────────────────────────────────
  async create(dto: DispatchInput, actor: AuthUser, ip?: string) {
    const flight = await this.prisma.operationalFlight.findUnique({ where: { id: dto.operationalFlightId }, include: { flightMaster: { select: { flightNumber: true } } } });
    if (!flight) throw new BadRequestException("Operational flight not found");
    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId }, select: { id: true, tenantId: true, code: true } });
    if (!group) throw new BadRequestException("Group not found");
    const when = new Date(dto.scheduledAt);
    if (isNaN(when.getTime())) throw new BadRequestException("scheduledAt is not a valid date/time");
    const dayStart = new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()));
    const pax = dto.pax ?? 0;
    if (dto.vehicleId) await this.assertVehicle(dto.vehicleId, pax, dayStart);
    if (dto.driverId) await this.assertDriver(dto.driverId, dayStart);
    // one ground dispatch per (flight, group)
    const dupe = await this.prisma.dispatchOrder.findFirst({ where: { operationalFlightId: dto.operationalFlightId, groupId: dto.groupId, status: { in: ACTIVE_STATUSES } }, select: { code: true } });
    if (dupe) throw new ConflictException(`Group ${group.code} already has active dispatch ${dupe.code} on this flight`);

    let code = "";
    for (let i = 0; i < 12; i++) {
      code = `DSP-${String(1000 + Math.floor(Math.random() * 9000))}`;
      if (!(await this.prisma.dispatchOrder.findUnique({ where: { code } }))) break;
    }
    const row = await this.prisma.dispatchOrder.create({
      data: {
        code, tenantId: group.tenantId, groupId: group.id, operationalFlightId: dto.operationalFlightId,
        vehicleId: dto.vehicleId || null, driverId: dto.driverId || null,
        routeFrom: dto.routeFrom, routeTo: dto.routeTo, pax, scheduledAt: when,
        status: "ASSIGNED", note: dto.note || null,
      },
      include: this.include,
    });
    await this.audit(actor, "CREATE", row.id, { operation: "CREATE", code, flight: flight.flightMaster.flightNumber, group: group.code, vehicleId: row.vehicleId, driverId: row.driverId }, ip);
    return row;
  }

  /** Assign or re-assign vehicle/driver. `null` clears (unassign). */
  async assign(id: string, dto: { vehicleId?: string | null; driverId?: string | null }, actor: AuthUser, ip?: string) {
    const before = await this.get(id);
    if (before.status === "COMPLETED" || before.status === "CANCELLED") {
      throw new BadRequestException(`Dispatch is ${before.status} — assignment is closed`);
    }
    const dayStart = new Date(Date.UTC(before.scheduledAt.getUTCFullYear(), before.scheduledAt.getUTCMonth(), before.scheduledAt.getUTCDate()));
    const data: Prisma.DispatchOrderUpdateInput = {};
    if (dto.vehicleId !== undefined) {
      if (dto.vehicleId) { await this.assertVehicle(dto.vehicleId, before.pax, dayStart, id); data.vehicle = { connect: { id: dto.vehicleId } }; }
      else data.vehicle = { disconnect: true };
    }
    if (dto.driverId !== undefined) {
      if (dto.driverId) { await this.assertDriver(dto.driverId, dayStart, id); data.driver = { connect: { id: dto.driverId } }; }
      else data.driver = { disconnect: true };
    }
    if (!Object.keys(data).length) throw new BadRequestException("Nothing to assign");
    const row = await this.prisma.dispatchOrder.update({ where: { id }, data, include: this.include });
    // Per-field intent so UNASSIGN is audited distinctly (clearing one resource still counts).
    const cleared = (dto.vehicleId === null && !!before.vehicleId) || (dto.driverId === null && !!before.driverId);
    const replaced = (!!dto.vehicleId && !!before.vehicleId && dto.vehicleId !== before.vehicleId)
      || (!!dto.driverId && !!before.driverId && dto.driverId !== before.driverId);
    const added = (!!dto.vehicleId && !before.vehicleId) || (!!dto.driverId && !before.driverId);
    const operation = cleared && !added && !replaced ? "UNASSIGN" : replaced ? "REASSIGN" : "ASSIGN";
    await this.audit(actor, "UPDATE", id, {
      operation, code: row.code,
      before: { vehicleId: before.vehicleId, driverId: before.driverId },
      after: { vehicleId: row.vehicleId, driverId: row.driverId },
    }, ip);
    return row;
  }

  /** Status change — reuses the EXISTING OpsService.DISPATCH_TX transition table. */
  async changeStatus(id: string, next: DispatchStatus, note: string | undefined, actor: AuthUser, ip?: string) {
    const before = await this.get(id);
    const allowed = OpsService.DISPATCH_TX[before.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Illegal dispatch transition ${before.status} → ${next}. Allowed: ${allowed.join(", ") || "none (terminal state)"}`);
    }
    if (next === "EN_ROUTE" && (!before.vehicleId || !before.driverId)) {
      throw new BadRequestException("Assign both a vehicle and a driver before dispatching");
    }
    const progressPct = next === "EN_ROUTE" ? Math.max(before.progressPct, 40) : next === "COMPLETED" ? 100 : before.progressPct;
    const row = await this.prisma.dispatchOrder.update({
      where: { id }, data: { status: next, progressPct, ...(note !== undefined ? { note } : {}) }, include: this.include,
    });
    await this.audit(actor, "UPDATE", id, { operation: next === "CANCELLED" ? "CANCEL" : "STATUS_CHANGE", code: row.code, from: before.status, to: next, ...(note ? { note } : {}) }, ip);
    return row;
  }

  /** Per-dispatch history straight from AuditLog — no separate history store. */
  async history(id: string) {
    await this.get(id);
    const logs = await this.prisma.auditLog.findMany({
      where: { module: "GroundOps", entityType: "DispatchOrder", entityId: id },
      orderBy: { createdAt: "asc" },
      select: { action: true, after: true, createdAt: true, actorUserId: true, actor: { select: { name: true, email: true } } },
    });
    return logs.map((l) => {
      const a = (l.after ?? {}) as Record<string, unknown>;
      return { operation: String(a.operation ?? l.action), from: a.from as string | undefined, to: a.to as string | undefined, at: l.createdAt, actor: l.actor?.name ?? l.actor?.email ?? l.actorUserId };
    });
  }

  /** Assignable resources for the assignment dialog (small reference sets). */
  async resources() {
    const [vehicles, drivers] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true, type: true, plateNo: true, seats: true, status: true }, orderBy: { code: "asc" } }),
      this.prisma.driver.findMany({ where: { status: { not: "OFF_DUTY" } }, select: { id: true, name: true, phone: true, status: true }, orderBy: { name: "asc" } }),
    ]);
    return { vehicles, drivers };
  }
}
