import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "./jwt.strategy";
import { LoginDto } from "./dto/login.dto";
import { RegisterAgentDto } from "./dto/register-agent.dto";
import { RegisterSupplierDto } from "./dto/register-supplier.dto";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private refreshTtlMs(): number {
    return Number(this.config.get("JWT_REFRESH_EXPIRES_DAYS", "14")) * 86_400_000;
  }

  // ── login ──────────────────────────────────────────────────────────────────
  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        company: { include: { agentProfile: true, supplierProfile: true } },
      },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password).catch(() => false))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is inactive — contact operations@tubalhijaz.com");
    }
    // Portal ↔ role check (UI login tabs)
    if (dto.portal === "agent" && user.role.key !== "AGENT") {
      throw new UnauthorizedException("This account is not an agent account");
    }
    if (dto.portal === "supplier" && user.role.key !== "SUPPLIER") {
      throw new UnauthorizedException("This account is not a supplier account");
    }
    if (dto.portal === "admin" && user.companyId !== null) {
      // Admin portal is for TUBA platform staff (no company affiliation)
      throw new UnauthorizedException("This account has no admin portal access");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(
      {
        sub: user.id,
        email: user.email,
        role: user.role.key,
        companyId: user.companyId,
        companyType: user.company?.type ?? null,
      },
      meta,
    );
    return { ...tokens, user: this.publicUser(user) };
  }

  // ── refresh rotation ───────────────────────────────────────────────────────
  async refresh(rawToken: string | undefined, meta: RequestMeta) {
    if (!rawToken) throw new UnauthorizedException("No refresh token");
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: {
        user: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
            company: { include: { agentProfile: true, supplierProfile: true } },
          },
        },
      },
    });
    if (!row || row.expiresAt < new Date()) throw new UnauthorizedException("Refresh token expired");
    if (row.revokedAt) {
      // Reuse of a rotated token ⇒ possible theft: revoke the whole family.
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token reuse detected");
    }
    if (row.user.status !== "ACTIVE") throw new UnauthorizedException("Account is inactive");

    const payload: JwtPayload = {
      sub: row.user.id,
      email: row.user.email,
      role: row.user.role.key,
      companyId: row.user.companyId,
      companyType: row.user.company?.type ?? null,
    };
    const tokens = await this.issueTokens(payload, meta, row.id);
    return { ...tokens, user: this.publicUser(row.user) };
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── me ─────────────────────────────────────────────────────────────────────
  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        company: { include: { agentProfile: true, supplierProfile: true } },
      },
    });
    return this.publicUser(user);
  }

  // ── registration: AGENT ────────────────────────────────────────────────────
  async registerAgent(dto: RegisterAgentDto, meta: RequestMeta) {
    const loginEmail = dto.businessEmail.toLowerCase();
    await this.assertEmailFree(loginEmail);
    const { password, tempPassword } = await this.resolvePassword(dto.password);
    const passwordHash = await argon2.hash(password);
    const code = await this.uniqueCompanyCode(() => `AGT-${this.seasonYearSync()}-${this.serial4()}`);

    const agentRole = await this.prisma.role.findUniqueOrThrow({ where: { key: "AGENT" } });

    const company = await this.prisma.$transaction(async (tx) => {
      const c = await tx.company.create({
        data: {
          code,
          type: "AGENT",
          name: dto.companyName,
          city: dto.city,
          email: loginEmail,
          phone: dto.phone,
          verificationStatus: "PENDING",
          agentProfile: {
            create: {
              crNumber: dto.crNumber,
              ownerName: dto.ownerName,
              ownerIdNumber: dto.ownerIdNumber,
              ownerNationality: dto.ownerNationality,
              businessEmail: dto.businessEmail,
              website: dto.website,
              referenceAgencyName: dto.referenceAgencyName,
              referenceAgentCode: dto.referenceAgentCode,
              guarantors: {
                create: [
                  ...(dto.guarantor1 ? [{ position: 1, ...dto.guarantor1 }] : []),
                  ...(dto.guarantor2 ? [{ position: 2, ...dto.guarantor2 }] : []),
                ],
              },
            },
          },
          bankAccounts: dto.bankName
            ? {
                create: [
                  {
                    bankName: dto.bankName,
                    accountNumber: dto.accountNumber ?? "",
                    iban: dto.iban,
                    beneficiary: dto.companyName,
                    isPrimary: true,
                  },
                ],
              }
            : undefined,
          wallet: { create: {} },
        },
      });
      await tx.user.create({
        data: {
          email: loginEmail,
          passwordHash,
          name: dto.ownerName,
          phone: dto.phone,
          roleId: agentRole.id,
          companyId: c.id,
        },
      });
      // Claim the wizard's uploaded documents (only unowned files can be claimed)
      const fileIds = [
        dto.tradeLicenseFileId,
        dto.ownerIdFileId,
        ...(dto.officePhotoFileIds ?? []),
        dto.logoFileId,
        dto.chequeFileId,
        dto.depositFileId,
      ].filter((x): x is string => !!x);
      if (fileIds.length > 0) {
        await tx.uploadedFile.updateMany({
          where: { id: { in: fileIds }, companyId: null },
          data: { companyId: c.id },
        });
      }
      await tx.auditLog.create({
        data: {
          actorLabel: `Registration (${loginEmail})`,
          action: "CREATE",
          module: "Companies",
          entityType: "Company",
          entityId: c.id,
          after: { code, type: "AGENT", verificationStatus: "PENDING", documents: fileIds.length },
          ip: meta.ip,
        },
      });
      return c;
    });

    return {
      companyId: company.id,
      applicationCode: company.code,
      verificationStatus: company.verificationStatus,
      loginEmail,
      ...(tempPassword ? { tempPassword } : {}),
    };
  }

  // ── registration: SUPPLIER ─────────────────────────────────────────────────
  async registerSupplier(dto: RegisterSupplierDto, meta: RequestMeta) {
    const loginEmail = dto.businessEmail.toLowerCase();
    await this.assertEmailFree(loginEmail);
    const { password, tempPassword } = await this.resolvePassword(dto.password);
    const passwordHash = await argon2.hash(password);
    const prefix = { HOTEL: "HTL", TRANSPORT: "TRN", CATERING: "CAT" }[dto.type];
    const code = await this.uniqueCompanyCode(() => `SUP-${prefix}-${this.serial4()}`);

    const supplierRole = await this.prisma.role.findUniqueOrThrow({ where: { key: "SUPPLIER" } });

    const company = await this.prisma.$transaction(async (tx) => {
      const c = await tx.company.create({
        data: {
          code,
          type: "SUPPLIER",
          name: dto.companyName,
          city: dto.city,
          email: loginEmail,
          phone: dto.phone,
          verificationStatus: "PENDING",
          supplierProfile: {
            create: {
              type: dto.type,
              crNumber: dto.crNumber,
              starRating: dto.starRating,
              district: dto.district,
              fleetSize: dto.fleetSize,
              primaryVehicleType: dto.primaryVehicleType,
              dailyMealCapacity: dto.dailyMealCapacity,
              halalCertBody: dto.halalCertBody,
            },
          },
          wallet: { create: {} },
        },
      });
      await tx.user.create({
        data: {
          email: loginEmail,
          passwordHash,
          name: dto.contactPerson,
          phone: dto.phone,
          roleId: supplierRole.id,
          companyId: c.id,
        },
      });
      const fileIds = [dto.tradeLicenseFileId, dto.certificationFileId].filter(
        (x): x is string => !!x,
      );
      if (fileIds.length > 0) {
        await tx.uploadedFile.updateMany({
          where: { id: { in: fileIds }, companyId: null },
          data: { companyId: c.id },
        });
      }
      await tx.auditLog.create({
        data: {
          actorLabel: `Registration (${loginEmail})`,
          action: "CREATE",
          module: "Companies",
          entityType: "Company",
          entityId: c.id,
          after: { code, type: "SUPPLIER", supplierType: dto.type, verificationStatus: "PENDING", documents: fileIds.length },
          ip: meta.ip,
        },
      });
      return c;
    });

    return {
      companyId: company.id,
      applicationCode: company.code,
      verificationStatus: company.verificationStatus,
      loginEmail,
      ...(tempPassword ? { tempPassword } : {}),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────
  private async issueTokens(payload: JwtPayload, meta: RequestMeta, rotatedFromId?: string) {
    const accessToken = await this.jwt.signAsync(payload as unknown as Record<string, unknown>);
    const refreshToken = randomBytes(48).toString("hex");
    const created = await this.prisma.refreshToken.create({
      data: {
        tokenHash: sha256(refreshToken),
        userId: payload.sub,
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 250),
      },
    });
    if (rotatedFromId) {
      await this.prisma.refreshToken.update({
        where: { id: rotatedFromId },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
    }
    return { accessToken, refreshToken };
  }

  private publicUser(user: {
    id: string;
    email: string;
    name: string;
    nameBn: string | null;
    companyId: string | null;
    role: { key: string; name: string; permissions: Array<{ permission: { key: string } }> };
    company: {
      id: string;
      code: string;
      type: "AGENT" | "SUPPLIER";
      name: string;
      nameBn: string | null;
      verificationStatus: string;
      rejectionReason: string | null;
      joinedAt: Date;
      agentProfile: { platformRating: Prisma.Decimal | null } | null;
      supplierProfile: { type: string } | null;
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      nameBn: user.nameBn,
      role: user.role.key,
      roleName: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
      companyId: user.companyId,
      company: user.company
        ? {
            id: user.company.id,
            code: user.company.code,
            type: user.company.type,
            name: user.company.name,
            nameBn: user.company.nameBn,
            verificationStatus: user.company.verificationStatus,
            rejectionReason: user.company.rejectionReason,
            joinedAt: user.company.joinedAt,
            supplierType: user.company.supplierProfile?.type ?? null,
            platformRating: user.company.agentProfile?.platformRating ?? null,
          }
        : null,
    };
  }

  private async assertEmailFree(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("An account with this email already exists");
  }

  private async resolvePassword(given?: string) {
    if (given) return { password: given, tempPassword: undefined };
    // UI wizard has no password step — issue a temporary credential, returned once.
    const tempPassword = `Tuba@${randomBytes(6).toString("base64url")}`;
    return { password: tempPassword, tempPassword };
  }

  private seasonYearCache?: number;
  private seasonYearSync(): number {
    return this.seasonYearCache ?? 1446;
  }
  async warmSeasonYear() {
    const s = await this.prisma.season.findFirst({ where: { isActive: true } });
    this.seasonYearCache = s?.hijriYear ?? 1446;
  }

  private serial4(): string {
    return String(1000 + Math.floor(Math.random() * 9000));
  }

  private async uniqueCompanyCode(gen: () => string): Promise<string> {
    await this.warmSeasonYear();
    for (let i = 0; i < 8; i++) {
      const code = gen();
      const exists = await this.prisma.company.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new ConflictException("Could not allocate a unique company code");
  }
}
