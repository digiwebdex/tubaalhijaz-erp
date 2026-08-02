// ─── Registration → verification → approval pipeline (e2e) ──────────────────
// Covers Phase 4: real uploads, document linking, review queue, approval
// side-effects, RBAC endpoints. As of Phase 10 the approval side-effect is
// event-driven (agent.approved → rule R01 → SEND_NOTIFICATION), so the welcome
// notification arrives asynchronously via the queue — assertions poll.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 10000, step = 300): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const r = await fn();
    if (r) return r;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((s) => setTimeout(s, step));
  }
}

const CEO = { email: "ceo@tubalhijaz.com", password: "Demo@123" };
const AGENT_A = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };

describe("Registration pipeline (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const uniq = Date.now();
  const regEmail = `pipe-agent-${uniq}@test.tuba`;
  let adminToken: string;
  let agentToken: string;
  let documentId: string;
  let companyId: string;
  let companyCode: string;
  let tempPassword: string;

  const login = async (creds: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(creds).expect(200)).body.accessToken as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    adminToken = await login(CEO);
    agentToken = await login(AGENT_A);
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.notificationLog.deleteMany({ where: { tenantId: companyId } });
      await prisma.uploadedFile.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({ where: { entityId: companyId } });
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.user.deleteMany({ where: { email: `pipe-staff-${uniq}@test.tuba` } });
    await app.close();
  });

  // ── 1. real file upload ─────────────────────────────────────────────────────
  it("uploads a document and returns documentId + storageKey", async () => {
    const res = await request(http)
      .post("/uploads?kind=TRADE_LICENSE")
      .attach("file", Buffer.from("%PDF-1.4 fake-trade-license"), {
        filename: "TL_Pipeline_Test.pdf",
        contentType: "application/pdf",
      })
      .expect(201);
    expect(res.body.documentId).toBeDefined();
    expect(res.body.storageKey).toMatch(/^\d{4}\/\d{2}\//);
    expect(res.body.kind).toBe("TRADE_LICENSE");
    documentId = res.body.documentId;
  });

  it("rejects disallowed file types", async () => {
    await request(http)
      .post("/uploads")
      .attach("file", Buffer.from("MZ fake exe"), {
        filename: "malware.exe",
        contentType: "application/x-msdownload",
      })
      .expect(400);
  });

  // ── 2. registration claims the uploaded document ────────────────────────────
  it("registers an agent linked to the uploaded document", async () => {
    const res = await request(http)
      .post("/auth/register/agent")
      .send({
        companyName: `Pipeline Travels ${uniq}`,
        crNumber: "CR-1446-77777",
        ownerName: "Pipeline Owner",
        businessEmail: regEmail,
        bankName: "Alinma Bank",
        accountNumber: "99887766554433",
        guarantor1: { name: "P G One", nationalId: "SA333333333" },
        guarantor2: { name: "P G Two", nationalId: "SA444444444" },
        tradeLicenseFileId: documentId,
      })
      .expect(201);
    companyId = res.body.companyId;
    companyCode = res.body.applicationCode;
    tempPassword = res.body.tempPassword;
    expect(res.body.verificationStatus).toBe("PENDING");
  });

  // ── 3. review queue shows the application with its documents ───────────────
  it("appears in the Super Admin pending queue", async () => {
    const res = await request(http)
      .get("/companies?status=PENDING&type=AGENT")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.map((c: { id: string }) => c.id)).toContain(companyId);
  });

  it("detail view exposes profile, guarantors, bank and the linked document", async () => {
    const res = await request(http)
      .get(`/companies/${companyId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.agentProfile.guarantors).toHaveLength(2);
    expect(res.body.bankAccounts).toHaveLength(1);
    expect(res.body.uploadedFiles).toHaveLength(1);
    expect(res.body.uploadedFiles[0].kind).toBe("TRADE_LICENSE");
  });

  it("streams the stored document back to staff", async () => {
    const res = await request(http)
      .get(`/uploads/${documentId}/file`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("does NOT stream another tenant's document to an agent", async () => {
    await request(http)
      .get(`/uploads/${documentId}/file`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(404);
  });

  // ── 4. approval side-effects (now rule-engine driven, Phase 10) ─────────────
  it("approval emits agent.approved → rule R01 queues the welcome notification", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    await request(http)
      .patch(`/companies/${companyId}/verification`)
      .set(auth)
      .send({ status: "UNDER_REVIEW" })
      .expect(200);
    const approvedAt = new Date();
    const approved = await request(http)
      .patch(`/companies/${companyId}/verification`)
      .set(auth)
      .send({ status: "VERIFIED" })
      .expect(200);
    expect(approved.body.verificationStatus).toBe("VERIFIED");

    // Async: the engine (not the endpoint) creates the notification — the whole point.
    const notif = await waitFor(() =>
      prisma.notificationLog.findFirst({ where: { tenantId: companyId }, include: { event: true } }),
    );
    expect(notif.status).toBe("PENDING");
    expect(notif.event?.key).toBe("AGENT_APPROVED");

    // The run was logged against rule R01 (agent.approved → SEND_NOTIFICATION)
    const runLog = await waitFor(() =>
      prisma.automationRunLog.findFirst({
        where: { eventKey: "agent.approved", action: "SEND_NOTIFICATION", startedAt: { gte: approvedAt } },
        include: { rule: true },
        orderBy: { startedAt: "desc" },
      }),
    );
    expect(runLog.rule.code).toBe("R01");
  });

  it("the applicant sees the approval live via /auth/me", async () => {
    const token = await login({ email: regEmail, password: tempPassword });
    const me = await request(http)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(me.body.company.verificationStatus).toBe("VERIFIED");
  });

  // ── 5. Users & Roles management (RBAC endpoints) ────────────────────────────
  describe("user & role management", () => {
    it("agents cannot list users (403)", async () => {
      await request(http).get("/users").set("Authorization", `Bearer ${agentToken}`).expect(403);
    });

    it("admin lists users and roles with permission sets", async () => {
      const users = await request(http).get("/users").set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(users.body.length).toBeGreaterThanOrEqual(10);
      const roles = await request(http).get("/roles").set("Authorization", `Bearer ${adminToken}`).expect(200);
      const superAdmin = roles.body.find((r: { key: string }) => r.key === "SUPER_ADMIN");
      // SUPER_ADMIN holds the full permission set (seed PERMS). Bump when a permission
      // is added — currently 11 (…, MANAGE_FLEET added in Phase 9).
      expect(superAdmin.permissions.length).toBe(11);
    });

    it("admin creates a staff user with a temp password", async () => {
      const res = await request(http)
        .post("/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: `pipe-staff-${uniq}@test.tuba`, name: "Pipeline Staff", roleKey: "FLEET_STAFF" })
        .expect(201);
      expect(res.body.tempPassword).toBeDefined();
      expect(res.body.role.key).toBe("FLEET_STAFF");
    });

    it("updates a role's permission set and restores it", async () => {
      const before = await request(http).get("/roles").set("Authorization", `Bearer ${adminToken}`).expect(200);
      const fleet = before.body.find((r: { key: string }) => r.key === "FLEET_STAFF");
      const original: string[] = fleet.permissions;

      const next = [...new Set([...original, "FINANCIAL_REPORTS"])];
      await request(http)
        .patch("/roles/FLEET_STAFF/permissions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ permissions: next })
        .expect(200);

      const after = await request(http).get("/roles").set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(after.body.find((r: { key: string }) => r.key === "FLEET_STAFF").permissions).toContain("FINANCIAL_REPORTS");

      // restore
      await request(http)
        .patch("/roles/FLEET_STAFF/permissions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ permissions: original })
        .expect(200);
    });

    it("refuses to modify SUPER_ADMIN permissions (lock-out protection)", async () => {
      await request(http)
        .patch("/roles/SUPER_ADMIN/permissions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ permissions: [] })
        .expect(403);
    });
  });
});
