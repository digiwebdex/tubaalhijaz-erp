// ─── Auth + tenancy integration tests ────────────────────────────────────────
// Runs against the seeded dev database (see prisma/seed.ts). Covers:
//   1. login success / failure / portal mismatch
//   2. refresh-token rotation + reuse detection
//   3. tenant isolation — Agent A can NEVER read Agent B's rows
//   4. permission-gated endpoints (verification workflow)
//   5. the verification state machine itself

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const CEO = { email: "ceo@tubalhijaz.com", password: "Demo@123" };
const AGENT_A = { email: "ahmad@rashidi-travel.com", password: "Demo@123" }; // Rashidi (2 groups)
const AGENT_B = { email: "office@alnoor-pilgrim.com", password: "Demo@123" }; // Al-Noor (1 group)

describe("Auth & tenancy (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  const createdCompanyIds: string[] = [];

  const login = async (creds: { email: string; password: string }, portal?: string) => {
    const res = await request(http)
      .post("/auth/login")
      .send({ ...creds, ...(portal ? { portal } : {}) })
      .expect(200);
    return res;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // clean up companies created by the registration tests
    for (const id of createdCompanyIds) {
      await prisma.user.deleteMany({ where: { companyId: id } });
      await prisma.auditLog.deleteMany({ where: { entityId: id } });
      await prisma.company.delete({ where: { id } }).catch(() => undefined);
    }
    await app.close();
  });

  // ── 1. login ────────────────────────────────────────────────────────────────
  describe("login", () => {
    it("succeeds with valid credentials and sets an httpOnly refresh cookie", async () => {
      const res = await login(CEO);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe("SUPER_ADMIN");
      expect(res.body.user.permissions).toContain("APPROVE_COMPANIES");
      const cookies = res.headers["set-cookie"] as unknown as string[];
      const rt = cookies.find((c) => c.startsWith("tuba_rt="));
      expect(rt).toBeDefined();
      expect(rt!).toMatch(/httponly/i);
      // Default Path=/auth (direct API). Production nginx prefix uses REFRESH_COOKIE_PATH=/api/auth.
      const expectedPath = process.env.REFRESH_COOKIE_PATH || "/auth";
      expect(rt!.toLowerCase()).toContain(`path=${expectedPath.toLowerCase()}`);
    });

    it("fails with a wrong password", async () => {
      await request(http)
        .post("/auth/login")
        .send({ email: CEO.email, password: "WrongPass@1" })
        .expect(401);
    });

    it("fails with an unknown email", async () => {
      await request(http)
        .post("/auth/login")
        .send({ email: "nobody@nowhere.com", password: "Demo@123" })
        .expect(401);
    });

    it("rejects a staff account on the agent portal tab", async () => {
      await request(http)
        .post("/auth/login")
        .send({ ...CEO, portal: "agent" })
        .expect(401);
    });

    it("accepts an agent account on the agent portal tab", async () => {
      const res = await login(AGENT_A, "agent");
      expect(res.body.user.role).toBe("AGENT");
      expect(res.body.user.company.code).toBe("AGT-1446-4827");
    });
  });

  // ── /auth/me ────────────────────────────────────────────────────────────────
  describe("me", () => {
    it("requires a token", async () => {
      await request(http).get("/auth/me").expect(401);
    });

    it("returns the current user with role, permissions and company", async () => {
      const { body } = await login(AGENT_A);
      const me = await request(http)
        .get("/auth/me")
        .set("Authorization", `Bearer ${body.accessToken}`)
        .expect(200);
      expect(me.body.email).toBe(AGENT_A.email);
      expect(me.body.company.verificationStatus).toBe("VERIFIED");
    });
  });

  // ── 2. refresh rotation ─────────────────────────────────────────────────────
  describe("refresh", () => {
    it("rotates the refresh token and detects reuse of the old one", async () => {
      const res = await login(CEO);
      const oldCookie = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
        c.startsWith("tuba_rt="),
      )!;

      // First refresh with the original cookie → OK, new cookie issued
      const r1 = await request(http).post("/auth/refresh").set("Cookie", oldCookie).expect(200);
      expect(r1.body.accessToken).toBeDefined();

      // Replaying the ORIGINAL (now rotated) cookie → reuse detected → 401
      await request(http).post("/auth/refresh").set("Cookie", oldCookie).expect(401);
    });

    it("fails without a cookie", async () => {
      await request(http).post("/auth/refresh").expect(401);
    });
  });

  // ── 3. tenant isolation ─────────────────────────────────────────────────────
  describe("tenant isolation", () => {
    it("Agent A sees only their own groups", async () => {
      const { body } = await login(AGENT_A);
      const res = await request(http)
        .get("/groups")
        .set("Authorization", `Bearer ${body.accessToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      for (const g of res.body) expect(g.tenant.code).toBe("AGT-1446-4827");
    });

    it("Agent B cannot fetch Agent A's group by id (404, not leaked)", async () => {
      const a = await login(AGENT_A);
      const aGroups = await request(http)
        .get("/groups")
        .set("Authorization", `Bearer ${a.body.accessToken}`)
        .expect(200);
      const rashidiGroupId = aGroups.body[0].id;

      const b = await login(AGENT_B);
      // B's own list must not contain it…
      const bGroups = await request(http)
        .get("/groups")
        .set("Authorization", `Bearer ${b.body.accessToken}`)
        .expect(200);
      expect(bGroups.body.map((g: { id: string }) => g.id)).not.toContain(rashidiGroupId);
      // …and a direct fetch with a valid token is a 404
      await request(http)
        .get(`/groups/${rashidiGroupId}`)
        .set("Authorization", `Bearer ${b.body.accessToken}`)
        .expect(404);
    });

    it("platform staff see all tenants' groups (cross-tenant)", async () => {
      const { body } = await login(CEO);
      const res = await request(http)
        .get("/groups")
        .set("Authorization", `Bearer ${body.accessToken}`)
        .expect(200);
      const tenants = new Set(res.body.map((g: { tenant: { code: string } }) => g.tenant.code));
      expect(tenants.size).toBeGreaterThan(1);
    });
  });

  // ── 4+5. registration, role gating, verification state machine ─────────────
  describe("registration + verification workflow", () => {
    const uniq = Date.now();
    const regEmail = `e2e-agent-${uniq}@test.tuba`;

    let newCompanyId: string;
    let tempPassword: string;

    it("registers a new agent (wizard fields) and returns a PENDING application", async () => {
      const res = await request(http)
        .post("/auth/register/agent")
        .send({
          companyName: `E2E Travels ${uniq}`,
          crNumber: "CR-1446-99999",
          ownerName: "E2E Owner",
          ownerIdNumber: "SA000000001",
          businessEmail: regEmail,
          bankName: "Al Rajhi Bank",
          accountNumber: "12345678901234",
          iban: "SA00 0000 0000 0000 0000 0000",
          guarantor1: { name: "G One", nationalId: "SA111111111", phone: "+966 5 000 0001" },
          guarantor2: { name: "G Two", nationalId: "SA222222222" },
          referenceAgencyName: "Al Noor Pilgrim Services",
          referenceAgentCode: "AGT-1446-2291",
        })
        .expect(201);
      expect(res.body.applicationCode).toMatch(/^AGT-\d{4}-\d{4}$/);
      expect(res.body.verificationStatus).toBe("PENDING");
      expect(res.body.tempPassword).toBeDefined();
      newCompanyId = res.body.companyId;
      tempPassword = res.body.tempPassword;
      createdCompanyIds.push(newCompanyId);
    });

    it("the new agent can log in with the temporary password", async () => {
      const res = await login({ email: regEmail, password: tempPassword }, "agent");
      expect(res.body.user.company.verificationStatus).toBe("PENDING");
    });

    it("an AGENT cannot transition verification status (403)", async () => {
      const agent = await login(AGENT_A);
      await request(http)
        .patch(`/companies/${newCompanyId}/verification`)
        .set("Authorization", `Bearer ${agent.body.accessToken}`)
        .send({ status: "UNDER_REVIEW" })
        .expect(403);
    });

    it("SUPER_ADMIN walks the state machine PENDING → UNDER_REVIEW → VERIFIED", async () => {
      const admin = await login(CEO);
      const auth = { Authorization: `Bearer ${admin.body.accessToken}` };

      const r1 = await request(http)
        .patch(`/companies/${newCompanyId}/verification`)
        .set(auth)
        .send({ status: "UNDER_REVIEW" })
        .expect(200);
      expect(r1.body.verificationStatus).toBe("UNDER_REVIEW");

      const r2 = await request(http)
        .patch(`/companies/${newCompanyId}/verification`)
        .set(auth)
        .send({ status: "VERIFIED" })
        .expect(200);
      expect(r2.body.verificationStatus).toBe("VERIFIED");
    });

    it("rejects an illegal transition (VERIFIED → UNDER_REVIEW)", async () => {
      const admin = await login(CEO);
      await request(http)
        .patch(`/companies/${newCompanyId}/verification`)
        .set("Authorization", `Bearer ${admin.body.accessToken}`)
        .send({ status: "UNDER_REVIEW" })
        .expect(400);
    });

    it("requires a reason when rejecting", async () => {
      const uniq2 = Date.now() + 1;
      const reg = await request(http)
        .post("/auth/register/supplier")
        .send({
          type: "HOTEL",
          companyName: `E2E Hotel ${uniq2}`,
          contactPerson: "E2E Contact",
          businessEmail: `e2e-sup-${uniq2}@test.tuba`,
          starRating: 4,
          district: "Ajyad",
        })
        .expect(201);
      createdCompanyIds.push(reg.body.companyId);

      const admin = await login(CEO);
      await request(http)
        .patch(`/companies/${reg.body.companyId}/verification`)
        .set("Authorization", `Bearer ${admin.body.accessToken}`)
        .send({ status: "REJECTED" })
        .expect(400); // no reason given

      await request(http)
        .patch(`/companies/${reg.body.companyId}/verification`)
        .set("Authorization", `Bearer ${admin.body.accessToken}`)
        .send({ status: "REJECTED", reason: "Trade License appears to be expired" })
        .expect(200);
    });

    it("the verification change is visible live via /auth/me (UI badge source)", async () => {
      const res = await login({ email: regEmail, password: tempPassword });
      const me = await request(http)
        .get("/auth/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(me.body.company.verificationStatus).toBe("VERIFIED");
    });

    it("gates the company list on APPROVE_COMPANIES permission", async () => {
      const agent = await login(AGENT_A);
      await request(http)
        .get("/companies")
        .set("Authorization", `Bearer ${agent.body.accessToken}`)
        .expect(403);

      const admin = await login(CEO);
      const res = await request(http)
        .get("/companies")
        .set("Authorization", `Bearer ${admin.body.accessToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(8);
    });
  });
});
