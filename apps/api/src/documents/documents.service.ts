import { BadRequestException, Injectable } from "@nestjs/common";
import { UploadKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { validateUpload } from "../storage/file-type";

const DAY = 86_400_000;
function expiryOf(expiryDate: Date | null) {
  if (!expiryDate) return { daysLeft: null as number | null, severity: null as string | null };
  const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / DAY);
  const severity = daysLeft < 0 ? "EXPIRED" : daysLeft <= 7 ? "CRITICAL" : daysLeft <= 30 ? "WARNING" : "OK";
  return { daysLeft, severity };
}

/**
 * Document Vault. Documents are versioned by (companyId, kind): a new upload of
 * the same type SUPERSEDES the previous one (isLatest=false) — never overwrites.
 * The vault lists the latest version of each type with expiry tracking; history
 * walks the full version chain.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Latest version of each document, filterable by company / type / expiring window. */
  async vault(filter: { companyId?: string | null; kind?: UploadKind; expiringDays?: number }) {
    const rows = await this.prisma.uploadedFile.findMany({
      where: {
        isLatest: true,
        ...(filter.companyId ? { companyId: filter.companyId } : {}),
        ...(filter.kind ? { kind: filter.kind } : {}),
        ...(filter.expiringDays != null
          ? { expiryDate: { not: null, lte: new Date(Date.now() + filter.expiringDays * DAY) } }
          : {}),
      },
      orderBy: [{ companyId: "asc" }, { kind: "asc" }],
      include: { company: { select: { code: true, name: true } }, uploadedBy: { select: { name: true } } },
    });
    return rows.map((r) => ({
      id: r.id, kind: r.kind, fileName: r.fileName, mimeType: r.mimeType, sizeBytes: r.sizeBytes,
      version: r.version, versionCount: r.version, scanStatus: r.scanStatus,
      company: r.company ? { code: r.company.code, name: r.company.name } : null,
      uploadedBy: r.uploadedBy?.name ?? null, createdAt: r.createdAt,
      expiryDate: r.expiryDate, ...expiryOf(r.expiryDate),
    }));
  }

  /** Full version history for a (company, kind) group, newest first. */
  async versions(companyId: string, kind: UploadKind) {
    const rows = await this.prisma.uploadedFile.findMany({
      where: { companyId, kind },
      orderBy: { version: "desc" },
      select: { id: true, version: true, isLatest: true, fileName: true, sizeBytes: true, scanStatus: true, expiryDate: true, createdAt: true, uploadedBy: { select: { name: true } } },
    });
    return rows.map((r) => ({ ...r, uploadedBy: r.uploadedBy?.name ?? null }));
  }

  /**
   * Store a new version of a document type. Validates content, uploads to MinIO,
   * marks the prior latest as superseded — all in one transaction.
   */
  async addVersion(
    file: { buffer: Buffer; originalname?: string; mimetype: string; size: number },
    opts: { companyId: string; kind: UploadKind; expiryDate?: Date; uploadedById?: string },
  ) {
    const scan = validateUpload(file.buffer, file.mimetype);
    if (!scan.ok) throw new BadRequestException(`Rejected: ${scan.reason}`);

    const { bucket, storageKey } = await this.storage.store(file.originalname || "document", file.buffer, file.mimetype);

    const prev = await this.prisma.uploadedFile.findFirst({
      where: { companyId: opts.companyId, kind: opts.kind, isLatest: true },
      orderBy: { version: "desc" },
    });

    const [created] = await this.prisma.$transaction([
      this.prisma.uploadedFile.create({
        data: {
          bucket, storageKey, fileName: file.originalname || "document", mimeType: file.mimetype,
          sizeBytes: file.size, kind: opts.kind, scanStatus: "CLEAN",
          companyId: opts.companyId, uploadedById: opts.uploadedById,
          version: (prev?.version ?? 0) + 1, isLatest: true,
          supersedesId: prev?.id ?? null, expiryDate: opts.expiryDate ?? null,
        },
      }),
      ...(prev ? [this.prisma.uploadedFile.update({ where: { id: prev.id }, data: { isLatest: false } })] : []),
    ]);
    return { documentId: created.id, version: created.version, supersedes: prev?.id ?? null, storageKey };
  }
}
