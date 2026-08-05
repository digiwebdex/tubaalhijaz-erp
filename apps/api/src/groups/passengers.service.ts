import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import type { CreatePassengerDto, UpdatePassengerDto } from "./passengers.dto";
import {
  mapVisaStatusEnumToLabel,
  mapVisaStatusLabelToEnum,
} from "./mutamer-excel.contract";
import { buildEvent, EV } from "../automation/events";

/**
 * Passenger (Mutamer / pilgrim manifest) CRUD.
 *
 * Groups shipped without any passenger-write route, so an agent could create a
 * group but never add pilgrims to it — the manifest was read-only forever.
 *
 * Tenancy: every read goes through `prisma.scoped`, so an agent can only reach
 * groups belonging to their own company; the passenger inherits the group's
 * tenantId rather than accepting one from the caller.
 *
 * NOTE on Group.paxCount — deliberately NOT recomputed from the manifest.
 * paxCount is the PLANNED head-count (what dispatch sizes buses and hotel
 * blocks against) and feeds the ops dashboards. A group planned for 47 with 3
 * passports entered so far must still tell dispatch 47, not 3. The actual
 * entered count is exposed separately as `_count.passengers`.
 *
 * T001-04: Mutamer Excel foundation fields + visaStatusLabel ↔ visaStatus mapping.
 */
@Injectable()
export class PassengersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly auditSvc: AuditService,
  ) {}

  /**
   * Defence in depth. `prisma.scoped` is the primary guard, but it is driven by
   * a per-role model map — a model missing from that map silently PASSES
   * THROUGH rather than failing closed, which is exactly how a supplier was
   * able to write into an agent's manifest. So ownership is also asserted here
   * against the caller, independently of the scope map.
   */
  private async getGroupOrThrow(groupId: string, user?: AuthUser) {
    const group = await this.prisma.scoped.group.findUnique({
      where: { id: groupId },
      select: { id: true, tenantId: true, maxCapacity: true, code: true },
    });
    if (!group) throw new NotFoundException("Group not found");
    if (user?.companyId && user.companyId !== group.tenantId) {
      // Don't confirm the group exists to someone who cannot see it.
      throw new NotFoundException("Group not found");
    }
    return group;
  }

  /** PAX-001, PAX-002 … unique within the group (@@unique([groupId, code])). */
  private async nextCodes(groupId: string, count: number) {
    const last = await this.prisma.passenger.findFirst({
      where: { groupId },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const start = last ? Number.parseInt(last.code.replace(/\D/g, ""), 10) || 0 : 0;
    return Array.from({ length: count }, (_, i) => `PAX-${String(start + i + 1).padStart(3, "0")}`);
  }

  private trimOrNull(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const t = value.trim();
    return t.length ? t : null;
  }

  /** Resolve visaStatus + visaStatusLabel for create (label may drive enum). */
  private resolveVisaOnCreate(dto: CreatePassengerDto): {
    visaStatus: "PENDING" | "APPROVED" | "REJECTED";
    visaStatusLabel: string | null;
  } {
    const label = this.trimOrNull(dto.visaStatusLabel) ?? null;
    const fromLabel = mapVisaStatusLabelToEnum(label);
    if (fromLabel) {
      return { visaStatus: fromLabel, visaStatusLabel: label };
    }
    // Legacy create: keep enum default PENDING; leave label null until Excel supplies it.
    return { visaStatus: "PENDING", visaStatusLabel: label };
  }

  private mutamerCreateFields(dto: CreatePassengerDto) {
    const visa = this.resolveVisaOnCreate(dto);
    return {
      age: dto.age ?? null,
      mainEaCode: this.trimOrNull(dto.mainEaCode) ?? null,
      mainEaName: this.trimOrNull(dto.mainEaName) ?? null,
      subEaCode: this.trimOrNull(dto.subEaCode) ?? null,
      subEaName: this.trimOrNull(dto.subEaName) ?? null,
      biometricStatus: this.trimOrNull(dto.biometricStatus) ?? null,
      visaNumber: this.trimOrNull(dto.visaNumber) ?? null,
      mofaNumber: this.trimOrNull(dto.mofaNumber) ?? null,
      mutamerType: this.trimOrNull(dto.mutamerType) ?? null,
      visaStatusLabel: visa.visaStatusLabel,
      visaStatus: visa.visaStatus,
    };
  }

  private toRow(dto: CreatePassengerDto, code: string, groupId: string, tenantId: string) {
    return {
      code,
      groupId,
      tenantId,
      name: dto.name,
      nameBn: dto.nameBn,
      passportNo: dto.passportNo.trim().toUpperCase(),
      passportExpiry: dto.passportExpiry ? new Date(dto.passportExpiry) : null,
      nationality: dto.nationality,
      gender: dto.gender,
      dob: dto.dob ? new Date(dto.dob) : null,
      phone: dto.phone,
      seat: dto.seat,
      ...this.mutamerCreateFields(dto),
    };
  }

  private async audit(
    user: AuthUser | undefined,
    action: "CREATE" | "UPDATE" | "DELETE",
    entityId: string,
    before: object | null,
    after: object,
  ) {
    if (!user?.sub) return;
    await this.auditSvc.log({ action, module: "Passengers", entityType: "Passenger", entityId, before, after });
  }

  async list(groupId: string, user?: AuthUser) {
    await this.getGroupOrThrow(groupId, user);
    return this.prisma.passenger.findMany({ where: { groupId }, orderBy: { code: "asc" } });
  }

  async create(groupId: string, dtos: CreatePassengerDto[], user?: AuthUser) {
    const group = await this.getGroupOrThrow(groupId, user);

    const existing = await this.prisma.passenger.count({ where: { groupId } });
    if (existing + dtos.length > group.maxCapacity) {
      throw new BadRequestException(
        `Group ${group.code} holds ${group.maxCapacity}; it already has ${existing} passenger(s), so ${dtos.length} more would exceed capacity`,
      );
    }

    // Duplicate passports are the classic manifest error — the same pilgrim
    // entered twice, or already travelling with another of this agency's groups.
    const numbers = dtos.map((d) => d.passportNo.trim().toUpperCase());
    const dupInPayload = numbers.filter((n, i) => numbers.indexOf(n) !== i);
    if (dupInPayload.length) {
      throw new BadRequestException(`Duplicate passport number(s) in this batch: ${[...new Set(dupInPayload)].join(", ")}`);
    }
    const clash = await this.prisma.passenger.findFirst({
      where: { tenantId: group.tenantId, passportNo: { in: numbers } },
      select: { passportNo: true, group: { select: { code: true } } },
    });
    if (clash) {
      throw new BadRequestException(
        `Passport ${clash.passportNo} is already registered on group ${clash.group.code}`,
      );
    }

    const codes = await this.nextCodes(groupId, dtos.length);
    const rows = dtos.map((d, i) => this.toRow(d, codes[i], groupId, group.tenantId));

    if (rows.length === 1) {
      const created = await this.prisma.passenger.create({ data: rows[0] });
      await this.audit(user, "CREATE", created.id, null, {
        code: created.code,
        groupId,
        passportNo: created.passportNo,
        name: created.name,
        age: created.age,
        mainEaCode: created.mainEaCode,
        subEaCode: created.subEaCode,
        biometricStatus: created.biometricStatus,
        visaNumber: created.visaNumber,
        mofaNumber: created.mofaNumber,
        mutamerType: created.mutamerType,
        visaStatus: created.visaStatus,
        visaStatusLabel: created.visaStatusLabel,
      });
      return created;
    }

    await this.prisma.passenger.createMany({ data: rows });
    const created = await this.prisma.passenger.findMany({
      where: { groupId, code: { in: codes } },
      orderBy: { code: "asc" },
    });
    // One audit row for the batch (avoid N× audit spam on large Excel commits later).
    await this.audit(user, "CREATE", groupId, null, {
      bulk: true,
      groupId,
      count: created.length,
      codes,
      passports: created.map((p) => p.passportNo),
    });

    // T001-08 — bulk create via passengers API (Mutamer Excel commit uses MutamerImportService).
    this.events.emit(
      EV.IMPORT_COMPLETED,
      buildEvent(EV.IMPORT_COMPLETED, {
        tenantId: group.tenantId,
        companyId: group.tenantId,
        entityType: "Group",
        entityId: groupId,
        recipientUserId: user?.sub ?? null,
        title: `Mutamer bulk create completed for ${group.code}`,
        data: {
          code: group.code,
          count: created.length,
          importedBy: user?.email ?? "unknown",
          fileName: "bulk-api",
        },
      }),
    );

    return created;
  }

  async update(id: string, dto: UpdatePassengerDto, user?: AuthUser) {
    const existing = await this.prisma.scoped.passenger.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Passenger not found");

    if (dto.passportNo) {
      const no = dto.passportNo.trim().toUpperCase();
      const clash = await this.prisma.passenger.findFirst({
        where: { tenantId: existing.tenantId, passportNo: no, id: { not: id } },
        select: { passportNo: true, group: { select: { code: true } } },
      });
      if (clash) {
        throw new BadRequestException(
          `Passport ${clash.passportNo} is already registered on group ${clash.group.code}`,
        );
      }
    }

    const data: Prisma.PassengerUncheckedUpdateInput = {
      name: dto.name,
      nameBn: dto.nameBn,
      passportNo: dto.passportNo ? dto.passportNo.trim().toUpperCase() : undefined,
      passportExpiry: dto.passportExpiry ? new Date(dto.passportExpiry) : undefined,
      nationality: dto.nationality,
      gender: dto.gender,
      dob: dto.dob ? new Date(dto.dob) : undefined,
      phone: dto.phone,
      seat: dto.seat,
      hotelStatus: dto.hotelStatus,
      transportStatus: dto.transportStatus,
      mohStatus: dto.mohStatus,
    };

    if (dto.age !== undefined) data.age = dto.age;
    if (dto.mainEaCode !== undefined) data.mainEaCode = this.trimOrNull(dto.mainEaCode);
    if (dto.mainEaName !== undefined) data.mainEaName = this.trimOrNull(dto.mainEaName);
    if (dto.subEaCode !== undefined) data.subEaCode = this.trimOrNull(dto.subEaCode);
    if (dto.subEaName !== undefined) data.subEaName = this.trimOrNull(dto.subEaName);
    if (dto.biometricStatus !== undefined) data.biometricStatus = this.trimOrNull(dto.biometricStatus);
    if (dto.visaNumber !== undefined) data.visaNumber = this.trimOrNull(dto.visaNumber);
    if (dto.mutamerType !== undefined) data.mutamerType = this.trimOrNull(dto.mutamerType);

    // T002-06 — MOFA Number: staff only (agents must not mutate desk MOFA identity).
    if (dto.mofaNumber !== undefined) {
      if (user?.companyId) {
        throw new ForbiddenException("Only Visa Desk / Ops staff may update MOFA Number");
      }
      const mofa = this.trimOrNull(dto.mofaNumber);
      if (!mofa) {
        throw new BadRequestException("mofaNumber is required when completing MOFA information");
      }
      data.mofaNumber = mofa.toUpperCase();
    }

    // T002-05 — embassy/custody slim fields: staff only (agents must not mutate).
    const embassyPatch =
      dto.embassyRef !== undefined ||
      dto.embassySubmittedAt !== undefined ||
      dto.passportReturnedAt !== undefined;
    if (embassyPatch) {
      if (user?.companyId) {
        throw new ForbiddenException("Only Visa Desk / Ops staff may update embassy/passport custody fields");
      }
      if (dto.embassyRef !== undefined) data.embassyRef = this.trimOrNull(dto.embassyRef);
      if (dto.embassySubmittedAt !== undefined) {
        data.embassySubmittedAt = dto.embassySubmittedAt ? new Date(dto.embassySubmittedAt) : null;
      }
      if (dto.passportReturnedAt !== undefined) {
        data.passportReturnedAt = dto.passportReturnedAt ? new Date(dto.passportReturnedAt) : null;
      }
    }

    // visaStatusLabel ↔ visaStatus: label wins when provided and mappable; else enum wins.
    if (dto.visaStatusLabel !== undefined) {
      const label = this.trimOrNull(dto.visaStatusLabel) ?? null;
      data.visaStatusLabel = label;
      const mapped = mapVisaStatusLabelToEnum(label);
      if (mapped) data.visaStatus = mapped;
      else if (dto.visaStatus) data.visaStatus = dto.visaStatus;
    } else if (dto.visaStatus !== undefined) {
      data.visaStatus = dto.visaStatus;
      data.visaStatusLabel = mapVisaStatusEnumToLabel(dto.visaStatus);
    }

    const updated = await this.prisma.passenger.update({
      where: { id },
      data,
    });

    await this.audit(
      user,
      "UPDATE",
      updated.id,
      {
        passportNo: existing.passportNo,
        age: existing.age,
        mainEaCode: existing.mainEaCode,
        subEaCode: existing.subEaCode,
        biometricStatus: existing.biometricStatus,
        visaNumber: existing.visaNumber,
        mofaNumber: existing.mofaNumber,
        mutamerType: existing.mutamerType,
        visaStatus: existing.visaStatus,
        visaStatusLabel: existing.visaStatusLabel,
        embassyRef: existing.embassyRef,
        embassySubmittedAt: existing.embassySubmittedAt,
        passportReturnedAt: existing.passportReturnedAt,
      },
      {
        passportNo: updated.passportNo,
        age: updated.age,
        mainEaCode: updated.mainEaCode,
        subEaCode: updated.subEaCode,
        biometricStatus: updated.biometricStatus,
        visaNumber: updated.visaNumber,
        mofaNumber: updated.mofaNumber,
        mutamerType: updated.mutamerType,
        visaStatus: updated.visaStatus,
        visaStatusLabel: updated.visaStatusLabel,
        embassyRef: updated.embassyRef,
        embassySubmittedAt: updated.embassySubmittedAt,
        passportReturnedAt: updated.passportReturnedAt,
      },
    );

    return updated;
  }

  async remove(id: string, user?: AuthUser) {
    const existing = await this.prisma.scoped.passenger.findUnique({
      where: { id },
      // `tenantId` MUST be selected: the scoped client post-checks ownership on
      // unique reads by comparing result[scopeField] to the caller's company.
      // Omitting it makes that read `undefined`, so the check fails and every
      // delete 404s — even for the rightful owner.
      select: {
        id: true,
        tenantId: true,
        code: true,
        passportNo: true,
        _count: { select: { tickets: true } },
      },
    });
    if (!existing) throw new NotFoundException("Passenger not found");
    if (existing._count.tickets) {
      throw new BadRequestException("Passenger has issued tickets — cancel those before removing");
    }
    await this.prisma.passenger.delete({ where: { id } });
    await this.audit(user, "DELETE", id, { code: existing.code, passportNo: existing.passportNo }, {
      deleted: true,
    });
    return { deleted: true, id };
  }
}
