import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "../finance/reports.service";
import { OpsService } from "../ops/ops.service";
import { biometricBacklogWhere, NOT_ISSUED_PIPELINE_STATES } from "../ops/visa-desk.util";
import { DashboardCache } from "./dashboard-cache.service";

const num = (d: unknown) => (d == null ? 0 : Math.round(Number(d) * 100) / 100);
const ACTIVE_GROUP = ["IN_PROGRESS", "VERIFIED"] as const;
const OPEN_SERVICE = ["REQUESTED", "ASSIGNED", "CONFIRMED", "VOUCHER_ISSUED"] as const;
const LIVE_DISPATCH = ["ASSIGNED", "EN_ROUTE", "DELAYED"] as const;
/** T002-09 §12 — "arriving ≤7d still not issued" horizon. */
const ARRIVING_SOON_DAYS = 7;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * Real dashboard aggregations — all via aggregate SQL (Prisma count/aggregate/
 * groupBy + $queryRaw for time-series); nothing pulls a full table into JS.
 * Finance figures reuse the audited ReportsService so the dashboards agree with
 * Finance ERP to the riyal. Heavy rollups are Redis-cached (short TTL).
 */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    /** Named `opsSvc` so it does not collide with the public `ops()` dashboard method. */
    private readonly opsSvc: OpsService,
    private readonly cache: DashboardCache,
  ) {}

  private yearStart() { return new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)); }
  private monthStart() { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); }
  private dayRange(date?: string) {
    const base = date ? new Date(date + "T00:00:00.000Z") : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    return { gte: base, lt: new Date(base.getTime() + 86_400_000) };
  }

  // ── CEO ──────────────────────────────────────────────────────────────────────
  ceo() {
    return this.cache.wrap("ceo", 60, async () => {
      const [pl, ar, activeGroups, paxAgg, airlines, overdue, activeAgents, revenueTrend, topAgents] =
        await Promise.all([
          this.reports.profitAndLoss(this.yearStart()),
          this.reports.arAging(),
          this.prisma.group.count({ where: { status: { in: [...ACTIVE_GROUP] } } }),
          this.prisma.group.aggregate({ _sum: { paxCount: true }, where: { status: { in: [...ACTIVE_GROUP] } } }),
          this.prisma.flightInfo.findMany({ where: { direction: "ARRIVAL" }, distinct: ["airline"], select: { airline: true } }),
          this.prisma.invoice.count({ where: { status: { in: ["OUTSTANDING", "OVERDUE"] } } }),
          this.prisma.company.count({ where: { type: "AGENT", verificationStatus: "VERIFIED" } }),
          this.monthlyRevenue(8),
          this.topAgentsByRevenue(5),
        ]);
      return {
        kpis: {
          ytdRevenue: pl.totalRevenue, netProfit: pl.netProfit, netMargin: pl.netMargin,
          activeGroups, pax: paxAgg._sum.paxCount ?? 0, airlines: airlines.length,
          arOutstanding: ar.totals.total, overdueInvoices: overdue, activeAgents,
        },
        revenueTrend, topAgents,
      };
    });
  }

  // ── Operations ───────────────────────────────────────────────────────────────
  ops() {
    return this.cache.wrap("ops", 30, async () => {
      const today = this.dayRange();
      const [groupsActive, arrToday, depToday, completedToday, delayed, hourly, pending] = await Promise.all([
        this.prisma.group.count({ where: { status: { in: [...ACTIVE_GROUP] } } }),
        this.prisma.flightInfo.count({ where: { direction: "ARRIVAL", scheduledAt: today } }),
        this.prisma.flightInfo.count({ where: { direction: "DEPARTURE", scheduledAt: today } }),
        this.prisma.dispatchOrder.count({ where: { status: "COMPLETED", updatedAt: today } }),
        this.prisma.dispatchOrder.count({ where: { status: "DELAYED" } }),
        this.hourlyFlights(),
        this.openServiceCount(),
      ]);
      return {
        kpis: { groupsActive, arrivalsToday: arrToday, departuresToday: depToday, completedToday, delayedDispatch: delayed, pendingTasks: pending.total },
        hourly, departments: pending.byType,
      };
    });
  }

  // ── Visa & Compliance (T002-09, architecture §12) ────────────────────────────
  /**
   * Read-only rollup of the widgets architecture §12 approves. Every visa figure
   * is delegated to `OpsService.mutamerVisaDesk` and every day-85 figure to
   * `OpsService.longStays`, so the dashboard can never drift from the Visa Desk
   * and Long Stay screens it drills into. Only the backlog/gate counts that no
   * existing endpoint exposes are queried here, and they read existing columns.
   */
  visa() {
    return this.cache.wrap("visa", 30, async () => {
      const until = new Date();
      until.setUTCDate(until.getUTCDate() + ARRIVING_SOON_DAYS);
      until.setUTCHours(23, 59, 59, 999);
      const notIssued = [...NOT_ISSUED_PIPELINE_STATES];

      const [desk, arriving, biometricNotIssued, arrivingGroups, longStays, gates] = await Promise.all([
        this.opsSvc.mutamerVisaDesk({ pageSize: 1 }),
        this.opsSvc.mutamerVisaDesk({ pageSize: 1, arrivingWithinDays: ARRIVING_SOON_DAYS }),
        this.prisma.passenger.count({ where: biometricBacklogWhere() as never }),
        this.prisma.group.count({
          where: { departDate: { lte: until }, passengers: { some: { visaPipelineStatus: { in: notIssued as never } } } },
        }),
        this.opsSvc.longStays(),
        this.gateReadiness(),
      ]);

      const sumNotIssued = (c: Record<string, number>) =>
        notIssued.reduce((s, k) => s + (c[k] ?? 0), 0);

      const ls = longStays.reduce(
        (a, l) => {
          a.total++;
          if (l.hostComplete) a.hostComplete++;
          if (l.day85.redCard) a.redCards++;
          const stage = l.day85.stage as keyof typeof a.stages;
          if (stage in a.stages) a.stages[stage]++;
          return a;
        },
        {
          total: 0,
          hostComplete: 0,
          redCards: 0,
          stages: { NOT_TRACKED: 0, TRACKING: 0, APPROACHING: 0, DUE: 0, ESCALATED: 0, RESOLVED: 0 },
        },
      );

      return {
        pipeline: desk.counts,
        mofa: {
          issuedTotal: desk.mofaCompleteness.issuedTotal,
          issuedWithMofa: desk.mofaCompleteness.issuedWithMofa,
          completePercent: desk.mofaCompleteness.percent,
          pendingPercent: Math.round((100 - desk.mofaCompleteness.percent) * 10) / 10,
          note: desk.mofaCompleteness.note,
        },
        backlog: {
          notIssued: sumNotIssued(desk.counts),
          biometricNotIssued,
          rejectedOpen: desk.counts.REJECTED,
          arrivingSoon: {
            days: ARRIVING_SOON_DAYS,
            mutamersNotIssued: sumNotIssued(arriving.counts),
            groups: arrivingGroups,
          },
        },
        longStay: {
          total: ls.total,
          tracking: ls.stages.TRACKING,
          approaching: ls.stages.APPROACHING,
          due: ls.stages.DUE,
          escalated: ls.stages.ESCALATED,
          resolved: ls.stages.RESOLVED,
          redCards: ls.redCards,
          hostComplete: ls.hostComplete,
          hostCompletePercent: pct(ls.hostComplete, ls.total),
        },
        gates,
        sop: desk.sop,
      };
    });
  }

  /** T002-09 §12 `gateVisa` board — readiness rollup over the T001-09 gate columns. */
  private async gateReadiness() {
    const active = { status: { in: [...ACTIVE_GROUP] } } as Prisma.GroupWhereInput;
    const [activeGroups, ready, waitingVisa, waitingPackage, waitingPayment, waitingBill] = await Promise.all([
      this.prisma.group.count({ where: active }),
      this.prisma.group.count({
        where: { ...active, gateVisa: true, gatePackage: true, gatePayment: true, gateBill: true },
      }),
      this.prisma.group.count({ where: { ...active, gateVisa: false } }),
      this.prisma.group.count({ where: { ...active, gatePackage: false } }),
      this.prisma.group.count({ where: { ...active, gatePayment: false } }),
      this.prisma.group.count({ where: { ...active, gateBill: false } }),
    ]);
    return { activeGroups, ready, waitingVisa, waitingPackage, waitingPayment, waitingBill };
  }

  // ── Finance ──────────────────────────────────────────────────────────────────
  finance() {
    return this.cache.wrap("finance", 60, async () => {
      const [pl, ar, ap, bs, cashTrend] = await Promise.all([
        this.reports.profitAndLoss(this.yearStart()),
        this.reports.arAging(),
        this.reports.apAging(),
        this.reports.balanceSheet(),
        this.monthlyRevenue(8),
      ]);
      const cash = bs.assets.filter((a) => a.code.startsWith("10")).reduce((s, a) => s + a.amount, 0);
      return {
        kpis: {
          cashPosition: num(cash), accountsReceivable: ar.totals.total, accountsPayable: ap.totals.total,
          netProfit: pl.netProfit, netMargin: pl.netMargin, totalRevenue: pl.totalRevenue,
        },
        arAging: [
          { bucket: "0–30 days", amount: ar.totals.cur }, { bucket: "31–60 days", amount: ar.totals.d30 },
          { bucket: "61–90 days", amount: ar.totals.d60 }, { bucket: "90+ days", amount: ar.totals.d90 },
        ],
        cashTrend, arEntities: ar.entities.slice(0, 6),
      };
    });
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  dispatch() {
    return this.cache.wrap("dispatch", 30, async () => {
      const today = this.dayRange();
      const [active, deliveredToday, paxMoving, delayed, orders] = await Promise.all([
        this.prisma.dispatchOrder.count({ where: { status: { in: [...LIVE_DISPATCH] } } }),
        this.prisma.dispatchOrder.count({ where: { status: "COMPLETED", updatedAt: today } }),
        this.prisma.dispatchOrder.aggregate({ _sum: { pax: true }, where: { status: { in: [...LIVE_DISPATCH] } } }),
        this.prisma.dispatchOrder.count({ where: { status: "DELAYED" } }),
        this.prisma.dispatchOrder.findMany({
          where: { status: { in: [...LIVE_DISPATCH, "COMPLETED"] } },
          orderBy: { scheduledAt: "desc" }, take: 12,
          select: {
            code: true, status: true, routeFrom: true, routeTo: true, pax: true, progressPct: true, scheduledAt: true,
            vehicle: { select: { code: true } }, driver: { select: { name: true } }, group: { select: { code: true } },
          },
        }),
      ]);
      return {
        kpis: { activeDispatches: active, deliveredToday, totalPaxMoving: paxMoving._sum.pax ?? 0, delayed },
        orders,
      };
    });
  }

  // ── Arrival / Departure boards ───────────────────────────────────────────────
  board(direction: "ARRIVAL" | "DEPARTURE", date?: string) {
    return this.cache.wrap(`board:${direction}:${date ?? "today"}`, 30, async () => {
      const range = this.dayRange(date);
      const flights = await this.prisma.flightInfo.findMany({
        where: { direction, scheduledAt: range },
        orderBy: { scheduledAt: "asc" },
        select: {
          flightNo: true, airline: true, scheduledAt: true, paxCount: true, status: true,
          group: { select: { code: true, tenant: { select: { name: true } } } },
        },
      });
      const totalPax = flights.reduce((s, f) => s + f.paxCount, 0);
      const arrivedStates = ["DELIVERED", "AT_GATE", "IMMIGRATION", "BAGGAGE", "EN_ROUTE"];
      const departedStates = ["DEPARTED", "BOARDING", "CHECK_IN"];
      const doneStates = direction === "ARRIVAL" ? arrivedStates : departedStates;
      const processed = flights.filter((f) => doneStates.includes(f.status)).reduce((s, f) => s + f.paxCount, 0);
      return {
        kpis: {
          flights: flights.length, totalPax, processedPax: processed, pendingPax: totalPax - processed,
          landed: flights.filter((f) => doneStates.includes(f.status)).length,
        },
        flights,
      };
    });
  }

  // ── Agent (tenant-scoped) ────────────────────────────────────────────────────
  agent(companyId: string) {
    return this.cache.wrap(`agent:${companyId}`, 30, async () => {
      const [wallet, activeGroups, seasonGroups, outstanding, paxTrend, groups, invoices, visaDesk] = await Promise.all([
        this.prisma.wallet.findUnique({ where: { companyId }, select: { balance: true, currency: true } }),
        this.prisma.group.count({ where: { tenantId: companyId, status: { in: [...ACTIVE_GROUP] } } }),
        this.prisma.group.count({ where: { tenantId: companyId } }),
        this.prisma.invoice.aggregate({ _sum: { total: true }, _count: true, where: { tenantId: companyId, status: { in: ["OUTSTANDING", "OVERDUE"] } } }),
        this.monthlyPax(companyId, 8),
        this.prisma.group.findMany({ where: { tenantId: companyId }, orderBy: { createdAt: "desc" }, take: 6, select: { code: true, paxCount: true, status: true, opsStatus: true } }),
        this.prisma.invoice.findMany({ where: { tenantId: companyId }, orderBy: { issueDate: "desc" }, take: 6, select: { code: true, total: true, status: true } }),
        // T002-09 §12 — Agent "Visa Status" card: same desk counts, tenant-scoped.
        this.opsSvc.mutamerVisaDesk({ pageSize: 1, tenantId: companyId }),
      ]);
      return {
        kpis: {
          walletBalance: num(wallet?.balance), currency: wallet?.currency ?? "SAR",
          activeGroups, seasonGroups, outstandingAmount: num(outstanding._sum.total), outstandingCount: outstanding._count,
        },
        paxTrend, groups, invoices,
        visa: {
          pipeline: visaDesk.counts,
          notIssued: [...NOT_ISSUED_PIPELINE_STATES].reduce(
            (s, k) => s + ((visaDesk.counts as Record<string, number>)[k] ?? 0), 0,
          ),
          mofaCompletePercent: visaDesk.mofaCompleteness.percent,
        },
      };
    });
  }

  // ── Supplier (tenant-scoped) ─────────────────────────────────────────────────
  supplier(companyId: string) {
    return this.cache.wrap(`supplier:${companyId}`, 30, async () => {
      const monthStart = this.monthStart();
      const [pendingBk, outstanding, seasonRev, upcoming, perf] = await Promise.all([
        this.supplierBookingCount(companyId, [...OPEN_SERVICE]),
        this.prisma.invoice.aggregate({ _sum: { total: true }, _count: true, where: { sourceType: { not: null }, status: { in: ["OUTSTANDING", "OVERDUE"] } } }),
        this.supplierRevenue(companyId, this.yearStart()),
        this.supplierBookingCount(companyId, ["CONFIRMED", "VOUCHER_ISSUED"]),
        this.prisma.supplierProfile.findUnique({ where: { companyId }, select: { qualityScore: true } }),
      ]);
      void monthStart;
      return {
        kpis: {
          pendingBookings: pendingBk, invoicesOutstanding: num(outstanding._sum.total),
          seasonRevenue: seasonRev, upcomingServices: upcoming, qualityScore: num(perf?.qualityScore),
        },
      };
    });
  }

  // ── shared aggregate helpers (raw SQL for time-series) ───────────────────────
  private async monthlyRevenue(months: number) {
    const from = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1));
    const rows = await this.prisma.$queryRaw<Array<{ month: string; total: Prisma.Decimal }>>`
      SELECT to_char(date_trunc('month', "issueDate"), 'YYYY-MM') AS month, COALESCE(SUM("total"), 0)::numeric AS total
      FROM "Invoice" WHERE "issueDate" >= ${from} AND "status" <> 'CANCELLED'
      GROUP BY 1 ORDER BY 1`;
    return this.zeroFillMonths(rows, from, months, (r) => ({ total: num(r?.total) }));
  }

  private async monthlyPax(companyId: string, months: number) {
    const from = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1));
    const rows = await this.prisma.$queryRaw<Array<{ month: string; pax: bigint }>>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, COALESCE(SUM("paxCount"), 0) AS pax
      FROM "Group" WHERE "tenantId" = ${companyId} AND "createdAt" >= ${from}
      GROUP BY 1 ORDER BY 1`;
    return this.zeroFillMonths(rows, from, months, (r) => ({ pax: Number(r?.pax ?? 0) }));
  }

  private async hourlyFlights() {
    const today = this.dayRange();
    const rows = await this.prisma.$queryRaw<Array<{ hour: number; direction: string; c: bigint }>>`
      SELECT EXTRACT(HOUR FROM "scheduledAt")::int AS hour, "direction"::text AS direction, COUNT(*) AS c
      FROM "FlightInfo" WHERE "scheduledAt" >= ${today.gte} AND "scheduledAt" < ${today.lt}
      GROUP BY 1, 2 ORDER BY 1`;
    const map = new Map<number, { hour: number; arr: number; dep: number }>();
    for (const r of rows) {
      const slot = map.get(r.hour) ?? { hour: r.hour, arr: 0, dep: 0 };
      if (r.direction === "ARRIVAL") slot.arr = Number(r.c); else slot.dep = Number(r.c);
      map.set(r.hour, slot);
    }
    return [...map.values()].sort((a, b) => a.hour - b.hour);
  }

  private async openServiceCount() {
    const s = OPEN_SERVICE as unknown as string[];
    const [hotel, transport, catering, visa, additional] = await Promise.all([
      this.prisma.hotelBooking.count({ where: { status: { in: s as never } } }),
      this.prisma.transportBooking.count({ where: { status: { in: s as never } } }),
      this.prisma.cateringBooking.count({ where: { status: { in: s as never } } }),
      this.prisma.visaRequest.count({ where: { status: { in: s as never } } }),
      this.prisma.additionalServiceRequest.count({ where: { status: { in: s as never } } }),
    ]);
    return { total: hotel + transport + catering + visa + additional, byType: [["Visa", visa], ["Hotel", hotel], ["Transport", transport], ["Catering", catering], ["Additional", additional]] as Array<[string, number]> };
  }

  private async supplierBookingCount(companyId: string, statuses: string[]) {
    const [hotel, transport, catering] = await Promise.all([
      this.prisma.hotelBooking.count({ where: { supplierId: companyId, status: { in: statuses as never } } }),
      this.prisma.transportBooking.count({ where: { supplierId: companyId, status: { in: statuses as never } } }),
      this.prisma.cateringBooking.count({ where: { supplierId: companyId, status: { in: statuses as never } } }),
    ]);
    return hotel + transport + catering;
  }

  private async supplierRevenue(companyId: string, from: Date) {
    const rows = await this.prisma.$queryRaw<Array<{ total: Prisma.Decimal }>>`
      SELECT COALESCE(SUM("credit"), 0)::numeric AS total FROM "LedgerEntry"
      WHERE "ledgerType" = 'SUPPLIER' AND "companyId" = ${companyId} AND "date" >= ${from}`;
    return num(rows[0]?.total);
  }

  private async topAgentsByRevenue(limit: number) {
    const rows = await this.prisma.$queryRaw<Array<{ name: string; total: Prisma.Decimal }>>`
      SELECT c."name" AS name, COALESCE(SUM(i."total"), 0)::numeric AS total
      FROM "Invoice" i JOIN "Company" c ON c."id" = i."tenantId"
      WHERE i."status" <> 'CANCELLED'
      GROUP BY c."name" ORDER BY total DESC LIMIT ${limit}`;
    return rows.map((r) => ({ name: r.name, total: num(r.total) }));
  }

  private zeroFillMonths<R, O>(rows: Array<{ month: string } & R>, from: Date, months: number, pick: (r?: { month: string } & R) => O) {
    const byMonth = new Map(rows.map((r) => [r.month, r]));
    const out: Array<{ month: string } & O> = [];
    for (let i = 0; i < months; i++) {
      const dt = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      out.push({ month: key, ...pick(byMonth.get(key)) });
    }
    return out;
  }
}
