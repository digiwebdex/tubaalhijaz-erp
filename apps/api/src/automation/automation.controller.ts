import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AutomationService, type RuleInput } from "./automation.service";
import { buildEvent, isEventKey, type EventKey } from "./events";

class RuleDto {
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() nameBn?: string;
  @IsString() @MaxLength(40) category!: string;
  @IsString() @MaxLength(200) trigger!: string;
  @IsOptional() @IsString() eventKey?: string;
  @IsOptional() @IsString() conditionExpr?: string;
  @IsOptional() @IsArray() conditions?: unknown[];
  @IsOptional() @IsArray() actions?: RuleInput["actions"];
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() cronExpr?: string;
}
class UpdateRuleDto extends RuleDto {
  @IsOptional() @IsString() @MaxLength(160) declare name: string;
  @IsOptional() @IsString() @MaxLength(40) declare category: string;
  @IsOptional() @IsString() @MaxLength(200) declare trigger: string;
}
class EnabledDto { @IsBoolean() enabled!: boolean; }
class TestEventDto {
  @IsString() eventKey!: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
  @IsOptional() @IsString() tenantId?: string;
}

@Controller("automation")
@RequirePermissions("CONFIGURE_WORKFLOWS")
export class AutomationController {
  constructor(
    private readonly automation: AutomationService,
    private readonly events: EventEmitter2,
  ) {}

  @Get("overview") overview() { return this.automation.overview(); }
  @Get("catalog") catalog() { return this.automation.overview().then((o) => o.catalog); }

  @Get("rules") list(
    @Query("category") category?: string,
    @Query("enabled") enabled?: string,
    @Query("eventKey") eventKey?: string,
  ) {
    return this.automation.listRules({
      category, eventKey,
      ...(enabled !== undefined && { enabled: enabled === "true" }),
    });
  }
  @Get("rules/:id") get(@Param("id") id: string) { return this.automation.getRule(id); }
  @Post("rules") create(@Body() dto: RuleDto) { return this.automation.createRule(dto); }
  @Patch("rules/:id") update(@Param("id") id: string, @Body() dto: UpdateRuleDto) {
    return this.automation.updateRule(id, dto);
  }
  @Patch("rules/:id/enabled") toggle(@Param("id") id: string, @Body() dto: EnabledDto) {
    return this.automation.setEnabled(id, dto.enabled);
  }
  @Delete("rules/:id") remove(@Param("id") id: string) { return this.automation.deleteRule(id); }

  @Get("runs") runs(@Query("ruleId") ruleId?: string, @Query("limit") limit?: string) {
    return this.automation.recentRuns(limit ? +limit : 50, ruleId);
  }

  /**
   * Fire a domain event by hand — the real path through the engine (dispatcher →
   * rule match → queued jobs). Used by the UI "test rule" button and e2e tests.
   */
  @Post("test") test(@Body() dto: TestEventDto) {
    if (!isEventKey(dto.eventKey)) return { emitted: false, reason: "unknown eventKey" };
    const key = dto.eventKey as EventKey;
    this.events.emit(key, buildEvent(key, { tenantId: dto.tenantId ?? null, data: dto.data ?? {} }));
    return { emitted: true, eventKey: key };
  }
}
