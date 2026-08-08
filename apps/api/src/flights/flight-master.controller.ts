import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { FlightMasterService } from "./flight-master.service";

class AirlineDto {
  @IsString() @MinLength(2) @MaxLength(3) @Matches(/^[A-Za-z0-9]+$/, { message: "IATA code is 2-3 alphanumerics" }) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(4) icao?: string;
  @IsString() @MaxLength(80) country!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class AirlinePatchDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(3) code?: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(4) icao?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class AirportDto {
  @IsString() @MinLength(3) @MaxLength(3) @Matches(/^[A-Za-z]{3}$/, { message: "IATA is 3 letters" }) iata!: string;
  @IsOptional() @IsString() @MaxLength(4) icao?: string;
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(80) city!: string;
  @IsString() @MaxLength(80) country!: string;
  @IsString() @MaxLength(60) timezone!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class AirportPatchDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(3) iata?: string;
  @IsOptional() @IsString() @MaxLength(4) icao?: string;
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class TerminalDto {
  @IsString() airportId!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class TerminalPatchDto {
  @IsOptional() @IsString() airportId?: string;
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class FlightNumberDto {
  @IsString() @MaxLength(12) flightNumber!: string;
  @IsString() airlineId!: string;
  @IsString() originId!: string;
  @IsString() destinationId!: string;
  @IsOptional() @IsString() defaultTerminalId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class FlightNumberPatchDto {
  @IsOptional() @IsString() @MaxLength(12) flightNumber?: string;
  @IsOptional() @IsString() airlineId?: string;
  @IsOptional() @IsString() originId?: string;
  @IsOptional() @IsString() destinationId?: string;
  @IsOptional() @IsString() defaultTerminalId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/**
 * Flight Master reference data. Staff-gated by MANAGE_FLIGHTS
 * (Super Admin / Operations / Airport Staff) — agents & suppliers have no access.
 */
@Controller("flight-master")
@RequirePermissions("MANAGE_FLIGHTS")
export class FlightMasterController {
  constructor(private readonly svc: FlightMasterService) {}

  // Airlines
  @Get("airlines") listAirlines(@Query("search") search?: string) { return this.svc.listAirlines(search); }
  @Post("airlines") createAirline(@Body() d: AirlineDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.createAirline(d, u, r.ip); }
  @Patch("airlines/:id") updateAirline(@Param("id") id: string, @Body() d: AirlinePatchDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.updateAirline(id, d, u, r.ip); }
  @Delete("airlines/:id") removeAirline(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.removeAirline(id, u, r.ip); }

  // Airports
  @Get("airports") listAirports(@Query("search") search?: string) { return this.svc.listAirports(search); }
  @Post("airports") createAirport(@Body() d: AirportDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.createAirport(d, u, r.ip); }
  @Patch("airports/:id") updateAirport(@Param("id") id: string, @Body() d: AirportPatchDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.updateAirport(id, d, u, r.ip); }
  @Delete("airports/:id") removeAirport(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.removeAirport(id, u, r.ip); }

  // Terminals
  @Get("terminals") listTerminals(@Query("airportId") airportId?: string, @Query("search") search?: string) { return this.svc.listTerminals(airportId, search); }
  @Post("terminals") createTerminal(@Body() d: TerminalDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.createTerminal(d, u, r.ip); }
  @Patch("terminals/:id") updateTerminal(@Param("id") id: string, @Body() d: TerminalPatchDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.updateTerminal(id, d, u, r.ip); }
  @Delete("terminals/:id") removeTerminal(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.removeTerminal(id, u, r.ip); }

  // Flight numbers
  @Get("flight-numbers") listFlightNumbers(@Query("search") search?: string, @Query("airlineId") airlineId?: string) { return this.svc.listFlightNumbers(search, airlineId); }
  @Post("flight-numbers") createFlightNumber(@Body() d: FlightNumberDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.createFlightNumber(d, u, r.ip); }
  @Patch("flight-numbers/:id") updateFlightNumber(@Param("id") id: string, @Body() d: FlightNumberPatchDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.updateFlightNumber(id, d, u, r.ip); }
  @Delete("flight-numbers/:id") removeFlightNumber(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.removeFlightNumber(id, u, r.ip); }
}
