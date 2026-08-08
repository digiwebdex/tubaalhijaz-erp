import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";

export interface SeasonInput { name: string; nameBn?: string; hijriYear: number; startDate: string; endDate: string }

/**
 * Season Management (Settings → Season). Reuses the existing Season model.
 * Rules: single default season, no overlapping ACTIVE seasons, archive (soft)
 * instead of delete, every mutation audited. `isActive` remains the flag the
 * rest of the app reads for "the current season" — Activate keeps it in sync.
 */
@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.season.findMany({ orderBy: [{ isDefault: "desc" }, { hijriYear: "desc" }, { startDate: "desc" }] });
  }

  private async get(id: string) {
    const s = await this.prisma.season.findUnique({ where: { id } });
    if (!s) throw new NotFoundException("Season not found");
    return s;
  }

  private audit(actor: AuthUser, action: AuditAction, entityId: string, after: unknown, ip?: string) {
    return this.prisma.auditLog.create({
      data: { actorUserId: actor.sub, action, module: "Seasons", entityType: "Season", entityId, after: after as unknown as Prisma.InputJsonValue, ip },
    });
  }

  /** Overlap iff start <= otherEnd AND end >= otherStart; only ACTIVE seasons block. */
  private async assertNoOverlap(excludeId: string | null, start: Date, end: Date) {
    if (start > end) throw new BadRequestException("Start date must be on or before end date");
    const clash = await this.prisma.season.findFirst({
      where: { status: "ACTIVE", ...(excludeId ? { id: { not: excludeId } } : {}), startDate: { lte: end }, endDate: { gte: start } },
    });
    if (clash) throw new BadRequestException(`Overlaps active season ${clash.code} (${clash.name})`);
  }

  private async genCode(hijriYear: number) {
    let code = `UMR-${hijriYear}`, n = 1;
    while (await this.prisma.season.findUnique({ where: { code } })) { n++; code = `UMR-${hijriYear}-${n}`; }
    return code;
  }

  async create(dto: SeasonInput, actor: AuthUser, ip?: string) {
    const start = new Date(dto.startDate), end = new Date(dto.endDate);
    if (start > end) throw new BadRequestException("Start date must be on or before end date");
    const code = await this.genCode(dto.hijriYear);
    const s = await this.prisma.season.create({
      data: { code, name: dto.name, nameBn: dto.nameBn ?? null, hijriYear: dto.hijriYear, startDate: start, endDate: end, status: "DRAFT", isActive: false, isDefault: false },
    });
    await this.audit(actor, "CREATE", s.id, { code, name: s.name, hijriYear: s.hijriYear }, ip);
    return s;
  }

  async update(id: string, dto: Partial<SeasonInput>, actor: AuthUser, ip?: string) {
    const before = await this.get(id);
    if (before.status === "ARCHIVED") throw new BadRequestException("Cannot edit an archived season");
    const data: Prisma.SeasonUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.nameBn !== undefined) data.nameBn = dto.nameBn;
    if (dto.hijriYear !== undefined) data.hijriYear = dto.hijriYear;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (before.status === "ACTIVE") {
      const ns = (data.startDate as Date | undefined) ?? before.startDate;
      const ne = (data.endDate as Date | undefined) ?? before.endDate;
      await this.assertNoOverlap(id, ns, ne);
    }
    const s = await this.prisma.season.update({ where: { id }, data });
    await this.audit(actor, "UPDATE", id, dto, ip);
    return s;
  }

  async activate(id: string, actor: AuthUser, ip?: string) {
    const s = await this.get(id);
    if (s.status === "ARCHIVED") throw new BadRequestException("Cannot activate an archived season");
    await this.assertNoOverlap(id, s.startDate, s.endDate);
    const u = await this.prisma.season.update({ where: { id }, data: { status: "ACTIVE", isActive: true } });
    await this.audit(actor, "UPDATE", id, { action: "activate", status: "ACTIVE" }, ip);
    return u;
  }

  async archive(id: string, actor: AuthUser, ip?: string) {
    await this.get(id);
    const u = await this.prisma.season.update({ where: { id }, data: { status: "ARCHIVED", isActive: false } });
    await this.audit(actor, "UPDATE", id, { action: "archive", status: "ARCHIVED" }, ip);
    return u;
  }

  async setDefault(id: string, actor: AuthUser, ip?: string) {
    const s = await this.get(id);
    if (s.status === "ARCHIVED") throw new BadRequestException("Cannot set an archived season as default");
    await this.prisma.$transaction([
      this.prisma.season.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } }),
      this.prisma.season.update({ where: { id }, data: { isDefault: true } }),
    ]);
    await this.audit(actor, "UPDATE", id, { action: "set-default", isDefault: true }, ip);
    return this.get(id);
  }
}
