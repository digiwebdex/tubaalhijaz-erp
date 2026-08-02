import { BadRequestException, Injectable } from "@nestjs/common";
import { LedgerType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { D, money } from "./money";

export interface JournalLine {
  accountCode: string; // ChartAccount.code
  debit?: number;
  credit?: number;
  description?: string;
}

export interface LedgerRow {
  id: string;
  date: string;
  description: string;
  ref: string | null;
  account?: { code: string; name: string } | null;
  debit: number;
  credit: number;
  balance: number; // running balance (window function) — sub-ledgers only
}

export interface LedgerView {
  entity: { companyId: string; name: string } | null;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  entries: LedgerRow[]; // chronological ascending, each with running balance
}

/**
 * Append-only ledger engine.
 *   • AGENT / SUPPLIER sub-ledgers: per-company running balance = Σ(credit − debit),
 *     computed at read time with a SQL window function — NO stored balance column,
 *     so it can never drift.
 *   • GENERAL ledger: double-entry postings against the chart of accounts;
 *     `postJournal` refuses to write unless Σdebit == Σcredit.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  // ── posting ────────────────────────────────────────────────────────────────
  /** Post a balanced GL journal (GENERAL ledger). Returns the created rows. */
  async postJournal(
    lines: JournalLine[],
    opts: { date?: Date; ref?: string; groupId?: string | null; createdById?: string | null },
    tx?: Prisma.TransactionClient,
  ) {
    if (lines.length < 2) throw new BadRequestException("A journal needs at least two lines");
    const totalDr = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCr = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.round(totalDr * 100) !== Math.round(totalCr * 100)) {
      throw new BadRequestException(
        `Unbalanced journal: debits ${totalDr} ≠ credits ${totalCr}`,
      );
    }
    const client = tx ?? this.prisma;
    const codes = [...new Set(lines.map((l) => l.accountCode))];
    const accounts = await client.chartAccount.findMany({ where: { code: { in: codes } } });
    const byCode = new Map(accounts.map((a) => [a.code, a.id]));
    const missing = codes.filter((c) => !byCode.has(c));
    if (missing.length) throw new BadRequestException(`Unknown GL account(s): ${missing.join(", ")}`);

    const date = opts.date ?? new Date();
    return client.ledgerEntry.createMany({
      data: lines.map((l) => ({
        ledgerType: "GENERAL" as LedgerType,
        accountId: byCode.get(l.accountCode)!,
        groupId: opts.groupId ?? null,
        date,
        description: l.description ?? "",
        ref: opts.ref ?? null,
        debit: D(l.debit ?? 0),
        credit: D(l.credit ?? 0),
        createdById: opts.createdById ?? null,
      })),
    });
  }

  /** Append a single sub-ledger (AGENT|SUPPLIER) entry. */
  async postSubLedger(
    ledgerType: "AGENT" | "SUPPLIER",
    companyId: string,
    entry: { date?: Date; description: string; ref?: string; debit?: number; credit?: number; groupId?: string | null; createdById?: string | null },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return client.ledgerEntry.create({
      data: {
        ledgerType,
        companyId,
        groupId: entry.groupId ?? null,
        date: entry.date ?? new Date(),
        description: entry.description,
        ref: entry.ref ?? null,
        debit: D(entry.debit ?? 0),
        credit: D(entry.credit ?? 0),
        createdById: entry.createdById ?? null,
      },
    });
  }

  // ── sub-ledger read (running balance via window function) ───────────────────
  async subLedger(ledgerType: "AGENT" | "SUPPLIER", companyId: string): Promise<LedgerView> {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; date: Date; description: string; ref: string | null; debit: Prisma.Decimal; credit: Prisma.Decimal; balance: Prisma.Decimal }>
    >`
      SELECT id, date, description, ref, debit, credit,
             SUM(credit - debit) OVER (ORDER BY date ASC, "createdAt" ASC
                                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance
      FROM "LedgerEntry"
      WHERE "ledgerType" = ${ledgerType}::"LedgerType" AND "companyId" = ${companyId}
      ORDER BY date ASC, "createdAt" ASC
    `;
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    const entries: LedgerRow[] = rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      description: r.description,
      ref: r.ref,
      debit: money(r.debit),
      credit: money(r.credit),
      balance: money(r.balance),
    }));
    const totalDebits = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredits = entries.reduce((s, e) => s + e.credit, 0);
    return {
      entity: company ? { companyId, name: company.name } : null,
      openingBalance: 0,
      totalDebits: money(totalDebits),
      totalCredits: money(totalCredits),
      closingBalance: entries.length ? entries[entries.length - 1].balance : 0,
      entries,
    };
  }

  // ── general ledger read (double-entry, by account) ──────────────────────────
  async generalLedger(filters: { accountCode?: string; groupId?: string; limit?: number }): Promise<LedgerRow[]> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        ledgerType: "GENERAL",
        ...(filters.accountCode ? { account: { code: filters.accountCode } } : {}),
        ...(filters.groupId ? { groupId: filters.groupId } : {}),
      },
      include: { account: { select: { code: true, name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: filters.limit ?? 200,
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      description: r.description,
      ref: r.ref,
      account: r.account ? { code: r.account.code, name: r.account.name } : null,
      debit: money(r.debit),
      credit: money(r.credit),
      balance: 0, // GL rows are double-entry; no per-line running balance
    }));
  }

  /** Distinct entities that have sub-ledger movements — for the entity dropdowns. */
  async ledgerEntities(ledgerType: "AGENT" | "SUPPLIER") {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { ledgerType, companyId: { not: null } },
      distinct: ["companyId"],
      select: { companyId: true, company: { select: { name: true, code: true } } },
    });
    return rows
      .filter((r) => r.company)
      .map((r) => ({ companyId: r.companyId!, name: r.company!.name, code: r.company!.code }));
  }
}
