import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { FeatureFlagsService, FLAG_CATEGORIES } from "./feature-flags.service";

class CreateFlagDto {
  @IsString() @MaxLength(80) @Matches(/^[A-Z0-9_]+$/, { message: "key must be UPPER_SNAKE_CASE" }) key!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsIn(FLAG_CATEGORIES as unknown as string[]) category!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
class UpdateFlagDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsIn(FLAG_CATEGORIES as unknown as string[]) category?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

/** Feature Flags API — one table, staff-gated, every change audited. */
@Controller("feature-flags")
@RequirePermissions("MANAGE_SYSTEM_SETTINGS")
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagsService) {}

  @Get() list(@Query("search") search?: string, @Query("category") category?: string) { return this.svc.list(search, category); }
  @Post() create(@Body() dto: CreateFlagDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.create(dto, u, r.ip); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFlagDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.update(id, dto, u, r.ip); }
  @Delete(":id") remove(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.remove(id, u, r.ip); }
}
