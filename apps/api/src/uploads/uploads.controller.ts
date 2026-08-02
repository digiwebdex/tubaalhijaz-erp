import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile as UploadedFileDec,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import { Prisma, UploadKind } from "@prisma/client";
import { Public } from "../common/decorators/public.decorator";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { validateUpload } from "../storage/file-type";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches the wizard hint
const CONFIRM_TTL_MS = 10 * 60 * 1000; // matches presigned URL expiry (expiresInSec: 600)
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/tiff",
]);
const KINDS = new Set(Object.values(UploadKind));

class PresignDto {
  @IsString() @MaxLength(200) fileName!: string;
  @IsIn([...ALLOWED_MIME]) mimeType!: string;
  @IsOptional() @IsString() kind?: string;
}
class ConfirmDto {
  /** One-time secret returned by POST /uploads/presign — required to finalize. */
  @IsString() @MinLength(32) @MaxLength(128) confirmToken!: string;
  @IsOptional() @IsString() fileName?: string;
}

type ConfirmMeta = {
  confirmTokenHash?: string;
  confirmExpiresAt?: string;
};

function hashConfirmToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(hash: string | undefined, token: string): boolean {
  if (!hash || !token) return false;
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(hashConfirmToken(token), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function metaOf(json: Prisma.JsonValue | null | undefined): ConfirmMeta {
  return json && typeof json === "object" && !Array.isArray(json) ? (json as ConfirmMeta) : {};
}

@Controller("uploads")
export class UploadsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Registration wizards upload BEFORE an account exists, so this is public
   * (size/type-limited). Files stay unlinked until a registration claims them.
   * Returns { documentId, storageKey, ... } per the MinIO-shaped contract.
   * When a Bearer JWT is present it is validated and ownership is stamped.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @UploadedFileDec() file: Express.Multer.File | undefined,
    @Query("kind") kind: string | undefined,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException("No file provided (multipart field: file)");
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type ${file.mimetype} — use PDF/JPG/PNG/WEBP/SVG/TIFF`);
    }
    // Content scan: verify the real bytes, not the client-declared type.
    const scan = validateUpload(file.buffer, file.mimetype);
    if (!scan.ok) throw new BadRequestException(`Rejected: ${scan.reason}`);
    const uploadKind = (kind && KINDS.has(kind as UploadKind) ? kind : "OTHER") as UploadKind;

    const { bucket, storageKey } = await this.storage.store(
      file.originalname || "upload",
      file.buffer,
      file.mimetype,
    );

    const user = req.user as AuthUser | undefined;
    const row = await this.prisma.uploadedFile.create({
      data: {
        bucket,
        storageKey,
        fileName: file.originalname || "upload",
        mimeType: file.mimetype,
        sizeBytes: file.size,
        kind: uploadKind,
        scanStatus: "CLEAN",
        uploadedById: user?.sub,
        companyId: user?.companyId ?? null,
      },
    });

    return {
      documentId: row.id,
      storageKey: row.storageKey,
      bucket: row.bucket,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      kind: row.kind,
      url: this.storage.urlFor(bucket, storageKey), // null on local driver → stream endpoint below
    };
  }

  /**
   * Presigned direct browser→MinIO upload (large files: office photos, scans) —
   * keeps big payloads off the API. Returns a PUT URL the browser uploads to,
   * plus a pending UploadedFile id and confirmToken to finalize afterward.
   * Public (wizard may be pre-auth); Bearer JWT stamps ownership when present.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("presign")
  async presign(@Body() dto: PresignDto, @Req() req: Request) {
    if (!this.storage.supportsPresigned) {
      throw new BadRequestException("Direct upload unavailable — use POST /uploads (multipart)");
    }
    const uploadKind = (dto.kind && KINDS.has(dto.kind as UploadKind) ? dto.kind : "OTHER") as UploadKind;
    const { url, bucket, storageKey } = await this.storage.presignedUpload(dto.fileName);
    const user = req.user as AuthUser | undefined;
    const confirmToken = randomBytes(32).toString("hex");
    const confirmExpiresAt = new Date(Date.now() + CONFIRM_TTL_MS).toISOString();
    const row = await this.prisma.uploadedFile.create({
      data: {
        bucket,
        storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: 0,
        kind: uploadKind,
        scanStatus: "PENDING",
        uploadedById: user?.sub,
        companyId: user?.companyId ?? null,
        meta: {
          confirmTokenHash: hashConfirmToken(confirmToken),
          confirmExpiresAt,
        } satisfies ConfirmMeta as Prisma.InputJsonValue,
      },
    });
    return {
      documentId: row.id,
      uploadUrl: url,
      method: "PUT",
      storageKey,
      bucket,
      expiresInSec: 600,
      confirmToken, // shown once — required by POST /uploads/:id/confirm
      confirmExpiresAt,
    };
  }

  /**
   * Confirm a presigned upload finished: verify ownership + confirmToken, object,
   * scan bytes, finalize. Public for pre-auth wizards; IDOR-hardened (S1-02).
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(":id/confirm")
  async confirm(@Param("id") id: string, @Body() dto: ConfirmDto, @Req() req: Request) {
    const user = req.user as AuthUser | undefined;
    const row = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!row) {
      await this.auditConfirm(user, id, false, "NOT_FOUND");
      throw new NotFoundException("Upload not found");
    }

    const denied = this.authorizeConfirm(row, user, dto.confirmToken);
    if (denied) {
      await this.auditConfirm(user, id, false, denied);
      throw new NotFoundException("Upload not found");
    }

    if (row.scanStatus !== "PENDING") {
      await this.auditConfirm(user, id, false, "ALREADY_CONFIRMED");
      throw new BadRequestException("Upload already confirmed");
    }

    const meta = metaOf(row.meta);
    if (meta.confirmExpiresAt && Date.parse(meta.confirmExpiresAt) < Date.now()) {
      await this.auditConfirm(user, id, false, "EXPIRED");
      throw new BadRequestException("Upload confirmation expired — request a new presign");
    }

    const stat = await this.storage.stat(row.bucket, row.storageKey);
    if (!stat) {
      await this.auditConfirm(user, id, false, "OBJECT_MISSING");
      throw new BadRequestException("Object not found in storage — upload did not complete");
    }
    if (stat.size <= 0 || stat.size > MAX_BYTES) {
      await this.prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
      await this.auditConfirm(user, id, false, "SIZE_REJECTED");
      throw new BadRequestException(`Rejected: file size ${stat.size} outside 1…${MAX_BYTES} bytes`);
    }

    // scan the real bytes (content-type spoofing / bad file → reject + remove row)
    const head = await this.storage.headBytes(row.bucket, row.storageKey);
    const scan = validateUpload(head, row.mimeType);
    if (!scan.ok) {
      await this.prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
      await this.auditConfirm(user, id, false, `SCAN_REJECTED:${scan.reason}`);
      throw new BadRequestException(`Rejected: ${scan.reason}`);
    }

    const cleanedMeta: Record<string, unknown> = { ...meta };
    delete cleanedMeta.confirmTokenHash;
    delete cleanedMeta.confirmExpiresAt;
    cleanedMeta.confirmedAt = new Date().toISOString();
    const updated = await this.prisma.uploadedFile.update({
      where: { id },
      data: {
        sizeBytes: stat.size,
        scanStatus: "CLEAN",
        // Clear capability secret after successful confirm (one-time use).
        meta: cleanedMeta as Prisma.InputJsonValue,
      },
    });
    await this.auditConfirm(user, id, true, "OK", {
      sizeBytes: updated.sizeBytes,
      kind: updated.kind,
      companyId: updated.companyId,
    });
    return {
      documentId: updated.id,
      sizeBytes: updated.sizeBytes,
      storageKey: updated.storageKey,
      kind: updated.kind,
    };
  }

  /** Stream the stored object (admin document review / own-company docs). */
  @Get(":id/file")
  async serve(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    const user = req.user as AuthUser;
    const row = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("File not found");
    // tenants may only fetch their own company's files; staff fetch any
    if (user.companyId && row.companyId !== user.companyId) {
      throw new NotFoundException("File not found");
    }
    const buf = await this.storage.read(row.bucket, row.storageKey);
    res.setHeader("Content-Type", row.mimeType);
    // ESP-04 — SVG can execute script if opened inline; force download for that MIME only.
    const disposition = row.mimeType === "image/svg+xml" ? "attachment" : "inline";
    res.setHeader("Content-Disposition", `${disposition}; filename="${row.fileName.replace(/"/g, "")}"`);
    res.send(buf);
  }

  /**
   * Returns a deny reason, or null if confirmation is authorized.
   * Rules: valid confirmToken always required; owned rows need matching JWT tenant/user;
   * orphan (pre-auth) rows may confirm with token alone.
   */
  private authorizeConfirm(
    row: { uploadedById: string | null; companyId: string | null; meta: Prisma.JsonValue | null },
    user: AuthUser | undefined,
    confirmToken: string,
  ): string | null {
    const meta = metaOf(row.meta);
    if (!meta.confirmTokenHash) return "NO_CONFIRM_SECRET";
    if (!tokenMatches(meta.confirmTokenHash, confirmToken)) return "BAD_TOKEN";

    const owned = !!(row.uploadedById || row.companyId);
    if (!owned) return null; // public wizard pending — token is the capability

    // Owned pending upload: JWT required + same user/company (staff companyId null may confirm).
    if (!user) return "AUTH_REQUIRED";
    if (row.uploadedById && row.uploadedById === user.sub) return null;
    if (row.companyId && user.companyId && row.companyId === user.companyId) return null;
    if (!user.companyId) return null; // platform staff
    return "CROSS_TENANT";
  }

  private async auditConfirm(
    user: AuthUser | undefined,
    entityId: string,
    ok: boolean,
    reason: string,
    after?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user?.sub ?? null,
        actorLabel: user ? undefined : "Anonymous (upload confirm)",
        action: "PROCESS",
        module: "Uploads",
        entityType: "UploadedFile",
        entityId,
        after: { result: ok ? "OK" : "DENIED", reason, ...(after ?? {}) },
      },
    }).catch(() => undefined);
  }
}
