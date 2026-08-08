import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, FlightDirection, FlightStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OperationalFlightService } from "./operational-flight.service";
import { GroundOpsService } from "./ground-ops.service";
import { MeetAssistService, deriveStatus, MA_STEPS, type MaStatus } from "./meet-assist.service";

/** Rolled-up ground status — uses the EXISTING DispatchStatus values only. */
export type GroundStatus = "UNASSIGNED" | "ASSIGNED" | "EN_ROUTE" | "COMPLETED" | "DELAYED" | "CANCELLED";

/**
 * Phase 10F — Flight Operations Command Center.
 * Pure ORCHESTRATION over 10B/10D/10E. No new model, table, enum, status system,
 * timeline store or permission. Cross-domain status is resolved through the REAL
 * DispatchOrder bridge (it carries both operationalFlightId and flightInfoId);
 * where that link is absent the value is null and the UI renders "—" (never inferred).
 */
@Injectable()
export class CommandCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flights: OperationalFlightService,
    private readonly ground: GroundOpsService,
    private readonly meet: MeetAssistService,
  ) {}

  private dayOf(v?: string) {
    const d = v ? new Date(v) : new Date();
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /** Single delay definition (10C): (actual ?? estimated) − scheduled, else null. */
  private delayMinutes(f: { scheduledTime: Date; estimatedTime: Date | null; actualTime: Date | null }): number | null {
    const ref = f.actualTime ?? f.estimatedTime;
    if (!ref || !f.scheduledTime) return null;
    return Math.round((ref.getTime() - f.scheduledTime.getTime()) / 60000);
  }

  private readonly boardInclude = {
    flightMaster: {
      select: {
        flightNumber: true,
        airline: { select: { code: true, name: true } },
        origin: { select: { iata: true, city: true } },
        destination: { select: { iata: true, city: true } },
      },
    },
    terminal: { select: { id: true, name: true } },
    dispatchOrders: {
      select: {
        id: true, code: true, status: true, vehicleId: true, driverId: true, scheduledAt: true,
        vehicle: { select: { code: true, seats: true } },
        driver: { select: { name: true, phone: true } },
        // The REAL bridge to Meet & Assist. Null on most rows today → status resolves to null.
        flightInfo: {
          select: {
            id: true, code: true, flightNo: true,
            group: { select: { code: true } },
            meetAssist: { select: { id: true, stepNo: true, done: true, assignedToId: true, startedAt: true, skippedAt: true, exceptionAt: true } },
          },
        },
      },
    },
  } satisfies Prisma.OperationalFlightInclude;

  private rollUpGround(ds: { status: string; vehicleId: string | null; driverId: string | null }[]): GroundStatus | null {
    if (!ds.length) return null;                       // no dispatch → "—"
    const active = ds.filter((d) => d.status !== "CANCELLED");
    if (!active.length) return "CANCELLED";
    if (active.some((d) => d.status === "DELAYED")) return "DELAYED";
    if (active.some((d) => d.status === "EN_ROUTE")) return "EN_ROUTE";
    if (active.every((d) => d.status === "COMPLETED")) return "COMPLETED";
    if (active.some((d) => !d.vehicleId || !d.driverId)) return "UNASSIGNED";
    return "ASSIGNED";
  }

  private rollUpMeetAssist(tasks: { done: boolean; assignedToId: string | null; startedAt: Date | null; skippedAt: Date | null; exceptionAt: Date | null }[]): MaStatus | null {
    if (!tasks.length) return null;                    // unresolved → "—"
    const states = tasks.map((t) => deriveStatus(t));
    if (states.includes("EXCEPTION")) return "EXCEPTION";
    if (states.every((s) => s === "COMPLETED")) return "COMPLETED";
    if (states.includes("IN_PROGRESS")) return "IN_PROGRESS";
    if (states.includes("ASSIGNED")) return "ASSIGNED";
    if (states.every((s) => s === "SKIPPED" || s === "COMPLETED")) return "SKIPPED";
    return "PENDING";
  }

  private shape(f: Prisma.OperationalFlightGetPayload<{ include: typeof CommandCenterService.prototype.boardInclude }>) {
    const maTasks = f.dispatchOrders.flatMap((d) => d.flightInfo?.meetAssist ?? []);
    return {
      id: f.id, flightDate: f.flightDate, direction: f.direction, status: f.status,
      scheduledTime: f.scheduledTime, estimatedTime: f.estimatedTime, actualTime: f.actualTime,
      gate: f.gate, terminal: f.terminal, isTestData: f.isTestData,
      flightMaster: f.flightMaster,
      delayMinutes: this.delayMinutes(f),
      groundStatus: this.rollUpGround(f.dispatchOrders),
      meetAssistStatus: this.rollUpMeetAssist(maTasks),
      dispatchCount: f.dispatchOrders.length,
    };
  }

  private buildWhere(q: Record<string, string>) {
    const where: Prisma.OperationalFlightWhereInput = {};
    const day = q.date ? this.dayOf(q.date) : null;
    if (day) where.flightDate = day;
    if (q.direction && q.direction !== "all") where.direction = q.direction as FlightDirection;
    if (q.status && q.status !== "all") where.status = q.status as FlightStatus;
    if (q.terminalId && q.terminalId !== "all") where.terminalId = q.terminalId;
    const master: Prisma.FlightMasterWhereInput = {};
    if (q.airlineId && q.airlineId !== "all") master.airlineId = q.airlineId;
    if (q.airportId && q.airportId !== "all") master.OR = [{ originId: q.airportId }, { destinationId: q.airportId }];
    if (q.search?.trim()) master.flightNumber = { contains: q.search.trim(), mode: "insensitive" };
    if (Object.keys(master).length) where.flightMaster = master;
    // Real server-side predicates (not derived-status filtering) for the ops tabs.
    if (q.ground === "has") where.dispatchOrders = { some: {} };
    if (q.ground === "none") where.dispatchOrders = { none: {} };
    if (q.meetAssist === "has") where.dispatchOrders = { some: { flightInfo: { meetAssist: { some: {} } } } };
    return where;
  }

  /** Paginated board — one query + count. Never loads history or passengers. */
  async board(q: Record<string, string>) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(q.pageSize) || 25));
    const where = this.buildWhere(q);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.operationalFlight.findMany({ where, include: this.boardInclude, orderBy: [{ flightDate: "asc" }, { scheduledTime: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.operationalFlight.count({ where }),
    ]);
    return { rows: rows.map((r) => this.shape(r)), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /** Unified KPIs — delegates to the EXISTING 10B/10D/10E dashboards, no new aggregation. */
  async overview(date?: string) {
    const day = this.dayOf(date);
    const iso = day ? day.toISOString().slice(0, 10) : null;
    const [flights, ground, meet, exceptions] = await Promise.all([
      this.flights.dashboard(iso ?? undefined),
      this.ground.dashboard(iso ?? undefined),
      this.meet.dashboard(iso ?? undefined),
      this.exceptions(iso ?? undefined),
    ]);
    return {
      date: iso,
      todaysFlights: flights.total,
      arrivals: flights.arrivals,
      departures: flights.departures,
      delayed: flights.delayed,
      cancelled: flights.cancelled,
      atGate: flights.atGate,
      enRoute: flights.enRoute,
      groundDispatches: ground.todaysDispatches,
      meetAssistPending: meet.pending,
      exceptions: exceptions.length,
    };
  }

  /**
   * Exceptions DERIVED from real state — no exception table.
   * Every item states exactly why it is exceptional.
   */
  async exceptions(date?: string) {
    const day = this.dayOf(date);
    const scoped = day ? { flightDate: day } : {};
    const [flights, dispatches, maTasks] = await Promise.all([
      this.prisma.operationalFlight.findMany({ where: scoped, include: this.boardInclude }),
      this.prisma.dispatchOrder.findMany({
        where: { operationalFlightId: { not: null }, ...(day ? { scheduledAt: { gte: day, lt: new Date(day.getTime() + 86_400_000) } } : {}) },
        select: { id: true, code: true, status: true, vehicleId: true, driverId: true, operationalFlight: { select: { flightMaster: { select: { flightNumber: true } } } } },
      }),
      this.prisma.meetAssistTask.findMany({
        where: { OR: [{ exceptionAt: { not: null } }, { skippedAt: { not: null } }], ...(day ? { flightInfo: { scheduledAt: { gte: day, lt: new Date(day.getTime() + 86_400_000) } } } : {}) },
        select: { id: true, stepNo: true, exceptionAt: true, skippedAt: true, note: true, flightInfo: { select: { flightNo: true, code: true } } },
      }),
    ]);
    const out: { id: string; kind: string; severity: "high" | "medium"; subject: string; reason: string; at: Date | null }[] = [];
    for (const f of flights) {
      const fn = f.flightMaster.flightNumber;
      if (f.status === "CANCELLED") out.push({ id: `f-${f.id}`, kind: "FLIGHT_CANCELLED", severity: "high", subject: fn, reason: "Flight status is CANCELLED", at: f.statusChangedAt });
      else if (f.status === "DELAYED") out.push({ id: `f-${f.id}`, kind: "FLIGHT_DELAYED", severity: "high", subject: fn, reason: "Flight status is DELAYED", at: f.statusChangedAt });
      else {
        const d = this.delayMinutes(f);
        if (d !== null && d >= 15) out.push({ id: `d-${f.id}`, kind: "SCHEDULE_SLIP", severity: d >= 30 ? "high" : "medium", subject: fn, reason: `Running ${d} minutes behind schedule`, at: f.actualTime ?? f.estimatedTime });
      }
    }
    for (const d of dispatches) {
      const fn = d.operationalFlight?.flightMaster.flightNumber ?? d.code;
      if (d.status === "CANCELLED") continue;
      if (d.status === "DELAYED") out.push({ id: `gd-${d.id}`, kind: "DISPATCH_DELAYED", severity: "high", subject: `${fn} · ${d.code}`, reason: "Dispatch status is DELAYED", at: null });
      else if (!d.vehicleId && !d.driverId) out.push({ id: `gu-${d.id}`, kind: "DISPATCH_UNASSIGNED", severity: "high", subject: `${fn} · ${d.code}`, reason: "No vehicle and no driver assigned", at: null });
      else if (!d.vehicleId) out.push({ id: `gv-${d.id}`, kind: "VEHICLE_UNASSIGNED", severity: "medium", subject: `${fn} · ${d.code}`, reason: "Vehicle not assigned", at: null });
      else if (!d.driverId) out.push({ id: `gr-${d.id}`, kind: "DRIVER_UNASSIGNED", severity: "medium", subject: `${fn} · ${d.code}`, reason: "Driver not assigned", at: null });
    }
    for (const t of maTasks) {
      const step = MA_STEPS[t.stepNo - 1] ?? `Step ${t.stepNo}`;
      const subject = `${t.flightInfo.flightNo} · ${step}`;
      if (t.exceptionAt) out.push({ id: `ma-${t.id}`, kind: "MEET_ASSIST_EXCEPTION", severity: "high", subject, reason: t.note ? `Exception raised: ${t.note}` : "Meet & Assist exception raised", at: t.exceptionAt });
      else if (t.skippedAt) out.push({ id: `ms-${t.id}`, kind: "MEET_ASSIST_SKIPPED", severity: "medium", subject, reason: "Checklist step was skipped", at: t.skippedAt });
    }
    return out;
  }

  /** Unified drawer — flight + timeline + dispatch + Meet & Assist. Loaded only on open. */
  async detail(id: string) {
    const flight = await this.prisma.operationalFlight.findUnique({ where: { id }, include: this.boardInclude });
    if (!flight) throw new NotFoundException("Operational flight not found");
    const timeline = await this.flights.timeline(id);   // reuses the 10B timeline API
    const maTasks = flight.dispatchOrders.flatMap((d) => (d.flightInfo?.meetAssist ?? []).map((t) => ({ ...t, flightInfo: d.flightInfo })));
    const checklist = maTasks
      .sort((a, b) => a.stepNo - b.stepNo)
      .map((t) => ({ id: t.id, stepNo: t.stepNo, task: MA_STEPS[t.stepNo - 1] ?? `Step ${t.stepNo}`, status: deriveStatus(t) }));
    return {
      flight: this.shape(flight),
      operations: flight.dispatchOrders.map((d) => ({
        id: d.id, code: d.code, status: d.status,
        vehicle: d.vehicle?.code ?? null, driver: d.driver?.name ?? null, scheduledAt: d.scheduledAt,
        group: d.flightInfo?.group?.code ?? null,
      })),
      meetAssist: {
        resolved: checklist.length > 0,
        status: this.rollUpMeetAssist(maTasks),
        completed: checklist.filter((c) => c.status === "COMPLETED").length,
        total: checklist.length,
        current: checklist.find((c) => c.status === "IN_PROGRESS" || c.status === "ASSIGNED" || c.status === "PENDING")?.task ?? null,
        exceptions: checklist.filter((c) => c.status === "EXCEPTION").length,
        checklist,
      },
      timeline,
    };
  }

  /** Filter dimensions backed by real reference data. */
  async options() {
    const [airlines, airports, terminals] = await this.prisma.$transaction([
      this.prisma.airline.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
      this.prisma.airport.findMany({ select: { id: true, iata: true }, orderBy: { iata: "asc" } }),
      this.prisma.terminal.findMany({ select: { id: true, name: true, airport: { select: { iata: true } } }, orderBy: { name: "asc" } }),
    ]);
    return { airlines, airports, terminals };
  }
}
