import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Prisma, AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";

export const FLAG_CATEGORIES = ["General", "AI", "Operations", "Finance", "Portal", "Reports", "Experimental", "API"] as const;
export type FlagCategory = (typeof FLAG_CATEGORIES)[number];
export interface FlagInput { key: string; name: string; category: string; description?: string; enabled?: boolean }

const DEFAULT_FLAGS: { key: string; name: string; category: FlagCategory; enabled: boolean; description: string }[] = [
  { key: "AI_ASSISTANT", name: "AI Assistant", category: "AI", enabled: false, description: "In-app AI assistant." },
  { key: "OCR", name: "OCR Processing", category: "AI", enabled: true, description: "Passport / document OCR pipeline." },
  { key: "SUPPLIER_PORTAL", name: "Supplier Portal", category: "Portal", enabled: true, description: "B2B supplier self-service portal." },
  { key: "AGENT_PORTAL", name: "Agent Portal", category: "Portal", enabled: true, description: "B2B agent self-service portal." },
  { key: "REPORTS_V2", name: "Reports V2", category: "Reports", enabled: false, description: "Next-generation reporting dashboards." },
  { key: "ACCOUNTING", name: "Accounting", category: "Finance", enabled: true, description: "Finance & accounting module." },
  { key: "PUBLIC_API", name: "Public API", category: "API", enabled: false, description: "External public API access." },
  { key: "MOBILE_APP", name: "Mobile App", category: "Portal", enabled: false, description: "Mobile application access." },
  { key: "EXPERIMENTAL_FEATURES", name: "Experimental Features", category: "Experimental", enabled: false, description: "Opt-in experimental features." },
];

/** Single Feature Flag service — one table, one config system. Idempotently seeds
 * the default flags on boot (create-if-missing; never overwrites admin toggles). */
@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const d of DEFAULT_FLAGS) {
      await this.prisma.featureFlag.upsert({
        where: { key: d.key },
        create: { key: d.key, name: d.name, category: d.category, description: d.description, enabled: d.enabled },
        update: {}, // create-if-missing only — preserves any admin changes
      });
    }
  }

  private audit(actor: AuthUser, action: AuditAction, entityId: string, after: unknown, ip?: string) {
    return this.prisma.auditLog.create({
      data: { actorUserId: actor.sub, action, module: "FeatureFlags", entityType: "FeatureFlag", entityId, after: after as unknown as Prisma.InputJsonValue, ip },
    });
  }
  private async get(id: string) {
    const f = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!f) throw new NotFoundException("Feature flag not found");
    return f;
  }

  async list(search?: string, category?: string) {
    const where: Prisma.FeatureFlagWhereInput = {};
    if (category && category !== "all") where.category = category;
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { key: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    return this.prisma.featureFlag.findMany({ where, orderBy: [{ category: "asc" }, { key: "asc" }] });
  }

  async create(dto: FlagInput, actor: AuthUser, ip?: string) {
    if (!FLAG_CATEGORIES.includes(dto.category as FlagCategory)) throw new BadRequestException("Invalid category");
    const clash = await this.prisma.featureFlag.findUnique({ where: { key: dto.key } });
    if (clash) throw new ConflictException(`Feature flag "${dto.key}" already exists`);
    const f = await this.prisma.featureFlag.create({ data: { key: dto.key, name: dto.name, category: dto.category, description: dto.description ?? null, enabled: !!dto.enabled } });
    await this.audit(actor, "CREATE", f.id, { key: f.key, category: f.category, enabled: f.enabled }, ip);
    return f;
  }

  async update(id: string, dto: Partial<FlagInput>, actor: AuthUser, ip?: string) {
    await this.get(id);
    const data: Prisma.FeatureFlagUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) {
      if (!FLAG_CATEGORIES.includes(dto.category as FlagCategory)) throw new BadRequestException("Invalid category");
      data.category = dto.category;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    const onlyToggle = dto.enabled !== undefined && Object.keys(dto).length === 1;
    const f = await this.prisma.featureFlag.update({ where: { id }, data });
    await this.audit(actor, onlyToggle ? "TOGGLE" : "UPDATE", id, { key: f.key, changed: Object.keys(dto), enabled: f.enabled }, ip);
    return f;
  }

  async remove(id: string, actor: AuthUser, ip?: string) {
    const f = await this.get(id);
    await this.prisma.featureFlag.delete({ where: { id } });
    await this.audit(actor, "DELETE", id, { key: f.key }, ip);
    return { ok: true };
  }
}
