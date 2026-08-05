import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { EnquiryType } from "@prisma/client";
import { Public } from "../common/decorators/public.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PrismaService } from "../prisma/prisma.service";

class CreateEnquiryDto {
  @IsIn(["AGENT", "SUPPLIER", "PILGRIM", "OTHER"]) type!: EnquiryType;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsEmail() @MaxLength(160) email!: string;
  @IsString() @MinLength(2) @MaxLength(200) subject!: string;
  @IsString() @MinLength(2) @MaxLength(4000) message!: string;
}

/** Public lead capture (marketing Contact form) + staff leads inbox. */
@Controller()
export class EnquiriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("enquiries")
  async create(@Body() dto: CreateEnquiryDto) {
    await this.prisma.enquiry.create({
      data: {
        type: dto.type,
        name: dto.name.trim(),
        company: dto.company?.trim() || null,
        email: dto.email.toLowerCase().trim(),
        subject: dto.subject.trim(),
        message: dto.message.trim(),
      },
    });
    return { ok: true, message: "Thank you — your enquiry has been received. Our team will be in touch shortly." };
  }

  @Get("enquiries")
  @RequirePermissions("MANAGE_SYSTEM_SETTINGS")
  list() {
    return this.prisma.enquiry.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  }

  @Patch("enquiries/:id/handled")
  @RequirePermissions("MANAGE_SYSTEM_SETTINGS")
  markHandled(@Param("id") id: string) {
    return this.prisma.enquiry.update({ where: { id }, data: { handled: true } });
  }
}
