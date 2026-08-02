import { BadRequestException, Injectable } from "@nestjs/common";
import { FinanceEntryKind, FinanceEntryStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "./ledger.service";
import { ACCT } from "./accounts";
import { D, money } from "./money";

const INCOME_ACCT: Record<string, string> = {
  "Visa Services": "4001",
  "Hotel Services": "4002",
  "Transport Svcs": "4003",
  "Catering Svcs": "4004",
  "Full Package": "4005",
};
const EXPENSE_ACCT: Record<string, string> = {
  "Hotel Costs": "5001",
  "Transport Costs": "5002",
  "Catering Costs": "5003",
  Salaries: "6001",
  Overhead: "6002",
};

export interface CreateEntryDto {
  kind: FinanceEntryKind;
  ref?: string;
  partyName: string;
  category: string;
  amount: number;
  groupId?: string;
  status?: FinanceEntryStatus;
  date?: string;
  notes?: string;
}

/**
 * Income / Expenses screens. Creating an entry posts a balanced double-entry to
 * the GL so P&L / Balance Sheet stay real:
 *   INCOME  → Dr Cash|AR, Cr Revenue account (by category)
 *   EXPENSE → Dr Expense account (by category), Cr Cash|AP
 */
@Injectable()
export class FinanceEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async list(kind: FinanceEntryKind) {
    const rows = await this.prisma.financeEntry.findMany({
      where: { kind },
      include: { group: { select: { code: true } } },
      orderBy: { date: "desc" },
      take: 200,
    });
    return rows.map((e) => ({
      id: e.code,
      date: e.date,
      ref: e.ref,
      entity: e.partyName,
      cat: e.category,
      amt: money(e.amount),
      group: e.group?.code ?? "—",
      status: e.status,
    }));
  }

  async create(dto: CreateEntryDto, createdById?: string) {
    if (dto.amount <= 0) throw new BadRequestException("Amount must be positive");
    const amount = money(dto.amount);
    const date = dto.date ? new Date(dto.date) : new Date();
    const status = dto.status ?? (dto.kind === "INCOME" ? "PENDING" : "PAID");
    const prefix = dto.kind === "INCOME" ? "INC" : "EXP";
    const code = `${prefix}-${String(1000 + Math.floor(Math.random() * 9000))}`;

    let groupId: string | null = null;
    if (dto.groupId) {
      const g = await this.prisma.group.findFirst({ where: { OR: [{ id: dto.groupId }, { code: dto.groupId }] }, select: { id: true } });
      groupId = g?.id ?? null;
    }

    const entry = await this.prisma.financeEntry.create({
      data: {
        code,
        kind: dto.kind,
        date,
        ref: dto.ref,
        partyName: dto.partyName,
        category: dto.category,
        amount: D(amount),
        groupId,
        status,
        notes: dto.notes,
        createdById,
      },
    });

    // Post the matching GL journal
    if (dto.kind === "INCOME") {
      const revenue = INCOME_ACCT[dto.category] ?? "4005";
      const debitAcct = status === "RECEIVED" ? ACCT.CASH_MAIN : ACCT.AR_AGENTS;
      await this.ledger.postJournal(
        [
          { accountCode: debitAcct, debit: amount, description: `${dto.category} — ${dto.partyName}` },
          { accountCode: revenue, credit: amount, description: `Income — ${dto.category}` },
        ],
        { date, ref: entry.code, groupId, createdById },
      );
    } else {
      const expenseAcct = EXPENSE_ACCT[dto.category] ?? "6005";
      const creditAcct = status === "PAID" ? ACCT.CASH_MAIN : ACCT.AP_SUPPLIERS;
      await this.ledger.postJournal(
        [
          { accountCode: expenseAcct, debit: amount, description: `${dto.category} — ${dto.partyName}` },
          { accountCode: creditAcct, credit: amount, description: `Expense — ${dto.category}` },
        ],
        { date, ref: entry.code, groupId, createdById },
      );
    }
    return { id: entry.code, status: entry.status };
  }
}
