// T002-02 — Mutamer Visa Desk Board (e2e)
// Worklist UI/API on Passenger via GET /ops/visa/mutamers.
// Covers: staff open desk, embassy filter, visaState filter, pagination, agent 403.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { deriveDeskVisaState } from "../src/ops/visa-desk.util";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };

describe("T002-02 Mutamer Visa Desk (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  const touchedPassengerIds: string[] = [];

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
    [agentTok, opsTok] = await Promise.all([login(AGENT), login(OPS)]);

    // Ensure a few passengers have distinct derived states for filters.
    const group = await prisma.group.findFirst({
      where: { code: "GRP-1446-2891" },
      include: { passengers: { take: 5, orderBy: { code: "asc" } } },
    });
    if (group && group.passengers.length >= 3) {
      const [a, b, c] = group.passengers;
      await prisma.passenger.update({
        where: { id: a.id },
        data: {
          biometricStatus: null,
          visaNumber: null,
          visaStatus: "PENDING",
          visaStatusLabel: "Visa Not Issued",
        },
      });
      await prisma.passenger.update({
        where: { id: b.id },
        data: {
          biometricStatus: "Registered",
          visaNumber: null,
          visaStatus: "PENDING",
          visaStatusLabel: "Visa Not Issued",
        },
      });
      await prisma.passenger.update({
        where: { id: c.id },
        data: {
          biometricStatus: "Registered",
          visaNumber: "V-T002-02",
          visaStatus: "APPROVED",
          visaStatusLabel: "Visa Issued",
        },
      });
      touchedPassengerIds.push(a.id, b.id, c.id);

      // Embassy on latest batch for group (embassy filter).
      await prisma.visaRequest.updateMany({
        where: { groupId: group.id },
        data: { embassy: "Saudi Embassy Dhaka" },
      });
      if (!(await prisma.group.findFirst({ where: { id: group.id, consulate: { not: null } } }))) {
        await prisma.group.update({
          where: { id: group.id },
          data: { consulate: "Dhaka" },
        });
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("deriveDeskVisaState maps T001 fields (§3.6)", () => {
    expect(deriveDeskVisaState({ visaStatus: "PENDING", visaStatusLabel: "Visa Not Issued" })).toBe("NEW");
    expect(
      deriveDeskVisaState({
        biometricStatus: "Registered",
        visaStatus: "PENDING",
        visaStatusLabel: "Visa Not Issued",
      }),
    ).toBe("BIOMETRIC");
    expect(
      deriveDeskVisaState({
        visaNumber: "V1",
        visaStatus: "APPROVED",
        visaStatusLabel: "Visa Issued",
      }),
    ).toBe("ISSUED");
    expect(deriveDeskVisaState({ visaStatus: "REJECTED", visaStatusLabel: "Rejected" })).toBe("REJECTED");
  });

  it("Scenario 1 — Officer opens desk → PASS", async () => {
    const res = await request(http)
      .get("/ops/visa/mutamers")
      .set(auth(opsTok))
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(25);
    expect(res.body.counts).toBeDefined();
    expect(res.body.counts.ALL).toBeGreaterThan(0);
    const row = res.body.items[0];
    expect(row).toHaveProperty("visaState");
    expect(row).toHaveProperty("group");
    expect(row.group).toHaveProperty("code");
    expect(row).toHaveProperty("passportNo");
    expect(row).toHaveProperty("embassy");
    expect(row.assignedOfficer).toBeNull();
  });

  it("Scenario 2 — Filter by Embassy → PASS", async () => {
    const res = await request(http)
      .get("/ops/visa/mutamers")
      .query({ embassy: "Dhaka", pageSize: 50 })
      .set(auth(opsTok))
      .expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const row of res.body.items) {
      const emb = `${row.embassy ?? ""} ${row.group?.consulate ?? ""}`.toLowerCase();
      expect(emb.includes("dhaka")).toBe(true);
    }
  });

  it("Scenario 3 — Filter by Visa State → PASS", async () => {
    const bio = await request(http)
      .get("/ops/visa/mutamers")
      .query({ visaState: "BIOMETRIC", pageSize: 50 })
      .set(auth(opsTok))
      .expect(200);
    expect(bio.body.total).toBeGreaterThan(0);
    for (const row of bio.body.items) {
      expect(row.visaState).toBe("BIOMETRIC");
    }

    const issued = await request(http)
      .get("/ops/visa/mutamers")
      .query({ visaState: "ISSUED", pageSize: 50 })
      .set(auth(opsTok))
      .expect(200);
    expect(issued.body.total).toBeGreaterThan(0);
    for (const row of issued.body.items) {
      expect(row.visaState).toBe("ISSUED");
    }
  });

  it("Scenario 4 — Agent attempts access → 403 PASS", async () => {
    await request(http)
      .get("/ops/visa/mutamers")
      .set(auth(agentTok))
      .expect(403);
  });

  it("Scenario 5 — Pagination → PASS", async () => {
    const p1 = await request(http)
      .get("/ops/visa/mutamers")
      .query({ page: 1, pageSize: 5 })
      .set(auth(opsTok))
      .expect(200);
    expect(p1.body.page).toBe(1);
    expect(p1.body.pageSize).toBe(5);
    expect(p1.body.items.length).toBeLessThanOrEqual(5);
    expect(p1.body.total).toBeGreaterThan(5);

    const p2 = await request(http)
      .get("/ops/visa/mutamers")
      .query({ page: 2, pageSize: 5 })
      .set(auth(opsTok))
      .expect(200);
    expect(p2.body.page).toBe(2);
    expect(p2.body.items.length).toBeGreaterThan(0);
    const ids1 = new Set(p1.body.items.map((r: { id: string }) => r.id));
    for (const r of p2.body.items) {
      expect(ids1.has(r.id)).toBe(false);
    }
  });

  it("regression — arrivingWithinDays and visaType filters accepted", async () => {
    const res = await request(http)
      .get("/ops/visa/mutamers")
      .query({ arrivingWithinDays: 7, visaType: "UMRAH", pageSize: 10 })
      .set(auth(opsTok))
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const row of res.body.items) {
      expect(row.group.visaType).toBe("UMRAH");
    }
  });
});
