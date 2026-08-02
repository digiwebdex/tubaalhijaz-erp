import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { EV, buildEvent } from "../automation/events";
import type { CreatePassengerDto } from "./passengers.dto";
import {
  ALWAYS_REQUIRED_FIELDS,
  BUSINESS_REQUIRED_FIELDS,
  MUTAMER_IMPORT_MAX_ROWS,
  type MutamerExcelApiField,
  isBusinessWorkbook,
  mapVisaStatusLabelToEnum,
  resolveHeaderToField,
} from "./mutamer-excel.contract";
import type { MutamerImportCommitDto, MutamerImportPreviewDto } from "./mutamer-import.dto";

export type ImportIssueLevel = "error" | "warning" | "duplicate";

export interface ImportIssue {
  level: ImportIssueLevel;
  row?: number;
  code: string;
  message: string;
}

export interface ImportPreviewResult {
  fileName: string;
  fileHash: string;
  format: "csv" | "xlsx";
  mode: "business" | "legacy";
  group: { id: string; code: string; maxCapacity: number; existingPassengers: number };
  headers: string[];
  mapping: Array<{ header: string; field: MutamerExcelApiField | null }>;
  summary: {
    totalRows: number;
    valid: number;
    invalid: number;
    warnings: number;
    duplicates: number;
    canCommit: boolean;
  };
  issues: ImportIssue[];
  /** Sanitized rows safe to POST to commit (only valid, non-duplicate). */
  passengers: CreatePassengerDto[];
  /** Sample of invalid/duplicate rows for UI (capped). */
  rejectedSample: Array<{ row: number; reason: string }>;
}

/**
 * T001-05 — Enterprise Mutamer Excel/CSV import engine.
 * Preview never writes. Commit is transactional and all-or-nothing.
 */
@Injectable()
export class MutamerImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private async getGroupOrThrow(groupId: string, user?: AuthUser) {
    const group = await this.prisma.scoped.group.findUnique({
      where: { id: groupId },
      select: { id: true, tenantId: true, maxCapacity: true, code: true },
    });
    if (!group) throw new NotFoundException("Group not found");
    if (user?.companyId && user.companyId !== group.tenantId) {
      throw new NotFoundException("Group not found");
    }
    return group;
  }

  private fileHash(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
  }

  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r") {
        /* skip */
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else field += ch;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  private async parseXlsx(bytes: Buffer): Promise<string[][]> {
    const wb = new ExcelJS.Workbook();
    // exceljs typings accept Buffer / Uint8Array via load
    await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new BadRequestException("Workbook has no sheets");
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (vals.length < colNumber - 1) vals.push("");
        const v = cell.value;
        if (v == null) vals.push("");
        else if (typeof v === "object" && v && "text" in v) vals.push(String((v as { text: string }).text ?? ""));
        else if (typeof v === "object" && v && "result" in v) vals.push(String((v as { result: unknown }).result ?? ""));
        else if (v instanceof Date) vals.push(v.toISOString().slice(0, 10));
        else vals.push(String(v));
      });
      rows.push(vals);
    });
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  }

  private detectFormat(fileName: string, format?: string): "csv" | "xlsx" {
    if (format === "csv" || format === "xlsx") return format;
    const n = fileName.toLowerCase();
    if (n.endsWith(".xlsx") || n.endsWith(".xlsm")) return "xlsx";
    return "csv";
  }

  private normGender(v: string): "MALE" | "FEMALE" | null {
    const g = v.trim().toLowerCase();
    if (["m", "male", "man"].includes(g)) return "MALE";
    if (["f", "female", "woman"].includes(g)) return "FEMALE";
    return null;
  }

  private isoOrNull(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  private rowFingerprint(cells: Record<string, string>): string {
    return createHash("sha256").update(JSON.stringify(cells)).digest("hex").slice(0, 24);
  }

  async preview(groupId: string, dto: MutamerImportPreviewDto, user: AuthUser): Promise<ImportPreviewResult> {
    const group = await this.getGroupOrThrow(groupId, user);
    const existingCount = await this.prisma.passenger.count({ where: { groupId } });
    const format = this.detectFormat(dto.fileName, dto.format);

    let bytes: Buffer;
    if (dto.contentBase64?.trim()) {
      bytes = Buffer.from(dto.contentBase64, "base64");
    } else if (dto.csvText != null) {
      bytes = Buffer.from(dto.csvText, "utf8");
    } else {
      throw new BadRequestException("Provide csvText or contentBase64");
    }
    if (!bytes.length) throw new BadRequestException("Empty file");

    const fileHash = this.fileHash(bytes);
    let matrix: string[][];
    try {
      matrix = format === "xlsx" ? await this.parseXlsx(bytes) : this.parseCsv(bytes.toString("utf8"));
    } catch (e) {
      throw new BadRequestException(
        e instanceof BadRequestException
          ? e.message
          : "Could not parse workbook — use .xlsx or CSV (UTF-8)",
      );
    }

    if (matrix.length < 2) {
      throw new BadRequestException("No data rows found. Include a header row plus at least one Mutamer.");
    }

    const headers = matrix[0].map((h) => String(h ?? "").trim());
    const mapping = headers.map((h) => ({ header: h, field: resolveHeaderToField(h) }));
    const fields = mapping.map((m) => m.field);
    const mode = isBusinessWorkbook(fields) ? "business" : "legacy";

    // Workbook-level column presence
    const issues: ImportIssue[] = [];
    const fieldIndex = new Map<MutamerExcelApiField, number>();
    mapping.forEach((m, i) => {
      if (m.field && !fieldIndex.has(m.field)) fieldIndex.set(m.field, i);
    });

    for (const req of ALWAYS_REQUIRED_FIELDS) {
      if (!fieldIndex.has(req)) {
        issues.push({
          level: "error",
          code: "MISSING_COLUMN",
          message: `Required column missing: ${req}`,
        });
      }
    }
    if (mode === "business") {
      for (const req of BUSINESS_REQUIRED_FIELDS) {
        if (!fieldIndex.has(req)) {
          issues.push({
            level: "error",
            code: "MISSING_COLUMN",
            message: `Business Mutamer sheet requires column: ${req}`,
          });
        }
      }
    } else if (!fieldIndex.has("gender")) {
      issues.push({
        level: "error",
        code: "MISSING_COLUMN",
        message: "Legacy template requires Gender column",
      });
    }

    const dataRows = matrix.slice(1);
    if (dataRows.length > MUTAMER_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `Too many rows (${dataRows.length}). Maximum is ${MUTAMER_IMPORT_MAX_ROWS} Mutamers per import.`,
      );
    }

    const priorImport = await this.prisma.mutamerImportRun.findUnique({
      where: { groupId_fileHash: { groupId, fileHash } },
    });
    if (priorImport) {
      issues.push({
        level: "duplicate",
        code: "DUPLICATE_IMPORT",
        message: `This exact file was already imported into ${group.code} on ${priorImport.createdAt.toISOString()} (${priorImport.successCount} rows). Use force=true on commit to override.`,
      });
    }

    type Built = { row: number; dto: CreatePassengerDto; fp: string };
    const built: Built[] = [];
    const rejectedSample: Array<{ row: number; reason: string }> = [];
    const seenPass = new Map<string, number>();
    const seenMofa = new Map<string, number>();
    const seenVisa = new Map<string, number>();
    const seenFp = new Map<string, number>();

    const get = (r: string[], field: MutamerExcelApiField) => {
      const i = fieldIndex.get(field);
      return i == null ? "" : String(r[i] ?? "").trim();
    };

    dataRows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const cells: Record<string, string> = {};
      for (const f of fieldIndex.keys()) cells[f] = get(raw, f);
      const fp = this.rowFingerprint(cells);
      const rowErrors: string[] = [];
      const rowWarns: string[] = [];

      const name = cells.name ?? "";
      const passport = (cells.passportNo ?? "").toUpperCase();
      const nationality = cells.nationality ?? "";
      let gender = this.normGender(cells.gender ?? "");

      if (name.length < 2) rowErrors.push("missing / too-short Mutamer name");
      if (passport.length < 3) rowErrors.push("missing passport number");
      if (nationality.length < 2) rowErrors.push("missing nationality");

      if (mode === "business") {
        if (!(cells.mainEaCode ?? "").trim()) rowErrors.push("Main EA code required");
        if (!(cells.subEaCode ?? "").trim()) rowErrors.push("Sub EA code required");
        if (!(cells.visaStatusLabel ?? "").trim()) rowErrors.push("Visa Status / Visa Type required");
        if (!gender) {
          gender = "MALE";
          rowWarns.push("Gender blank — defaulted to MALE");
        }
      } else if (!gender) {
        rowErrors.push('gender must be Male/Female (or M/F)');
      }

      if (seenPass.has(passport) && passport) {
        rowErrors.push(`duplicate passport in file (also row ${seenPass.get(passport)})`);
        issues.push({
          level: "duplicate",
          row: rowNum,
          code: "DUP_PASSPORT_FILE",
          message: `Row ${rowNum}: duplicate passport ${passport} (also row ${seenPass.get(passport)})`,
        });
      } else if (passport) seenPass.set(passport, rowNum);

      const mofa = (cells.mofaNumber ?? "").trim().toUpperCase();
      if (mofa) {
        if (seenMofa.has(mofa)) {
          rowErrors.push(`duplicate MOFA in file (also row ${seenMofa.get(mofa)})`);
          issues.push({
            level: "duplicate",
            row: rowNum,
            code: "DUP_MOFA_FILE",
            message: `Row ${rowNum}: duplicate MOFA ${mofa}`,
          });
        } else seenMofa.set(mofa, rowNum);
      }

      const visaNo = (cells.visaNumber ?? "").trim().toUpperCase();
      if (visaNo) {
        if (seenVisa.has(visaNo)) {
          rowErrors.push(`duplicate visa number in file (also row ${seenVisa.get(visaNo)})`);
          issues.push({
            level: "duplicate",
            row: rowNum,
            code: "DUP_VISA_FILE",
            message: `Row ${rowNum}: duplicate visa number ${visaNo}`,
          });
        } else seenVisa.set(visaNo, rowNum);
      }

      if (seenFp.has(fp)) {
        rowErrors.push(`duplicate Excel row (identical to row ${seenFp.get(fp)})`);
        issues.push({
          level: "duplicate",
          row: rowNum,
          code: "DUP_EXCEL_ROW",
          message: `Row ${rowNum}: duplicate Excel row (same as row ${seenFp.get(fp)})`,
        });
      } else seenFp.set(fp, rowNum);

      const ageRaw = (cells.age ?? "").trim();
      let age: number | undefined;
      if (ageRaw) {
        const n = Number(ageRaw);
        if (!Number.isInteger(n) || n < 0 || n > 130) rowErrors.push(`invalid age "${ageRaw}"`);
        else age = n;
      }

      const dob = this.isoOrNull(cells.dob ?? "");
      const exp = this.isoOrNull(cells.passportExpiry ?? "");
      if ((cells.dob ?? "").trim() && !dob) rowWarns.push(`DOB "${cells.dob}" not a valid date — skipped`);
      if ((cells.passportExpiry ?? "").trim() && !exp) {
        rowWarns.push(`passport expiry "${cells.passportExpiry}" not a valid date — skipped`);
      }
      if (exp) {
        const months = (new Date(exp).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
        if (months < 6) rowWarns.push("passport expires within 6 months");
      }

      for (const w of rowWarns) {
        issues.push({ level: "warning", row: rowNum, code: "ROW_WARNING", message: `Row ${rowNum}: ${w}` });
      }
      if (rowErrors.length) {
        for (const e of rowErrors) {
          issues.push({ level: "error", row: rowNum, code: "ROW_ERROR", message: `Row ${rowNum}: ${e}` });
        }
        if (rejectedSample.length < 40) {
          rejectedSample.push({ row: rowNum, reason: rowErrors.join("; ") });
        }
        return;
      }

      const dto: CreatePassengerDto = {
        name,
        passportNo: passport,
        nationality,
        gender: gender!,
        ...(age != null ? { age } : {}),
        ...(dob ? { dob } : {}),
        ...(exp ? { passportExpiry: exp } : {}),
        ...(cells.phone ? { phone: cells.phone } : {}),
        ...(cells.mainEaCode ? { mainEaCode: cells.mainEaCode } : {}),
        ...(cells.mainEaName ? { mainEaName: cells.mainEaName } : {}),
        ...(cells.subEaCode ? { subEaCode: cells.subEaCode } : {}),
        ...(cells.subEaName ? { subEaName: cells.subEaName } : {}),
        ...(cells.biometricStatus ? { biometricStatus: cells.biometricStatus } : {}),
        ...(visaNo ? { visaNumber: visaNo } : {}),
        ...(mofa ? { mofaNumber: mofa } : {}),
        ...(cells.mutamerType ? { mutamerType: cells.mutamerType } : {}),
        ...(cells.visaStatusLabel ? { visaStatusLabel: cells.visaStatusLabel } : {}),
      };
      built.push({ row: rowNum, dto, fp });
    });

    // DB duplicate checks for candidates
    const passports = built.map((b) => b.dto.passportNo);
    const mofas = built.map((b) => b.dto.mofaNumber).filter((x): x is string => !!x);
    const visas = built.map((b) => b.dto.visaNumber).filter((x): x is string => !!x);

    const dbPass = passports.length
      ? await this.prisma.passenger.findMany({
          where: { tenantId: group.tenantId, passportNo: { in: passports } },
          select: { passportNo: true, groupId: true, group: { select: { code: true } } },
        })
      : [];
    const dbPassSet = new Map(dbPass.map((p) => [p.passportNo, p]));

    const dbMofa = mofas.length
      ? await this.prisma.passenger.findMany({
          where: { tenantId: group.tenantId, mofaNumber: { in: mofas } },
          select: { mofaNumber: true, group: { select: { code: true } } },
        })
      : [];
    const dbMofaSet = new Map(dbMofa.map((p) => [p.mofaNumber!, p]));

    const dbVisa = visas.length
      ? await this.prisma.passenger.findMany({
          where: { tenantId: group.tenantId, visaNumber: { in: visas } },
          select: { visaNumber: true, group: { select: { code: true } } },
        })
      : [];
    const dbVisaSet = new Map(dbVisa.map((p) => [p.visaNumber!, p]));

    const passengers: CreatePassengerDto[] = [];
    for (const b of built) {
      let blocked = false;
      const clash = dbPassSet.get(b.dto.passportNo);
      if (clash) {
        blocked = true;
        const sameGroup = clash.groupId === groupId;
        issues.push({
          level: "duplicate",
          row: b.row,
          code: sameGroup ? "DUP_PASSPORT_GROUP" : "DUP_PASSPORT_TENANT",
          message: `Row ${b.row}: passport ${b.dto.passportNo} already on group ${clash.group.code}`,
        });
        if (rejectedSample.length < 40) {
          rejectedSample.push({
            row: b.row,
            reason: `passport already on ${clash.group.code}`,
          });
        }
      }
      if (b.dto.mofaNumber && dbMofaSet.has(b.dto.mofaNumber)) {
        blocked = true;
        issues.push({
          level: "duplicate",
          row: b.row,
          code: "DUP_MOFA_DB",
          message: `Row ${b.row}: MOFA ${b.dto.mofaNumber} already registered`,
        });
      }
      if (b.dto.visaNumber && dbVisaSet.has(b.dto.visaNumber)) {
        blocked = true;
        issues.push({
          level: "duplicate",
          row: b.row,
          code: "DUP_VISA_DB",
          message: `Row ${b.row}: visa number ${b.dto.visaNumber} already registered`,
        });
      }
      if (!blocked) passengers.push(b.dto);
    }

    if (existingCount + passengers.length > group.maxCapacity) {
      issues.push({
        level: "error",
        code: "CAPACITY",
        message: `Group ${group.code} capacity ${group.maxCapacity}; has ${existingCount}; import of ${passengers.length} would exceed capacity`,
      });
    }

    const errorCount = issues.filter((i) => i.level === "error").length;
    const dupCount = issues.filter((i) => i.level === "duplicate").length;
    const warnCount = issues.filter((i) => i.level === "warning").length;
    const invalid = dataRows.length - passengers.length;
    const canCommit =
      errorCount === 0 &&
      dupCount === 0 &&
      passengers.length > 0 &&
      existingCount + passengers.length <= group.maxCapacity;

    return {
      fileName: dto.fileName,
      fileHash,
      format,
      mode,
      group: {
        id: group.id,
        code: group.code,
        maxCapacity: group.maxCapacity,
        existingPassengers: existingCount,
      },
      headers,
      mapping,
      summary: {
        totalRows: dataRows.length,
        valid: passengers.length,
        invalid,
        warnings: warnCount,
        duplicates: dupCount,
        canCommit,
      },
      issues: issues.slice(0, 500),
      passengers,
      rejectedSample,
    };
  }

  async commit(groupId: string, dto: MutamerImportCommitDto, user: AuthUser) {
    if (!dto.confirm) {
      throw new BadRequestException("confirm=true is required — preview first, then confirm import");
    }
    const group = await this.getGroupOrThrow(groupId, user);

    const prior = await this.prisma.mutamerImportRun.findUnique({
      where: { groupId_fileHash: { groupId, fileHash: dto.fileHash } },
    });
    if (prior && !dto.force) {
      throw new BadRequestException(
        `Duplicate import blocked: file already imported into ${group.code} (${prior.successCount} rows on ${prior.createdAt.toISOString()}). Pass force=true to override.`,
      );
    }

    if (dto.passengers.length > MUTAMER_IMPORT_MAX_ROWS) {
      throw new BadRequestException(`Maximum ${MUTAMER_IMPORT_MAX_ROWS} passengers per import`);
    }

    // Re-validate duplicates against live DB (no silent overwrite).
    const numbers = dto.passengers.map((p) => p.passportNo.trim().toUpperCase());
    const dupInPayload = numbers.filter((n, i) => numbers.indexOf(n) !== i);
    if (dupInPayload.length) {
      throw new BadRequestException(`Duplicate passport(s) in commit payload: ${[...new Set(dupInPayload)].join(", ")}`);
    }

    const existingCount = await this.prisma.passenger.count({ where: { groupId } });
    if (existingCount + dto.passengers.length > group.maxCapacity) {
      throw new BadRequestException(
        `Group ${group.code} capacity exceeded (${existingCount} + ${dto.passengers.length} > ${group.maxCapacity})`,
      );
    }

    const clash = await this.prisma.passenger.findFirst({
      where: { tenantId: group.tenantId, passportNo: { in: numbers } },
      select: { passportNo: true, group: { select: { code: true } } },
    });
    if (clash) {
      throw new BadRequestException(
        `Passport ${clash.passportNo} already registered on group ${clash.group.code} — import aborted (no partial write)`,
      );
    }

    const mofas = dto.passengers.map((p) => p.mofaNumber?.trim().toUpperCase()).filter(Boolean) as string[];
    if (mofas.length) {
      const mClash = await this.prisma.passenger.findFirst({
        where: { tenantId: group.tenantId, mofaNumber: { in: mofas } },
        select: { mofaNumber: true },
      });
      if (mClash) {
        throw new BadRequestException(`MOFA ${mClash.mofaNumber} already registered — import aborted`);
      }
    }

    const last = await this.prisma.passenger.findFirst({
      where: { groupId },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    let start = last ? Number.parseInt(last.code.replace(/\D/g, ""), 10) || 0 : 0;

    const rows = dto.passengers.map((p) => {
      start += 1;
      const label = p.visaStatusLabel?.trim() || null;
      const mapped = mapVisaStatusLabelToEnum(label);
      return {
        code: `PAX-${String(start).padStart(3, "0")}`,
        groupId,
        tenantId: group.tenantId,
        name: p.name,
        nameBn: p.nameBn,
        passportNo: p.passportNo.trim().toUpperCase(),
        passportExpiry: p.passportExpiry ? new Date(p.passportExpiry) : null,
        nationality: p.nationality,
        gender: p.gender,
        dob: p.dob ? new Date(p.dob) : null,
        phone: p.phone ?? null,
        seat: p.seat ?? null,
        age: p.age ?? null,
        mainEaCode: p.mainEaCode?.trim() || null,
        mainEaName: p.mainEaName?.trim() || null,
        subEaCode: p.subEaCode?.trim() || null,
        subEaName: p.subEaName?.trim() || null,
        biometricStatus: p.biometricStatus?.trim() || null,
        visaNumber: p.visaNumber?.trim().toUpperCase() || null,
        mofaNumber: p.mofaNumber?.trim().toUpperCase() || null,
        mutamerType: p.mutamerType?.trim() || null,
        visaStatusLabel: label,
        visaStatus: mapped ?? "PENDING",
      };
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.passenger.createMany({ data: rows });
        if (prior && dto.force) {
          await tx.mutamerImportRun.delete({ where: { id: prior.id } });
        }
        await tx.mutamerImportRun.create({
          data: {
            groupId,
            tenantId: group.tenantId,
            fileName: dto.fileName,
            fileHash: dto.fileHash,
            rowCount: rows.length,
            successCount: rows.length,
            importedById: user.sub,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: user.sub,
            action: "CREATE",
            module: "Passengers",
            entityType: "MutamerImport",
            entityId: groupId,
            after: {
              fileName: dto.fileName,
              fileHash: dto.fileHash,
              groupId,
              groupCode: group.code,
              rowCount: rows.length,
              successCount: rows.length,
              failedCount: 0,
              force: !!dto.force,
              importedBy: user.email,
              at: new Date().toISOString(),
            },
          },
        });
      });
    } catch (e) {
      throw new BadRequestException(
        `Import rolled back — no passengers were written (${e instanceof Error ? e.message : "transaction failed"})`,
      );
    }

    this.events.emit(
      EV.IMPORT_COMPLETED,
      buildEvent(EV.IMPORT_COMPLETED, {
        tenantId: group.tenantId,
        companyId: group.tenantId,
        entityType: "Group",
        entityId: groupId,
        recipientUserId: user.sub,
        title: `Mutamer import completed for ${group.code}`,
        data: {
          code: group.code,
          fileName: dto.fileName,
          fileHash: dto.fileHash,
          count: rows.length,
          importedBy: user.email,
        },
      }),
    );

    return {
      imported: rows.length,
      failed: 0,
      groupId,
      groupCode: group.code,
      fileName: dto.fileName,
      fileHash: dto.fileHash,
      codes: rows.map((r) => r.code),
    };
  }
}
