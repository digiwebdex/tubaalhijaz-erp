import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";
import type { Request } from "express";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { WorkflowService, type WfMeta } from "./workflow.service";

class ReasonDto { @IsString() @MaxLength(500) reason!: string }
class OptReasonDto { @IsOptional() @IsString() @MaxLength(500) reason?: string }
class ChangeReqDto { @IsOptional() @IsString() @MaxLength(120) field?: string; @IsString() @MaxLength(1000) description!: string }
class BulkDto { @IsArray() @IsString({ each: true }) ids!: string[] }

function meta(req: Request): WfMeta {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.ip || null;
  return { ip, userAgent: (req.headers["user-agent"] as string) ?? null };
}

@Controller()
export class WorkflowController {
  constructor(private readonly wf: WorkflowService) {}

  // Reads — owner agent or staff
  @Get("groups/:id/workflow") status(@Param("id") id: string) { return this.wf.status(id); }
  @Get("groups/:id/timeline") timeline(@Param("id") id: string) { return this.wf.timelineOf(id); }
  @Get("groups/:id/change-requests") crList(@Param("id") id: string) { return this.wf.listChangeRequests(id); }

  // Agent (owner) actions
  @Post("groups/:id/submit")
  submit(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.submit(id, u, meta(req)); }
  @Post("groups/:id/change-requests")
  createCr(@Param("id") id: string, @Body() dto: ChangeReqDto, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.createChangeRequest(id, u, dto, meta(req)); }

  // Admin / Operations actions (MANAGE_OPS)
  @Post("groups/:id/approve") @RequirePermissions("MANAGE_OPS")
  approve(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.approve(id, u, meta(req)); }
  @Post("groups/:id/reject") @RequirePermissions("MANAGE_OPS")
  reject(@Param("id") id: string, @Body() dto: ReasonDto, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.reject(id, u, dto.reason, meta(req)); }
  @Post("groups/:id/return") @RequirePermissions("MANAGE_OPS")
  ret(@Param("id") id: string, @Body() dto: ReasonDto, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.returnForCorrection(id, u, dto.reason, meta(req)); }
  @Post("groups/:id/unlock") @RequirePermissions("MANAGE_OPS")
  unlock(@Param("id") id: string, @Body() dto: ReasonDto, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.unlock(id, u, dto.reason, meta(req)); }
  @Post("groups/:id/complete") @RequirePermissions("MANAGE_OPS")
  complete(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.complete(id, u, meta(req)); }
  @Post("groups/:id/archive") @RequirePermissions("MANAGE_OPS")
  archive(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.archive(id, u, meta(req)); }
  @Post("change-requests/:id/approve") @RequirePermissions("MANAGE_OPS")
  crApprove(@Param("id") id: string, @Body() dto: OptReasonDto, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.decideChangeRequest(id, u, "APPROVED", dto.reason ?? "", meta(req)); }
  @Post("change-requests/:id/reject") @RequirePermissions("MANAGE_OPS")
  crReject(@Param("id") id: string, @Body() dto: ReasonDto, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.decideChangeRequest(id, u, "REJECTED", dto.reason, meta(req)); }

  // Phase 2
  @Post("groups/:id/finalize") @RequirePermissions("MANAGE_OPS")
  finalize(@Param("id") id: string, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.finalize(id, u, meta(req)); }
  @Post("groups/bulk-approve") @RequirePermissions("MANAGE_OPS")
  bulkApprove(@Body() dto: BulkDto, @CurrentUser() u: AuthUser, @Req() req: Request) { return this.wf.bulkApprove(dto.ids ?? [], u, meta(req)); }
  @Get("groups/:id/versions") versions(@Param("id") id: string) { return this.wf.versions(id); }
  @Get("groups/:id/versions/:a/diff/:b") diff(@Param("id") id: string, @Param("a") a: string, @Param("b") b: string) { return this.wf.diffVersions(id, +a, +b); }
  @Get("groups/:id/approvals") approvalsList(@Param("id") id: string) { return this.wf.approvals(id); }
}
