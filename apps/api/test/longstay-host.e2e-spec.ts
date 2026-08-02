// T002-07 — Long Stay Host Register (e2e)
// Architecture: Host/Iqama/WhatsApp/Absher. Day-85 is T002-08 (not here).

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };

describe("T002-07 Long Stay Host Register (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  let groupId: string;
  let groupCode: string;
  let tenantId: string;
  let longStayId: string;
  const prevWa = process.env.REQUIRE_LONGSTAY_HOST_WHATSAPP;
  const cleanupIds: string[] = [];

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    process.env.REQUIRE_LONGSTAY_HOST_WHATSAPP = "true";
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    [agentTok, opsTok] = await Promise.all([login(AGENT), login(OPS)]);

    const group = await prisma.group.findFirstOrThrow({
      where: { code: "GRP-1446-2401" },
    });
    groupId = group.id;
    groupCode = group.code;
    tenantId = group.tenantId;

    // Scenario 1 — mark group Long Stay
    await prisma.group.update({
      where: { id: groupId },
      data: { visaType: "LONG_STAY" },
    });
  });

  afterAll(async () => {
    for (const id of cleanupIds) {
      await prisma.longStay.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.group.update({
      where: { id: groupId },
      data: { visaType: "UMRAH" },
    }).catch(() => undefined);
    if (prevWa === undefined) delete process.env.REQUIRE_LONGSTAY_HOST_WHATSAPP;
    else process.env.REQUIRE_LONGSTAY_HOST_WHATSAPP = prevWa;
    await app.close();
  });

  it("Scenario 1 — Passenger/Group marked Long Stay PASS", async () => {
    const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    expect(g.visaType).toBe("LONG_STAY");

    const now = new Date();
    const created = await request(http)
      .post("/ops/long-stays")
      .set(auth(opsTok))
      .send({
        groupId,
        hotelName: "T002-07 Host Test Hotel",
        city: "Makkah",
        nights: 90,
        checkIn: now.toISOString(),
        checkOut: new Date(now.getTime() + 90 * 86400000).toISOString(),
        pax: 10,
      })
      .expect(201);
    longStayId = created.body.id;
    cleanupIds.push(longStayId);
    expect(created.body.group).toBe(groupCode);
    expect(created.body.hostComplete).toBe(false);
  });

  it("Scenario 2 — Required Long Stay host information saved PASS", async () => {
    const res = await request(http)
      .patch(`/ops/long-stays/${longStayId}`)
      .set(auth(opsTok))
      .send({
        registerHost: true,
        hostName: "Abdullah Host",
        hostWhatsapp: "+966501112233",
        hostIqama: "1234567890",
        hostRelation: "Sponsor",
        absher: "Tracked",
        entryDate: new Date().toISOString(),
      })
      .expect(200);

    expect(res.body.hostName).toBe("Abdullah Host");
    expect(res.body.hostWhatsapp).toBe("+966501112233");
    expect(res.body.hostIqama).toBe("1234567890");
    expect(res.body.absher).toBe("Tracked");
    expect(res.body.hostComplete).toBe(true);

    const desk = await request(http)
      .get("/ops/visa/mutamers")
      .query({ groupId, visaType: "LONG_STAY", pageSize: 5 })
      .set(auth(opsTok))
      .expect(200);
    const row = (desk.body.items as Array<{ longStayHost?: { hostComplete?: boolean } }>)[0];
    expect(row?.longStayHost?.hostComplete).toBe(true);
  });

  it("Scenario 3 — Missing required information REJECTED PASS", async () => {
    // Explicit empty WhatsApp while registering
    await request(http)
      .patch(`/ops/long-stays/${longStayId}`)
      .set(auth(opsTok))
      .send({ registerHost: true, hostName: "No WA Host", hostWhatsapp: "" })
      .expect(400);

    // registerHost without hostName
    await request(http)
      .patch(`/ops/long-stays/${longStayId}`)
      .set(auth(opsTok))
      .send({ registerHost: true, hostWhatsapp: "+966500000000", hostName: "" })
      .expect(400);

    // Host register on non-LONG_STAY group rejected
    const umrah = await prisma.group.findFirstOrThrow({
      where: { visaType: "UMRAH", id: { not: groupId } },
    });
    const ls = await prisma.longStay.findFirst({ where: { groupId: umrah.id } });
    if (ls) {
      await request(http)
        .patch(`/ops/long-stays/${ls.id}`)
        .set(auth(opsTok))
        .send({ registerHost: true, hostName: "X", hostWhatsapp: "+9665" })
        .expect(400);
    }
  });

  it("Scenario 4 — Agent attempts update → 403 PASS", async () => {
    await request(http)
      .patch(`/ops/long-stays/${longStayId}`)
      .set(auth(agentTok))
      .send({
        registerHost: true,
        hostName: "Agent Hack",
        hostWhatsapp: "+966599999999",
      })
      .expect(403);

    await request(http)
      .post("/ops/long-stays")
      .set(auth(agentTok))
      .send({
        groupId,
        hotelName: "Hack",
        city: "Makkah",
        nights: 1,
        checkIn: new Date().toISOString(),
        checkOut: new Date().toISOString(),
        pax: 1,
      })
      .expect(403);
  });

  it("Scenario 5 — Audit written PASS", async () => {
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: longStayId, entityType: "LongStay", action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect((audit?.after as { hostName?: string })?.hostName).toBeTruthy();
    expect((audit?.after as { hostComplete?: boolean })?.hostComplete).toBe(true);
  });
});
