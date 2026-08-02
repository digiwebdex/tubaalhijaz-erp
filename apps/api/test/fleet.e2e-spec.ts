// ─── Fleet ERP (e2e) ─────────────────────────────────────────────────────────
// Confirms the Fleet backend behind FleetERP:
//   • MANAGE_FLEET gate (agents & non-fleet staff get 403)
//   • Vehicle / Driver / Document / Fuel / Maintenance / Insurance CRUD
//   • unified expiry feed (license + vehicle docs + insurance, 30/7-day buckets)
//   • expiry watchdog scan → NotificationLog, and it's idempotent
//   • cost-trend aggregation (6 continuous months) + dashboard rollup
//   • GPS: POST /vehicles/:id/location stores a fix; map + trail read it back
//   • dispatch assignment (Vehicle + Driver → DispatchOrder)

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const FLEET = { email: "fleet@tubalhijaz.com", password: "Demo@123" }; // FLEET_STAFF → MANAGE_FLEET
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" }; // OPS_STAFF → no MANAGE_FLEET
const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };

const iso = (dayOffset: number) => new Date(Date.now() + dayOffset * 86_400_000).toISOString();

describe("Fleet ERP (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let fleet: string, ops: string, agent: string;
  let vehicleId: string; // test vehicle (deleted in afterAll → cascades its children)
  let driverId: string;

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
    [fleet, ops, agent] = await Promise.all([login(FLEET), login(OPS), login(AGENT)]);
  });

  afterAll(async () => {
    if (driverId) await prisma.driver.delete({ where: { id: driverId } }).catch(() => undefined);
    if (vehicleId) await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => undefined);
    await app.close();
  });

  // ── access ───────────────────────────────────────────────────────────────────
  it("gates fleet endpoints to MANAGE_FLEET (agents & ops staff get 403)", async () => {
    await request(http).get("/fleet/vehicles").set(auth(agent)).expect(403);
    await request(http).get("/fleet/vehicles").set(auth(ops)).expect(403);
    await request(http).get("/fleet/vehicles").set(auth(fleet)).expect(200);
  });

  // ── Vehicle CRUD ───────────────────────────────────────────────────────────
  it("creates, reads, updates a vehicle", async () => {
    const created = await request(http).post("/fleet/vehicles").set(auth(fleet))
      .send({ code: `TEST-${Date.now()}`, type: "COASTER", plateNo: "SAUDI/TEST-1", seats: 30 })
      .expect(201);
    vehicleId = created.body.id;
    expect(created.body.status).toBe("ACTIVE");

    const list = await request(http).get("/fleet/vehicles").set(auth(fleet)).expect(200);
    expect(list.body.some((v: { id: string }) => v.id === vehicleId)).toBe(true);
    expect(list.body[0]).toHaveProperty("nextDocExpiry"); // derived doc summary present

    await request(http).patch(`/fleet/vehicles/${vehicleId}`).set(auth(fleet))
      .send({ status: "MAINTENANCE", notes: "in for service" }).expect(200);
    const got = await request(http).get(`/fleet/vehicles/${vehicleId}`).set(auth(fleet)).expect(200);
    expect(got.body.status).toBe("MAINTENANCE");
    // back to active for later dispatch/GPS tests
    await request(http).patch(`/fleet/vehicles/${vehicleId}`).set(auth(fleet)).send({ status: "ACTIVE" }).expect(200);
  });

  // ── Driver CRUD + license expiry severity ───────────────────────────────────
  it("creates a driver and computes license-expiry severity", async () => {
    const created = await request(http).post("/fleet/drivers").set(auth(fleet))
      .send({ name: "Test Driver", phone: "+966 5 000", licenseNo: "SA-DL-TEST", licenseExpiry: iso(5) })
      .expect(201);
    driverId = created.body.id;

    const list = await request(http).get("/fleet/drivers").set(auth(fleet)).expect(200);
    const row = list.body.find((d: { id: string }) => d.id === driverId);
    expect(row.licenseDays).toBeLessThanOrEqual(7);
    expect(row.licenseSeverity).toBe("CRITICAL"); // ≤7 days
  });

  // ── Vehicle documents feed the expiry list ──────────────────────────────────
  it("adds a vehicle document and it surfaces in the expiry feed", async () => {
    await request(http).post(`/fleet/vehicles/${vehicleId}/documents`).set(auth(fleet))
      .send({ type: "INSPECTION", docNo: "FHS-TEST", expiryDate: iso(3) }).expect(201);

    const docs = await request(http).get(`/fleet/vehicles/${vehicleId}/documents`).set(auth(fleet)).expect(200);
    expect(docs.body.length).toBe(1);

    const exp = await request(http).get("/fleet/expiring?days=30").set(auth(fleet)).expect(200);
    const mine = exp.body.find((e: { refId: string }) => e.refId === docs.body[0].id);
    expect(mine).toBeDefined();
    expect(mine.severity).toBe("CRITICAL");
    expect(mine.kind).toBe("INSPECTION");
  });

  it("expiry feed includes seeded EXPIRED and CRITICAL items", async () => {
    const exp = await request(http).get("/fleet/expiring?days=30").set(auth(fleet)).expect(200);
    expect(exp.body.some((e: { severity: string }) => e.severity === "EXPIRED")).toBe(true);
    expect(exp.body.some((e: { kind: string }) => e.kind === "INSURANCE")).toBe(true);
    // sorted most-urgent first
    const days = exp.body.map((e: { daysLeft: number }) => e.daysLeft);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  // ── Expiry watchdog scan is real + idempotent (via dispatch → tuba-notify) ──
  it("expiry scan raises notifications and is idempotent", async () => {
    await prisma.notificationLog.deleteMany({ where: { code: { startsWith: "FLEET-EXP-" } } });
    const first = await request(http).post("/fleet/expiry/scan").set(auth(fleet)).expect(201);
    expect(first.body.created).toBeGreaterThan(0);
    const second = await request(http).post("/fleet/expiry/scan").set(auth(fleet)).expect(201);
    expect(second.body.created).toBe(0); // deterministic codes → unique code / P2002 skip
    const rows = await prisma.notificationLog.count({ where: { code: { startsWith: "FLEET-EXP-" } } });
    expect(rows).toBe(first.body.created);
  });

  // ── Fuel + Maintenance + cost trend ─────────────────────────────────────────
  it("logs fuel + maintenance and reflects them in the cost trend", async () => {
    await request(http).post("/fleet/fuel").set(auth(fleet))
      .send({ vehicleId, date: iso(0), liters: 120, cost: 300, odometerKm: 1000 }).expect(201);
    await request(http).post("/fleet/maintenance").set(auth(fleet))
      .send({ vehicleId, type: "PREVENTIVE", description: "test service", date: iso(0), cost: 500 }).expect(201);

    const trend = await request(http).get("/fleet/cost-trend?months=6").set(auth(fleet)).expect(200);
    expect(trend.body).toHaveLength(6); // continuous, zero-filled axis
    const current = trend.body[5];
    expect(current.fuel).toBeGreaterThanOrEqual(300);
    expect(current.maintenance).toBeGreaterThanOrEqual(500);
    expect(current.total).toBe(Math.round((current.fuel + current.maintenance) * 100) / 100);
  });

  // ── Insurance CRUD ──────────────────────────────────────────────────────────
  it("creates and updates an insurance policy", async () => {
    const created = await request(http).post("/fleet/insurance").set(auth(fleet))
      .send({ vehicleId, provider: "Test Insurer", policyNo: `POL-${Date.now()}`, startDate: iso(-10), endDate: iso(200), premium: 5000 })
      .expect(201);
    await request(http).patch(`/fleet/insurance/${created.body.id}`).set(auth(fleet))
      .send({ premium: 5500 }).expect(200);
    const list = await request(http).get(`/fleet/insurance?vehicleId=${vehicleId}`).set(auth(fleet)).expect(200);
    expect(Number(list.body[0].premium)).toBe(5500);
  });

  // ── GPS (MVP manual fix) ─────────────────────────────────────────────────────
  it("accepts a manual GPS fix and renders it on the map + trail", async () => {
    await request(http).post(`/vehicles/${vehicleId}/location`).set(auth(fleet))
      .send({ lat: 21.4225, lng: 39.8262, label: "Makkah — Haram", speedKmh: 12 }).expect(201);

    const map = await request(http).get("/fleet/map").set(auth(fleet)).expect(200);
    const mine = map.body.find((m: { id: string }) => m.id === vehicleId);
    expect(mine).toBeDefined();
    expect(mine.lat).toBeCloseTo(21.4225, 3);
    expect(mine.lng).toBeCloseTo(39.8262, 3);

    const trail = await request(http).get(`/fleet/vehicles/${vehicleId}/trail`).set(auth(fleet)).expect(200);
    expect(trail.body.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects an out-of-range GPS fix", async () => {
    await request(http).post(`/vehicles/${vehicleId}/location`).set(auth(fleet))
      .send({ lat: 200, lng: 39 }).expect(400);
  });

  // ── Dispatch assignment ──────────────────────────────────────────────────────
  it("assigns a vehicle + driver to a dispatch order", async () => {
    const dispatches = await request(http).get("/fleet/dispatches").set(auth(fleet)).expect(200);
    if (!dispatches.body.length) return; // no open dispatches seeded — skip gracefully
    const target = dispatches.body[0];

    const res = await request(http).post(`/fleet/dispatches/${target.id}/assign`).set(auth(fleet))
      .send({ vehicleId, driverId }).expect(201);
    expect(res.body.vehicle.id).toBe(vehicleId);
    expect(res.body.driver.id).toBe(driverId);

    const drv = await prisma.driver.findUnique({ where: { id: driverId } });
    expect(drv?.status).toBe("ON_DUTY"); // assignment reflects on driver
  });

  // ── Dashboard rollup ──────────────────────────────────────────────────────────
  it("returns a dashboard rollup", async () => {
    const dash = await request(http).get("/fleet/dashboard").set(auth(fleet)).expect(200);
    expect(dash.body.fleet).toHaveProperty("active");
    expect(dash.body.fleet.total).toBeGreaterThan(0);
    expect(dash.body.cost.trend).toHaveLength(6);
    expect(dash.body.expiring).toHaveProperty("total");
    expect(dash.body.utilization).toHaveProperty("pct");
  });
});
