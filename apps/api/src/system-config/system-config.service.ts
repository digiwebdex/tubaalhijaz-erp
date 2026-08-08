import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, AuditAction, SystemConfig } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { encSecret, decSecret } from "../common/crypto";

export const CONFIG_CATEGORIES = ["General", "Security", "Notification", "Finance", "Workflow", "Integration", "API", "UI"] as const;
export type ConfigCategory = (typeof CONFIG_CATEGORIES)[number];

export interface ConfigInput { key: string; value?: string; category: string; description?: string; encrypted?: boolean; restartRequired?: boolean }

/**
 * Generic System Configuration — ONE table (SystemConfig). Encrypted values are
 * sealed with the shared crypto util and NEVER returned in plaintext by the API.
 * Every mutation is audited; RBAC is enforced at the controller (MANAGE_SYSTEM_SETTINGS).
 */
@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** API-safe view — encrypted entries are masked, plaintext never leaves the server. */
  private mask(c: SystemConfig) {
    return {
      id: c.id, key: c.key, category: c.category, description: c.description,
      encrypted: c.encrypted, restartRequired: c.restartRequired,
      value: c.encrypted ? "••••••••" : c.value,
      updatedAt: c.updatedAt,
    };
  }

  private audit(actor: AuthUser, action: AuditAction, entityId: string, after: unknown, ip?: string) {
    return this.prisma.auditLog.create({
      data: { actorUserId: actor.sub, action, module: "SystemConfig", entityType: "SystemConfig", entityId, after: after as unknown as Prisma.InputJsonValue, ip },
    });
  }

  private async get(id: string) {
    const c = await this.prisma.systemConfig.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Config not found");
    return c;
  }

  async list(search?: string, category?: string) {
    const where: Prisma.SystemConfigWhereInput = {};
    if (category && category !== "all") where.category = category;
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { key: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.systemConfig.findMany({ where, orderBy: [{ category: "asc" }, { key: "asc" }] });
    return rows.map((r) => this.mask(r));
  }

  async create(dto: ConfigInput, actor: AuthUser, ip?: string) {
    if (!CONFIG_CATEGORIES.includes(dto.category as ConfigCategory)) throw new BadRequestException("Invalid category");
    const clash = await this.prisma.systemConfig.findUnique({ where: { key: dto.key } });
    if (clash) throw new ConflictException(`Configuration key "${dto.key}" already exists`);
    const value = dto.encrypted ? encSecret(dto.value ?? "") : (dto.value ?? "");
    const c = await this.prisma.systemConfig.create({
      data: { key: dto.key, value, category: dto.category, description: dto.description ?? null, encrypted: !!dto.encrypted, restartRequired: !!dto.restartRequired },
    });
    await this.audit(actor, "CREATE", c.id, { key: c.key, category: c.category, encrypted: c.encrypted, restartRequired: c.restartRequired }, ip);
    return this.mask(c);
  }

  async update(id: string, dto: Partial<ConfigInput>, actor: AuthUser, ip?: string) {
    const before = await this.get(id);
    const data: Prisma.SystemConfigUpdateInput = {};
    if (dto.category !== undefined) {
      if (!CONFIG_CATEGORIES.includes(dto.category as ConfigCategory)) throw new BadRequestException("Invalid category");
      data.category = dto.category;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.restartRequired !== undefined) data.restartRequired = dto.restartRequired;
    const enc = dto.encrypted !== undefined ? dto.encrypted : before.encrypted;
    if (dto.encrypted !== undefined) data.encrypted = dto.encrypted;
    if (dto.value !== undefined) {
      data.value = enc ? encSecret(dto.value) : dto.value;
    } else if (dto.encrypted !== undefined && dto.encrypted !== before.encrypted) {
      // encryption toggled without a new value — re-seal / unseal the existing value
      const plain = before.encrypted ? decSecret(before.value) : before.value;
      data.value = enc ? encSecret(plain) : plain;
    }
    const c = await this.prisma.systemConfig.update({ where: { id }, data });
    await this.audit(actor, "UPDATE", id, { key: c.key, changed: Object.keys(dto) }, ip);
    return this.mask(c);
  }

  async remove(id: string, actor: AuthUser, ip?: string) {
    const c = await this.get(id);
    await this.prisma.systemConfig.delete({ where: { id } });
    await this.audit(actor, "DELETE", id, { key: c.key }, ip);
    return { ok: true };
  }

  /** Server-side accessor for consumers — decrypts on demand. Not exposed via the API. */
  async resolve(key: string): Promise<string | null> {
    const c = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (!c) return null;
    return c.encrypted ? decSecret(c.value) : c.value;
  }
}
