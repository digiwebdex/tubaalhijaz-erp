import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import {
  ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CurrencyCode, FinanceEntryKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { LedgerService } from "./ledger.service";
import { WalletService } from "./wallet.service";
import { CurrencyService } from "./currency.service";
import { InvoiceService } from "./invoice.service";
import { ReportsService } from "./reports.service";
import { FinanceEntriesService } from "./finance-entries.service";
import { money } from "./money";

class PayInvoiceDto {
  @IsOptional() @IsString() @MaxLength(40) method?: string;
  @IsOptional() @IsString() @MaxLength(80) bankRef?: string;
}
class EntryLineDto {
  @IsString() @MaxLength(200) desc!: string;
  @IsInt() @Min(1) qty!: number;
  @IsNumber() @Min(0) unit!: number;
}
class CreateEntryDto {
  @IsIn(["INCOME", "EXPENSE"]) kind!: FinanceEntryKind;
  @IsOptional() @IsString() @MaxLength(40) ref?: string;
  @IsString() @MaxLength(160) partyName!: string;
  @IsString() @MaxLength(60) category!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsIn(["RECEIVED", "PENDING", "OVERDUE", "PAID"]) status?: "RECEIVED" | "PENDING" | "OVERDUE" | "PAID";
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
class CreateInvoiceDto {
  @IsString() tenantId!: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsInt() @Min(0) dueInDays?: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => EntryLineDto) items!: EntryLineDto[];
  @IsOptional() @IsString() notes?: string;
}
class CreateMofaBillDto {
  @IsString() tenantId!: string;
  @IsString() groupId!: string;
  @Type(() => Number) @IsInt() @Min(1) qty!: number;
  @Type(() => Number) @IsNumber() @Min(0) rate!: number;
  @IsOptional() @IsInt() @Min(0) dueInDays?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
class SignMofaBillDto {
  @IsString() @MaxLength(160) approvalSign!: string;
  @IsOptional() @IsDateString() crDate?: string;
}
class UpsertRateDto {
  @IsIn(["USD", "BDT", "EUR", "GBP", "TRY"]) currency!: CurrencyCode;
  @IsNumber() @Min(0) rateToSar!: number;
}

/** Finance ERP (staff). Reads gated on FINANCIAL_REPORTS, writes on EDIT_FINANCIAL_RECORDS. */
@Controller("finance")
export class FinanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
    private readonly currency: CurrencyService,
    private readonly invoices: InvoiceService,
    private readonly reports: ReportsService,
    private readonly entries: FinanceEntriesService,
  ) {}

  @Get("dashboard")
  @RequirePermissions("FINANCIAL_REPORTS")
  dashboard() {
    return this.reports.dashboard();
  }

  // ── income / expenses ────────────────────────────────────────────────────────
  @Get("entries")
  @RequirePermissions("FINANCIAL_REPORTS")
  listEntries(@Query("kind") kind: string) {
    const k = (kind ?? "INCOME").toUpperCase();
    if (k !== "INCOME" && k !== "EXPENSE") throw new BadRequestException("kind must be income|expense");
    return this.entries.list(k as FinanceEntryKind);
  }

  @Post("entries")
  @RequirePermissions("EDIT_FINANCIAL_RECORDS")
  createEntry(@Body() dto: CreateEntryDto, @CurrentUser() user: AuthUser) {
    return this.entries.create(dto, user.sub);
  }

  // ── ledgers ──────────────────────────────────────────────────────────────────
  @Get("ledger/entities")
  @RequirePermissions("FINANCIAL_REPORTS")
  ledgerEntities(@Query("type") type: string) {
    return this.ledger.ledgerEntities(type === "supplier" ? "SUPPLIER" : "AGENT");
  }

  @Get("ledger")
  @RequirePermissions("FINANCIAL_REPORTS")
  getLedger(@Query("type") type: string, @Query("companyId") companyId?: string, @Query("groupId") groupId?: string) {
    if (type === "gl") return this.ledger.generalLedger({ groupId });
    if (!companyId) throw new BadRequestException("companyId is required for agent/supplier ledgers");
    return this.ledger.subLedger(type === "supplier" ? "SUPPLIER" : "AGENT", companyId);
  }

  // ── AR / AP ──────────────────────────────────────────────────────────────────
  @Get("ar")
  @RequirePermissions("FINANCIAL_REPORTS")
  ar() {
    return this.reports.arAging();
  }

  @Get("ap")
  @RequirePermissions("FINANCIAL_REPORTS")
  ap() {
    return this.reports.apAging();
  }

  // ── cash & bank (derived from GL cash accounts) ──────────────────────────────
  @Get("cash")
  @RequirePermissions("FINANCIAL_REPORTS")
  async cash() {
    const accounts = await this.prisma.chartAccount.findMany({ where: { code: { startsWith: "10" }, kind: "ASSET" }, orderBy: { code: "asc" } });
    const balances = await Promise.all(
      accounts.map(async (a) => {
        const agg = await this.prisma.ledgerEntry.aggregate({ where: { accountId: a.id, ledgerType: "GENERAL" }, _sum: { debit: true, credit: true } });
        return { name: a.name, code: a.code, balance: money(Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0)) };
      }),
    );
    const txns = await this.prisma.ledgerEntry.findMany({
      where: { ledgerType: "GENERAL", account: { code: { startsWith: "10" } } },
      include: { account: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 12,
    });
    return {
      accounts: balances,
      total: money(balances.reduce((s, b) => s + b.balance, 0)),
      transactions: txns.map((t) => ({
        date: t.date,
        desc: t.description,
        ref: t.ref,
        type: Number(t.debit) > 0 ? "cr" : "dr", // cash inflow (debit to cash) shows as credit movement to the bank
        amount: money(Number(t.debit) > 0 ? t.debit : t.credit),
      })),
    };
  }

  // ── multi-currency ───────────────────────────────────────────────────────────
  @Get("currencies")
  @RequirePermissions("FINANCIAL_REPORTS")
  currencies() {
    return this.currency.latestRates();
  }

  @Get("currencies/convert")
  @RequirePermissions("FINANCIAL_REPORTS")
  convert(@Query("amount") amount: string, @Query("from") from: string, @Query("to") to: string) {
    const CODES = new Set(["SAR", "USD", "BDT", "EUR", "GBP", "TRY"]);
    if (!CODES.has(from) || !CODES.has(to)) {
      throw new BadRequestException("from/to must be one of SAR, USD, BDT, EUR, GBP, TRY");
    }
    return this.currency.convert(Number(amount) || 0, from as CurrencyCode, to as CurrencyCode);
  }

  @Post("currencies")
  @RequirePermissions("EDIT_FINANCIAL_RECORDS")
  upsertRate(@Body() dto: UpsertRateDto) {
    return this.currency.upsertRate(dto.currency, dto.rateToSar);
  }

  // ── invoices / receipts ──────────────────────────────────────────────────────
  @Get("invoices")
  @RequirePermissions("FINANCIAL_REPORTS")
  listInvoices(@Query("status") status?: string, @Query("kind") kind?: string) {
    return this.invoices.list({ status, kind });
  }

  // T002-06 — MOFA Processing Bill Sheet (flag-gated). Not mutamer MOFA Number.
  @Get("mofa-processing-bills/status")
  @RequirePermissions("FINANCIAL_REPORTS")
  mofaBillStatus() {
    return {
      enabled: InvoiceService.mofaBillEnabled(),
      flag: "ENABLE_MOFA_PROCESSING_BILL",
      note: "MOFA Processing Bill (Qty×Rate) ≠ Passenger MOFA Number",
    };
  }

  @Get("mofa-processing-bills")
  @RequirePermissions("FINANCIAL_REPORTS")
  listMofaBills() {
    return this.invoices.list({ kind: "MOFA_PROCESSING" });
  }

  @Post("mofa-processing-bills")
  @RequirePermissions("EDIT_FINANCIAL_RECORDS")
  createMofaBill(@Body() dto: CreateMofaBillDto, @CurrentUser() user: AuthUser) {
    return this.invoices.createMofaProcessingBill(dto, user.sub);
  }

  @Patch("mofa-processing-bills/:id/sign")
  @RequirePermissions("EDIT_FINANCIAL_RECORDS")
  signMofaBill(
    @Param("id") id: string,
    @Body() dto: SignMofaBillDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.signMofaBill(id, dto, user.sub);
  }

  @Get("invoices/:id")
  @RequirePermissions("FINANCIAL_REPORTS")
  getInvoice(@Param("id") id: string) {
    return this.invoices.get(id);
  }

  @Post("invoices")
  @RequirePermissions("EDIT_FINANCIAL_RECORDS")
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.invoices.createManual(dto, user.sub);
  }

  @Patch("invoices/:id/pay")
  @RequirePermissions("EDIT_FINANCIAL_RECORDS")
  payInvoice(@Param("id") id: string, @Body() dto: PayInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.invoices.markPaid(id, { ...dto, createdById: user.sub });
  }

  @Get("receipts")
  @RequirePermissions("FINANCIAL_REPORTS")
  receipts() {
    return this.invoices.receipts();
  }

  // ── statements ────────────────────────────────────────────────────────────────
  @Get("statements")
  @RequirePermissions("FINANCIAL_REPORTS")
  statement(@Query("type") type: string, @Query("companyId") companyId: string) {
    if (!companyId) throw new BadRequestException("companyId is required");
    return this.ledger.subLedger(type === "supplier" ? "SUPPLIER" : "AGENT", companyId);
  }

  // ── P&L / Balance Sheet ──────────────────────────────────────────────────────
  @Get("pl")
  @RequirePermissions("FINANCIAL_REPORTS")
  pl(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reports.profitAndLoss(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get("bs")
  @RequirePermissions("FINANCIAL_REPORTS")
  bs(@Query("asOf") asOf?: string) {
    return this.reports.balanceSheet(asOf ? new Date(asOf) : undefined);
  }
}
