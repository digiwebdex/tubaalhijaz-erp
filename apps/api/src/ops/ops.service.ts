import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  BrnStatus, DispatchStatus, FlightStatus, LongStayStatus, Prisma,
  RenewalStatus, ZiyarahStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { OpsGateway } from "./ops.gateway";
import {
  VISA_PIPELINE_STATES,
  allowedTargets,
  type VisaPipelineState,
} from "../groups/visa-pipeline.machine";
import { buildEvent, EV } from "../automation/events";
import {
  DAY85_DUE,
  day85NotifyCode,
  day85View,
  isDay85Stage,
  type Day85Stage,
  type Day85View,
} from "./day85";

const dayRange = (date?: string) => {
  if (!date) return undefined;
  const start = new Date(date + "T00:00:00.000Z");
  const end = new Date(start.getTime() + 86_400_000);
  return { gte: start, lt: end };
};

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OpsGateway,
    private readonly events: EventEmitter2,
  ) {}

  private audit(user: AuthUser, action: "CREATE" | "UPDATE", entityType: string, entityId: string, after: object) {
    return this.prisma.auditLog.create({
      data: { actorUserId: user.sub, action, module: "OpsControl", entityType, entityId, after: after as never },
    });
  }

  /**
   * T002-08 — every Day-85 compliance action lands here. Separate `module` so
   * the compliance trail is greppable next to plain Long Stay edits; cron runs
   * carry no actor (`actorLabel` instead), per the AuditLog convention.
   */
  private day85Audit(
    action: "RUN" | "UPDATE",
    longStayId: string,
    after: object,
    user?: AuthUser,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: user?.sub ?? null,
        actorLabel: user ? null : "System (Cron)",
        action,
        module: "Day85Compliance",
        entityType: "LongStay",
        entityId: longStayId,
        after: after as never,
      },
    });
  }

  // ── Group Master ─────────────────────────────────────────────────────────────
  async groupMaster(status?: string) {
    const groups = await this.prisma.group.findMany({
      where: status ? { opsStatus: status as never } : {},
      include: {
        tenant: { select: { name: true } },
        uploadedByUser: { select: { id: true, name: true, email: true } },
        umrahCompany: { select: { id: true, code: true, name: true } },
        hotelBookings: { select: { hotel: { select: { name: true, city: true } } }, take: 1, orderBy: { createdAt: "desc" } },
        visaRequests: { select: { status: true }, take: 1, orderBy: { createdAt: "desc" } },
      },
      orderBy: { departDate: "asc" },
      take: 100,
    });
    const visaLabel = (s?: string) => (s === "COMPLETED" || s === "VOUCHER_ISSUED" ? "Ready" : s === "CONFIRMED" ? "In Process" : "Pending");
    return groups.map((g) => ({
      id: g.id,
      code: g.code,
      agent: g.tenant.name,
      pax: g.paxCount,
      hotel: g.hotelBookings[0]?.hotel?.name ?? "—",
      city: g.hotelBookings[0]?.hotel?.city ?? (g.destination === "MADINAH" ? "Madinah" : "Makkah"),
      dates: g.departDate && g.returnDate ? `${fmt(g.departDate)} – ${fmt(g.returnDate)}` : "—",
      visa: visaLabel(g.visaRequests[0]?.status),
      opsStatus: g.opsStatus,
      // T001-03/09 foundation projection (additive; old clients ignore extras)
      name: g.name,
      nusukGroupNumber: g.nusukGroupNumber,
      visaType: g.visaType,
      packageType: g.packageType,
      hajiWhatsapp: g.hajiWhatsapp,
      consulate: g.consulate,
      // T002-01 — Umrah Co linkage
      umrahCompanyId: g.umrahCompanyId,
      umrahCompany: g.umrahCompany,
      uploadedByLabel: g.uploadedByLabel ?? g.uploadedByUser?.name ?? null,
      uploadedByUserId: g.uploadedByUserId,
      gateVisa: g.gateVisa,
      gatePackage: g.gatePackage,
      gatePayment: g.gatePayment,
      gateBill: g.gateBill,
    }));
  }

  // ── Arrival / Departure boards ───────────────────────────────────────────────
  async board(direction: "ARRIVAL" | "DEPARTURE", date?: string) {
    const flights = await this.prisma.flightInfo.findMany({
      where: { direction, ...(dayRange(date) ? { scheduledAt: dayRange(date) } : {}) },
      include: {
        group: { select: { code: true, tenant: { select: { name: true } } } },
        dispatchOrders: {
          select: { code: true, status: true, vehicle: { select: { code: true } }, driver: { select: { name: true } } },
          take: 1,
          orderBy: { scheduledAt: "asc" },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });
    return flights.map((f) => this.flightRow(f));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private flightRow(f: any) {
    const dsp = f.dispatchOrders?.[0];
    return {
      id: f.id,
      code: f.code,
      flight: f.flightNo,
      airline: f.airline,
      route: `${f.originAirport} → ${f.destAirport}`,
      time: f.scheduledAt,
      terminal: f.terminal,
      gate: f.gate,
      pax: f.paxCount,
      group: f.group?.code ?? null,
      agent: f.group?.tenant?.name ?? null,
      vehicle: dsp?.vehicle?.code ?? null,
      driver: dsp?.driver?.name ?? null,
      dispatchStatus: dsp?.status ?? null,
      status: f.status,
    };
  }

  async setFlightStatus(id: string, status: FlightStatus, user: AuthUser) {
    const flight = await this.prisma.flightInfo.findUnique({ where: { id } });
    if (!flight) throw new NotFoundException("Flight not found");
    const updated = await this.prisma.flightInfo.update({
      where: { id },
      data: { status },
      include: {
        group: { select: { code: true, tenant: { select: { name: true } } } },
        dispatchOrders: { select: { code: true, status: true, vehicle: { select: { code: true } }, driver: { select: { name: true } } }, take: 1 },
      },
    });
    await this.audit(user, "UPDATE", "FlightInfo", id, { code: flight.code, from: flight.status, to: status });
    const row = this.flightRow(updated);
    // live push: board patches the row; terminal states also fire a group event
    this.gateway.broadcast("flight.status", { direction: flight.direction, row });
    if (status === "DELIVERED") this.gateway.broadcast("group.arrival", { group: row.group, flight: row.flight });
    if (status === "DEPARTED") this.gateway.broadcast("group.departure", { group: row.group, flight: row.flight });
    return row;
  }

  // ── Dispatch board (CRUD + status) ───────────────────────────────────────────
  async dispatches(status?: string) {
    const rows = await this.prisma.dispatchOrder.findMany({
      where: status ? { status: status as never } : {},
      include: {
        group: { select: { code: true } },
        vehicle: { select: { code: true } },
        driver: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 150,
    });
    return rows.map((d) => this.dispatchRow(d));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dispatchRow(d: any) {
    return {
      id: d.id,
      code: d.code,
      vehicle: d.vehicle?.code ?? "—",
      driver: d.driver?.name ?? "—",
      pax: d.pax,
      route: `${d.routeFrom} → ${d.routeTo}`,
      group: d.group?.code ?? null,
      time: d.scheduledAt,
      status: d.status,
      progressPct: d.progressPct,
      note: d.note,
    };
  }

  async createDispatch(
    dto: { groupId: string; vehicleId?: string; driverId?: string; flightInfoId?: string; routeFrom: string; routeTo: string; pax: number; scheduledAt: string },
    user: AuthUser,
  ) {
    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId }, select: { id: true, tenantId: true } });
    if (!group) throw new NotFoundException("Group not found");
    let code = "";
    for (let i = 0; i < 12; i++) {
      code = `DSP-${String(1000 + Math.floor(Math.random() * 9000))}`;
      if (!(await this.prisma.dispatchOrder.findUnique({ where: { code } }))) break;
    }
    const created = await this.prisma.dispatchOrder.create({
      data: {
        code,
        tenantId: group.tenantId,
        groupId: group.id,
        flightInfoId: dto.flightInfoId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        routeFrom: dto.routeFrom,
        routeTo: dto.routeTo,
        pax: dto.pax,
        scheduledAt: new Date(dto.scheduledAt),
        status: "ASSIGNED",
      },
      include: { group: { select: { code: true } }, vehicle: { select: { code: true } }, driver: { select: { name: true } } },
    });
    await this.audit(user, "CREATE", "DispatchOrder", created.id, { code });
    const row = this.dispatchRow(created);
    this.gateway.broadcast("dispatch.created", { row });
    return row;
  }

  static readonly DISPATCH_TX: Record<DispatchStatus, DispatchStatus[]> = {
    ASSIGNED: ["EN_ROUTE", "DELAYED", "CANCELLED"],
    EN_ROUTE: ["COMPLETED", "DELAYED", "CANCELLED"],
    DELAYED: ["EN_ROUTE", "COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  async setDispatchStatus(id: string, status: DispatchStatus, note: string | undefined, user: AuthUser) {
    const d = await this.prisma.dispatchOrder.findUnique({ where: { id } });
    if (!d) throw new NotFoundException("Dispatch not found");
    const allowed = OpsService.DISPATCH_TX[d.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Illegal dispatch transition ${d.status} → ${status}`);
    }
    const progressPct = status === "EN_ROUTE" ? Math.max(d.progressPct, 40) : status === "COMPLETED" ? 100 : d.progressPct;
    const updated = await this.prisma.dispatchOrder.update({
      where: { id },
      data: { status, progressPct, ...(note !== undefined ? { note } : {}) },
      include: { group: { select: { code: true } }, vehicle: { select: { code: true } }, driver: { select: { name: true } } },
    });
    await this.audit(user, "UPDATE", "DispatchOrder", id, { code: d.code, from: d.status, to: status, ...(note ? { note } : {}) });
    const row = this.dispatchRow(updated);
    this.gateway.broadcast("dispatch.status", { row });
    return row;
  }

  /** Manual "flag delayed" for ops staff (with an incident note). */
  flagDelayed(id: string, note: string, user: AuthUser) {
    if (!note) throw new BadRequestException("A delay note is required");
    return this.setDispatchStatus(id, "DELAYED", note, user);
  }

  // ── Meet & Assist ─────────────────────────────────────────────────────────────
  async meetAssist(flightInfoId: string) {
    const flight = await this.prisma.flightInfo.findUnique({ where: { id: flightInfoId }, include: { meetAssist: { orderBy: { stepNo: "asc" } } } });
    if (!flight) throw new NotFoundException("Flight not found");
    // lazily create the 7-step checklist if missing
    if (flight.meetAssist.length === 0) {
      await this.prisma.meetAssistTask.createMany({
        data: Array.from({ length: 7 }, (_, i) => ({ flightInfoId, stepNo: i + 1, done: false })),
      });
    }
    const steps = await this.prisma.meetAssistTask.findMany({ where: { flightInfoId }, orderBy: { stepNo: "asc" } });
    return { flightInfoId, code: flight.code, steps: steps.map((s) => ({ stepNo: s.stepNo, done: s.done, completedAt: s.completedAt })) };
  }

  async toggleMeetAssist(flightInfoId: string, stepNo: number, done: boolean, user: AuthUser) {
    const task = await this.prisma.meetAssistTask.findUnique({ where: { flightInfoId_stepNo: { flightInfoId, stepNo } } });
    if (!task) throw new NotFoundException("Checklist step not found");
    await this.prisma.meetAssistTask.update({ where: { id: task.id }, data: { done, completedAt: done ? new Date() : null } });
    await this.audit(user, "UPDATE", "MeetAssistTask", task.id, { flightInfoId, stepNo, done });
    const result = await this.meetAssist(flightInfoId);
    this.gateway.broadcast("meetassist.updated", result);
    return result;
  }

  // ── Ziyarah ───────────────────────────────────────────────────────────────────
  async ziyarah(status?: string) {
    const rows = await this.prisma.ziyarahTrip.findMany({
      where: status ? { status: status as never } : {},
      include: { group: { select: { code: true } }, vehicle: { select: { code: true } } },
      orderBy: { date: "asc" },
    });
    return rows.map((z) => ({ id: z.id, code: z.code, group: z.group?.code, date: z.date, sites: z.sites, guide: z.guideName, vehicle: z.vehicle?.code ?? "—", pax: z.pax, status: z.status }));
  }

  async createZiyarah(dto: { groupId: string; date: string; sites: string; guideName?: string; vehicleId?: string; pax: number }, user: AuthUser) {
    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId }, select: { id: true, tenantId: true } });
    if (!group) throw new NotFoundException("Group not found");
    let code = "";
    for (let i = 0; i < 12; i++) { code = `ZYR-${String(1000 + Math.floor(Math.random() * 9000))}`; if (!(await this.prisma.ziyarahTrip.findUnique({ where: { code } }))) break; }
    const created = await this.prisma.ziyarahTrip.create({
      data: { code, tenantId: group.tenantId, groupId: group.id, date: new Date(dto.date), sites: dto.sites, guideName: dto.guideName, vehicleId: dto.vehicleId, pax: dto.pax, status: "SCHEDULED" },
    });
    await this.audit(user, "CREATE", "ZiyarahTrip", created.id, { code });
    this.gateway.broadcast("ziyarah.changed", { id: created.id, code });
    return created;
  }

  async setZiyarahStatus(id: string, status: ZiyarahStatus, user: AuthUser) {
    const z = await this.prisma.ziyarahTrip.findUnique({ where: { id } });
    if (!z) throw new NotFoundException("Ziyarah trip not found");
    const updated = await this.prisma.ziyarahTrip.update({ where: { id }, data: { status } });
    await this.audit(user, "UPDATE", "ZiyarahTrip", id, { code: z.code, to: status });
    this.gateway.broadcast("ziyarah.changed", { id, code: z.code, status });
    return updated;
  }

  // ── Long Stay (T002-07 Host Register) ─────────────────────────────────────────
  /** Architecture flag — Host WhatsApp mandatory when LS host ships (default on). */
  private requireLongStayHostWhatsapp(): boolean {
    const raw = process.env.REQUIRE_LONGSTAY_HOST_WHATSAPP;
    if (raw === undefined || raw === "") return true;
    const v = raw.trim().toLowerCase();
    return !(v === "0" || v === "false" || v === "no");
  }

  private hostComplete(row: {
    hostName?: string | null;
    hostWhatsapp?: string | null;
    hostIqama?: string | null;
  }): boolean {
    if (!(row.hostName ?? "").trim()) return false;
    if (this.requireLongStayHostWhatsapp() && !(row.hostWhatsapp ?? "").trim()) return false;
    return true;
  }

  private assertHostRegister(
    dto: {
      registerHost?: boolean;
      hostName?: string | null;
      hostWhatsapp?: string | null;
    },
    existing?: { hostName?: string | null; hostWhatsapp?: string | null },
  ) {
    if (!dto.registerHost && dto.hostName === undefined && dto.hostWhatsapp === undefined) return;

    const name = (dto.hostName !== undefined ? dto.hostName : existing?.hostName)?.trim() ?? "";
    const wa = (dto.hostWhatsapp !== undefined ? dto.hostWhatsapp : existing?.hostWhatsapp)?.trim() ?? "";

    if (dto.registerHost && !name) {
      throw new BadRequestException("hostName is required to register Long Stay host");
    }
    if (dto.hostName !== undefined && !name) {
      throw new BadRequestException("hostName cannot be empty");
    }
    if (this.requireLongStayHostWhatsapp() && (dto.registerHost || dto.hostWhatsapp !== undefined) && !wa) {
      throw new BadRequestException(
        "hostWhatsapp is required for Long Stay host (REQUIRE_LONGSTAY_HOST_WHATSAPP)",
      );
    }
  }

  /**
   * T002-08 — a Long Stay may not exit the Kingdom before it entered; a broken
   * entry/exit pair silently breaks the day-85 clock, so reject it up front.
   */
  private assertDay85Dates(
    dto: { entryDate?: string | null; exitDate?: string | null },
    existing?: { entryDate?: Date | null; exitDate?: Date | null },
  ) {
    const entry =
      dto.entryDate !== undefined
        ? dto.entryDate
          ? new Date(dto.entryDate)
          : null
        : (existing?.entryDate ?? null);
    const exit =
      dto.exitDate !== undefined
        ? dto.exitDate
          ? new Date(dto.exitDate)
          : null
        : (existing?.exitDate ?? null);

    if (entry && Number.isNaN(entry.getTime())) throw new BadRequestException("entryDate is invalid");
    if (exit && Number.isNaN(exit.getTime())) throw new BadRequestException("exitDate is invalid");
    if (exit && !entry) {
      throw new BadRequestException("exitDate requires entryDate (Day-85 clock starts at Kingdom entry)");
    }
    if (entry && exit && exit.getTime() < entry.getTime()) {
      throw new BadRequestException("exitDate cannot be before entryDate");
    }
  }

  private shapeLongStay(l: {
    id: string;
    code: string;
    hotelName: string;
    city: string;
    nights: number;
    checkIn: Date;
    checkOut: Date;
    pax: number;
    renewal: string;
    status: string;
    hostName: string | null;
    hostIqama: string | null;
    hostWhatsapp: string | null;
    hostRelation: string | null;
    absher: string | null;
    entryDate: Date | null;
    exitDate: Date | null;
    day85NotifiedAt?: Date | null;
    group?: { code: string; visaType?: string | null } | null;
  }) {
    return {
      id: l.id,
      code: l.code,
      group: l.group?.code ?? null,
      groupVisaType: l.group?.visaType ?? null,
      hotel: l.hotelName,
      city: l.city,
      nights: l.nights,
      checkIn: l.checkIn,
      checkOut: l.checkOut,
      pax: l.pax,
      renewal: l.renewal,
      status: l.status,
      hostName: l.hostName,
      hostIqama: l.hostIqama,
      hostWhatsapp: l.hostWhatsapp,
      hostRelation: l.hostRelation,
      absher: l.absher,
      entryDate: l.entryDate,
      exitDate: l.exitDate,
      hostComplete: this.hostComplete(l),
      // T002-08 — derived compliance view; no public mutate API (architecture §7).
      day85: day85View(l),
      sop: {
        requireHostWhatsapp: this.requireLongStayHostWhatsapp(),
        flag: "REQUIRE_LONGSTAY_HOST_WHATSAPP",
      },
    };
  }

  /** Read-side filter for the day-85 board: a stage name, or `red` for DUE+ESCALATED. */
  async longStays(status?: string, day85?: string) {
    const rows = await this.prisma.longStay.findMany({
      where: status ? { status: status as never } : {},
      include: { group: { select: { code: true, visaType: true } } },
      orderBy: { checkIn: "asc" },
    });
    const shaped = rows.map((l) => this.shapeLongStay(l));
    const filter = day85?.trim().toUpperCase();
    if (!filter) return shaped;
    if (filter === "RED") return shaped.filter((l) => l.day85.redCard);
    if (!isDay85Stage(filter)) {
      throw new BadRequestException(`Unknown day85 filter "${day85}" (stage name or "red")`);
    }
    return shaped.filter((l) => l.day85.stage === filter);
  }

  async createLongStay(
    dto: {
      groupId: string;
      hotelName: string;
      city: string;
      nights: number;
      checkIn: string;
      checkOut: string;
      pax: number;
      hostName?: string;
      hostIqama?: string;
      hostWhatsapp?: string;
      hostRelation?: string;
      absher?: string;
      entryDate?: string;
      exitDate?: string;
      registerHost?: boolean;
    },
    user: AuthUser,
  ) {
    if (user.companyId) {
      throw new ForbiddenException("Only Ops / Visa Desk staff may manage Long Stay host register");
    }
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      select: { id: true, tenantId: true, visaType: true, code: true },
    });
    if (!group) throw new NotFoundException("Group not found");

    if (dto.registerHost || dto.hostName || dto.hostWhatsapp) {
      if (group.visaType !== "LONG_STAY") {
        throw new BadRequestException(
          `Host register requires Group.visaType=LONG_STAY (group ${group.code} is ${group.visaType ?? "unset"})`,
        );
      }
      this.assertHostRegister(dto);
    }
    this.assertDay85Dates(dto);

    let code = "";
    for (let i = 0; i < 12; i++) {
      code = `LST-${String(1000 + Math.floor(Math.random() * 9000))}`;
      if (!(await this.prisma.longStay.findUnique({ where: { code } }))) break;
    }
    const created = await this.prisma.longStay.create({
      data: {
        code,
        tenantId: group.tenantId,
        groupId: group.id,
        hotelName: dto.hotelName,
        city: dto.city,
        nights: dto.nights,
        checkIn: new Date(dto.checkIn),
        checkOut: new Date(dto.checkOut),
        pax: dto.pax,
        status: "UPCOMING",
        hostName: dto.hostName?.trim() || null,
        hostIqama: dto.hostIqama?.trim() || null,
        hostWhatsapp: dto.hostWhatsapp?.trim() || null,
        hostRelation: dto.hostRelation?.trim() || null,
        absher: dto.absher?.trim() || null,
        entryDate: dto.entryDate ? new Date(dto.entryDate) : null,
        exitDate: dto.exitDate ? new Date(dto.exitDate) : null,
      },
      include: { group: { select: { code: true, visaType: true } } },
    });
    await this.audit(user, "CREATE", "LongStay", created.id, {
      code,
      hostName: created.hostName,
      hostWhatsapp: created.hostWhatsapp,
      registerHost: dto.registerHost ?? false,
    });
    this.gateway.broadcast("longstay.changed", { id: created.id, code });
    return this.shapeLongStay(created);
  }

  async updateLongStay(
    id: string,
    data: {
      status?: LongStayStatus;
      renewal?: RenewalStatus;
      hostName?: string;
      hostIqama?: string;
      hostWhatsapp?: string;
      hostRelation?: string;
      absher?: string;
      entryDate?: string | null;
      exitDate?: string | null;
      registerHost?: boolean;
    },
    user: AuthUser,
  ) {
    if (user.companyId) {
      throw new ForbiddenException("Only Ops / Visa Desk staff may manage Long Stay host register");
    }
    const l = await this.prisma.longStay.findUnique({
      where: { id },
      include: { group: { select: { code: true, visaType: true } } },
    });
    if (!l) throw new NotFoundException("Long stay not found");

    const hostTouch =
      data.registerHost
      || data.hostName !== undefined
      || data.hostWhatsapp !== undefined
      || data.hostIqama !== undefined
      || data.hostRelation !== undefined
      || data.absher !== undefined
      || data.entryDate !== undefined
      || data.exitDate !== undefined;

    if (hostTouch) {
      if (l.group.visaType !== "LONG_STAY") {
        throw new BadRequestException(
          `Host register requires Group.visaType=LONG_STAY (group ${l.group.code} is ${l.group.visaType ?? "unset"})`,
        );
      }
      this.assertHostRegister(data, l);
    }
    this.assertDay85Dates(data, l);

    const before = day85View(l);
    const updated = await this.prisma.longStay.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.renewal !== undefined ? { renewal: data.renewal } : {}),
        ...(data.hostName !== undefined ? { hostName: data.hostName.trim() || null } : {}),
        ...(data.hostIqama !== undefined ? { hostIqama: data.hostIqama.trim() || null } : {}),
        ...(data.hostWhatsapp !== undefined ? { hostWhatsapp: data.hostWhatsapp.trim() || null } : {}),
        ...(data.hostRelation !== undefined ? { hostRelation: data.hostRelation.trim() || null } : {}),
        ...(data.absher !== undefined ? { absher: data.absher.trim() || null } : {}),
        ...(data.entryDate !== undefined
          ? { entryDate: data.entryDate ? new Date(data.entryDate) : null }
          : {}),
        ...(data.exitDate !== undefined
          ? { exitDate: data.exitDate ? new Date(data.exitDate) : null }
          : {}),
      },
      include: { group: { select: { code: true, visaType: true } } },
    });
    await this.audit(user, "UPDATE", "LongStay", id, {
      code: l.code,
      status: data.status,
      renewal: data.renewal,
      hostName: updated.hostName,
      hostIqama: updated.hostIqama,
      hostWhatsapp: updated.hostWhatsapp,
      hostRelation: updated.hostRelation,
      absher: updated.absher,
      entryDate: updated.entryDate,
      exitDate: updated.exitDate,
      registerHost: data.registerHost ?? false,
      hostComplete: this.hostComplete(updated),
      day85Stage: day85View(updated).stage,
    });

    // T002-08 — resolution is a compliance action: exit stamped, stay completed
    // or renewal approved clears the red card. Recorded separately from the edit.
    const after = day85View(updated);
    if (after.resolved && !before.resolved) {
      await this.day85Audit(
        "UPDATE",
        id,
        {
          code: l.code,
          event: "DAY85_RESOLVED",
          resolvedBy: after.resolvedBy,
          stageBefore: before.stage,
          stageAfter: after.stage,
          dayCount: before.dayCount,
          wasRedCard: before.redCard,
          notifiedAt: updated.day85NotifiedAt,
        },
        user,
      );
    }

    this.gateway.broadcast("longstay.changed", { id, code: l.code });
    return this.shapeLongStay(updated);
  }

  // ── Day-85 compliance sweep (T002-08) ─────────────────────────────────────────
  /**
   * Architecture §11: "Day-85 sweep | Cron (daily 06:00) | Find LS groups/mutamers
   * at day≥85; notify; set red-card flag". Driven by the existing BullMQ
   * Automation worker — this method is the domain half only: it finds the stays
   * that crossed a compliance line, emits one domain event each (the rule engine
   * fans out to Host / Agent / Tuba per §9), stamps `day85NotifiedAt` and audits.
   *
   * Idempotent by design: DUE notifies once (stamp), ESCALATED notifies once
   * (compliance audit trail), and the deterministic NotificationLog code makes a
   * duplicate dispatch a no-op even if the job is replayed.
   */
  async day85Sweep(now: Date = new Date()): Promise<string> {
    const threshold = new Date(now.getTime() - DAY85_DUE * 86_400_000);
    const rows = await this.prisma.longStay.findMany({
      where: {
        entryDate: { not: null, lte: threshold },
        exitDate: null,
        status: { not: "COMPLETED" },
        renewal: { not: "APPROVED" },
      },
      include: {
        group: { select: { id: true, code: true, name: true, visaType: true } },
        tenant: { select: { id: true, name: true } },
      },
    });

    let due = 0;
    let escalated = 0;
    let notified = 0;

    for (const l of rows) {
      const view = day85View(l, now);
      if (!view.redCard) continue; // resolved between query and derivation
      if (view.stage === "DUE") due += 1;
      else escalated += 1;

      if (await this.day85AlreadyNotified(l.id, view.stage, l.day85NotifiedAt)) continue;

      const notifyCode = day85NotifyCode(l.id, view.stage);
      const payload = this.day85EventData(l, view, notifyCode);

      this.events.emit(
        EV.LONGSTAY_DAY85,
        buildEvent(EV.LONGSTAY_DAY85, {
          tenantId: l.tenantId,
          companyId: l.tenantId,
          entityType: "LongStay",
          entityId: l.id,
          // Host is not a login user (§8) — reach them on the registered WhatsApp.
          recipientAddress: l.hostWhatsapp,
          title:
            view.stage === "ESCALATED"
              ? `Long Stay ${l.code}: day ${view.dayCount} — overstay risk`
              : `Long Stay ${l.code}: day ${view.dayCount} — day-85 compliance due`,
          data: payload,
        }),
      );

      if (!l.day85NotifiedAt) {
        await this.prisma.longStay.update({
          where: { id: l.id },
          data: { day85NotifiedAt: now },
        });
      }
      await this.day85Audit("RUN", l.id, {
        code: l.code,
        event: "DAY85_NOTIFIED",
        stage: view.stage,
        dayCount: view.dayCount,
        dueAt: view.dueAt,
        escalateAt: view.escalateAt,
        group: l.group.code,
        hostName: l.hostName,
        hostWhatsapp: l.hostWhatsapp,
        hostComplete: this.hostComplete(l),
        notifyCode,
      });
      this.gateway.broadcast("longstay.changed", { id: l.id, code: l.code, day85: view.stage });
      notified += 1;
    }

    return `day-85 sweep: ${rows.length} tracked, ${due} due, ${escalated} escalated, ${notified} notified`;
  }

  /** DUE dedupes on the stamp; ESCALATED dedupes on its own compliance audit row. */
  private async day85AlreadyNotified(
    longStayId: string,
    stage: Day85Stage,
    notifiedAt: Date | null,
  ): Promise<boolean> {
    if (stage === "DUE") return Boolean(notifiedAt);
    const prior = await this.prisma.auditLog.findFirst({
      where: {
        module: "Day85Compliance",
        entityType: "LongStay",
        entityId: longStayId,
        after: { path: ["stage"], equals: "ESCALATED" },
      },
      select: { id: true },
    });
    return Boolean(prior);
  }

  private day85EventData(
    l: {
      id: string;
      code: string;
      hostName: string | null;
      hostWhatsapp: string | null;
      entryDate: Date | null;
      group: { code: string; name: string | null };
      tenant: { name: string };
    },
    view: Day85View,
    notifyCode: string,
  ): Record<string, unknown> {
    return {
      code: l.code,
      stage: view.stage,
      dayCount: view.dayCount,
      daysToDue: view.daysToDue,
      dueAt: view.dueAt?.toISOString() ?? null,
      escalateAt: view.escalateAt?.toISOString() ?? null,
      entryDate: l.entryDate?.toISOString() ?? null,
      groupCode: l.group.code,
      groupName: l.group.name,
      agent: l.tenant.name,
      hostName: l.hostName,
      hostWhatsapp: l.hostWhatsapp,
      // Consumed by the SEND_NOTIFICATION handler for idempotent NotificationLog codes.
      notifyCode,
    };
  }

  // ── BRN Management ────────────────────────────────────────────────────────────
  async brns(status?: string) {
    const rows = await this.prisma.bRN.findMany({
      where: status ? { status: status as never } : {},
      include: { group: { select: { code: true, tenant: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((b) => ({ id: b.id, code: b.code, group: b.group?.code, agent: b.group?.tenant?.name, service: b.serviceScope, created: b.createdAt, status: b.status, detail: b.detail, priority: b.priority }));
  }

  async createBrn(dto: { groupId: string; serviceScope: string; detail?: string; dateRequired?: string; priority?: string }, user: AuthUser) {
    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId }, select: { id: true, tenantId: true } });
    if (!group) throw new NotFoundException("Group not found");
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    const yr = season?.hijriYear ?? 1446;
    let code = "";
    for (let i = 0; i < 12; i++) { code = `BRN-${yr}-${String(1000 + Math.floor(Math.random() * 9000))}`; if (!(await this.prisma.bRN.findUnique({ where: { code } }))) break; }
    const created = await this.prisma.bRN.create({
      data: {
        code, tenantId: group.tenantId, groupId: group.id, serviceScope: dto.serviceScope, detail: dto.detail,
        dateRequired: dto.dateRequired ? new Date(dto.dateRequired) : null, priority: (dto.priority as never) ?? "NORMAL", status: "OPEN",
      },
    });
    await this.audit(user, "CREATE", "BRN", created.id, { code });
    this.gateway.broadcast("brn.changed", { id: created.id, code });
    return created;
  }

  async setBrnStatus(id: string, status: BrnStatus, user: AuthUser) {
    const b = await this.prisma.bRN.findUnique({ where: { id } });
    if (!b) throw new NotFoundException("BRN not found");
    const updated = await this.prisma.bRN.update({ where: { id }, data: { status } });
    await this.audit(user, "UPDATE", "BRN", id, { code: b.code, to: status });
    this.gateway.broadcast("brn.changed", { id, code: b.code, status });
    return updated;
  }

  /**
   * T002-02/03 — Mutamer Visa Desk worklist (Passenger SoT).
   * Filters by canonical `visaPipelineStatus`. Opening records is not audited.
   */
  async mutamerVisaDesk(query: {
    page?: number;
    pageSize?: number;
    visaState?: string;
    embassy?: string;
    groupId?: string;
    visaType?: string;
    umrahCompanyId?: string;
    /** T002-09 — agent (tenant) scope, so the dashboard reuses these same counts. */
    tenantId?: string;
    priority?: string;
    arrivingWithinDays?: number;
    q?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

    const and: Prisma.PassengerWhereInput[] = [];

    if (query.groupId?.trim()) {
      and.push({ groupId: query.groupId.trim() });
    }

    const groupFilter: Prisma.GroupWhereInput = {};
    if (query.visaType?.trim()) {
      const vt = query.visaType.trim().toUpperCase();
      if (!["UMRAH", "HAJJ", "LONG_STAY"].includes(vt)) {
        throw new BadRequestException("visaType must be UMRAH, HAJJ, or LONG_STAY");
      }
      groupFilter.visaType = vt as never;
    }
    if (query.umrahCompanyId?.trim()) {
      groupFilter.umrahCompanyId = query.umrahCompanyId.trim();
    }
    if (query.tenantId?.trim()) {
      groupFilter.tenantId = query.tenantId.trim();
    }
    if (query.arrivingWithinDays != null && !Number.isNaN(Number(query.arrivingWithinDays))) {
      const days = Math.max(0, Math.min(90, Number(query.arrivingWithinDays)));
      const until = new Date();
      until.setUTCDate(until.getUTCDate() + days);
      until.setUTCHours(23, 59, 59, 999);
      groupFilter.departDate = { lte: until };
    }
    if (Object.keys(groupFilter).length) {
      and.push({ group: groupFilter });
    }

    const embassy = query.embassy?.trim();
    if (embassy) {
      and.push({
        OR: [
          { group: { consulate: { contains: embassy, mode: "insensitive" } } },
          {
            group: {
              visaRequests: { some: { embassy: { contains: embassy, mode: "insensitive" } } },
            },
          },
        ],
      });
    }

    const priority = query.priority?.trim()?.toUpperCase();
    if (priority) {
      if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority)) {
        throw new BadRequestException("priority must be LOW, NORMAL, HIGH, or URGENT");
      }
      and.push({
        group: { visaRequests: { some: { priority: priority as never } } },
      });
    }

    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { passportNo: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { group: { code: { contains: q, mode: "insensitive" } } },
          { group: { name: { contains: q, mode: "insensitive" } } },
          { group: { nusukGroupNumber: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const rawState = query.visaState?.trim()?.toUpperCase();
    if (rawState && rawState !== "ALL") {
      if (!(VISA_PIPELINE_STATES as readonly string[]).includes(rawState)) {
        throw new BadRequestException(
          `visaState must be one of ${VISA_PIPELINE_STATES.join("|")}|ALL`,
        );
      }
      and.push({ visaPipelineStatus: rawState as never });
    }

    const where: Prisma.PassengerWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.passenger.count({ where }),
      this.prisma.passenger.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { code: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          group: {
            select: {
              id: true,
              code: true,
              name: true,
              visaType: true,
              nusukGroupNumber: true,
              consulate: true,
              departDate: true,
              gateVisa: true,
              umrahCompanyId: true,
              umrahCompany: { select: { id: true, code: true, name: true } },
              visaRequests: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  code: true,
                  embassy: true,
                  priority: true,
                  status: true,
                  umrahCompanyId: true,
                },
              },
              // T002-07 Host register + T002-08 Day-85 compliance summary.
              longStays: {
                orderBy: { updatedAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  code: true,
                  hostName: true,
                  hostWhatsapp: true,
                  hostIqama: true,
                  absher: true,
                  entryDate: true,
                  exitDate: true,
                  status: true,
                  renewal: true,
                  day85NotifiedAt: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const requirePassportReturn = (() => {
      const v = (process.env.VISA_REQUIRE_PASSPORT_RETURN ?? "").trim().toLowerCase();
      return v === "1" || v === "true" || v === "yes";
    })();

    const items = rows.map((p) => {
      const vr = p.group.visaRequests[0] ?? null;
      const ls = p.group.longStays[0] ?? null;
      const embassyResolved =
        vr?.embassy?.trim() || p.group.consulate?.trim() || p.embassyRef?.trim() || null;
      const visaState = p.visaPipelineStatus as VisaPipelineState;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        passportNo: p.passportNo,
        biometricStatus: p.biometricStatus,
        visaNumber: p.visaNumber,
        mofaNumber: p.mofaNumber,
        visaStatus: p.visaStatus,
        visaStatusLabel: p.visaStatusLabel,
        visaPipelineStatus: visaState,
        visaState, // alias for T002-02 UI
        visaRejectReason: p.visaRejectReason,
        embassyRef: p.embassyRef,
        embassySubmittedAt: p.embassySubmittedAt,
        passportReturnedAt: p.passportReturnedAt,
        allowedNext: allowedTargets(visaState, { requirePassportReturn }),
        updatedAt: p.updatedAt,
        assignedOfficer: null as string | null,
        dueDate: p.group.departDate,
        embassy: embassyResolved,
        priority: vr?.priority ?? null,
        longStayHost: ls
          ? {
              id: ls.id,
              code: ls.code,
              hostName: ls.hostName,
              hostWhatsapp: ls.hostWhatsapp,
              hostIqama: ls.hostIqama,
              absher: ls.absher,
              entryDate: ls.entryDate,
              exitDate: ls.exitDate,
              hostComplete: this.hostComplete(ls),
              day85: day85View(ls),
            }
          : null,
        visaRequest: vr
          ? { id: vr.id, code: vr.code, status: vr.status }
          : null,
        group: {
          id: p.group.id,
          code: p.group.code,
          name: p.group.name,
          visaType: p.group.visaType,
          nusukGroupNumber: p.group.nusukGroupNumber,
          consulate: p.group.consulate,
          departDate: p.group.departDate,
          gateVisa: p.group.gateVisa,
          umrahCompanyId: p.group.umrahCompanyId,
          umrahCompany: p.group.umrahCompany,
        },
      };
    });

    const facetBase: Prisma.PassengerWhereInput[] = [];
    if (query.groupId?.trim()) facetBase.push({ groupId: query.groupId.trim() });
    if (Object.keys(groupFilter).length) facetBase.push({ group: groupFilter });
    if (embassy) {
      facetBase.push({
        OR: [
          { group: { consulate: { contains: embassy, mode: "insensitive" } } },
          {
            group: {
              visaRequests: { some: { embassy: { contains: embassy, mode: "insensitive" } } },
            },
          },
        ],
      });
    }
    if (priority) {
      facetBase.push({
        group: { visaRequests: { some: { priority: priority as never } } },
      });
    }
    if (q) {
      facetBase.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { passportNo: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { group: { code: { contains: q, mode: "insensitive" } } },
          { group: { name: { contains: q, mode: "insensitive" } } },
          { group: { nusukGroupNumber: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const baseWhere: Prisma.PassengerWhereInput = facetBase.length ? { AND: facetBase } : {};
    const countFor = (state: string) =>
      this.prisma.passenger.count({
        where: { AND: [...facetBase, { visaPipelineStatus: state as never }] },
      });

    const issuedStates = ["ISSUED", "PASSPORT_RETURNED", "COMPLETED"] as const;
    const [
      countNew, countMofa, countEmbassy, countBio, countSubmitted,
      countProcessing, countIssued, countRejected, countPassport, countCompleted, countClosed, countAll,
      issuedTotal, issuedWithMofa,
    ] = await this.prisma.$transaction([
      countFor("NEW"),
      countFor("MOFA"),
      countFor("EMBASSY"),
      countFor("BIOMETRIC"),
      countFor("SUBMITTED"),
      countFor("PROCESSING"),
      countFor("ISSUED"),
      countFor("REJECTED"),
      countFor("PASSPORT_RETURNED"),
      countFor("COMPLETED"),
      countFor("REJECTED_CLOSED"),
      this.prisma.passenger.count({ where: baseWhere }),
      // T002-06 — MOFA number completeness % (filled / issued count). Architecture §12.
      this.prisma.passenger.count({
        where: { AND: [...facetBase, { visaPipelineStatus: { in: [...issuedStates] } }] },
      }),
      this.prisma.passenger.count({
        where: {
          AND: [
            ...facetBase,
            { visaPipelineStatus: { in: [...issuedStates] } },
            { mofaNumber: { not: null } },
            { NOT: { mofaNumber: "" } },
          ],
        },
      }),
    ]);

    const mofaPercent =
      issuedTotal > 0 ? Math.round((issuedWithMofa / issuedTotal) * 1000) / 10 : 0;

    return {
      items,
      total,
      page,
      pageSize,
      sop: {
        requirePassportReturn,
        flag: "VISA_REQUIRE_PASSPORT_RETURN",
      },
      mofaCompleteness: {
        issuedTotal,
        issuedWithMofa,
        percent: mofaPercent,
        note: "MOFA Number completeness (Passenger). Separate from MOFA Processing Bill.",
      },
      counts: {
        ALL: countAll,
        NEW: countNew,
        MOFA: countMofa,
        EMBASSY: countEmbassy,
        BIOMETRIC: countBio,
        SUBMITTED: countSubmitted,
        PROCESSING: countProcessing,
        ISSUED: countIssued,
        REJECTED: countRejected,
        PASSPORT_RETURNED: countPassport,
        COMPLETED: countCompleted,
        REJECTED_CLOSED: countClosed,
      },
    };
  }
}

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
