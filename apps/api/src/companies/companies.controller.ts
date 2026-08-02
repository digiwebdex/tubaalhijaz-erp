import { Body, Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { CompanyType, VerificationStatus } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { CompaniesService } from "./companies.service";

class TransitionDto {
  @IsIn(["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"])
  status!: VerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(160) nameBn?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions("APPROVE_COMPANIES")
  list(@Query("type") type?: CompanyType, @Query("status") status?: VerificationStatus) {
    return this.companies.list({ type, status });
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.companies.findOne(id, user);
  }

  /** Company Management edit (Super Admin console). */
  @Patch(":id")
  @RequirePermissions("APPROVE_COMPANIES")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.companies.update(id, dto, user, req.ip);
  }

  /** Super Admin / Ops verification workflow: PENDING → UNDER_REVIEW → VERIFIED | REJECTED (+ suspend/resume). */
  @Patch(":id/verification")
  @RequirePermissions("APPROVE_COMPANIES")
  transition(
    @Param("id") id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.companies.transitionVerification(id, dto.status, dto.reason, user, req.ip);
  }
}
