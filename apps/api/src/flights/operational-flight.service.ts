import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, FlightDirection, FlightStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";

export interface OpFlightInput {
  flightMasterId: string; flightDate: string; direction: FlightDirection;
  scheduledTime: string; estimatedTime?: string | null; actualTime?: string | null;
  terminalId?: string | null; gate?: string | null; remarks?: string | null; isTestData?: boolean;
}

/**
 * Canonical operational path per direction, expressed with the EXISTING FlightStatus
 * enum (no new statuses invented): AIRBORNE→EN_ROUTE, LANDED→ARRIVED, COMPLETED→DELIVERED.
 */
export const FLIGHT_PATH: Record<FlightDirection, FlightStatus[]> = {
  DEPARTURE: ["SCHEDULED", "CHECK_IN", "BOARDING", "DEPARTED", "EN_ROUTE", "ARRIVED", "DELIVERED"] as FlightStatus[],
  ARRIVAL: ["SCHEDULED", "EN_ROUTE", "LANDING", "AT_GATE", "ARRIVED", "DELIVERED"] as FlightStatus[],
};
/** Explicit, controlled transitions. Terminal states have no outgoing edges. */
const TRANSITIONS: Record<FlightDirection, Partial<Record<FlightStatus, FlightStatus[]>>> = {
  DEPARTURE: {
    SCHEDULED: ["CHECK_IN", "BOARDING", "DELAYED", "RESCHEDULED", "CANCELLED"],
    CHECK_IN: ["BOARDING", "DELAYED", "CANCELLED"],
    BOARDING: ["DEPARTED", "DELAYED", "CANCELLED"],
    DEPARTED: ["EN_ROUTE", "ARRIVED"],
    EN_ROUTE: ["LANDING", "ARRIVED"],
    LANDING: ["AT_GATE", "ARRIVED"],
    AT_GATE: ["ARRIVED", "DELIVERED"],
    ARRIVED: ["AT_GATE", "DELIVERED"],
    DELAYED: ["SCHEDULED", "CHECK_IN", "BOARDING", "DEPARTED", "RESCHEDULED", "CANCELLED"],
    RESCHEDULED: ["SCHEDULED", "CANCELLED"],
    DELIVERED: [], CANCELLED: [],
  },
  ARRIVAL: {
    SCHEDULED: ["EN_ROUTE", "LANDING", "DELAYED", "RESCHEDULED", "CANCELLED"],
    EN_ROUTE: ["LANDING", "DELAYED", "CANCELLED"],
    LANDING: ["AT_GATE", "ARRIVED"],
    AT_GATE: ["ARRIVED", "DELIVERED"],
    ARRIVED: ["DELIVERED"],
    DELAYED: ["SCHEDULED", "EN_ROUTE", "LANDING", "RESCHEDULED", "CANCELLED"],
    RESCHEDULED: ["SCHEDULED", "CANCELLED"],
    DELIVERED: [], CANCELLED: [],
  },
};

const DAY = 86_400_000;

@Injectable()
export class OperationalFlightService {
  constructor(private readonly prisma: PrismaService) {}

  /** Flat include — one join, no N+1 on list screens. */
  private readonly detail = {
    flightMaster: {
      select: {
        id: true, flightNumber: true, active: true,
        airline: { select: { code: true, name: true } },
        origin: { select: { iata: true, city: true } },
        destination: { select: { iata: true, city: true } },
      },
    },
    terminal: { select: { id: true, name: true, airportId: true } },
  } satisfies Prisma.OperationalFlightInclude;

  private audit(actor: AuthUser, action: "CREATE" | "UPDATE" | "DELETE", id: string, payload: Record<string, unknown>, ip?: string) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub, action, module: "FlightOps", entityType: "OperationalFlight", entityId: id,
        after: payload as unknown as Prisma.InputJsonValue, ip,
      },
    });
  }

  private parseDate(v: string, label: string): Date {
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException(`${label} is not a valid date/time`);
    return d;
  }

  /** Times must be coherent: scheduled near the flight date, estimates/actuals near scheduled. */
  private assertChronology(flightDate: Date, scheduled: Date, estimated?: Date | null, actual?: Date | null) {
    const dayStart = new Date(Date.UTC(flightDate.getUTCFullYear(), flightDate.getUTCMonth(), flightDate.getUTCDate()));
    if (Math.abs(scheduled.getTime() - dayStart.getTime()) > 2 * DAY) {
      throw new BadRequestException("Scheduled time must fall on (or adjacent to) the flight date");
    }
    for (const [label, t] of [["Estimated time", estimated], ["Actual time", actual]] as const) {
      if (!t) continue;
      if (Math.abs(t.getTime() - scheduled.getTime()) > DAY) {
        throw new BadRequestException(`${label} must be within 24 hours of the scheduled time`);
      }
    }
  }

  /** Terminal must belong to the airport this flight actually touches. */
  private async assertTerminal(terminalId: string, direction: FlightDirection, masterId: string) {
    const [terminal, master] = await Promise.all([
      this.prisma.terminal.findUnique({ where: { id: terminalId } }),
      this.prisma.flightMaster.findUnique({ where: { id: masterId }, select: { originId: true, destinationId: true } }),
    ]);
    if (!terminal) throw new BadRequestException("Terminal not found");
    if (!master) throw new BadRequestException("Flight master not found");
    const expected = direction === "ARRIVAL" ? master.destinationId : master.originId;
    if (terminal.airportId !== expected) {
      throw new BadRequestException(`Terminal does not belong to the ${direction === "ARRIVAL" ? "destination" : "origin"} airport`);
    }
  }

  async list(q: { direction?: string; status?: string; date?: string; search?: string; page?: string; pageSize?: string; airlineId?: string; airportId?: string; terminalId?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(q.pageSize) || 25));
    const where: Prisma.OperationalFlightWhereInput = {};
    if (q.direction && q.direction !== "all") where.direction = q.direction as FlightDirection;
    if (q.status && q.status !== "all") where.status = q.status as FlightStatus;
    if (q.date) {
      const d = new Date(q.date);
      if (!isNaN(d.getTime())) where.flightDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    if (q.search?.trim()) {
      const s = q.search.trim();
      where.OR = [
        { flightMaster: { flightNumber: { contains: s, mode: "insensitive" } } },
        { flightMaster: { airline: { code: { contains: s, mode: "insensitive" } } } },
        { flightMaster: { origin: { iata: { contains: s, mode: "insensitive" } } } },
        { flightMaster: { destination: { iata: { contains: s, mode: "insensitive" } } } },
        { gate: { contains: s, mode: "insensitive" } },
      ];
    }
    if (q.airlineId && q.airlineId !== "all") where.flightMaster = { airlineId: q.airlineId };
    if (q.terminalId && q.terminalId !== "all") where.terminalId = q.terminalId;
    if (q.airportId && q.airportId !== "all") {
      // A flight "touches" an airport as either origin or destination.
      where.AND = [{ flightMaster: { OR: [{ originId: q.airportId }, { destinationId: q.airportId }] } }];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.operationalFlight.findMany({ where, include: this.detail, orderBy: [{ flightDate: "asc" }, { scheduledTime: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.operationalFlight.count({ where }),
    ]);
    return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async get(id: string) {
    const row = await this.prisma.operationalFlight.findUnique({ where: { id }, include: this.detail });
    if (!row) throw new NotFoundException("Operational flight not found");
    return row;
  }

  /** Timeline foundation — canonical path + real status history derived from the audit trail (no duplicate history store). */
  async timeline(id: string) {
    const flight = await this.get(id);
    const logs = await this.prisma.auditLog.findMany({
      where: { module: "FlightOps", entityType: "OperationalFlight", entityId: id },
      orderBy: { createdAt: "asc" },
      select: { action: true, after: true, createdAt: true, actorUserId: true, actor: { select: { name: true, email: true } } },
    });
    const history = logs
      .map((l) => {
        const a = (l.after ?? {}) as Record<string, unknown>;
        return { operation: String(a.operation ?? l.action), from: a.from as string | undefined, to: a.to as string | undefined, at: l.createdAt, actor: l.actor?.name ?? l.actor?.email ?? l.actorUserId };
      })
      .filter((h) => h.operation === "STATUS_CHANGE" || h.operation === "CREATE");
    const reached = new Set<string>(["SCHEDULED", ...history.map((h) => h.to).filter(Boolean) as string[]]);
    // Progress inference: the canonical path is ordered, so a flight sitting at
    // step N has necessarily progressed past the earlier steps. Audit history may
    // be shorter than reality (e.g. retention/reseed) — the real records are still
    // returned separately in `history`.
    const path = FLIGHT_PATH[flight.direction];
    const idx = path.indexOf(flight.status);
    if (idx >= 0) path.slice(0, idx + 1).forEach((s) => reached.add(s));
    return {
      flightId: id,
      direction: flight.direction,
      current: flight.status,
      /** Only the canonical states for this record's direction. */
      steps: FLIGHT_PATH[flight.direction].map((s) => ({ status: s, reached: reached.has(s), current: s === flight.status })),
      offPath: !FLIGHT_PATH[flight.direction].includes(flight.status) ? flight.status : null,
      history,
      allowedNext: TRANSITIONS[flight.direction][flight.status] ?? [],
    };
  }

  async create(dto: OpFlightInput, actor: AuthUser, ip?: string) {
    const master = await this.prisma.flightMaster.findUnique({ where: { id: dto.flightMasterId } });
    if (!master) throw new BadRequestException("Flight master not found");
    if (!master.active) throw new BadRequestException("Flight master is archived — activate it before scheduling operational flights");
    if (!["ARRIVAL", "DEPARTURE"].includes(dto.direction)) throw new BadRequestException("Direction must be ARRIVAL or DEPARTURE");

    const raw = this.parseDate(dto.flightDate, "Flight date");
    const flightDate = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
    const scheduled = this.parseDate(dto.scheduledTime, "Scheduled time");
    const estimated = dto.estimatedTime ? this.parseDate(dto.estimatedTime, "Estimated time") : null;
    const actual = dto.actualTime ? this.parseDate(dto.actualTime, "Actual time") : null;
    this.assertChronology(flightDate, scheduled, estimated, actual);
    if (dto.terminalId) await this.assertTerminal(dto.terminalId, dto.direction, dto.flightMasterId);

    const dupe = await this.prisma.operationalFlight.findUnique({
      where: { flightMasterId_flightDate_direction: { flightMasterId: dto.flightMasterId, flightDate, direction: dto.direction } },
    });
    if (dupe) throw new ConflictException(`${master.flightNumber} already has a ${dto.direction} on ${flightDate.toISOString().slice(0, 10)}`);

    const row = await this.prisma.operationalFlight.create({
      data: {
        flightMasterId: dto.flightMasterId, flightDate, direction: dto.direction,
        scheduledTime: scheduled, estimatedTime: estimated, actualTime: actual,
        terminalId: dto.terminalId || null, gate: dto.gate || null, remarks: dto.remarks || null,
        isTestData: dto.isTestData ?? false, status: "SCHEDULED", statusChangedAt: new Date(),
      },
      include: this.detail,
    });
    await this.audit(actor, "CREATE", row.id, { operation: "CREATE", flightNumber: master.flightNumber, date: flightDate.toISOString().slice(0, 10), direction: row.direction, to: "SCHEDULED" }, ip);
    return row;
  }

  async update(id: string, dto: Partial<OpFlightInput>, actor: AuthUser, ip?: string) {
    const before = await this.get(id);
    const flightDate = dto.flightDate ? (() => { const r = this.parseDate(dto.flightDate!, "Flight date"); return new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate())); })() : before.flightDate;
    const scheduled = dto.scheduledTime ? this.parseDate(dto.scheduledTime, "Scheduled time") : before.scheduledTime;
    const estimated = dto.estimatedTime !== undefined ? (dto.estimatedTime ? this.parseDate(dto.estimatedTime, "Estimated time") : null) : before.estimatedTime;
    const actual = dto.actualTime !== undefined ? (dto.actualTime ? this.parseDate(dto.actualTime, "Actual time") : null) : before.actualTime;
    this.assertChronology(flightDate, scheduled, estimated, actual);
    const direction = (dto.direction ?? before.direction) as FlightDirection;
    const masterId = dto.flightMasterId ?? before.flightMasterId;
    if (dto.terminalId) await this.assertTerminal(dto.terminalId, direction, masterId);
    if (dto.flightMasterId || dto.flightDate || dto.direction) {
      const clash = await this.prisma.operationalFlight.findUnique({ where: { flightMasterId_flightDate_direction: { flightMasterId: masterId, flightDate, direction } } });
      if (clash && clash.id !== id) throw new ConflictException("Another operational flight already exists for that master, date and direction");
    }
    const row = await this.prisma.operationalFlight.update({
      where: { id },
      data: {
        flightMasterId: masterId, flightDate, direction, scheduledTime: scheduled, estimatedTime: estimated, actualTime: actual,
        ...(dto.terminalId !== undefined ? { terminalId: dto.terminalId || null } : {}),
        ...(dto.gate !== undefined ? { gate: dto.gate || null } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks || null } : {}),
      },
      include: this.detail,
    });
    await this.audit(actor, "UPDATE", id, {
      operation: "UPDATE", flightNumber: row.flightMaster.flightNumber, changed: Object.keys(dto),
      before: { scheduledTime: before.scheduledTime, estimatedTime: before.estimatedTime, actualTime: before.actualTime, gate: before.gate, terminalId: before.terminalId },
      after: { scheduledTime: row.scheduledTime, estimatedTime: row.estimatedTime, actualTime: row.actualTime, gate: row.gate, terminalId: row.terminalId },
    }, ip);
    return row;
  }

  async changeStatus(id: string, next: FlightStatus, actor: AuthUser, ip?: string) {
    const before = await this.get(id);
    const allowed = TRANSITIONS[before.direction][before.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Illegal transition ${before.status} → ${next} for ${before.direction}. Allowed: ${allowed.join(", ") || "none (terminal state)"}`);
    }
    const now = new Date();
    const stamps: Prisma.OperationalFlightUpdateInput = { status: next, statusChangedAt: now };
    // Landing/arrival/departure moments record the actual time when not already set.
    if (!before.actualTime && (next === "DEPARTED" || next === "ARRIVED" || next === "AT_GATE")) stamps.actualTime = now;
    const row = await this.prisma.operationalFlight.update({ where: { id }, data: stamps, include: this.detail });
    await this.audit(actor, "UPDATE", id, { operation: "STATUS_CHANGE", flightNumber: row.flightMaster.flightNumber, from: before.status, to: next }, ip);
    return row;
  }

  /** No hard delete once the flight has operational history — cancel instead. */
  async remove(id: string, actor: AuthUser, ip?: string) {
    const row = await this.get(id);
    const changes = await this.prisma.auditLog.count({
      where: { module: "FlightOps", entityType: "OperationalFlight", entityId: id, after: { path: ["operation"], equals: "STATUS_CHANGE" } },
    });
    if (row.status !== "SCHEDULED" || changes > 0) {
      throw new BadRequestException("Flight has operational history — cancel it instead of deleting");
    }
    await this.prisma.operationalFlight.delete({ where: { id } });
    await this.audit(actor, "DELETE", id, { operation: "DELETE", flightNumber: row.flightMaster.flightNumber, date: row.flightDate.toISOString().slice(0, 10) }, ip);
    return { ok: true };
  }


  /** Operations-control KPIs for a day — single groupBy, no rows loaded. */
  async dashboard(date?: string) {
    const where: Prisma.OperationalFlightWhereInput = {};
    let iso: string | null = null;
    const d = date ? new Date(date) : new Date();
    if (!isNaN(d.getTime())) {
      const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      where.flightDate = day; iso = day.toISOString().slice(0, 10);
    }
    const grouped = await this.prisma.operationalFlight.groupBy({ by: ["direction", "status"], where, _count: { _all: true } });
    const n = (f: (g: (typeof grouped)[number]) => boolean) => grouped.filter(f).reduce((a, g) => a + g._count._all, 0);
    const byStatus: Record<string, number> = {};
    for (const g of grouped) byStatus[g.status] = (byStatus[g.status] ?? 0) + g._count._all;
    return {
      date: iso,
      total: n(() => true),
      arrivals: n((g) => g.direction === "ARRIVAL"),
      departures: n((g) => g.direction === "DEPARTURE"),
      scheduled: byStatus.SCHEDULED ?? 0,
      checkIn: byStatus.CHECK_IN ?? 0,
      boarding: byStatus.BOARDING ?? 0,
      enRoute: byStatus.EN_ROUTE ?? 0,
      atGate: byStatus.AT_GATE ?? 0,
      delayed: byStatus.DELAYED ?? 0,
      cancelled: byStatus.CANCELLED ?? 0,
      completed: byStatus.DELIVERED ?? 0,
      byStatus,
    };
  }

  /** Board KPIs for the Arrival/Departure views (counts only — no history loaded). */
  async stats(direction: FlightDirection, date?: string) {
    const where: Prisma.OperationalFlightWhereInput = { direction };
    if (date) { const d = new Date(date); if (!isNaN(d.getTime())) where.flightDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
    const grouped = await this.prisma.operationalFlight.groupBy({ by: ["status"], where, _count: { _all: true } });
    const by = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    const total = grouped.reduce((s, g) => s + g._count._all, 0);
    return {
      total,
      scheduled: by.SCHEDULED ?? 0,
      inProgress: (by.CHECK_IN ?? 0) + (by.BOARDING ?? 0) + (by.DEPARTED ?? 0) + (by.EN_ROUTE ?? 0) + (by.LANDING ?? 0) + (by.AT_GATE ?? 0),
      delayed: (by.DELAYED ?? 0) + (by.RESCHEDULED ?? 0),
      completed: (by.DELIVERED ?? 0) + (by.ARRIVED ?? 0),
      cancelled: by.CANCELLED ?? 0,
    };
  }
}
