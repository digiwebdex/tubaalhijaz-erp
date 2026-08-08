import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FlightDirection, FlightStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { EV, buildEvent } from "../automation/events";

/** Terminal states — a flight here cannot transition further (guard). */
const TERMINAL: FlightStatus[] = ["ARRIVED", "DELIVERED", "CANCELLED"];
const MA_STEPS = 7; // Meet & Assist checklist length

export interface FlightCreateInput {
  direction: FlightDirection; airline: string; flightNo: string; aircraft?: string;
  originAirport: string; destAirport: string; scheduledAt: string;
  boardingAt?: string; departureAt?: string; arrivalAt?: string;
  terminal?: string; gate?: string; capacity: number; paxCount?: number; groupId: string;
}
export interface FlightUpdateInput {
  airline?: string; flightNo?: string; aircraft?: string; originAirport?: string; destAirport?: string;
  scheduledAt?: string; boardingAt?: string; departureAt?: string; arrivalAt?: string;
  terminal?: string; gate?: string; capacity?: number;
}
export interface AssignInput { groupId: string; seatsAllocated?: number; }
export interface TicketInput { groupId: string; passengerId?: string; pnr?: string; ticketNumber?: string; seatNumber?: string; }
export interface TicketUpdateInput { passengerId?: string; pnr?: string; ticketNumber?: string; seatNumber?: string; }

/** Enterprise Flight Management — Flight Master, Assignment, Tickets, Operations. */
@Injectable()
export class FlightsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2, private readonly auditSvc: AuditService) {}

  private audit(_user: AuthUser, action: "CREATE" | "UPDATE" | "DELETE", id: string, before: object, after: object) {
    return this.auditSvc.log({ action, module: "Flights", entityType: "FlightInfo", entityId: id, before, after });
  }

  // ── Read ──────────────────────────────────────────────────────────────────
  async list(q: { direction?: string; status?: string; q?: string; groupId?: string }) {
    const where: Prisma.FlightInfoWhereInput = {};
    if (q.direction) where.direction = q.direction as FlightDirection;
    if (q.status) where.status = q.status as FlightStatus;
    if (q.groupId) where.OR = [{ groupId: q.groupId }, { assignments: { some: { groupId: q.groupId } } }];
    if (q.q) {
      const s = q.q;
      where.AND = [{ OR: [
        { flightNo: { contains: s, mode: "insensitive" } },
        { airline: { contains: s, mode: "insensitive" } },
        { code: { contains: s, mode: "insensitive" } },
      ] }];
    }
    // SECURITY (audit HIGH-2): read through the existing tenant-scoped client.
    // Platform staff (companyId null) pass through unchanged; agents are filtered to
    // their own tenantId; suppliers fail CLOSED. No second scoping system introduced.
    return this.prisma.scoped.flightInfo.findMany({
      where, orderBy: { scheduledAt: "asc" },
      include: { _count: { select: { assignments: true, tickets: true } } },
    });
  }

  async get(id: string) {
    // SECURITY (audit HIGH-2): scoped findUnique yields null for a foreign tenant,
    // which the existing NotFoundException below converts to 404 (app convention).
    const f = await this.prisma.scoped.flightInfo.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, code: true, name: true } },
        assignments: { include: { group: { select: { id: true, code: true, name: true, paxCount: true } } } },
        tickets: { include: { passenger: { select: { id: true, name: true, passportNo: true } } } },
        meetAssist: { orderBy: { stepNo: "asc" } },
      },
    });
    if (!f) throw new NotFoundException("Flight not found");
    return f;
  }

  private async genCode(direction: FlightDirection): Promise<string> {
    const prefix = direction === "ARRIVAL" ? "ARR" : "DEP";
    let seq = (await this.prisma.flightInfo.count({ where: { direction } })) + 1;
    let code = `${prefix}-${String(seq).padStart(3, "0")}`;
    while (await this.prisma.flightInfo.findUnique({ where: { code } })) {
      seq++; code = `${prefix}-${String(seq).padStart(3, "0")}`;
    }
    return code;
  }

  // ── Flight Master CRUD ──────────────────────────────────────────────────────
  async create(dto: FlightCreateInput, user: AuthUser) {
    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId }, select: { id: true, tenantId: true } });
    if (!group) throw new BadRequestException("Group not found");
    const code = await this.genCode(dto.direction);
    const capacity = dto.capacity ?? 0;
    const row = await this.prisma.flightInfo.create({
      data: {
        code, tenantId: group.tenantId, groupId: group.id, direction: dto.direction,
        airline: dto.airline, flightNo: dto.flightNo, aircraft: dto.aircraft ?? null,
        originAirport: dto.originAirport, destAirport: dto.destAirport, scheduledAt: new Date(dto.scheduledAt),
        boardingAt: dto.boardingAt ? new Date(dto.boardingAt) : null,
        departureAt: dto.departureAt ? new Date(dto.departureAt) : null,
        arrivalAt: dto.arrivalAt ? new Date(dto.arrivalAt) : null,
        terminal: dto.terminal ?? null, gate: dto.gate ?? null,
        paxCount: dto.paxCount ?? 0, capacity, availableSeats: capacity, status: "SCHEDULED",
      },
    });
    // Primary group is also recorded as an assignment so M:N and the seat ledger stay consistent.
    await this.prisma.flightAssignment.create({
      data: { flightInfoId: row.id, groupId: group.id, seatsAllocated: dto.paxCount ?? 0, createdById: user.sub },
    });
    await this.recomputeSeats(row.id);
    await this.audit(user, "CREATE", row.id, {}, { code, flightNo: dto.flightNo, direction: dto.direction, capacity });
    return this.get(row.id);
  }

  async update(id: string, dto: FlightUpdateInput, user: AuthUser) {
    const before = await this.prisma.flightInfo.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Flight not found");
    const data: Prisma.FlightInfoUpdateInput = {};
    if (dto.airline !== undefined) data.airline = dto.airline;
    if (dto.flightNo !== undefined) data.flightNo = dto.flightNo;
    if (dto.aircraft !== undefined) data.aircraft = dto.aircraft;
    if (dto.originAirport !== undefined) data.originAirport = dto.originAirport;
    if (dto.destAirport !== undefined) data.destAirport = dto.destAirport;
    if (dto.terminal !== undefined) data.terminal = dto.terminal;
    if (dto.gate !== undefined) data.gate = dto.gate;
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.boardingAt !== undefined) data.boardingAt = dto.boardingAt ? new Date(dto.boardingAt) : null;
    if (dto.departureAt !== undefined) data.departureAt = dto.departureAt ? new Date(dto.departureAt) : null;
    if (dto.arrivalAt !== undefined) data.arrivalAt = dto.arrivalAt ? new Date(dto.arrivalAt) : null;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    await this.prisma.flightInfo.update({ where: { id }, data });
    if (dto.capacity !== undefined) await this.recomputeSeats(id);
    await this.audit(user, "UPDATE", id, { flightNo: before.flightNo, capacity: before.capacity }, { ...dto });
    return this.get(id);
  }

  async remove(id: string, user: AuthUser) {
    const f = await this.prisma.flightInfo.findUnique({ where: { id }, include: { _count: { select: { dispatchOrders: true } } } });
    if (!f) throw new NotFoundException("Flight not found");
    if (f._count.dispatchOrders > 0) throw new BadRequestException("Cannot delete: flight has dispatch orders — reassign or cancel them first.");
    // MeetAssist + FlightAssignment cascade; tickets/dispatch FK is optional → set null automatically.
    await this.prisma.flightInfo.delete({ where: { id } });
    await this.audit(user, "DELETE", id, { code: f.code }, {});
    return { ok: true };
  }

  // ── Assignment (Flight ↔ many Groups) + seat ledger ─────────────────────────
  private async currentAllocated(id: string): Promise<number> {
    const agg = await this.prisma.flightAssignment.aggregate({ where: { flightInfoId: id }, _sum: { seatsAllocated: true } });
    return agg._sum.seatsAllocated ?? 0;
  }
  private async recomputeSeats(id: string) {
    const f = await this.prisma.flightInfo.findUnique({ where: { id }, select: { capacity: true } });
    if (!f) return;
    const alloc = await this.currentAllocated(id);
    await this.prisma.flightInfo.update({ where: { id }, data: { availableSeats: Math.max(0, f.capacity - alloc) } });
  }

  async assign(id: string, dto: AssignInput, user: AuthUser) {
    const f = await this.prisma.flightInfo.findUnique({ where: { id } });
    if (!f) throw new NotFoundException("Flight not found");
    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId }, select: { id: true } });
    if (!group) throw new BadRequestException("Group not found");
    const seats = dto.seatsAllocated ?? 0;
    const existing = await this.prisma.flightAssignment.findUnique({ where: { flightInfoId_groupId: { flightInfoId: id, groupId: dto.groupId } } });
    const otherAlloc = (await this.currentAllocated(id)) - (existing?.seatsAllocated ?? 0);
    if (f.capacity > 0 && otherAlloc + seats > f.capacity) {
      throw new BadRequestException(`Insufficient seats: ${Math.max(0, f.capacity - otherAlloc)} available, ${seats} requested`);
    }
    const a = await this.prisma.flightAssignment.upsert({
      where: { flightInfoId_groupId: { flightInfoId: id, groupId: dto.groupId } },
      create: { flightInfoId: id, groupId: dto.groupId, seatsAllocated: seats, createdById: user.sub },
      update: { seatsAllocated: seats },
    });
    await this.recomputeSeats(id);
    await this.audit(user, "UPDATE", id, {}, { assignedGroup: dto.groupId, seats });
    this.events.emit(EV.FLIGHT_ASSIGNED, buildEvent(EV.FLIGHT_ASSIGNED, {
      tenantId: f.tenantId, entityType: "FlightInfo", entityId: id,
      title: `Flight ${f.code} assigned to a group`, data: { flightId: id, code: f.code, groupId: dto.groupId, seats },
    }));
    return a;
  }

  async unassign(id: string, groupId: string, user: AuthUser) {
    const f = await this.prisma.flightInfo.findUnique({ where: { id }, select: { groupId: true } });
    if (!f) throw new NotFoundException("Flight not found");
    if (f.groupId === groupId) throw new BadRequestException("Cannot unassign the flight's primary group; reassign the flight to another primary first.");
    await this.prisma.flightAssignment.deleteMany({ where: { flightInfoId: id, groupId } });
    await this.recomputeSeats(id);
    await this.audit(user, "UPDATE", id, { unassignedGroup: groupId }, {});
    return { ok: true };
  }

  async assignments(id: string) {
    // SECURITY (audit HIGH-2): FlightAssignment is not tenant-scoped itself, so gate on
    // scoped access to the parent flight (throws 404 for a foreign tenant).
    await this.get(id);
    return this.prisma.flightAssignment.findMany({ where: { flightInfoId: id }, include: { group: { select: { id: true, code: true, name: true, paxCount: true } } } });
  }

  // ── Tickets / PNR / Seat mapping ────────────────────────────────────────────
  async addTicket(id: string, dto: TicketInput, user: AuthUser) {
    const f = await this.prisma.flightInfo.findUnique({ where: { id } });
    if (!f) throw new NotFoundException("Flight not found");
    const t = await this.prisma.ticket.create({
      data: { groupId: dto.groupId, flightInfoId: id, passengerId: dto.passengerId ?? null, pnr: dto.pnr ?? null, ticketNumber: dto.ticketNumber ?? null, seatNumber: dto.seatNumber ?? null },
    });
    if (dto.passengerId && dto.seatNumber) {
      await this.prisma.passenger.update({ where: { id: dto.passengerId }, data: { seat: dto.seatNumber } }).catch(() => undefined);
    }
    await this.audit(user, "UPDATE", id, {}, { ticketId: t.id, pnr: dto.pnr, ticketNumber: dto.ticketNumber, seat: dto.seatNumber });
    return t;
  }

  async updateTicket(id: string, ticketId: string, dto: TicketUpdateInput, user: AuthUser) {
    const data: Prisma.TicketUpdateInput = {};
    if (dto.pnr !== undefined) data.pnr = dto.pnr;
    if (dto.ticketNumber !== undefined) data.ticketNumber = dto.ticketNumber;
    if (dto.seatNumber !== undefined) data.seatNumber = dto.seatNumber;
    if (dto.passengerId !== undefined) data.passenger = dto.passengerId ? { connect: { id: dto.passengerId } } : { disconnect: true };
    const t = await this.prisma.ticket.update({ where: { id: ticketId }, data });
    if (dto.passengerId && dto.seatNumber) {
      await this.prisma.passenger.update({ where: { id: dto.passengerId }, data: { seat: dto.seatNumber } }).catch(() => undefined);
    }
    await this.audit(user, "UPDATE", id, {}, { ticketId, ...dto });
    return t;
  }

  // ── Operations: status lifecycle + automation triggers ──────────────────────
  async setStatus(id: string, status: FlightStatus, user: AuthUser) {
    const f = await this.prisma.flightInfo.findUnique({ where: { id }, include: { assignments: { select: { groupId: true } } } });
    if (!f) throw new NotFoundException("Flight not found");
    if (TERMINAL.includes(f.status) && f.status !== status) {
      throw new BadRequestException(`Flight is in a terminal state (${f.status}); cannot change to ${status}.`);
    }
    const updated = await this.prisma.flightInfo.update({ where: { id }, data: { status } });
    await this.audit(user, "UPDATE", id, { status: f.status }, { status });

    // Meet & Assist: provision the greeter checklist for arriving flights (direct automation).
    if (f.direction === "ARRIVAL" && (status === "LANDING" || status === "ARRIVED" || status === "DELIVERED")) {
      const existing = await this.prisma.meetAssistTask.count({ where: { flightInfoId: id } });
      if (existing === 0) {
        await this.prisma.meetAssistTask.createMany({ data: Array.from({ length: MA_STEPS }, (_, i) => ({ flightInfoId: id, stepNo: i + 1, done: false })) });
      }
    }

    const groupIds = Array.from(new Set([f.groupId, ...f.assignments.map((a) => a.groupId)]));
    // Domain event → automation rule engine (Timeline / Notifications / Dispatch / Visa / Hotel / Transport rules subscribe on this key).
    this.events.emit(EV.FLIGHT_STATUS_CHANGED, buildEvent(EV.FLIGHT_STATUS_CHANGED, {
      tenantId: f.tenantId, entityType: "FlightInfo", entityId: id,
      title: `Flight ${f.code} → ${status}`,
      data: { flightId: id, code: f.code, direction: f.direction, from: f.status, to: status, groupIds },
    }));
    return updated;
  }
}
