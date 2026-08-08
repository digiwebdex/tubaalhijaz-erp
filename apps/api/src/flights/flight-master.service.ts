import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Prisma, AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";

export interface AirlineInput { code: string; name: string; icao?: string | null; country: string; active?: boolean }
export interface AirportInput { iata: string; icao?: string | null; name: string; city: string; country: string; timezone: string; active?: boolean }
export interface TerminalInput { airportId: string; name: string; active?: boolean }
export interface FlightMasterInput { flightNumber: string; airlineId: string; originId: string; destinationId: string; defaultTerminalId?: string | null; active?: boolean }

/** Roles that administer flight master data (Super Admin / Operations / Airport Staff). */
const FLIGHT_ROLES = ["SUPER_ADMIN", "OPS_STAFF", "AIRPORT_STAFF"] as const;

/**
 * Flight Master — reference data (Airline / Airport / Terminal / Flight Number)
 * beneath the operational FlightInfo. No scheduling here.
 * Permissions resolve from the DB per-request, so MANAGE_FLIGHTS is bootstrapped
 * idempotently on boot (create-if-missing; never revokes anything).
 */
@Injectable()
export class FlightMasterService implements OnModuleInit {
  private readonly log = new Logger("FlightMaster");
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensurePermissions();
    await this.ensureReferenceData();
  }

  /** Idempotently ensure MANAGE_FLIGHTS exists and is granted to the flight roles. */
  private async ensurePermissions() {
    const perm = await this.prisma.permission.upsert({
      where: { key: "MANAGE_FLIGHTS" },
      create: { key: "MANAGE_FLIGHTS", name: "Manage Flights", nameBn: "ফ্লাইট ব্যবস্থাপনা" },
      update: {},
    });
    const viewDash = await this.prisma.permission.findUnique({ where: { key: "VIEW_DASHBOARD" } });
    for (const key of FLIGHT_ROLES) {
      const role = await this.prisma.role.upsert({
        where: { key },
        create: { key, name: key === "AIRPORT_STAFF" ? "Airport Staff" : key === "OPS_STAFF" ? "Operations Staff" : "Super Admin" },
        update: {},
      });
      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
      // Airport Staff needs a landing page permission to use the console at all.
      if (key === "AIRPORT_STAFF" && viewDash) {
        await this.prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: viewDash.id } },
          create: { roleId: role.id, permissionId: viewDash.id },
          update: {},
        });
      }
    }
  }

  /** Minimal factual reference data (carriers/airports named in the Hajj-Umrah corridor). */
  private async ensureReferenceData() {
    const airlines: AirlineInput[] = [
      { code: "SV", name: "Saudia", icao: "SVA", country: "Saudi Arabia" },
      { code: "BG", name: "Biman Bangladesh Airlines", icao: "BBC", country: "Bangladesh" },
      { code: "EK", name: "Emirates", icao: "UAE", country: "United Arab Emirates" },
    ];
    for (const a of airlines) {
      await this.prisma.airline.upsert({ where: { code: a.code }, create: { ...a, icao: a.icao ?? null }, update: {} });
    }
    const airports: AirportInput[] = [
      { iata: "JED", icao: "OEJN", name: "King Abdulaziz International Airport", city: "Jeddah", country: "Saudi Arabia", timezone: "Asia/Riyadh" },
      { iata: "MED", icao: "OEMA", name: "Prince Mohammad Bin Abdulaziz International Airport", city: "Madinah", country: "Saudi Arabia", timezone: "Asia/Riyadh" },
      { iata: "RUH", icao: "OERK", name: "King Khalid International Airport", city: "Riyadh", country: "Saudi Arabia", timezone: "Asia/Riyadh" },
      { iata: "DAC", icao: "VGHS", name: "Hazrat Shahjalal International Airport", city: "Dhaka", country: "Bangladesh", timezone: "Asia/Dhaka" },
    ];
    for (const p of airports) {
      await this.prisma.airport.upsert({ where: { iata: p.iata }, create: { ...p, icao: p.icao ?? null }, update: {} });
    }
    const jed = await this.prisma.airport.findUnique({ where: { iata: "JED" } });
    if (jed) {
      for (const name of ["Hajj Terminal", "Terminal 1"]) {
        await this.prisma.terminal.upsert({ where: { airportId_name: { airportId: jed.id, name } }, create: { airportId: jed.id, name }, update: {} });
      }
    }
  }

  private audit(actor: AuthUser, action: AuditAction, entityType: string, entityId: string, after: unknown, ip?: string) {
    return this.prisma.auditLog.create({
      data: { actorUserId: actor.sub, action, module: "FlightMaster", entityType, entityId, after: after as unknown as Prisma.InputJsonValue, ip },
    });
  }

  // ── Airlines ───────────────────────────────────────────────────────────────
  listAirlines(search?: string) {
    const where: Prisma.AirlineWhereInput = {};
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [{ code: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { country: { contains: q, mode: "insensitive" } }];
    }
    return this.prisma.airline.findMany({ where, orderBy: { code: "asc" } });
  }
  async createAirline(dto: AirlineInput, actor: AuthUser, ip?: string) {
    const code = dto.code.trim().toUpperCase();
    if (await this.prisma.airline.findUnique({ where: { code } })) throw new ConflictException(`Airline "${code}" already exists`);
    const row = await this.prisma.airline.create({ data: { code, name: dto.name, icao: dto.icao || null, country: dto.country, active: dto.active ?? true } });
    await this.audit(actor, "CREATE", "Airline", row.id, { code: row.code, name: row.name }, ip);
    return row;
  }
  async updateAirline(id: string, dto: Partial<AirlineInput>, actor: AuthUser, ip?: string) {
    if (!(await this.prisma.airline.findUnique({ where: { id } }))) throw new NotFoundException("Airline not found");
    const data: Prisma.AirlineUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.icao !== undefined) data.icao = dto.icao || null;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.active !== undefined) data.active = dto.active;
    const row = await this.prisma.airline.update({ where: { id }, data });
    await this.audit(actor, "UPDATE", "Airline", id, { code: row.code, changed: Object.keys(dto) }, ip);
    return row;
  }
  async removeAirline(id: string, actor: AuthUser, ip?: string) {
    const row = await this.prisma.airline.findUnique({ where: { id }, include: { flightNumbers: true } });
    if (!row) throw new NotFoundException("Airline not found");
    if (row.flightNumbers.length) throw new BadRequestException(`Airline is used by ${row.flightNumbers.length} flight number(s) — deactivate instead`);
    await this.prisma.airline.delete({ where: { id } });
    await this.audit(actor, "DELETE", "Airline", id, { code: row.code }, ip);
    return { ok: true };
  }

  // ── Airports ───────────────────────────────────────────────────────────────
  listAirports(search?: string) {
    const where: Prisma.AirportWhereInput = {};
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [{ iata: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { country: { contains: q, mode: "insensitive" } }];
    }
    return this.prisma.airport.findMany({ where, orderBy: { iata: "asc" }, include: { terminals: { orderBy: { name: "asc" } } } });
  }
  async createAirport(dto: AirportInput, actor: AuthUser, ip?: string) {
    const iata = dto.iata.trim().toUpperCase();
    if (await this.prisma.airport.findUnique({ where: { iata } })) throw new ConflictException(`Airport "${iata}" already exists`);
    const row = await this.prisma.airport.create({ data: { iata, icao: dto.icao ? dto.icao.trim().toUpperCase() : null, name: dto.name, city: dto.city, country: dto.country, timezone: dto.timezone, active: dto.active ?? true } });
    await this.audit(actor, "CREATE", "Airport", row.id, { iata: row.iata, name: row.name }, ip);
    return row;
  }
  async updateAirport(id: string, dto: Partial<AirportInput>, actor: AuthUser, ip?: string) {
    if (!(await this.prisma.airport.findUnique({ where: { id } }))) throw new NotFoundException("Airport not found");
    const data: Prisma.AirportUpdateInput = {};
    if (dto.iata !== undefined) data.iata = dto.iata.trim().toUpperCase();
    if (dto.icao !== undefined) data.icao = dto.icao ? dto.icao.trim().toUpperCase() : null;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.active !== undefined) data.active = dto.active;
    const row = await this.prisma.airport.update({ where: { id }, data });
    await this.audit(actor, "UPDATE", "Airport", id, { iata: row.iata, changed: Object.keys(dto) }, ip);
    return row;
  }
  async removeAirport(id: string, actor: AuthUser, ip?: string) {
    const row = await this.prisma.airport.findUnique({ where: { id }, include: { originFlights: true, destFlights: true } });
    if (!row) throw new NotFoundException("Airport not found");
    const used = row.originFlights.length + row.destFlights.length;
    if (used) throw new BadRequestException(`Airport is used by ${used} flight number(s) — deactivate instead`);
    await this.prisma.airport.delete({ where: { id } });
    await this.audit(actor, "DELETE", "Airport", id, { iata: row.iata }, ip);
    return { ok: true };
  }

  // ── Terminals ──────────────────────────────────────────────────────────────
  listTerminals(airportId?: string, search?: string) {
    const where: Prisma.TerminalWhereInput = {};
    if (airportId && airportId !== "all") where.airportId = airportId;
    if (search?.trim()) where.name = { contains: search.trim(), mode: "insensitive" };
    return this.prisma.terminal.findMany({ where, orderBy: [{ airportId: "asc" }, { name: "asc" }], include: { airport: { select: { iata: true, name: true } } } });
  }
  async createTerminal(dto: TerminalInput, actor: AuthUser, ip?: string) {
    if (!(await this.prisma.airport.findUnique({ where: { id: dto.airportId } }))) throw new BadRequestException("Airport not found");
    const clash = await this.prisma.terminal.findUnique({ where: { airportId_name: { airportId: dto.airportId, name: dto.name } } });
    if (clash) throw new ConflictException("Terminal already exists for this airport");
    const row = await this.prisma.terminal.create({ data: { airportId: dto.airportId, name: dto.name, active: dto.active ?? true } });
    await this.audit(actor, "CREATE", "Terminal", row.id, { name: row.name, airportId: row.airportId }, ip);
    return row;
  }
  async updateTerminal(id: string, dto: Partial<TerminalInput>, actor: AuthUser, ip?: string) {
    if (!(await this.prisma.terminal.findUnique({ where: { id } }))) throw new NotFoundException("Terminal not found");
    const data: Prisma.TerminalUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.airportId !== undefined) data.airport = { connect: { id: dto.airportId } };
    const row = await this.prisma.terminal.update({ where: { id }, data });
    await this.audit(actor, "UPDATE", "Terminal", id, { name: row.name, changed: Object.keys(dto) }, ip);
    return row;
  }
  async removeTerminal(id: string, actor: AuthUser, ip?: string) {
    const row = await this.prisma.terminal.findUnique({ where: { id }, include: { defaultForFlights: true } });
    if (!row) throw new NotFoundException("Terminal not found");
    if (row.defaultForFlights.length) throw new BadRequestException(`Terminal is the default for ${row.defaultForFlights.length} flight number(s) — deactivate instead`);
    await this.prisma.terminal.delete({ where: { id } });
    await this.audit(actor, "DELETE", "Terminal", id, { name: row.name }, ip);
    return { ok: true };
  }

  // ── Flight numbers (master) ────────────────────────────────────────────────
  private readonly fmInclude = {
    airline: { select: { code: true, name: true } },
    origin: { select: { iata: true, city: true } },
    destination: { select: { iata: true, city: true } },
    defaultTerminal: { select: { name: true } },
  };
  listFlightNumbers(search?: string, airlineId?: string) {
    const where: Prisma.FlightMasterWhereInput = {};
    if (airlineId && airlineId !== "all") where.airlineId = airlineId;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { flightNumber: { contains: q, mode: "insensitive" } },
        { airline: { code: { contains: q, mode: "insensitive" } } },
        { origin: { iata: { contains: q, mode: "insensitive" } } },
        { destination: { iata: { contains: q, mode: "insensitive" } } },
      ];
    }
    return this.prisma.flightMaster.findMany({ where, orderBy: { flightNumber: "asc" }, include: this.fmInclude });
  }
  private async assertRefs(dto: Partial<FlightMasterInput>) {
    if (dto.airlineId && !(await this.prisma.airline.findUnique({ where: { id: dto.airlineId } }))) throw new BadRequestException("Airline not found");
    if (dto.originId && !(await this.prisma.airport.findUnique({ where: { id: dto.originId } }))) throw new BadRequestException("Origin airport not found");
    if (dto.destinationId && !(await this.prisma.airport.findUnique({ where: { id: dto.destinationId } }))) throw new BadRequestException("Destination airport not found");
    if (dto.defaultTerminalId && !(await this.prisma.terminal.findUnique({ where: { id: dto.defaultTerminalId } }))) throw new BadRequestException("Default terminal not found");
    if (dto.originId && dto.destinationId && dto.originId === dto.destinationId) throw new BadRequestException("Origin and destination must differ");
  }
  async createFlightNumber(dto: FlightMasterInput, actor: AuthUser, ip?: string) {
    const flightNumber = dto.flightNumber.trim().toUpperCase();
    if (await this.prisma.flightMaster.findUnique({ where: { flightNumber } })) throw new ConflictException(`Flight number "${flightNumber}" already exists`);
    await this.assertRefs(dto);
    const row = await this.prisma.flightMaster.create({
      data: { flightNumber, airlineId: dto.airlineId, originId: dto.originId, destinationId: dto.destinationId, defaultTerminalId: dto.defaultTerminalId || null, active: dto.active ?? true },
      include: this.fmInclude,
    });
    await this.audit(actor, "CREATE", "FlightMaster", row.id, { flightNumber: row.flightNumber }, ip);
    return row;
  }
  async updateFlightNumber(id: string, dto: Partial<FlightMasterInput>, actor: AuthUser, ip?: string) {
    const before = await this.prisma.flightMaster.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Flight number not found");
    await this.assertRefs({ ...dto, originId: dto.originId ?? before.originId, destinationId: dto.destinationId ?? before.destinationId });
    const data: Prisma.FlightMasterUpdateInput = {};
    if (dto.flightNumber !== undefined) data.flightNumber = dto.flightNumber.trim().toUpperCase();
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.airlineId !== undefined) data.airline = { connect: { id: dto.airlineId } };
    if (dto.originId !== undefined) data.origin = { connect: { id: dto.originId } };
    if (dto.destinationId !== undefined) data.destination = { connect: { id: dto.destinationId } };
    if (dto.defaultTerminalId !== undefined) data.defaultTerminal = dto.defaultTerminalId ? { connect: { id: dto.defaultTerminalId } } : { disconnect: true };
    const row = await this.prisma.flightMaster.update({ where: { id }, data, include: this.fmInclude });
    await this.audit(actor, "UPDATE", "FlightMaster", id, { flightNumber: row.flightNumber, changed: Object.keys(dto) }, ip);
    return row;
  }
  async removeFlightNumber(id: string, actor: AuthUser, ip?: string) {
    const row = await this.prisma.flightMaster.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Flight number not found");
    await this.prisma.flightMaster.delete({ where: { id } });
    await this.audit(actor, "DELETE", "FlightMaster", id, { flightNumber: row.flightNumber }, ip);
    return { ok: true };
  }
}
