import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { EV, buildEvent } from "../automation/events";
import {
  WHATSAPP_REQUIRED_VISA_TYPES,
  type CreateGroupDto,
  type UpdateGroupDto,
} from "./groups.dto";

/**
 * Group CRUD. Groups are the root of the operational workflow — dispatch,
 * ziyarah, long-stay, services, vouchers and invoices all hang off a group —
 * so until this existed none of those flows could be exercised at all.
 *
 * Tenancy follows the same model as the read endpoints: `prisma.scoped`
 * filters reads automatically, and on write the tenant is derived from the
 * caller rather than trusted from the body — an agent can only ever create
 * groups for their own company.
 *
 * T001-01: Nusuk Group Number spine, HAJJ visa type, Haji WhatsApp (flagged),
 * consulate / servicesValue / uploadedBy — additive fields; internal `code` unchanged.
 * T001-02: Readiness gates gateVisa / gatePackage / gatePayment / gateBill (default false).
 * T002-01: Optional umrahCompanyId → verified Company with supplierProfile.type=UMRAH_COMPANY.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** When true, HAJJ/UMRAH create/update require a non-empty hajiWhatsapp. Off by default (backward compatible). */
  private requireHajiWhatsapp(): boolean {
    const v = (process.env.REQUIRE_HAJI_WHATSAPP ?? "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  }

  private assertHajiWhatsapp(visaType: string, whatsapp: string | null | undefined) {
    if (!this.requireHajiWhatsapp()) return;
    if (!WHATSAPP_REQUIRED_VISA_TYPES.has(visaType)) return;
    if (!whatsapp?.trim()) {
      throw new BadRequestException(
        "hajiWhatsapp is required for HAJJ and UMRAH groups when REQUIRE_HAJI_WHATSAPP is enabled",
      );
    }
  }

  private normalizeOptionalString(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const t = value.trim();
    return t.length ? t : null;
  }

  /** Resolve which tenant a write belongs to, from the caller — never the body. */
  private async resolveTenantId(user: AuthUser, bodyTenantId?: string) {
    if (user.companyId) {
      // Agent/supplier: always their own company. A body tenantId that
      // disagrees is a privilege-escalation attempt, not a convenience.
      if (bodyTenantId && bodyTenantId !== user.companyId) {
        throw new ForbiddenException("Cannot create a group for another company");
      }
      return user.companyId;
    }
    // Platform staff act on behalf of an agency, so they must name it.
    if (!bodyTenantId) {
      throw new BadRequestException("tenantId is required when creating a group as staff");
    }
    const company = await this.prisma.company.findUnique({ where: { id: bodyTenantId } });
    if (!company) throw new BadRequestException("Unknown tenantId");
    return company.id;
  }

  private async activeSeason() {
    const season =
      (await this.prisma.season.findFirst({ where: { isActive: true } })) ??
      (await this.prisma.season.findFirst({ orderBy: { hijriYear: "desc" } }));
    if (!season) {
      throw new BadRequestException("No season configured — run the production seed first");
    }
    return season;
  }

  /** GRP-<hijriYear>-<4 digits>, retried on the unique constraint. */
  private async uniqueCode(hijriYear: number) {
    for (let i = 0; i < 12; i++) {
      const code = `GRP-${hijriYear}-${Math.floor(1000 + Math.random() * 9000)}`;
      const clash = await this.prisma.group.findUnique({ where: { code } });
      if (!clash) return code;
    }
    throw new BadRequestException("Could not allocate a unique group code");
  }

  private async assertUploadedByUser(userId: string | null | undefined) {
    if (!userId) return;
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!u) throw new BadRequestException("Unknown uploadedByUserId");
  }

  /** T002-01 — Umrah Co must be a verified SUPPLIER with supplierProfile.type=UMRAH_COMPANY. */
  private async assertUmrahCompany(companyId: string | null | undefined) {
    if (!companyId) return;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { supplierProfile: { select: { type: true } } },
    });
    if (!company) throw new BadRequestException("Unknown umrahCompanyId");
    if (company.type !== "SUPPLIER" || company.supplierProfile?.type !== "UMRAH_COMPANY") {
      throw new BadRequestException("umrahCompanyId must reference a UMRAH_COMPANY supplier");
    }
    if (company.verificationStatus !== "VERIFIED") {
      throw new BadRequestException("Umrah Company must be VERIFIED");
    }
  }

  private groupInclude() {
    return {
      tenant: { select: { id: true, code: true, name: true } },
      season: { select: { code: true, hijriYear: true } },
      workflowStage: true,
      uploadedByUser: { select: { id: true, email: true, name: true } },
      umrahCompany: { select: { id: true, code: true, name: true, nameBn: true } },
    } as const;
  }

  private async audit(
    user: AuthUser,
    action: "CREATE" | "UPDATE",
    entityId: string,
    before: object | null,
    after: object,
  ) {
    await this.prisma.auditLog
      .create({
        data: {
          actorUserId: user.sub,
          action,
          module: "Groups",
          entityType: "Group",
          entityId,
          before: before ?? undefined,
          after,
        },
      })
      .catch(() => undefined);
  }

  private isUniqueNusukViolation(e: unknown): boolean {
    return (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      Array.isArray(e.meta?.target) &&
      (e.meta!.target as string[]).includes("nusukGroupNumber")
    );
  }

  private gateSnapshot(g: {
    gateVisa: boolean;
    gatePackage: boolean;
    gatePayment: boolean;
    gateBill: boolean;
  }) {
    return {
      gateVisa: g.gateVisa,
      gatePackage: g.gatePackage,
      gatePayment: g.gatePayment,
      gateBill: g.gateBill,
    };
  }

  private gatesChanged(
    before: { gateVisa: boolean; gatePackage: boolean; gatePayment: boolean; gateBill: boolean },
    after: { gateVisa: boolean; gatePackage: boolean; gatePayment: boolean; gateBill: boolean },
  ) {
    return (
      before.gateVisa !== after.gateVisa ||
      before.gatePackage !== after.gatePackage ||
      before.gatePayment !== after.gatePayment ||
      before.gateBill !== after.gateBill
    );
  }

  private emitGatesChanged(
    group: {
      id: string;
      code: string;
      tenantId: string;
      name: string;
      gateVisa: boolean;
      gatePackage: boolean;
      gatePayment: boolean;
      gateBill: boolean;
    },
    before: ReturnType<GroupsService["gateSnapshot"]>,
    actorEmail: string,
    recipientUserId?: string | null,
  ) {
    this.events.emit(
      EV.GROUP_GATES_CHANGED,
      buildEvent(EV.GROUP_GATES_CHANGED, {
        tenantId: group.tenantId,
        companyId: group.tenantId,
        entityType: "Group",
        entityId: group.id,
        recipientUserId: recipientUserId ?? null,
        title: `Group ${group.code} readiness gates changed`,
        data: {
          code: group.code,
          name: group.name,
          before,
          after: this.gateSnapshot(group),
          changedBy: actorEmail,
        },
      }),
    );
  }

  async create(dto: CreateGroupDto, user: AuthUser) {
    const tenantId = await this.resolveTenantId(user, dto.tenantId);
    const season = await this.activeSeason();
    const code = await this.uniqueCode(season.hijriYear);

    if (dto.departDate && dto.returnDate && dto.returnDate < dto.departDate) {
      throw new BadRequestException("returnDate cannot be before departDate");
    }

    const nusukGroupNumber = this.normalizeOptionalString(dto.nusukGroupNumber) ?? null;
    const hajiWhatsapp = this.normalizeOptionalString(dto.hajiWhatsapp) ?? null;
    const consulate = this.normalizeOptionalString(dto.consulate) ?? null;
    const umrahCompanyId = this.normalizeOptionalString(dto.umrahCompanyId) ?? null;
    const uploadedByLabel = this.normalizeOptionalString(dto.uploadedByLabel) ?? null;
    const uploadedByUserId = dto.uploadedByUserId?.trim() || user.sub;

    this.assertHajiWhatsapp(dto.visaType, hajiWhatsapp);
    await this.assertUploadedByUser(uploadedByUserId);
    await this.assertUmrahCompany(umrahCompanyId);

    let group;
    try {
      group = await this.prisma.group.create({
        data: {
          code,
          tenantId,
          seasonId: season.id,
          name: dto.name,
          nameBn: dto.nameBn,
          destination: dto.destination,
          visaType: dto.visaType,
          packageType: dto.packageType ?? "STANDARD",
          maxCapacity: dto.maxCapacity ?? 40,
          paxCount: dto.paxCount ?? 0,
          departDate: dto.departDate ? new Date(dto.departDate) : null,
          returnDate: dto.returnDate ? new Date(dto.returnDate) : null,
          notes: dto.notes,
          nusukGroupNumber,
          hajiWhatsapp,
          consulate,
          umrahCompanyId,
          servicesValue: dto.servicesValue != null ? new Prisma.Decimal(dto.servicesValue) : null,
          uploadedByUserId,
          uploadedByLabel,
          gateVisa: dto.gateVisa ?? false,
          gatePackage: dto.gatePackage ?? false,
          gatePayment: dto.gatePayment ?? false,
          gateBill: dto.gateBill ?? false,
          currentStage: 1,
        },
        include: this.groupInclude(),
      });
    } catch (e) {
      if (this.isUniqueNusukViolation(e)) {
        throw new ConflictException(`Nusuk group number already exists: ${nusukGroupNumber}`);
      }
      throw e;
    }

    await this.audit(user, "CREATE", group.id, null, {
      code: group.code,
      nusukGroupNumber: group.nusukGroupNumber,
      visaType: group.visaType,
      hajiWhatsapp: group.hajiWhatsapp,
      consulate: group.consulate,
      umrahCompanyId: group.umrahCompanyId,
      servicesValue: group.servicesValue != null ? Number(group.servicesValue) : null,
      uploadedByUserId: group.uploadedByUserId,
      uploadedByLabel: group.uploadedByLabel,
      ...this.gateSnapshot(group),
      packageType: group.packageType,
      tenantId,
      createdBy: user.email,
    });

    // Drives the automation engine (R-rules keyed on group.created).
    this.events.emit(
      EV.GROUP_CREATED,
      buildEvent(EV.GROUP_CREATED, {
        tenantId,
        companyId: tenantId,
        entityType: "Group",
        entityId: group.id,
        recipientUserId: uploadedByUserId,
        title: `Group ${group.code} created`,
        data: {
          code: group.code,
          nusukGroupNumber: group.nusukGroupNumber,
          name: group.name,
          destination: group.destination,
          visaType: group.visaType,
          paxCount: group.paxCount,
          createdBy: user.email,
        },
      }),
    );

    return group;
  }

  async update(id: string, dto: UpdateGroupDto, user: AuthUser) {
    // scoped client: an agent updating someone else's group simply cannot see it
    const existing = await this.prisma.scoped.group.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Group not found");

    const departDate = dto.departDate ? new Date(dto.departDate) : existing.departDate;
    const returnDate = dto.returnDate ? new Date(dto.returnDate) : existing.returnDate;
    if (departDate && returnDate && returnDate < departDate) {
      throw new BadRequestException("returnDate cannot be before departDate");
    }
    if (dto.paxCount != null && dto.paxCount > (dto.maxCapacity ?? existing.maxCapacity)) {
      throw new BadRequestException("paxCount cannot exceed maxCapacity");
    }

    const visaType = dto.visaType ?? existing.visaType;
    const nextWhatsapp =
      dto.hajiWhatsapp !== undefined
        ? this.normalizeOptionalString(dto.hajiWhatsapp) ?? null
        : existing.hajiWhatsapp;
    this.assertHajiWhatsapp(visaType, nextWhatsapp);

    if (dto.uploadedByUserId !== undefined && dto.uploadedByUserId !== null) {
      await this.assertUploadedByUser(dto.uploadedByUserId.trim());
    }

    // Unchecked input keeps scalar FKs (currentStage, uploadedByUserId) like the pre-T001 update path.
    const data: Prisma.GroupUncheckedUpdateInput = {
      name: dto.name,
      nameBn: dto.nameBn,
      destination: dto.destination,
      visaType: dto.visaType,
      packageType: dto.packageType,
      maxCapacity: dto.maxCapacity,
      paxCount: dto.paxCount,
      departDate: dto.departDate ? new Date(dto.departDate) : undefined,
      returnDate: dto.returnDate ? new Date(dto.returnDate) : undefined,
      notes: dto.notes,
      status: dto.status,
      opsStatus: dto.opsStatus,
      currentStage: dto.currentStage,
      stageNote: dto.stageNote,
    };

    if (dto.nusukGroupNumber !== undefined) {
      data.nusukGroupNumber = this.normalizeOptionalString(dto.nusukGroupNumber) ?? null;
    }
    if (dto.hajiWhatsapp !== undefined) {
      data.hajiWhatsapp = this.normalizeOptionalString(dto.hajiWhatsapp) ?? null;
    }
    if (dto.consulate !== undefined) {
      data.consulate = this.normalizeOptionalString(dto.consulate) ?? null;
    }
    if (dto.umrahCompanyId !== undefined) {
      const nextUmrah =
        dto.umrahCompanyId === null
          ? null
          : this.normalizeOptionalString(dto.umrahCompanyId) ?? null;
      await this.assertUmrahCompany(nextUmrah);
      data.umrahCompanyId = nextUmrah;
    }
    if (dto.servicesValue !== undefined) {
      data.servicesValue =
        dto.servicesValue === null ? null : new Prisma.Decimal(dto.servicesValue);
    }
    if (dto.uploadedByUserId !== undefined) {
      data.uploadedByUserId =
        dto.uploadedByUserId === null ? null : dto.uploadedByUserId.trim();
    }
    if (dto.uploadedByLabel !== undefined) {
      data.uploadedByLabel = this.normalizeOptionalString(dto.uploadedByLabel) ?? null;
    }
    if (dto.gateVisa !== undefined) data.gateVisa = dto.gateVisa;
    if (dto.gatePackage !== undefined) data.gatePackage = dto.gatePackage;
    if (dto.gatePayment !== undefined) data.gatePayment = dto.gatePayment;
    if (dto.gateBill !== undefined) data.gateBill = dto.gateBill;

    let group;
    try {
      group = await this.prisma.group.update({
        where: { id },
        data,
        include: this.groupInclude(),
      });
    } catch (e) {
      if (this.isUniqueNusukViolation(e)) {
        throw new ConflictException(
          `Nusuk group number already exists: ${String(data.nusukGroupNumber ?? "")}`,
        );
      }
      throw e;
    }

    const beforeGates = this.gateSnapshot(existing);
    const afterGates = this.gateSnapshot(group);

    await this.audit(
      user,
      "UPDATE",
      group.id,
      {
        nusukGroupNumber: existing.nusukGroupNumber,
        visaType: existing.visaType,
        hajiWhatsapp: existing.hajiWhatsapp,
        consulate: existing.consulate,
        umrahCompanyId: existing.umrahCompanyId,
        servicesValue: existing.servicesValue != null ? Number(existing.servicesValue) : null,
        uploadedByUserId: existing.uploadedByUserId,
        uploadedByLabel: existing.uploadedByLabel,
        packageType: existing.packageType,
        status: existing.status,
        ...beforeGates,
      },
      {
        nusukGroupNumber: group.nusukGroupNumber,
        visaType: group.visaType,
        hajiWhatsapp: group.hajiWhatsapp,
        consulate: group.consulate,
        umrahCompanyId: group.umrahCompanyId,
        servicesValue: group.servicesValue != null ? Number(group.servicesValue) : null,
        uploadedByUserId: group.uploadedByUserId,
        uploadedByLabel: group.uploadedByLabel,
        packageType: group.packageType,
        status: group.status,
        ...afterGates,
      },
    );

    if (this.gatesChanged(beforeGates, afterGates)) {
      this.emitGatesChanged(
        group,
        beforeGates,
        user.email,
        group.uploadedByUserId ?? user.sub,
      );
    }

    if (dto.status === "COMPLETED" && existing.status !== "COMPLETED") {
      this.events.emit(
        EV.GROUP_COMPLETED,
        buildEvent(EV.GROUP_COMPLETED, {
          tenantId: group.tenantId,
          companyId: group.tenantId,
          entityType: "Group",
          entityId: group.id,
          title: `Group ${group.code} completed`,
          data: { code: group.code, name: group.name },
        }),
      );
    }

    return group;
  }

  async remove(id: string) {
    const existing = await this.prisma.scoped.group.findUnique({
      where: { id },
      include: { _count: { select: { passengers: true, invoices: true, dispatchOrders: true } } },
    });
    if (!existing) throw new NotFoundException("Group not found");
    // Refuse to orphan operational records; cancelling is the intended path.
    const c = existing._count;
    if (c.passengers || c.invoices || c.dispatchOrders) {
      throw new BadRequestException(
        "Group has passengers, invoices or dispatch orders — set status CANCELLED instead of deleting",
      );
    }
    await this.prisma.group.delete({ where: { id } });
    return { deleted: true, id };
  }
}
