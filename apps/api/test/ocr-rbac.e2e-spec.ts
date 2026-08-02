// ─── OCR review permission gate (S1-01) ───────────────────────────────────────
// REVIEW_OCR_QUEUE gates list + override/approve/reject.
// Agents may still POST /ocr/documents (submit) and GET /ocr/documents/:id (poll).

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";

const PW = "Demo@123";

describe("OCR REVIEW_OCR_QUEUE gate (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok = "";
  let opsTok = "";
  let financeTok = "";
  let adminTok = "";

  const login = async (email: string) =>
    (await request(http).post("/auth/login").send({ email, password: PW }).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    agentTok = await login("ahmad@rashidi-travel.com");
    opsTok = await login("ops@tubalhijaz.com");
    financeTok = await login("finance@tubalhijaz.com");
    adminTok = await login("ceo@tubalhijaz.com");
  });

  afterAll(async () => {
    await app.close();
  });

  it("unauthenticated review routes are 401", async () => {
    await request(http).get("/ocr/documents").expect(401);
    await request(http).post("/ocr/documents/x/approve").send({}).expect(401);
  });

  it("AGENT cannot list the OCR review queue (403)", async () => {
    await request(http).get("/ocr/documents").set(auth(agentTok)).expect(403);
  });

  it("FINANCE_STAFF cannot list or mutate OCR review (403)", async () => {
    await request(http).get("/ocr/documents").set(auth(financeTok)).expect(403);
    await request(http).post("/ocr/documents/nope/override").set(auth(financeTok)).send({ fields: [] }).expect(403);
    await request(http).post("/ocr/documents/nope/approve").set(auth(financeTok)).send({}).expect(403);
    await request(http).post("/ocr/documents/nope/reject").set(auth(financeTok)).send({}).expect(403);
    await request(http).post("/ocr/documents/nope/reprocess").set(auth(financeTok)).send({}).expect(403);
  });

  it("AGENT cannot override / approve / reject / reprocess (403)", async () => {
    await request(http).post("/ocr/documents/nope/override").set(auth(agentTok)).send({ fields: [{ field: "name", value: "X" }] }).expect(403);
    await request(http).post("/ocr/documents/nope/approve").set(auth(agentTok)).send({}).expect(403);
    await request(http).post("/ocr/documents/nope/reject").set(auth(agentTok)).send({ reason: "no" }).expect(403);
    await request(http).post("/ocr/documents/nope/reprocess").set(auth(agentTok)).send({}).expect(403);
  });

  it("OPS_STAFF and SUPER_ADMIN pass the review gate (not 403)", async () => {
    for (const tok of [opsTok, adminTok]) {
      const list = await request(http).get("/ocr/documents").set(auth(tok));
      expect(list.status).toBeLessThan(400);

      // bogus id: permission gate passes → 404/400, never 403
      const approve = await request(http).post("/ocr/documents/nope/approve").set(auth(tok)).send({});
      expect(approve.status).not.toBe(403);

      const reject = await request(http).post("/ocr/documents/nope/reject").set(auth(tok)).send({});
      expect(reject.status).not.toBe(403);

      const override = await request(http).post("/ocr/documents/nope/override").set(auth(tok)).send({ fields: [] });
      expect(override.status).not.toBe(403);
    }
  });

  it("AGENT may still submit OCR (create is not REVIEW_OCR_QUEUE-gated)", async () => {
    // Missing/invalid uploadedFileId → business error, not permission denial
    const res = await request(http)
      .post("/ocr/documents")
      .set(auth(agentTok))
      .send({ uploadedFileId: "nonexistent-file-id", documentType: "PASSPORT" });
    expect(res.status).not.toBe(403);
    expect([400, 404]).toContain(res.status);
  });

  it("AGENT may poll GET /ocr/documents/:id (tenant-scoped; not review-gated)", async () => {
    // Unknown id → 404 (scoped), not 403 from permissions
    const res = await request(http).get("/ocr/documents/nonexistent-ocr-id").set(auth(agentTok));
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(404);
  });
});
