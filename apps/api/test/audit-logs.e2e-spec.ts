// ─── Audit log read API (S2-01) ──────────────────────────────────────────────
// GET /audit-logs gated on ACCESS_AUDIT_LOGS; tenant JWTs rejected; filters +
// pagination + sorting over existing AuditLog rows.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const PW = "Demo@123";

describe("Audit logs read API (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let prisma: PrismaService;
  let financeTok = "";
  let ceoTok = "";
  let adminTok = "";
  let opsTok = "";
  let agentTok = "";
  let seededActorId = "";
  let seededId = "";

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = async (email: string) =>
    (await request(http).post("/auth/login").send({ email, password: PW }).expect(200)).body
      .accessToken as string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);

    financeTok = await login("finance@tubalhijaz.com");
    ceoTok = await login("chairman@tubalhijaz.com");
    adminTok = await login("ceo@tubalhijaz.com");
    opsTok = await login("ops@tubalhijaz.com");
    agentTok = await login("ahmad@rashidi-travel.com");

    const actor = await prisma.user.findFirst({
      where: { email: "finance@tubalhijaz.com" },
      select: { id: true },
    });
    seededActorId = actor!.id;

    const row = await prisma.auditLog.create({
      data: {
        actorUserId: seededActorId,
        action: "VIEW",
        module: "Finance",
        entityType: "Invoice",
        entityId: "e2e-audit-invoice-1",
        after: { probe: true },
        ip: "127.0.0.1",
      },
    });
    seededId = row.id;
  });

  afterAll(async () => {
    if (seededId) await prisma.auditLog.deleteMany({ where: { id: seededId } });
    await app.close();
  });

  it("unauthenticated → 401", async () => {
    await request(http).get("/audit-logs").expect(401);
  });

  it("roles without ACCESS_AUDIT_LOGS → 403 (ops, agent)", async () => {
    await request(http).get("/audit-logs").set(auth(opsTok)).expect(403);
    await request(http).get("/audit-logs").set(auth(agentTok)).expect(403);
  });

  it("tenant isolation: agent cannot read platform audit trail (403)", async () => {
    const res = await request(http).get("/audit-logs").set(auth(agentTok));
    expect(res.status).toBe(403);
  });

  it("finance / CEO / super-admin can list (200) with pagination shape", async () => {
    for (const tok of [financeTok, ceoTok, adminTok]) {
      const res = await request(http)
        .get("/audit-logs")
        .query({ page: 1, pageSize: 10 })
        .set(auth(tok))
        .expect(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(typeof res.body.total).toBe("number");
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(10);
      expect(res.body.sort).toBe("createdAt:desc");
    }
  });

  it("filters by action + module + entity + user", async () => {
    const res = await request(http)
      .get("/audit-logs")
      .query({
        action: "VIEW",
        module: "Finance",
        entity: "Invoice",
        entityId: "e2e-audit-invoice-1",
        user: seededActorId,
        pageSize: 50,
      })
      .set(auth(financeTok))
      .expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some((i: { id: string }) => i.id === seededId)).toBe(true);
    for (const item of res.body.items) {
      expect(item.action).toBe("VIEW");
      expect(item.module.toLowerCase()).toBe("finance");
      expect(item.entityType.toLowerCase()).toBe("invoice");
    }
  });

  it("date range filter includes seeded row", async () => {
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const res = await request(http)
      .get("/audit-logs")
      .query({ from, to, entityId: "e2e-audit-invoice-1" })
      .set(auth(financeTok))
      .expect(200);
    expect(res.body.items.some((i: { id: string }) => i.id === seededId)).toBe(true);
  });

  it("sorting createdAt:asc vs desc", async () => {
    const desc = await request(http)
      .get("/audit-logs")
      .query({ pageSize: 5, sort: "createdAt:desc" })
      .set(auth(financeTok))
      .expect(200);
    const asc = await request(http)
      .get("/audit-logs")
      .query({ pageSize: 5, sort: "createdAt:asc" })
      .set(auth(financeTok))
      .expect(200);
    expect(desc.body.sort).toBe("createdAt:desc");
    expect(asc.body.sort).toBe("createdAt:asc");
    if (desc.body.items.length >= 2) {
      const d0 = new Date(desc.body.items[0].createdAt).getTime();
      const d1 = new Date(desc.body.items[1].createdAt).getTime();
      expect(d0).toBeGreaterThanOrEqual(d1);
    }
    if (asc.body.items.length >= 2) {
      const a0 = new Date(asc.body.items[0].createdAt).getTime();
      const a1 = new Date(asc.body.items[1].createdAt).getTime();
      expect(a0).toBeLessThanOrEqual(a1);
    }
  });

  it("pagination pages are disjoint when total > pageSize", async () => {
    const page1 = await request(http)
      .get("/audit-logs")
      .query({ page: 1, pageSize: 2 })
      .set(auth(financeTok))
      .expect(200);
    if (page1.body.total <= 2) return;
    const page2 = await request(http)
      .get("/audit-logs")
      .query({ page: 2, pageSize: 2 })
      .set(auth(financeTok))
      .expect(200);
    const ids1 = new Set(page1.body.items.map((i: { id: string }) => i.id));
    for (const item of page2.body.items) expect(ids1.has(item.id)).toBe(false);
  });
});
