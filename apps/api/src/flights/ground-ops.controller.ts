import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { DispatchStatus } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { GroundOpsService } from "./ground-ops.service";

const DISPATCH_STATUSES = ["ASSIGNED", "EN_ROUTE", "COMPLETED", "DELAYED", "CANCELLED"];

class CreateDispatchDto {
  @IsString() operationalFlightId!: string;
  @IsString() groupId!: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsString() driverId?: string;
  @IsString() @MaxLength(160) routeFrom!: string;
  @IsString() @MaxLength(160) routeTo!: string;
  @IsOptional() @IsInt() @Min(0) pax?: number;
  @IsISO8601() scheduledAt!: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
class AssignDto {
  /** omit = leave unchanged · null = unassign */
  @IsOptional() vehicleId?: string | null;
  @IsOptional() driverId?: string | null;
}
class StatusDto {
  @IsIn(DISPATCH_STATUSES) status!: DispatchStatus;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/**
 * Phase 10D — Ground Operations / Dispatch, flight-centric.
 * Operates on the EXISTING DispatchOrder table with the EXISTING DispatchStatus enum.
 * Gated by MANAGE_FLIGHTS (no new permission) so Super Admin / Ops / Airport Staff
 * all have access — MANAGE_OPS would exclude Airport Staff.
 */
@Controller("ground-ops")
@RequirePermissions("MANAGE_FLIGHTS")
export class GroundOpsController {
  constructor(private readonly svc: GroundOpsService) {}

  @Get("dispatches") list(@Query() q: Record<string, string>) { return this.svc.list(q); }
  @Get("dashboard") dashboard(@Query("date") date?: string) { return this.svc.dashboard(date); }
  @Get("resources") resources() { return this.svc.resources(); }
  @Get("dispatches/:id/history") history(@Param("id") id: string) { return this.svc.history(id); }

  @Post("dispatches") create(@Body() dto: CreateDispatchDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.create(dto, u, r.ip); }
  @Patch("dispatches/:id/assign") assign(@Param("id") id: string, @Body() dto: AssignDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.assign(id, dto, u, r.ip); }
  @Patch("dispatches/:id/status") status(@Param("id") id: string, @Body() dto: StatusDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.changeStatus(id, dto.status, dto.note, u, r.ip); }
}
