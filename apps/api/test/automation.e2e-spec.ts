// ─── Automation engine (e2e) ─────────────────────────────────────────────────
// Real Redis (VPS tunnel) + BullMQ + EventEmitter. Confirms:
//   • CONFIGURE_WORKFLOWS gate + rule CRUD
//   • a domain event flows event → dispatcher → queued job → worker → run log
//   • SEND_NOTIFICATION creates a NotificationLog (the agent-welcome path)
//   • GENERATE_QR produces a stored QR image
//   • RUN_BACKUP produces a stored backup artifact
//   • conditions gate whether a rule fires
// Jobs are async (queue + tunnel latency) so assertions poll.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const ADMIN = { email: "ceo@tubalhijaz.com", password: "Demo@123" }; // SUPER_ADMIN → CONFIGURE_WORKFLOWS
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" }; // OPS_STAFF → CONFIGURE_WORKFLOWS
const FIN = { email: "finance@tubalhijaz.com", password: "Demo@123" }; // FINANCE_STAFF — no CONFIGURE_WORKFLOWS
const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const SUPPLIER = { email: "manager@jabalomar-hyatt.sa", password: "Demo@123" };

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 10000, step = 300): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const r = await fn();
    if (r) return r;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((s) => setTimeout(s, step));
  }
}

describe("Automation engine (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let admin: string, ops: string, fin: string, agent: string, supplier: string;
  let tenantId: string;
  const createdRuleIds: string[] = [];

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
    [admin, ops, fin, agent, supplier] = await Promise.all([
      login(ADMIN), login(OPS), login(FIN), login(AGENT), login(SUPPLIER),
    ]);
    tenantId = (await prisma.company.findFirstOrThrow({ where: { type: "AGENT" } })).id;
  });

  afterAll(async () => {
    for (const id of createdRuleIds) await prisma.automationRule.delete({ where: { id } }).catch(() => undefined);
    await app.close();
  });

  // ── access + catalog (S2-05 role matrix — API is the authorization boundary) ─
  it("gates automation config to CONFIGURE_WORKFLOWS", async () => {
    await request(http).get("/automation/rules").set(auth(admin)).expect(200); // SUPER_ADMIN
    await request(http).get("/automation/rules").set(auth(ops)).expect(200); // OPS_STAFF
    await request(http).get("/automation/rules").set(auth(fin)).expect(403); // FINANCE_STAFF
    await request(http).get("/automation/rules").set(auth(agent)).expect(403); // AGENT
    await request(http).get("/automation/rules").set(auth(supplier)).expect(403); // SUPPLIER
  });

  it("exposes the event + action catalog and seeded engine rules", async () => {
    const ov = await request(http).get("/automation/overview").set(auth(admin)).expect(200);
    expect(ov.body.catalog.events).toContain("agent.approved");
    expect(ov.body.catalog.actions).toContain("SEND_NOTIFICATION");
    const rules = await request(http).get("/automation/rules?eventKey=agent.approved").set(auth(admin)).expect(200);
    expect(rules.body.some((r: { code: string }) => r.code === "R01")).toBe(true);
  });

  // ── rule CRUD ──────────────────────────────────────────────────────────────
  it("creates, updates, toggles and deletes a rule", async () => {
    const created = await request(http).post("/automation/rules").set(auth(admin)).send({
      name: "Test Rule", category: "Group", trigger: "unit test",
      eventKey: "group.created", actions: [{ type: "SEND_NOTIFICATION", params: { title: "hi" } }],
    }).expect(201);
    const id = created.body.id;
    expect(created.body.code).toMatch(/^AR-/);

    await request(http).patch(`/automation/rules/${id}`).set(auth(admin)).send({ name: "Renamed" }).expect(200);
    await request(http).patch(`/automation/rules/${id}/enabled`).set(auth(admin)).send({ enabled: false }).expect(200);
    const got = await request(http).get(`/automation/rules/${id}`).set(auth(admin)).expect(200);
    expect(got.body.name).toBe("Renamed");
    expect(got.body.enabled).toBe(false);
    await request(http).delete(`/automation/rules/${id}`).set(auth(admin)).expect(200);
  });

  // ── the core loop: event → queued job → worker → run log + notification ──────
  it("fires SEND_NOTIFICATION when agent.approved is emitted (no hardcoding)", async () => {
    const t0 = new Date();
    await request(http).post("/automation/test").set(auth(admin))
      .send({ eventKey: "agent.approved", tenantId, data: { code: "TST-CO", name: "Test Co" } })
      .expect(201);

    const run = await waitFor(() =>
      prisma.automationRunLog.findFirst({
        where: { eventKey: "agent.approved", action: "SEND_NOTIFICATION", startedAt: { gte: t0 } },
        include: { rule: { select: { code: true } } },
      }),
    );
    expect(run.status).toBe("OK");
    expect(run.rule.code).toBe("R01");

    // R01 dispatches the AGENT_APPROVED template on channel EMAIL, rendered in the
    // tenant's language (bn default) — subject carries the code "TST-CO".
    const notif = await waitFor(() =>
      prisma.notificationLog.findFirst({ where: { tenantId, createdAt: { gte: t0 }, channel: "EMAIL" } }),
    );
    expect(notif.status).toBe("PENDING"); // SMTP not configured in tests → awaiting-config
    expect(notif.title).toContain("TST-CO");
    expect(notif.lang).toBe("bn");
  });

  // ── QR generation job ────────────────────────────────────────────────────────
  it("GENERATE_QR stores a QR image for a voucher code", async () => {
    const t0 = new Date();
    const code = `VCH-QR-${Date.now()}`;
    await request(http).post("/automation/test").set(auth(admin))
      .send({ eventKey: "voucher.generated", tenantId, data: { voucherCode: code, code } })
      .expect(201);

    const file = await waitFor(() =>
      prisma.uploadedFile.findFirst({ where: { mimeType: "image/png", createdAt: { gte: t0 }, fileName: { contains: code } } }),
    );
    expect(file.sizeBytes).toBeGreaterThan(0);
    expect((file.meta as { qr?: boolean }).qr).toBe(true);
  });

  // ── RUN_BACKUP job (via a temporary rule) ────────────────────────────────────
  it("RUN_BACKUP produces a stored backup artifact", async () => {
    const rule = await request(http).post("/automation/rules").set(auth(admin)).send({
      name: "Test Backup", category: "Sys", trigger: "unit test",
      eventKey: "passenger.ocr.completed", actions: [{ type: "RUN_BACKUP" }],
    }).expect(201);
    createdRuleIds.push(rule.body.id);

    const t0 = new Date();
    await request(http).post("/automation/test").set(auth(admin))
      .send({ eventKey: "passenger.ocr.completed", data: { groupId: "x" } }).expect(201);

    const backup = await waitFor(() =>
      prisma.uploadedFile.findFirst({ where: { createdAt: { gte: t0 }, fileName: { contains: "backup-" } } }),
    );
    expect(backup.sizeBytes).toBeGreaterThan(0);
    expect((backup.meta as { backup?: boolean }).backup).toBe(true);
  });

  // ── conditions gate the rule ─────────────────────────────────────────────────
  it("skips a rule whose conditions are not met", async () => {
    const rule = await request(http).post("/automation/rules").set(auth(admin)).send({
      name: "Big groups only", category: "Group", trigger: "unit test",
      eventKey: "group.created", conditions: [{ path: "pax", op: "gte", value: 10 }],
      actions: [{ type: "SEND_NOTIFICATION", params: { title: "big group" } }],
    }).expect(201);
    createdRuleIds.push(rule.body.id);

    const t0 = new Date();
    // pax below threshold → no run
    await request(http).post("/automation/test").set(auth(admin))
      .send({ eventKey: "group.created", data: { pax: 5 } }).expect(201);
    await new Promise((s) => setTimeout(s, 2500));
    const skipped = await prisma.automationRunLog.findFirst({ where: { ruleId: rule.body.id, startedAt: { gte: t0 } } });
    expect(skipped).toBeNull();

    // pax above threshold → fires
    await request(http).post("/automation/test").set(auth(admin))
      .send({ eventKey: "group.created", data: { pax: 40 } }).expect(201);
    const fired = await waitFor(() =>
      prisma.automationRunLog.findFirst({ where: { ruleId: rule.body.id, startedAt: { gte: t0 } } }),
    );
    expect(fired.status).toBe("OK");
  });
});
