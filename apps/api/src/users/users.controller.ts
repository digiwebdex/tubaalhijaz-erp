import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

class CreateUserDto {
  @IsEmail() @MaxLength(160) email!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) nameBn?: string;
  @IsString() @MaxLength(40) roleKey!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) password?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) nameBn?: string;
  @IsOptional() @IsString() @MaxLength(40) roleKey?: string;
  @IsOptional() @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"]) status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

class SetRolePermissionsDto {
  @IsArray() @ArrayUnique() @IsString({ each: true })
  permissions!: string[];
}

const userSelect = {
  id: true,
  code: true,
  email: true,
  name: true,
  nameBn: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { key: true, name: true } },
  company: { select: { id: true, code: true, name: true, type: true } },
} as const;

/** Super Admin "User & Role Management" — backed by the Phase-3 RBAC tables. */
@Controller()
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Users ──────────────────────────────────────────────────────────────────
  @Get("users")
  @RequirePermissions("MANAGE_USERS")
  listUsers() {
    return this.prisma.user.findMany({ select: userSelect, orderBy: { createdAt: "asc" } });
  }

  @Post("users")
  @RequirePermissions("MANAGE_USERS")
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const role = await this.prisma.role.findUnique({ where: { key: dto.roleKey } });
    if (!role) throw new BadRequestException(`Unknown role: ${dto.roleKey}`);
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new BadRequestException("An account with this email already exists");
    }
    const tempPassword = dto.password ?? `Tuba@${randomBytes(6).toString("base64url")}`;
    const created = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        nameBn: dto.nameBn,
        phone: dto.phone,
        companyId: dto.companyId,
        roleId: role.id,
        passwordHash: await argon2.hash(tempPassword),
      },
      select: userSelect,
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        action: "CREATE",
        module: "Users",
        entityType: "User",
        entityId: created.id,
        after: { email, role: dto.roleKey },
        ip: req.ip,
      },
    });
    return { ...created, ...(dto.password ? {} : { tempPassword }) };
  }

  @Patch("users/:id")
  @RequirePermissions("MANAGE_USERS")
  async updateUser(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) throw new NotFoundException("User not found");
    if (id === actor.sub && (dto.status === "INACTIVE" || dto.status === "SUSPENDED")) {
      throw new ForbiddenException("You cannot deactivate your own account");
    }
    let roleId: string | undefined;
    if (dto.roleKey) {
      const role = await this.prisma.role.findUnique({ where: { key: dto.roleKey } });
      if (!role) throw new BadRequestException(`Unknown role: ${dto.roleKey}`);
      roleId = role.id;
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, nameBn: dto.nameBn, status: dto.status, ...(roleId ? { roleId } : {}) },
      select: userSelect,
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        action: "UPDATE",
        module: "Users",
        entityType: "User",
        entityId: id,
        before: { role: existing.role.key, status: existing.status, name: existing.name },
        after: dto as object,
        ip: req.ip,
      },
    });
    return updated;
  }

  // ── Roles & permissions matrix ─────────────────────────────────────────────
  @Get("roles")
  @RequirePermissions("MANAGE_USERS")
  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: { key: "asc" },
    });
    return roles.map((r) => ({
      key: r.key,
      name: r.name,
      nameBn: r.nameBn,
      users: r._count.users,
      permissions: r.permissions.map((p) => p.permission.key),
    }));
  }

  @Get("permissions")
  @RequirePermissions("MANAGE_USERS")
  listPermissions() {
    return this.prisma.permission.findMany({
      select: { key: true, name: true, nameBn: true },
      orderBy: { key: "asc" },
    });
  }

  /** Replace a role's permission set (the Super Admin matrix toggles). */
  @Patch("roles/:key/permissions")
  @RequirePermissions("MANAGE_USERS")
  async setRolePermissions(
    @Param("key") key: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    if (key === "SUPER_ADMIN") {
      throw new ForbiddenException("SUPER_ADMIN permissions are fixed (lock-out protection)");
    }
    const role = await this.prisma.role.findUnique({
      where: { key },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException(`Unknown role: ${key}`);
    const perms = await this.prisma.permission.findMany({ where: { key: { in: dto.permissions } } });
    if (perms.length !== dto.permissions.length) {
      const known = new Set(perms.map((p) => p.key));
      throw new BadRequestException(
        `Unknown permission(s): ${dto.permissions.filter((p) => !known.has(p)).join(", ")}`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.sub,
          action: "UPDATE",
          module: "Users",
          entityType: "Role",
          entityId: role.id,
          before: { permissions: role.permissions.map((p) => p.permission.key) },
          after: { permissions: dto.permissions },
          ip: req.ip,
        },
      }),
    ]);
    // Note: the PermissionsGuard cache means changes take effect within ≤60s.
    return { key, permissions: dto.permissions };
  }
}
