import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { ImpersonationService } from "./impersonation.service";

class StartDto {
  @IsString() agentUserId!: string;
  @IsString() @MaxLength(500) reason!: string;
}
class PolicyDto {
  @IsOptional() @IsInt() @Min(1) impersonationMaxMinutes?: number;
  @IsOptional() @IsBoolean() forceLogoutOnRoleChange?: boolean;
  @IsOptional() @IsBoolean() forceLogoutOnLock?: boolean;
  @IsOptional() @IsInt() @Min(1) maxSessionMinutes?: number;
}

/** F01 — Administration → Agent Operations (impersonation) + security policy. */
@Controller()
export class ImpersonationController {
  constructor(private readonly svc: ImpersonationService) {}

  @Get("admin/agents") @RequirePermissions("AGENT_IMPERSONATION")
  agents(@Query() q: { q?: string; companyId?: string; status?: string }) { return this.svc.listAgents(q); }

  @Post("admin/impersonation/start") @RequirePermissions("AGENT_IMPERSONATION")
  start(@Body() dto: StartDto, @CurrentUser() u: AuthUser) { return this.svc.start(u, dto); }

  // Called with the impersonation token itself — no extra permission (the agent context lacks AGENT_IMPERSONATION anyway).
  @Post("admin/impersonation/stop") stop(@CurrentUser() u: AuthUser) { return this.svc.stop(u); }
  @Get("admin/impersonation/active") active(@CurrentUser() u: AuthUser) { return this.svc.active(u); }

  @Post("admin/users/:id/force-logout") @RequirePermissions("AGENT_IMPERSONATION")
  forceLogout(@Param("id") id: string) { return this.svc.forceLogout(id); }

  @Get("admin/security-policy") @RequirePermissions("MANAGE_SYSTEM_SETTINGS") getPolicy() { return this.svc.getPolicy(); }
  @Put("admin/security-policy") @RequirePermissions("MANAGE_SYSTEM_SETTINGS") setPolicy(@Body() dto: PolicyDto) { return this.svc.setPolicy(dto); }
}
