import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PrismaService } from "../prisma/prisma.service";

class RuleDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsInt() @Min(0) minPax?: number;
  @IsOptional() @IsString() visaType?: string;
  @IsOptional() @IsString() packageType?: string;
  @IsOptional() @IsString() @MaxLength(40) requiredRole?: string;
  @IsOptional() @IsInt() @Min(1) level?: number;
  @IsOptional() @IsInt() @Min(1) minApprovals?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** Configurable approval matrix — no hardcoded levels. */
@Controller("approval-rules")
@RequirePermissions("MANAGE_SYSTEM_SETTINGS")
export class ApprovalRuleController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() list() { return this.prisma.approvalRule.findMany({ orderBy: { level: "desc" } }); }
  @Post() create(@Body() d: RuleDto) {
    return this.prisma.approvalRule.create({ data: {
      name: d.name, minPax: d.minPax ?? null, visaType: (d.visaType ?? null) as never, packageType: (d.packageType ?? null) as never,
      requiredRole: d.requiredRole ?? "OPS_STAFF", level: d.level ?? 1, minApprovals: d.minApprovals ?? 1, active: d.active ?? true } });
  }
  @Patch(":id") update(@Param("id") id: string, @Body() d: Partial<RuleDto>) {
    const data: Record<string, unknown> = {};
    for (const k of ["name","minPax","level","minApprovals","active","requiredRole"] as const) if (d[k] !== undefined) data[k] = d[k];
    return this.prisma.approvalRule.update({ where: { id }, data });
  }
  @Delete(":id") async remove(@Param("id") id: string) { await this.prisma.approvalRule.delete({ where: { id } }); return { ok: true }; }
}
