import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { SeasonsService } from "./seasons.service";

class CreateSeasonDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) nameBn?: string;
  @IsInt() @Min(1300) @Max(1600) hijriYear!: number;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
}
class UpdateSeasonDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) nameBn?: string;
  @IsOptional() @IsInt() @Min(1300) @Max(1600) hijriYear?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

/** Season Management API — staff-gated; reuses the Season model. No hard delete (archive only). */
@Controller("seasons")
@RequirePermissions("MANAGE_SYSTEM_SETTINGS")
export class SeasonsController {
  constructor(private readonly svc: SeasonsService) {}

  @Get() list() { return this.svc.list(); }
  @Post() create(@Body() dto: CreateSeasonDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.create(dto, u, r.ip); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateSeasonDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.update(id, dto, u, r.ip); }
  @Post(":id/activate") activate(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.activate(id, u, r.ip); }
  @Post(":id/archive") archive(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.archive(id, u, r.ip); }
  @Post(":id/default") setDefault(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.setDefault(id, u, r.ip); }
}
