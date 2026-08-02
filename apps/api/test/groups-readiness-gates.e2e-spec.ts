// T001-02 — Readiness gates + PACKAGE gate (e2e)
// Covers: default false, PATCH toggles, packageType independence, audit,
// event catalog key, tenancy, backward-compatible create without gates.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { ALL_EVENT_KEYS, EV } from "../src/automation/events";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OTHER_AGENT = { email: "office@alnoor-pilgrim.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };

describe("T001-02 Group readiness gates (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: EventEmitter2;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let otherTok: string;
  let opsTok: string;
  const createdIds: string[] = [];

  const login = async (creds: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(creds).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    events = app.get(EventEmitter2);
    [agentTok, otherTok, opsTok] = await Promise.all([login(AGENT), login(OTHER_AGENT), login(OPS)]);
  });

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "Group", entityId: { in: createdIds } },
      });
      await prisma.group.deleteMany({ where: { id: { in: createdIds } } });
    }
    await app.close();
  });

  it("event catalog includes group.gates.changed", () => {
    expect(EV.GROUP_GATES_CHANGED).toBe("group.gates.changed");
    expect(ALL_EVENT_KEYS).toContain("group.gates.changed");
  });

  it("create without gates defaults all four to false (backward compatible)", async () => {
    const res = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-02 Legacy Gates",
        destination: "MAKKAH",
        visaType: "UMRAH",
        packageType: "STANDARD",
      })
      .expect(201);
    createdIds.push(res.body.id);
    expect(res.body.gateVisa).toBe(false);
    expect(res.body.gatePackage).toBe(false);
    expect(res.body.gatePayment).toBe(false);
    expect(res.body.gateBill).toBe(false);
    expect(res.body.packageType).toBe("STANDARD");
  });

  it("PATCH toggles gates independently; packageType stays independent; UPDATE audited", async () => {
    const created = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-02 Gate Toggle",
        destination: "MAKKAH",
        visaType: "UMRAH",
        packageType: "ECONOMY",
      })
      .expect(201);
    createdIds.push(created.body.id);

    const patched = await request(http)
      .patch(`/groups/${created.body.id}`)
      .set(auth(agentTok))
      .send({ gateVisa: true, gatePackage: true })
      .expect(200);

    expect(patched.body.gateVisa).toBe(true);
    expect(patched.body.gatePackage).toBe(true);
    expect(patched.body.gatePayment).toBe(false);
    expect(patched.body.gateBill).toBe(false);
    expect(patched.body.packageType).toBe("ECONOMY");

    const pkgOnly = await request(http)
      .patch(`/groups/${created.body.id}`)
      .set(auth(agentTok))
      .send({ packageType: "PREMIUM" })
      .expect(200);
    expect(pkgOnly.body.packageType).toBe("PREMIUM");
    expect(pkgOnly.body.gateVisa).toBe(true);
    expect(pkgOnly.body.gatePackage).toBe(true);

    const got = await request(http).get(`/groups/${created.body.id}`).set(auth(agentTok)).expect(200);
    expect(got.body.gateVisa).toBe(true);
    expect(got.body.gatePackage).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Group", entityId: created.body.id, action: "UPDATE", module: "Groups" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect((audit!.after as { gateVisa?: boolean })?.gateVisa).toBe(true);
  });

  it("emits group.gates.changed when a gate flips; silent when gates unchanged", async () => {
    const created = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-02 Gate Event",
        destination: "MADINAH",
        visaType: "LONG_STAY",
      })
      .expect(201);
    createdIds.push(created.body.id);

    let gateEvents = 0;
    const handler = () => {
      gateEvents += 1;
    };
    events.on(EV.GROUP_GATES_CHANGED, handler);
    try {
      await request(http)
        .patch(`/groups/${created.body.id}`)
        .set(auth(agentTok))
        .send({ gatePayment: true, gateBill: true })
        .expect(200);
      expect(gateEvents).toBe(1);

      const beforeSecond = gateEvents;
      await request(http)
        .patch(`/groups/${created.body.id}`)
        .set(auth(agentTok))
        .send({ name: "T001-02 Gate Event Renamed" })
        .expect(200);
      expect(gateEvents).toBe(beforeSecond);
    } finally {
      events.off(EV.GROUP_GATES_CHANGED, handler);
    }
  });

  it("create may set initial gates; staff PATCH works; other agent cannot toggle", async () => {
    const created = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-02 Initial Gates",
        destination: "MAKKAH",
        visaType: "HAJJ",
        hajiWhatsapp: "+966500000099",
        gateVisa: true,
        gatePackage: false,
      })
      .expect(201);
    createdIds.push(created.body.id);
    expect(created.body.gateVisa).toBe(true);
    expect(created.body.gatePackage).toBe(false);

    const staff = await request(http)
      .patch(`/groups/${created.body.id}`)
      .set(auth(opsTok))
      .send({ gatePackage: true })
      .expect(200);
    expect(staff.body.gatePackage).toBe(true);

    await request(http)
      .patch(`/groups/${created.body.id}`)
      .set(auth(otherTok))
      .send({ gateBill: true })
      .expect(404);
  });

  it("rejects non-boolean gate values", async () => {
    const created = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-02 Gate Validation",
        destination: "MAKKAH",
        visaType: "UMRAH",
      })
      .expect(201);
    createdIds.push(created.body.id);

    await request(http)
      .patch(`/groups/${created.body.id}`)
      .set(auth(agentTok))
      .send({ gateVisa: "yes" })
      .expect(400);
  });
});
