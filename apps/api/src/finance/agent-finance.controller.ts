import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req,
  UploadedFile as UploadedFileDec, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { PaymentSlipType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { WalletService } from "./wallet.service";
import { LedgerService } from "./ledger.service";
import { PaymentSlipService } from "./payment-slip.service";
import { money } from "./money";

class ReviewSlipDto {
  @IsIn(["CONFIRMED", "REJECTED"]) decision!: "CONFIRMED" | "REJECTED";
}
class SlipDto {
  @IsIn(["BANK_TRANSFER", "CHEQUE", "SADAD", "WIRE", "ONLINE_BANKING"]) type!: PaymentSlipType;
  // multipart fields arrive as strings — coerce before @IsNumber validates
  @Type(() => Number) @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(80) bank?: string;
  @IsOptional() @IsString() @MaxLength(60) transferRef?: string;
  @IsOptional() @IsString() paymentDate?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

const SOURCE_CATEGORY: Record<string, string> = {
  hotelBooking: "hotel",
  transportBooking: "transport",
  cateringBooking: "catering",
  visaRequest: "visa",
};

/** Agent Portal · Finance module. All routes scoped to the caller's own company. */
@Controller("agent-finance")
export class AgentFinanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
    private readonly slips: PaymentSlipService,
  ) {}

  private companyId(user: AuthUser): string {
    if (user.companyType !== "AGENT" || !user.companyId) {
      throw new ForbiddenException("Agent portal only");
    }
    return user.companyId;
  }

  @Get("wallet")
  wallet_(@CurrentUser() user: AuthUser) {
    return this.wallet.balance(this.companyId(user));
  }

  @Get("wallet/transactions")
  txns(@CurrentUser() user: AuthUser) {
    return this.wallet.transactions(this.companyId(user));
  }

  @Get("wallet/pending")
  async pending(@CurrentUser() user: AuthUser) {
    const companyId = this.companyId(user);
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId: companyId, status: { in: ["OUTSTANDING", "OVERDUE"] } },
      include: { group: { select: { code: true } } },
      orderBy: { dueDate: "asc" },
    });
    return invoices.map((inv) => ({
      ref: inv.code,
      desc: `${inv.group?.code ? inv.group.code + " — " : ""}${inv.notes ?? "Services invoice"}`,
      amount: money(inv.total),
      due: inv.dueDate,
      category: (inv.sourceType && SOURCE_CATEGORY[inv.sourceType]) || "hotel",
    }));
  }

  // ── payment slips (agent) ─────────────────────────────────────────────────────
  @Post("payment-slips")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  createSlip(
    @Body() dto: SlipDto,
    @UploadedFileDec() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.slips.create(this.companyId(user), { ...dto, amount: Number(dto.amount) }, file);
  }

  @Get("payment-slips")
  listSlips(@CurrentUser() user: AuthUser) {
    return this.slips.list(this.companyId(user));
  }

  // ── statement (own sub-ledger) ────────────────────────────────────────────────
  @Get("statement")
  statement(@CurrentUser() user: AuthUser) {
    return this.ledger.subLedger("AGENT", this.companyId(user));
  }

  // ── financial documents hub ───────────────────────────────────────────────────
  @Get("documents")
  async documents(@CurrentUser() user: AuthUser) {
    const companyId = this.companyId(user);
    const [invoices, files] = await Promise.all([
      this.prisma.invoice.findMany({ where: { tenantId: companyId }, include: { group: { select: { code: true } } }, orderBy: { issueDate: "desc" }, take: 50 }),
      this.prisma.uploadedFile.findMany({ where: { companyId, kind: { in: ["VOUCHER", "INVOICE"] } }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    const invDocs = invoices.map((inv) => ({
      id: inv.id,
      type: "invoice",
      label: `Invoice — ${inv.group?.code ?? inv.code}`,
      ref: inv.code,
      amount: `SAR ${money(inv.total).toLocaleString()}`,
      date: inv.issueDate,
      due: inv.dueDate,
      status: inv.status.toLowerCase(),
      fileId: inv.fileId,
      size: "0.4 MB",
    }));
    const fileDocs = files
      .filter((f) => f.kind === "VOUCHER")
      .map((f) => ({
        id: f.id,
        type: "hotel",
        label: f.fileName.replace(/\.pdf$/i, ""),
        ref: f.fileName.replace(/\.pdf$/i, ""),
        amount: null as string | null,
        date: f.createdAt,
        due: null as Date | null,
        status: "confirmed",
        fileId: f.id,
        size: `${(f.sizeBytes / 1024 / 1024).toFixed(1)} MB`,
      }));
    return [...invDocs, ...fileDocs];
  }

  // ── staff: review a payment slip → credit wallet ──────────────────────────────
  @Get("payment-slips/review-queue")
  @RequirePermissions("EDIT_FINANCIAL_RECORDS")
  async reviewQueue() {
    const rows = await this.prisma.paymentSlip.findMany({
      where: { status: "PENDING" },
      include: { company: { select: { code: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((s) => ({
      id: s.id,
      ref: s.code,
      company: s.company.name,
      companyCode: s.company.code,
      amount: money(s.amount),
      type: s.type,
      transferRef: s.transferRef,
      date: s.paymentDate,
    }));
  }

  @Patch("payment-slips/:id/review")
  @RequirePermissions("EDIT_FINANCIAL_RECORDS")
  review(@Param("id") id: string, @Body() dto: ReviewSlipDto, @CurrentUser() user: AuthUser) {
    return this.slips.review(id, dto.decision, user.sub);
  }
}
