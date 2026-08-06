import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { auditContext } from "../common/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { ListAuditLogsQueryDto } from "./audit.dto";

export type AuditLogListItem = {
  id: string;
  actorUserId: string | null;
  actorLabel: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: AuditAction;
  module: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: Date;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Shared, context-aware audit write. Actor/actingAs/ip/userAgent/correlation/session
   * come automatically from the request AuditContext — callers pass only the domain fields.
   */
  async log(entry: {
    action: AuditAction | string; module: string; entityType: string; entityId?: string | null;
    before?: object | null; after?: object | null; reason?: string | null; workflowId?: string | null; actorLabel?: string | null;
  }) {
    const ctx = auditContext.getStore();
    await this.prisma.auditLog
      .create({
        data: {
          actorUserId: ctx?.actualUserId ?? null,
          actingAsUserId: ctx?.actingAsUserId ?? null,
          actorLabel: entry.actorLabel ?? ctx?.actorLabel ?? (ctx?.actualUserId ? null : "System"),
          action: entry.action as AuditAction,
          module: entry.module,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          before: (entry.before ?? undefined) as never,
          after: (entry.after ?? undefined) as never,
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
          reason: entry.reason ?? null,
          correlationId: ctx?.correlationId ?? null,
          workflowId: entry.workflowId ?? ctx?.workflowId ?? null,
        },
      })
      .catch(() => undefined);
  }

  async list(query: ListAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const sortDir = query.sort === "createdAt:asc" ? "asc" : "desc";

    const where: Prisma.AuditLogWhereInput = {};

    const from = parseOptionalDate(query.from, "from");
    const to = parseOptionalDate(query.to, "to");
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const actorUserId = query.actorUserId ?? query.user;
    if (actorUserId) where.actorUserId = actorUserId;

    if (query.action) where.action = query.action;

    if (query.module) {
      where.module = { equals: query.module, mode: "insensitive" };
    }

    const entityType = query.entityType ?? query.entity;
    if (entityType) {
      where.entityType = { equals: entityType, mode: "insensitive" };
    }
    if (query.entityId) where.entityId = query.entityId;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { email: true, name: true } },
        },
      }),
    ]);

    const items: AuditLogListItem[] = rows.map((r) => ({
      id: r.id,
      actorUserId: r.actorUserId,
      actorLabel: r.actorLabel,
      actorEmail: r.actor?.email ?? null,
      actorName: r.actor?.name ?? null,
      action: r.action,
      module: r.module,
      entityType: r.entityType,
      entityId: r.entityId,
      ip: r.ip,
      createdAt: r.createdAt,
      before: r.before,
      after: r.after,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      sort: `createdAt:${sortDir}` as const,
    };
  }
}

function parseOptionalDate(raw: string | undefined, field: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid ${field} date`);
  }
  return d;
}
