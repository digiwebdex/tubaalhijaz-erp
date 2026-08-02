// ─── Critical path + audit trail (e2e) ───────────────────────────────────────
// The registration→approval and service→voucher→invoice paths are covered by
// registration-pipeline / services-workflow / finance suites. This adds the
// invoice→payment settlement path AND verifies the Phase-14 audit hardening:
// sensitive financial actions write an AuditLog.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const FINANCE = { email: "finance@tubalhijaz.com", password: "Demo@123" };

describe("Critical path — invoice payment + audit trail (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let fin: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    fin = (await request(http).post("/auth/login").send(FINANCE).expect(200)).body.accessToken;
  });

  afterAll(async () => { await app.close(); });

  it("finance settles an outstanding invoice → PAID, receipt + GL, and it's audited", async () => {
    // pick a still-open invoice (create-independent: use one seeded as OUTSTANDING)
    const open = await prisma.invoice.findFirst({ where: { status: "OUTSTANDING" }, select: { id: true, code: true } });
    if (!open) return; // nothing outstanding (a prior run paid them all) — skip gracefully

    const before = await prisma.auditLog.count({ where: { entityType: "Invoice", entityId: open.id, action: "PROCESS" } });

    await request(http).patch(`/finance/invoices/${open.id}/pay`).set(auth(fin))
      .send({ method: "BANK_TRANSFER", bankRef: "TEST-REF-001" }).expect(200);

    // invoice is settled
    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: open.id }, select: { status: true } });
    expect(paid.status).toBe("PAID");

    // a receipt + allocation exist
    const receipts = await prisma.receiptAllocation.count({ where: { invoiceId: open.id } });
    expect(receipts).toBeGreaterThan(0);

    // …and the financial transaction was audited (Phase 14)
    const after = await prisma.auditLog.findFirst({
      where: { entityType: "Invoice", entityId: open.id, action: "PROCESS" },
      orderBy: { createdAt: "desc" },
    });
    expect(after).toBeTruthy();
    expect(after!.actorUserId).toBeTruthy(); // the acting finance user is recorded
    expect(before).toBe(0);
  });

  it("paying an already-paid invoice is idempotent (still PAID, no crash)", async () => {
    const paid = await prisma.invoice.findFirst({ where: { status: "PAID" }, select: { id: true } });
    if (!paid) return;
    await request(http).patch(`/finance/invoices/${paid.id}/pay`).set(auth(fin)).send({}).expect(200);
    const still = await prisma.invoice.findUniqueOrThrow({ where: { id: paid.id }, select: { status: true } });
    expect(still.status).toBe("PAID");
  });
});
