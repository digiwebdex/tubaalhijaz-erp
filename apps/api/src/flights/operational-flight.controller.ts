import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";
import { FlightDirection, FlightStatus } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { OperationalFlightService } from "./operational-flight.service";

const DIRECTIONS = ["ARRIVAL", "DEPARTURE"];
const STATUSES = [
  "SCHEDULED", "CHECK_IN", "BOARDING", "DEPARTED", "EN_ROUTE", "LANDING",
  "AT_GATE", "ARRIVED", "DELIVERED", "DELAYED", "RESCHEDULED", "CANCELLED",
];

class CreateOpFlightDto {
  @IsString() flightMasterId!: string;
  @IsISO8601() flightDate!: string;
  @IsIn(DIRECTIONS) direction!: FlightDirection;
  @IsISO8601() scheduledTime!: string;
  @IsOptional() @IsISO8601() estimatedTime?: string;
  @IsOptional() @IsISO8601() actualTime?: string;
  @IsOptional() @IsString() terminalId?: string;
  @IsOptional() @IsString() @MaxLength(10) gate?: string;
  @IsOptional() @IsString() @MaxLength(300) remarks?: string;
  @IsOptional() @IsBoolean() isTestData?: boolean;
}
class UpdateOpFlightDto {
  @IsOptional() @IsString() flightMasterId?: string;
  @IsOptional() @IsISO8601() flightDate?: string;
  @IsOptional() @IsIn(DIRECTIONS) direction?: FlightDirection;
  @IsOptional() @IsISO8601() scheduledTime?: string;
  @IsOptional() @IsISO8601() estimatedTime?: string | null;
  @IsOptional() @IsISO8601() actualTime?: string | null;
  @IsOptional() @IsString() terminalId?: string;
  @IsOptional() @IsString() @MaxLength(10) gate?: string;
  @IsOptional() @IsString() @MaxLength(300) remarks?: string;
}
class StatusDto {
  @IsIn(STATUSES) status!: FlightStatus;
}

/**
 * Operational flights (Phase 10B). Physical flight instances built on the 10A
 * Flight Master. Staff-only via the existing MANAGE_FLIGHTS permission — no new
 * permission, no tenant data (platform-scope schedule).
 */
@Controller("flight-ops")
@RequirePermissions("MANAGE_FLIGHTS")
export class OperationalFlightController {
  constructor(private readonly svc: OperationalFlightService) {}

  @Get() list(@Query() q: { direction?: string; status?: string; date?: string; search?: string; page?: string; pageSize?: string; airlineId?: string; airportId?: string; terminalId?: string }) { return this.svc.list(q); }
  @Get("dashboard") dashboard(@Query("date") date?: string) { return this.svc.dashboard(date); }
  @Get("stats") stats(@Query("direction") direction: FlightDirection, @Query("date") date?: string) { return this.svc.stats(direction ?? "ARRIVAL", date); }
  @Get(":id") get(@Param("id") id: string) { return this.svc.get(id); }
  @Get(":id/timeline") timeline(@Param("id") id: string) { return this.svc.timeline(id); }

  @Post() create(@Body() dto: CreateOpFlightDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.create(dto, u, r.ip); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateOpFlightDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.update(id, dto, u, r.ip); }
  @Patch(":id/status") status(@Param("id") id: string, @Body() dto: StatusDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.changeStatus(id, dto.status, u, r.ip); }
  @Delete(":id") remove(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.remove(id, u, r.ip); }
}
