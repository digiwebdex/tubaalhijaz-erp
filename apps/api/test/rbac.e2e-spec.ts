// ─── RBAC + tenant isolation matrix (e2e) ────────────────────────────────────
// Every role × every permission-gated module: confirm 200 where allowed and 403
// where not. Plus tenant isolation: an agent can only ever see its own company's
// data, and a cross-tenant fetch 404s.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";

const PW = "Demo@123";
const ROLE_EMAIL: Record<string, string> = {
  SUPER_ADMIN: "ceo@tubalhijaz.com",
  OPS_STAFF: "ops@tubalhijaz.com",
  FINANCE_STAFF: "finance@tubalhijaz.com",
  FLEET_STAFF: "fleet@tubalhijaz.com",
  CEO_VIEWER: "chairman@tubalhijaz.com",
  AGENT: "ahmad@rashidi-travel.com",
  SUPPLIER: "manager@jabalomar-hyatt.sa",
  DRIVER: "driver.ahmad@tubalhijaz.com",
};
const ALL_ROLES = Object.keys(ROLE_EMAIL);

// permission → roles that hold it (from the seed's RBAC matrix)
const HOLDERS: Record<string, string[]> = {
  VIEW_DASHBOARD: ["SUPER_ADMIN", "OPS_STAFF", "FINANCE_STAFF", "FLEET_STAFF", "CEO_VIEWER"],
  MANAGE_FLEET: ["SUPER_ADMIN", "FLEET_STAFF"],
  FINANCIAL_REPORTS: ["SUPER_ADMIN", "FINANCE_STAFF", "CEO_VIEWER"],
  CONFIGURE_WORKFLOWS: ["SUPER_ADMIN", "OPS_STAFF"],
  MANAGE_USERS: ["SUPER_ADMIN"],
  APPROVE_COMPANIES: ["SUPER_ADMIN", "OPS_STAFF"],
  REVIEW_OCR_QUEUE: ["SUPER_ADMIN", "OPS_STAFF"],
  ACCESS_AUDIT_LOGS: ["SUPER_ADMIN", "FINANCE_STAFF", "CEO_VIEWER"],
};

// one representative GET per permission-gated module
const MATRIX: Array<{ label: string; path: string; perm: keyof typeof HOLDERS }> = [
  { label: "Dashboards", path: "/dashboards/ceo", perm: "VIEW_DASHBOARD" },
  { label: "Ops boards", path: "/ops/arrivals", perm: "VIEW_DASHBOARD" },
  { label: "Fleet", path: "/fleet/vehicles", perm: "MANAGE_FLEET" },
  { label: "Finance P&L", path: "/finance/pl", perm: "FINANCIAL_REPORTS" },
  { label: "Automation rules", path: "/automation/rules", perm: "CONFIGURE_WORKFLOWS" },
  { label: "Users", path: "/users", perm: "MANAGE_USERS" },
  { label: "Roles", path: "/roles", perm: "MANAGE_USERS" },
  { label: "Companies", path: "/companies", perm: "APPROVE_COMPANIES" },
  { label: "OCR review queue", path: "/ocr/documents", perm: "REVIEW_OCR_QUEUE" },
  { label: "Audit logs", path: "/audit-logs", perm: "ACCESS_AUDIT_LOGS" },
];

describe("RBAC + tenant isolation (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  const tok: Record<string, string> = {};
  let agentB = "";

  const login = async (email: string) =>
    (await request(http).post("/auth/login").send({ email, password: PW }).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    for (const [role, email] of Object.entries(ROLE_EMAIL)) tok[role] = await login(email);
    agentB = await login("office@alnoor-pilgrim.com"); // a different agency
  });

  afterAll(async () => { await app.close(); });

  it("unauthenticated requests are rejected (401)", async () => {
    await request(http).get("/dashboards/ceo").expect(401);
    await request(http).get("/fleet/vehicles").expect(401);
  });

  // ── the matrix: every role against every gated module ────────────────────────
  for (const entry of MATRIX) {
    describe(`${entry.label} (${entry.perm})`, () => {
      for (const role of ALL_ROLES) {
        const allowed = HOLDERS[entry.perm].includes(role);
        it(`${role} → ${allowed ? "allowed" : "403"}`, async () => {
          const res = await request(http).get(entry.path).set(auth(tok[role]));
          if (allowed) expect(res.status).toBeLessThan(400);
          else expect(res.status).toBe(403);
        });
      }
    });
  }

  // ── write-side gate: only EDIT_FINANCIAL_RECORDS may mutate finance ──────────
  it("agents/ops cannot pay an invoice (403), finance staff can reach it", async () => {
    await request(http).patch("/finance/invoices/nope/pay").set(auth(tok.AGENT)).send({}).expect(403);
    await request(http).patch("/finance/invoices/nope/pay").set(auth(tok.OPS_STAFF)).send({}).expect(403);
    // finance staff pass the gate → not 403 (404 for the bogus id is fine)
    const res = await request(http).patch("/finance/invoices/nope/pay").set(auth(tok.FINANCE_STAFF)).send({});
    expect(res.status).not.toBe(403);
  });

  // ── tenant isolation ─────────────────────────────────────────────────────────
  it("an agent sees only its own company's groups", async () => {
    const a = await request(http).get("/groups").set(auth(tok.AGENT)).expect(200);
    expect(a.body.length).toBeGreaterThan(0);
    const b = await request(http).get("/groups").set(auth(agentB)).expect(200);
    const aIds = new Set(a.body.map((g: { id: string }) => g.id));
    for (const g of b.body) expect(aIds.has(g.id)).toBe(false); // disjoint sets
  });

  it("cross-tenant fetch by id 404s (scoped client)", async () => {
    const a = await request(http).get("/groups").set(auth(tok.AGENT)).expect(200);
    const someAId = a.body[0].id;
    // agent B may not read agent A's group
    await request(http).get(`/groups/${someAId}`).set(auth(agentB)).expect(404);
    // but agent A can
    await request(http).get(`/groups/${someAId}`).set(auth(tok.AGENT)).expect(200);
  });
});
