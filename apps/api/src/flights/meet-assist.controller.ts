import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { MeetAssistService, type MaStatus } from "./meet-assist.service";

const STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "EXCEPTION"];

class AssignDto {
  /** null = unassign */
  @ValidateIf((o) => o.assignedToId !== null) @IsString() assignedToId!: string | null;
}
class StatusDto {
  @IsIn(STATUSES) status!: MaStatus;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
class EnsureDto {
  @IsString() flightInfoId!: string;
}

/**
 * Phase 10E — Meet & Assist operational workspace.
 * Reuses the EXISTING MeetAssistTask checklist (no second task model), existing
 * User/Role for staff, existing AuditLog, and the existing MANAGE_FLIGHTS permission.
 */
@Controller("meet-assist")
@RequirePermissions("MANAGE_FLIGHTS")
export class MeetAssistController {
  constructor(private readonly svc: MeetAssistService) {}

  @Get("tasks") list(@Query() q: Record<string, string>) { return this.svc.list(q); }
  @Get("dashboard") dashboard(@Query("date") date?: string) { return this.svc.dashboard(date); }
  @Get("staff") staff() { return this.svc.staff(); }
  @Get("options") options() { return this.svc.options(); }
  @Get("tasks/:id") detail(@Param("id") id: string) { return this.svc.detail(id); }

  @Post("checklist") ensure(@Body() dto: EnsureDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.ensureChecklist(dto.flightInfoId, u, r.ip); }
  @Patch("tasks/:id/assign") assign(@Param("id") id: string, @Body() dto: AssignDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.assign(id, dto.assignedToId, u, r.ip); }
  @Patch("tasks/:id/status") status(@Param("id") id: string, @Body() dto: StatusDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.changeStatus(id, dto.status, dto.note, u, r.ip); }
}
