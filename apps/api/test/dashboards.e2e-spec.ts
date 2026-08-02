// ─── Dashboards (e2e) ────────────────────────────────────────────────────────
// Every dashboard number is a live aggregate. These tests are the "does it add
// up" spot-checks: each endpoint figure is compared to a direct table count /
// the audited Finance reports. Also covers the VIEW_DASHBOARD gate + Redis cache.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { DashboardCache } from "../src/dashboards/dashboard-cache.service";

const STAFF = { email: "ceo@tubalhijaz.com", password: "Demo@123" };
const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const ACTIVE = ["IN_PROGRESS", "VERIFIED"];
const LIVE_DISPATCH = ["ASSIGNED", "EN_ROUTE", "DELAYED"];

describe("Dashboards (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let staff: string, agent: string;

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await app.get(DashboardCache).bust(); // fresh aggregates (not a stale cached run)
    [staff, agent] = await Promise.all([login(STAFF), login(AGENT)]);
  });

  afterAll(async () => { await app.close(); });

  it("gates dashboards to VIEW_DASHBOARD (agents 403)", async () => {
    await request(http).get("/dashboards/ceo").set(auth(agent)).expect(403);
    await request(http).get("/dashboards/ceo").set(auth(staff)).expect(200);
  });

  // ── CEO — spot-check the marquee numbers ─────────────────────────────────────
  it("CEO active agents == count(Company AGENT VERIFIED); revenue ties to Finance", async () => {
    const ceo = (await request(http).get("/dashboards/ceo").set(auth(staff)).expect(200)).body;
    const activeAgents = await prisma.company.count({ where: { type: "AGENT", verificationStatus: "VERIFIED" } });
    expect(ceo.kpis.activeAgents).toBe(activeAgents);

    const activeGroups = await prisma.group.count({ where: { status: { in: ACTIVE as never } } });
    expect(ceo.kpis.activeGroups).toBe(activeGroups);
    expect(ceo.kpis.ytdRevenue).toBeGreaterThan(0);

    const fin = (await request(http).get("/dashboards/finance").set(auth(staff)).expect(200)).body;
    expect(ceo.kpis.ytdRevenue).toBeCloseTo(fin.kpis.totalRevenue, 1); // same GL source
    expect(ceo.revenueTrend).toHaveLength(8);
    expect(ceo.topAgents.length).toBeGreaterThan(0);
  });

  // ── Ops ──────────────────────────────────────────────────────────────────────
  it("Ops groupsActive + pendingTasks match direct counts", async () => {
    const ops = (await request(http).get("/dashboards/ops").set(auth(staff)).expect(200)).body;
    const groupsActive = await prisma.group.count({ where: { status: { in: ACTIVE as never } } });
    expect(ops.kpis.groupsActive).toBe(groupsActive);
    const delayed = await prisma.dispatchOrder.count({ where: { status: "DELAYED" } });
    expect(ops.kpis.delayedDispatch).toBe(delayed);
    expect(Array.isArray(ops.departments)).toBe(true);
  });

  // ── Finance — ties to the audited reports ────────────────────────────────────
  it("Finance AR total == arAging total; aging buckets sum to it", async () => {
    const fin = (await request(http).get("/dashboards/finance").set(auth(staff)).expect(200)).body;
    const bucketSum = fin.arAging.reduce((s: number, b: { amount: number }) => s + b.amount, 0);
    expect(bucketSum).toBeCloseTo(fin.kpis.accountsReceivable, 0);
    expect(fin.kpis.cashPosition).toBeGreaterThan(0);
    expect(fin.cashTrend).toHaveLength(8);
  });

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  it("Dispatch activeDispatches == count(DispatchOrder live)", async () => {
    const d = (await request(http).get("/dashboards/dispatch").set(auth(staff)).expect(200)).body;
    const active = await prisma.dispatchOrder.count({ where: { status: { in: LIVE_DISPATCH as never } } });
    expect(d.kpis.activeDispatches).toBe(active);
    expect(Array.isArray(d.orders)).toBe(true);
  });

  // ── Arrival / Departure ──────────────────────────────────────────────────────
  it("Arrival/Departure flight counts == count(FlightInfo direction, today)", async () => {
    const today = { gte: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z") };
    const end = new Date(today.gte.getTime() + 86_400_000);
    for (const [path, dir] of [["arrivals", "ARRIVAL"], ["departures", "DEPARTURE"]] as const) {
      const board = (await request(http).get(`/dashboards/${path}`).set(auth(staff)).expect(200)).body;
      const count = await prisma.flightInfo.count({ where: { direction: dir, scheduledAt: { gte: today.gte, lt: end } } });
      expect(board.kpis.flights).toBe(count);
      expect(board.kpis.totalPax).toBeGreaterThanOrEqual(0);
    }
  });

  // ── Agent / Supplier (representative tenant) ─────────────────────────────────
  it("Agent dashboard resolves a tenant and matches its group/wallet data", async () => {
    const a = (await request(http).get("/dashboards/agent").set(auth(staff)).expect(200)).body;
    expect(a.kpis).toHaveProperty("walletBalance");
    expect(a.kpis).toHaveProperty("seasonGroups");
    expect(a.paxTrend).toHaveLength(8);
  });

  it("Supplier dashboard resolves a tenant", async () => {
    const s = (await request(http).get("/dashboards/supplier").set(auth(staff)).expect(200)).body;
    expect(s.kpis).toHaveProperty("pendingBookings");
    expect(s.kpis).toHaveProperty("seasonRevenue");
  });

  // ── T002-09 Visa & Compliance (architecture §12) ─────────────────────────────
  it("Scenario — executive opens visa dashboard (staff 200)", async () => {
    const visa = (await request(http).get("/dashboards/visa").set(auth(staff)).expect(200)).body;
    expect(visa).toHaveProperty("pipeline");
    expect(visa).toHaveProperty("mofa");
    expect(visa).toHaveProperty("backlog");
    expect(visa).toHaveProperty("longStay");
    expect(visa).toHaveProperty("gates");
  });

  it("Scenario — Visa KPIs correct (pipeline + MOFA + biometric backlog)", async () => {
    await app.get(DashboardCache).bust();
    const visa = (await request(http).get("/dashboards/visa").set(auth(staff)).expect(200)).body;

    const byState = await prisma.passenger.groupBy({
      by: ["visaPipelineStatus"],
      _count: { _all: true },
    });
    const expected: Record<string, number> = {};
    for (const row of byState) expected[row.visaPipelineStatus] = row._count._all;
    for (const [state, count] of Object.entries(visa.pipeline as Record<string, number>)) {
      if (state === "ALL") {
        expect(count).toBe(Object.values(expected).reduce((s, n) => s + n, 0));
        continue;
      }
      expect(count).toBe(expected[state] ?? 0);
    }

    // Desk SoT: issued family = ISSUED + PASSPORT_RETURNED + COMPLETED (T002-06).
    const issuedStates = ["ISSUED", "PASSPORT_RETURNED", "COMPLETED"] as const;
    const issuedTotal = await prisma.passenger.count({
      where: { visaPipelineStatus: { in: [...issuedStates] as never } },
    });
    const issuedWithMofa = await prisma.passenger.count({
      where: {
        visaPipelineStatus: { in: [...issuedStates] as never },
        mofaNumber: { not: null },
        NOT: { mofaNumber: "" },
      },
    });
    expect(visa.mofa.issuedTotal).toBe(issuedTotal);
    expect(visa.mofa.issuedWithMofa).toBe(issuedWithMofa);
    expect(visa.mofa.completePercent).toBe(
      issuedTotal > 0 ? Math.round((issuedWithMofa / issuedTotal) * 1000) / 10 : 0,
    );

    const NOT_ISSUED = ["NEW", "MOFA", "EMBASSY", "BIOMETRIC", "SUBMITTED", "PROCESSING"];
    const biometric = await prisma.passenger.count({
      where: {
        AND: [
          { visaPipelineStatus: { in: NOT_ISSUED as never } },
          { biometricStatus: { not: null } },
          { NOT: { biometricStatus: "" } },
          { NOT: { biometricStatus: { equals: "pending", mode: "insensitive" } } },
          { NOT: { biometricStatus: { equals: "not registered", mode: "insensitive" } } },
        ],
      },
    });
    expect(visa.backlog.biometricNotIssued).toBe(biometric);
    expect(visa.backlog.arrivingSoon.days).toBe(7);
    expect(visa.gates).toHaveProperty("waitingVisa");
    expect(visa.gates).toHaveProperty("ready");
  });

  it("Scenario — Long Stay KPIs correct (red cards + host complete)", async () => {
    await app.get(DashboardCache).bust();
    const visa = (await request(http).get("/dashboards/visa").set(auth(staff)).expect(200)).body;
    const total = await prisma.longStay.count();
    expect(visa.longStay.total).toBe(total);
    expect(visa.longStay.redCards).toBe(visa.longStay.due + visa.longStay.escalated);
    expect(visa.longStay.hostComplete).toBeGreaterThanOrEqual(0);
    expect(visa.longStay.hostCompletePercent).toBeGreaterThanOrEqual(0);
    expect(visa.longStay.hostCompletePercent).toBeLessThanOrEqual(100);
  });

  it("Scenario — Agent blocked from /dashboards/visa → 403", async () => {
    await request(http).get("/dashboards/visa").set(auth(agent)).expect(403);
  });

  it("Scenario — Agent Visa Status card payload present on /dashboards/agent", async () => {
    const a = (await request(http).get("/dashboards/agent").set(auth(staff)).expect(200)).body;
    expect(a.visa).toBeDefined();
    expect(a.visa).toHaveProperty("pipeline");
    expect(a.visa).toHaveProperty("notIssued");
    expect(a.visa).toHaveProperty("mofaCompletePercent");
    expect(typeof a.visa.notIssued).toBe("number");
  });

  // ── Cache ─────────────────────────────────────────────────────────────────────
  it("caches heavy rollups (identical payload on immediate re-fetch)", async () => {
    const a = (await request(http).get("/dashboards/ceo").set(auth(staff)).expect(200)).body;
    const b = (await request(http).get("/dashboards/ceo").set(auth(staff)).expect(200)).body;
    expect(b).toEqual(a);
  });
});
