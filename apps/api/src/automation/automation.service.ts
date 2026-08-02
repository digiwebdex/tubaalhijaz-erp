import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RunStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ACTION_TYPES, parseActions, type AutomationAction } from "./actions";
import { ALL_EVENT_KEYS } from "./events";

export interface RuleInput {
  code?: string;
  name: string;
  nameBn?: string;
  category: string;
  trigger: string;
  eventKey?: string | null;
  conditionExpr?: string | null;
  conditions?: unknown;
  actions?: AutomationAction[];
  enabled?: boolean;
  cronExpr?: string | null;
}

@Injectable()
export class AutomationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Rule CRUD ────────────────────────────────────────────────────────────────
  listRules(filter?: { category?: string; enabled?: boolean; eventKey?: string }) {
    return this.prisma.automationRule.findMany({
      where: {
        ...(filter?.category && { category: filter.category }),
        ...(filter?.enabled !== undefined && { enabled: filter.enabled }),
        ...(filter?.eventKey && { eventKey: filter.eventKey }),
      },
      orderBy: { code: "asc" },
      include: { _count: { select: { runLogs: true } } },
    });
  }

  async getRule(id: string) {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id },
      include: { runLogs: { orderBy: { startedAt: "desc" }, take: 20 } },
    });
    if (!rule) throw new NotFoundException("Rule not found");
    return rule;
  }

  async createRule(input: RuleInput) {
    const code = input.code ?? (await this.nextCode());
    return this.prisma.automationRule.create({
      data: {
        code,
        name: input.name,
        nameBn: input.nameBn,
        category: input.category,
        trigger: input.trigger,
        eventKey: input.eventKey ?? null,
        conditionExpr: input.conditionExpr ?? null,
        conditions: (input.conditions ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        actions: (input.actions ?? []) as unknown as Prisma.InputJsonValue,
        enabled: input.enabled ?? true,
        cronExpr: input.cronExpr ?? null,
      },
    });
  }

  async updateRule(id: string, input: Partial<RuleInput>) {
    await this.mustExist(id);
    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.nameBn !== undefined && { nameBn: input.nameBn }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.trigger !== undefined && { trigger: input.trigger }),
        ...(input.eventKey !== undefined && { eventKey: input.eventKey }),
        ...(input.conditionExpr !== undefined && { conditionExpr: input.conditionExpr }),
        ...(input.conditions !== undefined && {
          conditions: (input.conditions ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        }),
        ...(input.actions !== undefined && { actions: input.actions as unknown as Prisma.InputJsonValue }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.cronExpr !== undefined && { cronExpr: input.cronExpr }),
      },
    });
  }

  async setEnabled(id: string, enabled: boolean) {
    await this.mustExist(id);
    return this.prisma.automationRule.update({ where: { id }, data: { enabled } });
  }

  async deleteRule(id: string) {
    await this.mustExist(id);
    await this.prisma.automationRule.delete({ where: { id } });
    return { ok: true };
  }

  // ── Matching (dispatcher) ──────────────────────────────────────────────────
  /** Enabled rules registered for a fired domain event, with typed actions. */
  async rulesForEvent(eventKey: string) {
    const rules = await this.prisma.automationRule.findMany({
      where: { enabled: true, eventKey },
    });
    return rules.map((r) => ({ rule: r, actions: parseActions(r.actions) }));
  }

  // ── Run logs ────────────────────────────────────────────────────────────────
  recentRuns(limit = 50, ruleId?: string) {
    return this.prisma.automationRunLog.findMany({
      where: { ...(ruleId && { ruleId }) },
      orderBy: { startedAt: "desc" },
      take: Math.min(200, limit),
      include: { rule: { select: { code: true, name: true, category: true } } },
    });
  }

  async logRun(entry: {
    ruleId: string;
    eventKey?: string;
    action?: string;
    jobId?: string;
    status: RunStatus;
    durationMs?: number;
    message?: string;
  }) {
    const [log] = await this.prisma.$transaction([
      this.prisma.automationRunLog.create({ data: entry }),
      this.prisma.automationRule.update({ where: { id: entry.ruleId }, data: { lastRunAt: new Date() } }),
    ]);
    return log;
  }

  // ── Meta / dashboard ─────────────────────────────────────────────────────────
  async overview() {
    const [total, enabled, runs24h, failures24h, recent] = await Promise.all([
      this.prisma.automationRule.count(),
      this.prisma.automationRule.count({ where: { enabled: true } }),
      this.prisma.automationRunLog.count({ where: { startedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      this.prisma.automationRunLog.count({
        where: { startedAt: { gte: new Date(Date.now() - 86_400_000) }, status: "ERROR" },
      }),
      this.recentRuns(10),
    ]);
    return {
      rules: { total, enabled, disabled: total - enabled },
      runs24h,
      failures24h,
      catalog: { events: ALL_EVENT_KEYS, actions: ACTION_TYPES },
      recent,
    };
  }

  private async nextCode() {
    const n = await this.prisma.automationRule.count();
    return `AR-${String(n + 1).padStart(2, "0")}`;
  }

  private async mustExist(id: string) {
    const found = await this.prisma.automationRule.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException("Rule not found");
  }
}
