import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min,
} from "class-validator";
import {
  BrnStatus, DispatchStatus, FlightStatus, LongStayStatus, RenewalStatus, ZiyarahStatus,
} from "@prisma/client";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { OpsService } from "./ops.service";

const FLIGHT_STATES = ["SCHEDULED", "DELAYED", "LANDING", "AT_GATE", "IMMIGRATION", "BAGGAGE", "EN_ROUTE", "DELIVERED", "STANDBY", "CHECK_IN", "BOARDING", "DEPARTED"];

class FlightStatusDto { @IsIn(FLIGHT_STATES) status!: FlightStatus; }
class CreateDispatchDto {
  @IsString() groupId!: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsString() driverId?: string;
  @IsOptional() @IsString() flightInfoId?: string;
  @IsString() @MaxLength(160) routeFrom!: string;
  @IsString() @MaxLength(160) routeTo!: string;
  @IsInt() @Min(0) pax!: number;
  @IsString() scheduledAt!: string;
}
class DispatchStatusDto {
  @IsIn(["ASSIGNED", "EN_ROUTE", "COMPLETED", "DELAYED", "CANCELLED"]) status!: DispatchStatus;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
class FlagDelayedDto { @IsString() @MaxLength(300) note!: string; }
class MaStepDto { @IsInt() @Min(1) stepNo!: number; @IsBoolean() done!: boolean; }
class CreateZiyarahDto {
  @IsString() groupId!: string;
  @IsString() date!: string;
  @IsString() @MaxLength(300) sites!: string;
  @IsOptional() @IsString() guideName?: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsInt() @Min(0) pax!: number;
}
class ZiyarahStatusDto { @IsIn(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"]) status!: ZiyarahStatus; }
class CreateLongStayDto {
  @IsString() groupId!: string;
  @IsString() @MaxLength(160) hotelName!: string;
  @IsString() @MaxLength(80) city!: string;
  @IsInt() @Min(1) nights!: number;
  @IsString() checkIn!: string;
  @IsString() checkOut!: string;
  @IsInt() @Min(0) pax!: number;
  /** T002-07 — optional host register on create (LONG_STAY groups). */
  @IsOptional() @IsString() @MaxLength(160) hostName?: string;
  @IsOptional() @IsString() @MaxLength(40) hostIqama?: string;
  @IsOptional() @IsString() @MaxLength(30) hostWhatsapp?: string;
  @IsOptional() @IsString() @MaxLength(80) hostRelation?: string;
  @IsOptional() @IsString() @MaxLength(120) absher?: string;
  @IsOptional() @IsString() entryDate?: string;
  @IsOptional() @IsString() exitDate?: string;
  @IsOptional() @IsBoolean() registerHost?: boolean;
}
class UpdateLongStayDto {
  @IsOptional() @IsIn(["UPCOMING", "ACTIVE", "RENEWAL", "COMPLETED"]) status?: LongStayStatus;
  @IsOptional() @IsIn(["NONE", "REQUESTED", "APPROVED"]) renewal?: RenewalStatus;
  /** T002-07 Host register */
  @IsOptional() @IsString() @MaxLength(160) hostName?: string;
  @IsOptional() @IsString() @MaxLength(40) hostIqama?: string;
  @IsOptional() @IsString() @MaxLength(30) hostWhatsapp?: string;
  @IsOptional() @IsString() @MaxLength(80) hostRelation?: string;
  @IsOptional() @IsString() @MaxLength(120) absher?: string;
  @IsOptional() @IsString() entryDate?: string | null;
  @IsOptional() @IsString() exitDate?: string | null;
  /** When true, hostName (+ WhatsApp if flag) required. */
  @IsOptional() @IsBoolean() registerHost?: boolean;
}
class CreateBrnDto {
  @IsString() groupId!: string;
  @IsString() @MaxLength(160) serviceScope!: string;
  @IsOptional() @IsString() @MaxLength(500) detail?: string;
  @IsOptional() @IsString() dateRequired?: string;
  @IsOptional() @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"]) priority?: string;
}
class BrnStatusDto { @IsIn(["OPEN", "PROCESSING", "FULFILLED", "CANCELLED"]) status!: BrnStatus; }

/** T002-02 — Mutamer Visa Desk worklist query (Passenger SoT). */
class MutamerVisaDeskQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  /** T002-03 — filter by canonical VisaPipelineStatus (or ALL). */
  @IsOptional()
  @IsIn([
    "NEW", "MOFA", "EMBASSY", "BIOMETRIC", "SUBMITTED", "PROCESSING",
    "ISSUED", "REJECTED", "PASSPORT_RETURNED", "COMPLETED", "REJECTED_CLOSED", "ALL",
  ])
  visaState?: string;
  @IsOptional() @IsString() @MaxLength(120) embassy?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsIn(["UMRAH", "HAJJ", "LONG_STAY"]) visaType?: string;
  @IsOptional() @IsString() umrahCompanyId?: string;
  /** T002-09 — scope the worklist/counts to one agent tenant. */
  @IsOptional() @IsString() tenantId?: string;
  @IsOptional() @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"]) priority?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(90) arrivingWithinDays?: number;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

/** OpsControl (staff). VIEW_DASHBOARD gates it to internal staff (agents/suppliers lack it). */
@Controller("ops")
@RequirePermissions("VIEW_DASHBOARD")
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get("groups") groups(@Query("status") status?: string) { return this.ops.groupMaster(status); }

  /** T002-02 — Mutamer Visa Desk board (worklist on Passenger). Prefer Ops over /services. */
  @Get("visa/mutamers")
  mutamerVisaDesk(@Query() query: MutamerVisaDeskQueryDto) {
    return this.ops.mutamerVisaDesk(query);
  }

  @Get("arrivals") arrivals(@Query("date") date?: string) { return this.ops.board("ARRIVAL", date); }
  @Get("departures") departures(@Query("date") date?: string) { return this.ops.board("DEPARTURE", date); }

  @RequirePermissions("MANAGE_OPS")
  @Patch("flights/:id/status")
  flightStatus(@Param("id") id: string, @Body() dto: FlightStatusDto, @CurrentUser() u: AuthUser) {
    return this.ops.setFlightStatus(id, dto.status, u);
  }

  @Get("dispatches") dispatches(@Query("status") status?: string) { return this.ops.dispatches(status); }
  @RequirePermissions("MANAGE_OPS")
  @Post("dispatches") createDispatch(@Body() dto: CreateDispatchDto, @CurrentUser() u: AuthUser) { return this.ops.createDispatch(dto, u); }
  @RequirePermissions("MANAGE_OPS")
  @Patch("dispatches/:id/status")
  dispatchStatus(@Param("id") id: string, @Body() dto: DispatchStatusDto, @CurrentUser() u: AuthUser) {
    return this.ops.setDispatchStatus(id, dto.status, dto.note, u);
  }
  @RequirePermissions("MANAGE_OPS")
  @Post("dispatches/:id/flag-delayed")
  flagDelayed(@Param("id") id: string, @Body() dto: FlagDelayedDto, @CurrentUser() u: AuthUser) {
    return this.ops.flagDelayed(id, dto.note, u);
  }

  @Get("meet-assist/:flightInfoId") meetAssist(@Param("flightInfoId") id: string) { return this.ops.meetAssist(id); }
  @RequirePermissions("MANAGE_OPS")
  @Patch("meet-assist/:flightInfoId/step")
  toggleStep(@Param("flightInfoId") id: string, @Body() dto: MaStepDto, @CurrentUser() u: AuthUser) {
    return this.ops.toggleMeetAssist(id, dto.stepNo, dto.done, u);
  }

  @Get("ziyarah") ziyarah(@Query("status") status?: string) { return this.ops.ziyarah(status); }
  @RequirePermissions("MANAGE_OPS")
  @Post("ziyarah") createZiyarah(@Body() dto: CreateZiyarahDto, @CurrentUser() u: AuthUser) { return this.ops.createZiyarah(dto, u); }
  @RequirePermissions("MANAGE_OPS")
  @Patch("ziyarah/:id/status") ziyarahStatus(@Param("id") id: string, @Body() dto: ZiyarahStatusDto, @CurrentUser() u: AuthUser) { return this.ops.setZiyarahStatus(id, dto.status, u); }

  /** `day85` filters the compliance board (stage name or `red`) — read-only (T002-08). */
  @Get("long-stays")
  longStays(@Query("status") status?: string, @Query("day85") day85?: string) {
    return this.ops.longStays(status, day85);
  }
  @RequirePermissions("MANAGE_OPS")
  @Post("long-stays") createLongStay(@Body() dto: CreateLongStayDto, @CurrentUser() u: AuthUser) { return this.ops.createLongStay(dto, u); }
  @RequirePermissions("MANAGE_OPS")
  @Patch("long-stays/:id") updateLongStay(@Param("id") id: string, @Body() dto: UpdateLongStayDto, @CurrentUser() u: AuthUser) { return this.ops.updateLongStay(id, dto, u); }

  @Get("brns") brns(@Query("status") status?: string) { return this.ops.brns(status); }
  @RequirePermissions("MANAGE_OPS")
  @Post("brns") createBrn(@Body() dto: CreateBrnDto, @CurrentUser() u: AuthUser) { return this.ops.createBrn(dto, u); }
  @RequirePermissions("MANAGE_OPS")
  @Patch("brns/:id/status") brnStatus(@Param("id") id: string, @Body() dto: BrnStatusDto, @CurrentUser() u: AuthUser) { return this.ops.setBrnStatus(id, dto.status, u); }
}
