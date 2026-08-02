import {
  BadRequestException, Body, Controller, Get, Post, Query, Req,
  UploadedFile as UploadedFileDec, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString } from "class-validator";
import { Request } from "express";
import { UploadKind } from "@prisma/client";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { DocumentsService } from "./documents.service";

const KINDS = Object.values(UploadKind);
const MAX = 10 * 1024 * 1024;

class VersionUploadDto {
  @IsIn(KINDS) kind!: UploadKind;
  @IsOptional() @IsString() expiryDate?: string;
  @IsOptional() @IsString() companyId?: string; // staff uploading on behalf of a tenant
}

/**
 * Document Vault — Agent Portal "Documents" (scoped to the caller's company) and
 * Super Admin "Document Management" (all tenants). Auth-only; tenant callers are
 * force-scoped to their own company, staff (no company) see everything.
 */
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get() vault(
    @Req() req: Request,
    @Query("kind") kind?: UploadKind,
    @Query("companyId") companyId?: string,
    @Query("expiringDays") expiringDays?: string,
  ) {
    const user = req.user as AuthUser;
    return this.documents.vault({
      companyId: user.companyId ?? companyId ?? null, // tenants scoped to own; staff optional filter
      kind: kind && KINDS.includes(kind) ? kind : undefined,
      expiringDays: expiringDays ? Math.min(365, Math.max(1, +expiringDays)) : undefined,
    });
  }

  @Get("versions") versions(
    @Req() req: Request,
    @Query("kind") kind: UploadKind,
    @Query("companyId") companyId?: string,
  ) {
    const user = req.user as AuthUser;
    const cid = user.companyId ?? companyId;
    if (!cid || !KINDS.includes(kind)) throw new BadRequestException("companyId and a valid kind are required");
    return this.documents.versions(cid, kind);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX } }))
  async upload(
    @UploadedFileDec() file: Express.Multer.File | undefined,
    @Body() dto: VersionUploadDto,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException("No file provided (multipart field: file)");
    const user = req.user as AuthUser;
    const companyId = user.companyId ?? dto.companyId;
    if (!companyId) throw new BadRequestException("companyId required (staff must specify the tenant)");
    return this.documents.addVersion(file, {
      companyId, kind: dto.kind, uploadedById: user.sub,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    });
  }
}
