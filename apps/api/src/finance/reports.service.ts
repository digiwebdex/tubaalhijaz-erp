import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { money } from "./money";

interface AgingRow {
  entity: string;
  cur: number; // 0-30
  d30: number; // 31-60
  d60: number; // 61-90
  d90: number; // 90+
  total: number;
}

function bucketOf(ageDays: number): keyof Pick<AgingRow, "cur" | "d30" | "d60" | "d90"> {
  if (ageDays <= 30) return "cur";
  if (ageDays <= 60) return "d30";
  if (ageDays <= 90) return "d60";
  return "d90";
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private now() {
    return new Date();
  }

  // ── Accounts Receivable aging (from outstanding invoices) ──────────────────
  async arAging() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: ["OUTSTANDING", "OVERDUE"] } },
      include: { tenant: { select: { name: true } }, allocations: { select: { amount: true } } },
    });
    const byEntity = new Map<string, AgingRow>();
    const now = this.now().getTime();
    for (const inv of invoices) {
      const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
      const due = money(Number(inv.total) - paid);
      if (due <= 0) continue;
      const ageDays = Math.floor((now - inv.issueDate.getTime()) / 86_400_000);
      const name = inv.tenant.name;
      const row = byEntity.get(name) ?? { entity: name, cur: 0, d30: 0, d60: 0, d90: 0, total: 0 };
      row[bucketOf(ageDays)] += due;
      row.total += due;
      byEntity.set(name, row);
    }
    return this.summarize([...byEntity.values()]);
  }

  // ── Accounts Payable aging (FIFO over supplier sub-ledger) ─────────────────
  async apAging() {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { ledgerType: "SUPPLIER", companyId: { not: null } },
      include: { company: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    // group by supplier
    const bySupplier = new Map<string, { name: string; entries: Array<{ date: Date; debit: number; credit: number }> }>();
    for (const r of rows) {
      const key = r.companyId!;
      const g = bySupplier.get(key) ?? { name: r.company?.name ?? key, entries: [] };
      g.entries.push({ date: r.date, debit: Number(r.debit), credit: Number(r.credit) });
      bySupplier.set(key, g);
    }
    const now = this.now().getTime();
    const result: AgingRow[] = [];
    for (const g of bySupplier.values()) {
      // FIFO: apply debits (payments) against oldest credits (payables)
      const openCredits: Array<{ date: Date; amount: number }> = [];
      let paymentPool = 0;
      for (const e of g.entries) {
        if (e.credit > 0) openCredits.push({ date: e.date, amount: e.credit });
        if (e.debit > 0) paymentPool += e.debit;
      }
      for (const c of openCredits) {
        if (paymentPool <= 0) break;
        const applied = Math.min(paymentPool, c.amount);
        c.amount -= applied;
        paymentPool -= applied;
      }
      const row: AgingRow = { entity: g.name, cur: 0, d30: 0, d60: 0, d90: 0, total: 0 };
      for (const c of openCredits) {
        if (c.amount <= 0.005) continue;
        const ageDays = Math.floor((now - c.date.getTime()) / 86_400_000);
        row[bucketOf(ageDays)] += money(c.amount);
        row.total += money(c.amount);
      }
      if (row.total > 0) result.push(row);
    }
    return this.summarize(result);
  }

  private summarize(rows: AgingRow[]) {
    const totals = rows.reduce(
      (t, r) => ({
        cur: t.cur + r.cur,
        d30: t.d30 + r.d30,
        d60: t.d60 + r.d60,
        d90: t.d90 + r.d90,
        total: t.total + r.total,
      }),
      { cur: 0, d30: 0, d60: 0, d90: 0, total: 0 },
    );
    return {
      entities: rows
        .sort((a, b) => b.total - a.total)
        .map((r) => ({ entity: r.entity, cur: money(r.cur), d30: money(r.d30), d60: money(r.d60), d90: money(r.d90), total: money(r.total) })),
      totals: {
        cur: money(totals.cur),
        d30: money(totals.d30),
        d60: money(totals.d60),
        d90: money(totals.d90),
        total: money(totals.total),
      },
    };
  }

  // ── GL aggregation helper ───────────────────────────────────────────────────
  private async glByAccount(where: Prisma.Sql) {
    return this.prisma.$queryRaw<
      Array<{ code: string; name: string; kind: string; plsection: string | null; debit: Prisma.Decimal; credit: Prisma.Decimal }>
    >`
      SELECT a.code, a.name, a.kind, a."plSection" AS plsection,
             COALESCE(SUM(le.debit),0) AS debit, COALESCE(SUM(le.credit),0) AS credit
      FROM "ChartAccount" a
      JOIN "LedgerEntry" le ON le."accountId" = a.id AND le."ledgerType" = 'GENERAL'
      WHERE ${where}
      GROUP BY a.id, a.code, a.name, a.kind, a."plSection"
      ORDER BY a.code ASC
    `;
  }

  // ── Profit & Loss (real GL aggregation over a period) ──────────────────────
  async profitAndLoss(from?: Date, to?: Date) {
    const start = from ?? new Date(0); // all-time by default (a period can be passed)
    const end = to ?? this.now();
    const acc = await this.glByAccount(Prisma.sql`le.date >= ${start} AND le.date <= ${end}`);

    const line = (r: (typeof acc)[number], net: number) => ({ code: r.code, name: r.name, amount: money(net) });
    const revenue = acc.filter((r) => r.kind === "REVENUE").map((r) => line(r, Number(r.credit) - Number(r.debit)));
    const cogs = acc.filter((r) => r.kind === "EXPENSE" && r.plsection === "COGS").map((r) => line(r, Number(r.debit) - Number(r.credit)));
    const opex = acc.filter((r) => r.kind === "EXPENSE" && r.plsection === "OPEX").map((r) => line(r, Number(r.debit) - Number(r.credit)));

    const totalRevenue = money(revenue.reduce((s, l) => s + l.amount, 0));
    const totalCogs = money(cogs.reduce((s, l) => s + l.amount, 0));
    const totalOpex = money(opex.reduce((s, l) => s + l.amount, 0));
    const grossProfit = money(totalRevenue - totalCogs);
    const ebitda = money(grossProfit - totalOpex);
    const netProfit = ebitda; // depreciation/interest/zakat post as their own accounts when present

    return {
      period: { from: start, to: end },
      revenue,
      cogs,
      opex,
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMargin: totalRevenue ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0,
      totalOpex,
      ebitda,
      netProfit,
      netMargin: totalRevenue ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0,
    };
  }

  // ── Balance Sheet (cumulative GL balances up to a date) ────────────────────
  async balanceSheet(asOf?: Date) {
    const at = asOf ?? this.now();
    const acc = await this.glByAccount(Prisma.sql`le.date <= ${at}`);

    const assets = acc.filter((r) => r.kind === "ASSET").map((r) => ({ code: r.code, name: r.name, amount: money(Number(r.debit) - Number(r.credit)) }));
    const liabilities = acc.filter((r) => r.kind === "LIABILITY").map((r) => ({ code: r.code, name: r.name, amount: money(Number(r.credit) - Number(r.debit)) }));
    const equityAccts = acc.filter((r) => r.kind === "EQUITY").map((r) => ({ code: r.code, name: r.name, amount: money(Number(r.credit) - Number(r.debit)) }));

    // current-period profit rolls into equity
    const revenue = acc.filter((r) => r.kind === "REVENUE").reduce((s, r) => s + (Number(r.credit) - Number(r.debit)), 0);
    const expenses = acc.filter((r) => r.kind === "EXPENSE").reduce((s, r) => s + (Number(r.debit) - Number(r.credit)), 0);
    const currentProfit = money(revenue - expenses);

    const totalAssets = money(assets.reduce((s, a) => s + a.amount, 0));
    const totalLiabilities = money(liabilities.reduce((s, l) => s + l.amount, 0));
    const totalEquity = money(equityAccts.reduce((s, e) => s + e.amount, 0) + currentProfit);
    const liabPlusEquity = money(totalLiabilities + totalEquity);

    return {
      asOf: at,
      assets,
      liabilities,
      equity: [...equityAccts, { code: "—", name: "Current Period Profit", amount: currentProfit }],
      totalAssets,
      totalLiabilities,
      totalEquity,
      liabilitiesPlusEquity: liabPlusEquity,
      balanced: Math.abs(totalAssets - liabPlusEquity) < 1,
    };
  }

  // ── Finance dashboard KPIs ──────────────────────────────────────────────────
  async dashboard() {
    const [bs, pl, ar, ap] = await Promise.all([
      this.balanceSheet(),
      this.profitAndLoss(),
      this.arAging(),
      this.apAging(),
    ]);
    const cash = money(bs.assets.filter((a) => a.code.startsWith("10")).reduce((s, a) => s + a.amount, 0));
    return {
      cashPosition: cash,
      accountsReceivable: ar.totals.total,
      accountsPayable: ap.totals.total,
      ytdNetProfit: pl.netProfit,
      netMargin: pl.netMargin,
      totalRevenue: pl.totalRevenue,
      arAging: ar.totals,
      balanced: bs.balanced,
    };
  }
}
