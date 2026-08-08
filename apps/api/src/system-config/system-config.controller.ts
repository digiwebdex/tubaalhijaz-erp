import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { SystemConfigService, CONFIG_CATEGORIES } from "./system-config.service";

class CreateConfigDto {
  @IsString() @MaxLength(120) @Matches(/^[A-Za-z0-9_.:-]+$/, { message: "key may contain letters, digits, . _ : -" }) key!: string;
  @IsOptional() @IsString() @MaxLength(5000) value?: string;
  @IsIn(CONFIG_CATEGORIES as unknown as string[]) category!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() encrypted?: boolean;
  @IsOptional() @IsBoolean() restartRequired?: boolean;
}
class UpdateConfigDto {
  @IsOptional() @IsString() @MaxLength(5000) value?: string;
  @IsOptional() @IsIn(CONFIG_CATEGORIES as unknown as string[]) category?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() encrypted?: boolean;
  @IsOptional() @IsBoolean() restartRequired?: boolean;
}

/** Generic System Configuration API — one table, staff-gated. Encrypted values are never returned. */
@Controller("system-config")
@RequirePermissions("MANAGE_SYSTEM_SETTINGS")
export class SystemConfigController {
  constructor(private readonly svc: SystemConfigService) {}

  @Get() list(@Query("search") search?: string, @Query("category") category?: string) { return this.svc.list(search, category); }
  @Post() create(@Body() dto: CreateConfigDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.create(dto, u, r.ip); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateConfigDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.update(id, dto, u, r.ip); }
  @Delete(":id") remove(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.remove(id, u, r.ip); }
}
