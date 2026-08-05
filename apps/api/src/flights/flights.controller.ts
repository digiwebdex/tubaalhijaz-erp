import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { FlightsService } from "./flights.service";
import type { FlightCreateInput, FlightUpdateInput, AssignInput, TicketInput, TicketUpdateInput } from "./flights.service";

const STATUSES = [
  "SCHEDULED", "DELAYED", "LANDING", "AT_GATE", "IMMIGRATION", "BAGGAGE", "EN_ROUTE",
  "DELIVERED", "STANDBY", "CHECK_IN", "BOARDING", "DEPARTED", "IN_TRANSIT", "ARRIVED", "CANCELLED", "RESCHEDULED",
];

class FlightCreateDto {
  @IsIn(["ARRIVAL", "DEPARTURE"]) direction!: "ARRIVAL" | "DEPARTURE";
  @IsString() @MaxLength(80) airline!: string;
  @IsString() @MaxLength(20) flightNo!: string;
  @IsOptional() @IsString() @MaxLength(40) aircraft?: string;
  @IsString() @MaxLength(8) originAirport!: string;
  @IsString() @MaxLength(8) destAirport!: string;
  @IsISO8601() scheduledAt!: string;
  @IsOptional() @IsISO8601() boardingAt?: string;
  @IsOptional() @IsISO8601() departureAt?: string;
  @IsOptional() @IsISO8601() arrivalAt?: string;
  @IsOptional() @IsString() @MaxLength(12) terminal?: string;
  @IsOptional() @IsString() @MaxLength(12) gate?: string;
  @IsInt() @Min(0) capacity!: number;
  @IsOptional() @IsInt() @Min(0) paxCount?: number;
  @IsString() groupId!: string;
}
class FlightUpdateDto {
  @IsOptional() @IsString() @MaxLength(80) airline?: string;
  @IsOptional() @IsString() @MaxLength(20) flightNo?: string;
  @IsOptional() @IsString() @MaxLength(40) aircraft?: string;
  @IsOptional() @IsString() @MaxLength(8) originAirport?: string;
  @IsOptional() @IsString() @MaxLength(8) destAirport?: string;
  @IsOptional() @IsISO8601() scheduledAt?: string;
  @IsOptional() @IsISO8601() boardingAt?: string;
  @IsOptional() @IsISO8601() departureAt?: string;
  @IsOptional() @IsISO8601() arrivalAt?: string;
  @IsOptional() @IsString() @MaxLength(12) terminal?: string;
  @IsOptional() @IsString() @MaxLength(12) gate?: string;
  @IsOptional() @IsInt() @Min(0) capacity?: number;
}
class AssignDto {
  @IsString() groupId!: string;
  @IsOptional() @IsInt() @Min(0) seatsAllocated?: number;
}
class TicketDto {
  @IsString() groupId!: string;
  @IsOptional() @IsString() passengerId?: string;
  @IsOptional() @IsString() @MaxLength(20) pnr?: string;
  @IsOptional() @IsString() @MaxLength(30) ticketNumber?: string;
  @IsOptional() @IsString() @MaxLength(10) seatNumber?: string;
}
class TicketUpdateDto {
  @IsOptional() @IsString() passengerId?: string;
  @IsOptional() @IsString() @MaxLength(20) pnr?: string;
  @IsOptional() @IsString() @MaxLength(30) ticketNumber?: string;
  @IsOptional() @IsString() @MaxLength(10) seatNumber?: string;
}
class StatusDto {
  @IsIn(STATUSES) status!: string;
}

/**
 * Enterprise Flight Management. Reads are open to any authenticated user
 * (agents = read-only). All writes require MANAGE_OPS (Operations + Super Admin).
 */
@Controller("flights")
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @Get() list(@Query() q: { direction?: string; status?: string; q?: string; groupId?: string }) { return this.flights.list(q); }
  @Get(":id") get(@Param("id") id: string) { return this.flights.get(id); }
  @Get(":id/assignments") listAssignments(@Param("id") id: string) { return this.flights.assignments(id); }

  @Post() @RequirePermissions("MANAGE_OPS")
  create(@Body() dto: FlightCreateDto, @CurrentUser() u: AuthUser) { return this.flights.create(dto as FlightCreateInput, u); }

  @Patch(":id") @RequirePermissions("MANAGE_OPS")
  update(@Param("id") id: string, @Body() dto: FlightUpdateDto, @CurrentUser() u: AuthUser) { return this.flights.update(id, dto as FlightUpdateInput, u); }

  @Delete(":id") @RequirePermissions("MANAGE_OPS")
  remove(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.flights.remove(id, u); }

  @Post(":id/assign") @RequirePermissions("MANAGE_OPS")
  assign(@Param("id") id: string, @Body() dto: AssignDto, @CurrentUser() u: AuthUser) { return this.flights.assign(id, dto as AssignInput, u); }

  @Delete(":id/assign/:groupId") @RequirePermissions("MANAGE_OPS")
  unassign(@Param("id") id: string, @Param("groupId") groupId: string, @CurrentUser() u: AuthUser) { return this.flights.unassign(id, groupId, u); }

  @Post(":id/tickets") @RequirePermissions("MANAGE_OPS")
  addTicket(@Param("id") id: string, @Body() dto: TicketDto, @CurrentUser() u: AuthUser) { return this.flights.addTicket(id, dto as TicketInput, u); }

  @Patch(":id/tickets/:ticketId") @RequirePermissions("MANAGE_OPS")
  updateTicket(@Param("id") id: string, @Param("ticketId") ticketId: string, @Body() dto: TicketUpdateDto, @CurrentUser() u: AuthUser) { return this.flights.updateTicket(id, ticketId, dto as TicketUpdateInput, u); }

  @Patch(":id/status") @RequirePermissions("MANAGE_OPS")
  setStatus(@Param("id") id: string, @Body() dto: StatusDto, @CurrentUser() u: AuthUser) { return this.flights.setStatus(id, dto.status as never, u); }
}
