// ─── Service request → fulfillment round trips (e2e) ────────────────────────
// One full loop per service type:
//   agent creates request → auto-routed to the matching supplier →
//   supplier sees it in /supplier/bookings → accepts →
//   voucher PDF generated + BRN linked → agent sees "Voucher Ready".
// Plus: reject-with-reason, visa/additional ops pipelines, cross-supplier isolation.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" }; // Rashidi
const HOTEL_SUP = { email: "manager@jabalomar-hyatt.sa", password: "Demo@123" }; // Jabal Omar (HOTEL)
const TRANSPORT_SUP = { email: "dispatch@alnaqil.sa", password: "Demo@123" }; // Al-Naqil (TRANSPORT)
const CATERING_SUP = { email: "kitchen@albarakah.sa", password: "Demo@123" }; // Al-Barakah (CATERING)
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };

describe("Service workflows (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  let agentToken: string;
  let hotelSupToken: string;
  let transportSupToken: string;
  let cateringSupToken: string;
  let opsToken: string;
  let groupId: string; // one of Rashidi's groups
  const created: Array<{ service: string; model: string; id: string }> = [];

  const login = async (creds: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(creds).expect(200)).body.accessToken as string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);

    [agentToken, hotelSupToken, transportSupToken, cateringSupToken, opsToken] = await Promise.all([
      login(AGENT), login(HOTEL_SUP), login(TRANSPORT_SUP), login(CATERING_SUP), login(OPS),
    ]);
    const groups = await request(http).get("/groups").set(auth(agentToken)).expect(200);
    groupId = groups.body.find((g: { code: string }) => g.code === "GRP-1446-2401")?.id ?? groups.body[0].id;
  });

  afterAll(async () => {
    // remove everything the tests created (vouchers/files/BRNs cascade off bookings via explicit cleanup)
    for (const c of created) {
      const vouchers = await prisma.voucher.findMany({ where: { refType: c.model, refId: c.id } });
      for (const v of vouchers) {
        await prisma.voucher.delete({ where: { id: v.id } });
        if (v.fileId) await prisma.uploadedFile.delete({ where: { id: v.fileId } }).catch(() => undefined);
      }
      await prisma.bRN.deleteMany({ where: { OR: [{ hotelBookingId: c.id }, { detail: { contains: c.id } }] } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any)[c.model].delete({ where: { id: c.id } }).catch(() => undefined);
    }
    await app.close();
  });

  // ── HOTEL: the flagship round trip ───────────────────────────────────────────
  describe("hotel round trip", () => {
    let bookingId: string;
    let bookingCode: string;

    it("agent creates a hotel request (wizard fields) → auto-assigned to the hotel supplier", async () => {
      const hotels = await request(http).get("/hotels").set(auth(agentToken)).expect(200);
      const jabal = hotels.body.find((h: { name: string }) => h.name.includes("Jabal Omar"));
      const res = await request(http)
        .post("/services/hotel")
        .set(auth(agentToken))
        .send({
          groupId,
          hotelId: jabal.id,
          checkIn: "2026-08-15",
          checkOut: "2026-08-29",
          doubleRooms: 10,
          tripleRooms: 3,
          mealPlan: "FULL_BOARD",
          specialRequests: "Ground floor rooms preferred for elderly guests.",
        })
        .expect(201);
      bookingId = res.body.id;
      bookingCode = res.body.code;
      created.push({ service: "hotel", model: "hotelBooking", id: bookingId });
      expect(res.body.status).toBe("ASSIGNED");
      expect(res.body.nights).toBe(14);
      expect(Number(res.body.totalAmount)).toBeGreaterThan(0);
    });

    it("the hotel supplier sees it in their incoming bookings", async () => {
      const res = await request(http).get("/supplier/bookings").set(auth(hotelSupToken)).expect(200);
      const mine = res.body.find((b: { id: string }) => b.id === bookingId);
      expect(mine).toBeTruthy();
      expect(mine.agent).toBe("Rashidi Travel Co. LLC");
      expect(mine.status).toBe("ASSIGNED");
    });

    it("a DIFFERENT supplier cannot see or accept it", async () => {
      const res = await request(http).get("/supplier/bookings").set(auth(transportSupToken)).expect(200);
      expect(res.body.map((b: { id: string }) => b.id)).not.toContain(bookingId);
      await request(http)
        .post(`/supplier/bookings/hotel/${bookingId}/accept`)
        .set(auth(transportSupToken))
        .expect(404);
    });

    it("supplier accepts → voucher PDF generated, BRN linked, status VOUCHER_ISSUED", async () => {
      const res = await request(http)
        .post(`/supplier/bookings/hotel/${bookingId}/accept`)
        .set(auth(hotelSupToken))
        .expect(201);
      expect(res.body.status).toBe("VOUCHER_ISSUED");
      expect(res.body.voucher.code).toMatch(/^VCH-\d{4}-\d+-HOT/);

      const voucher = await prisma.voucher.findFirst({ where: { refType: "hotelBooking", refId: bookingId } });
      expect(voucher).toBeTruthy();
      expect(voucher!.fileId).toBeTruthy();
      const file = await prisma.uploadedFile.findUnique({ where: { id: voucher!.fileId! } });
      expect(file!.mimeType).toBe("application/pdf");
      expect(file!.sizeBytes).toBeGreaterThan(1000); // a real rendered PDF
      const brn = await prisma.bRN.findFirst({ where: { hotelBookingId: bookingId } });
      expect(brn!.status).toBe("FULFILLED");
    });

    it("agent sees Voucher Ready and can download the PDF", async () => {
      const list = await request(http)
        .get(`/services/hotel?groupId=${groupId}`)
        .set(auth(agentToken))
        .expect(200);
      const mine = list.body.find((b: { id: string }) => b.id === bookingId);
      expect(mine.status).toBe("VOUCHER_ISSUED");
      expect(mine.voucher).toBeTruthy();

      const pdf = await request(http)
        .get(`/uploads/${mine.voucher.fileId}/file`)
        .set(auth(agentToken))
        .expect(200);
      expect(pdf.headers["content-type"]).toContain("application/pdf");
      expect(pdf.body.length ?? pdf.text.length).toBeGreaterThan(1000);

      // voucher-ready notification record exists for the agent tenant
      const notif = await prisma.notificationLog.findFirst({
        where: { title: { contains: mine.voucher.code } },
      });
      expect(notif).toBeTruthy();
      await prisma.notificationLog.deleteMany({ where: { title: { contains: mine.voucher.code } } });
    });
  });

  // ── TRANSPORT round trip ─────────────────────────────────────────────────────
  it("transport: create → supplier accept → voucher → agent sees ready", async () => {
    const res = await request(http)
      .post("/services/transport")
      .set(auth(agentToken))
      .send({
        groupId,
        vehicleType: "BUS",
        vehicleCount: 2,
        departurePoint: "Jeddah North Terminal",
        destination: "Makkah → Madinah",
        departAt: "2026-08-15T10:00:00Z",
        returnAt: "2026-08-29T14:00:00Z",
        stopPoints: "Hotel → Haram → Mina",
      })
      .expect(201);
    created.push({ service: "transport", model: "transportBooking", id: res.body.id });
    expect(res.body.status).toBe("ASSIGNED");

    const incoming = await request(http).get("/supplier/bookings").set(auth(transportSupToken)).expect(200);
    expect(incoming.body.map((b: { id: string }) => b.id)).toContain(res.body.id);

    const accept = await request(http)
      .post(`/supplier/bookings/transport/${res.body.id}/accept`)
      .set(auth(transportSupToken))
      .expect(201);
    expect(accept.body.voucher.code).toMatch(/-TRA/);

    const list = await request(http)
      .get(`/services/transport?groupId=${groupId}`)
      .set(auth(agentToken))
      .expect(200);
    const mine = list.body.find((b: { id: string }) => b.id === res.body.id);
    expect(mine.status).toBe("VOUCHER_ISSUED");
    expect(mine.voucher.fileId).toBeTruthy();
    await prisma.notificationLog.deleteMany({ where: { title: { contains: accept.body.voucher.code } } });
  });

  // ── CATERING round trip (incl. reject → re-assign → accept) ────────────────
  it("catering: create → supplier REJECTS with reason → ops re-assigns → accept → voucher", async () => {
    const res = await request(http)
      .post("/services/catering")
      .set(auth(agentToken))
      .send({
        groupId,
        mealPlan: "FULL_BOARD",
        halalCount: 25,
        vegetarianCount: 2,
        diabeticCount: 1,
        startDate: "2026-08-15",
        endDate: "2026-08-29",
        specialInstructions: "Deliver to lobby level.",
      })
      .expect(201);
    created.push({ service: "catering", model: "cateringBooking", id: res.body.id });
    expect(res.body.status).toBe("ASSIGNED");
    expect(Number(res.body.totalAmount)).toBeGreaterThan(0); // 140 × pax × 14 days

    // reject requires a reason
    await request(http)
      .post(`/supplier/bookings/catering/${res.body.id}/reject`)
      .set(auth(cateringSupToken))
      .send({})
      .expect(400);
    const rejected = await request(http)
      .post(`/supplier/bookings/catering/${res.body.id}/reject`)
      .set(auth(cateringSupToken))
      .send({ reason: "No kitchen capacity for these dates" })
      .expect(201);
    expect(rejected.body.status).toBe("REJECTED");
    expect(rejected.body.statusReason).toContain("kitchen capacity");

    // ops re-assigns (REJECTED → ASSIGNED) then the supplier accepts
    await request(http)
      .patch(`/services/catering/${res.body.id}/status`)
      .set(auth(opsToken))
      .send({ status: "ASSIGNED" })
      .expect(200);
    const accept = await request(http)
      .post(`/supplier/bookings/catering/${res.body.id}/accept`)
      .set(auth(cateringSupToken))
      .expect(201);
    expect(accept.body.voucher.code).toMatch(/-CAT/);
    await prisma.notificationLog.deleteMany({ where: { title: { contains: accept.body.voucher.code } } });
  });

  // ── VISA pipeline (ops-fulfilled, no supplier) ──────────────────────────────
  it("visa: create → ops walks REQUESTED→ASSIGNED→CONFIRMED→COMPLETED", async () => {
    const res = await request(http)
      .post("/services/visa")
      .set(auth(agentToken))
      .send({
        groupId,
        visaType: "UMRAH",
        applicationYearHijri: "1446",
        nusukRef: "NK-14462401-AG",
        muallimNo: "MU-0099-1446",
        mohCategory: "A",
      })
      .expect(201);
    created.push({ service: "visa", model: "visaRequest", id: res.body.id });
    expect(res.body.status).toBe("REQUESTED");

    for (const status of ["ASSIGNED", "CONFIRMED", "COMPLETED"]) {
      const r = await request(http)
        .patch(`/services/visa/${res.body.id}/status`)
        .set(auth(opsToken))
        .send({ status })
        .expect(200);
      expect(r.body.status).toBe(status);
    }
    // agent sees the final state
    const list = await request(http).get(`/services/visa?groupId=${groupId}`).set(auth(agentToken)).expect(200);
    expect(list.body.find((v: { id: string }) => v.id === res.body.id).status).toBe("COMPLETED");
  });

  // ── ADDITIONAL SERVICES pipeline ────────────────────────────────────────────
  it("additional: create → ops CONFIRMED; agent can cancel own requests but not confirm", async () => {
    const res = await request(http)
      .post("/services/additional")
      .set(auth(agentToken))
      .send({
        groupId,
        serviceType: "WHEELCHAIR",
        beneficiaries: 3,
        priority: "HIGH",
        description: "3 elderly pilgrims need wheelchair assistance",
        requestedFor: "2026-08-16T08:00:00Z",
      })
      .expect(201);
    created.push({ service: "additional", model: "additionalServiceRequest", id: res.body.id });

    // agent may not confirm…
    await request(http)
      .patch(`/services/additional/${res.body.id}/status`)
      .set(auth(agentToken))
      .send({ status: "CONFIRMED" })
      .expect(403);
    // …ops may
    await request(http)
      .patch(`/services/additional/${res.body.id}/status`)
      .set(auth(opsToken))
      .send({ status: "ASSIGNED" })
      .expect(200);
    await request(http)
      .patch(`/services/additional/${res.body.id}/status`)
      .set(auth(opsToken))
      .send({ status: "CONFIRMED" })
      .expect(200);

    // illegal jump is rejected
    await request(http)
      .patch(`/services/additional/${res.body.id}/status`)
      .set(auth(opsToken))
      .send({ status: "REQUESTED" })
      .expect(400);

    // a second request can be cancelled by the agent
    const res2 = await request(http)
      .post("/services/additional")
      .set(auth(agentToken))
      .send({ groupId, serviceType: "SIM_CARD", beneficiaries: 28, priority: "NORMAL" })
      .expect(201);
    created.push({ service: "additional", model: "additionalServiceRequest", id: res2.body.id });
    const cancelled = await request(http)
      .patch(`/services/additional/${res2.body.id}/status`)
      .set(auth(agentToken))
      .send({ status: "CANCELLED", reason: "No longer needed" })
      .expect(200);
    expect(cancelled.body.status).toBe("CANCELLED");
  });

  // ── supplier invoice/voucher uploads ────────────────────────────────────────
  it("supplier uploads an invoice against an accepted booking", async () => {
    const hotelBooking = created.find((c) => c.service === "hotel")!;
    const res = await request(http)
      .post(`/supplier/bookings/hotel/${hotelBooking.id}/upload?type=invoice`)
      .set(auth(hotelSupToken))
      .field("invoiceNo", "INV-2026-0101")
      .field("amountExVat", "226100")
      .field("servicePeriod", "15 Aug – 29 Aug 2026")
      .attach("file", Buffer.from("%PDF-1.4 supplier invoice"), {
        filename: "Invoice_2026-0101.pdf",
        contentType: "application/pdf",
      })
      .expect(201);
    expect(res.body.kind).toBe("INVOICE");
    expect(res.body.meta.total).toBeCloseTo(226100 * 1.15, 0);

    const shelf = await request(http).get("/supplier/uploads?kind=INVOICE").set(auth(hotelSupToken)).expect(200);
    expect(shelf.body.map((f: { id: string }) => f.id)).toContain(res.body.documentId);
    await prisma.uploadedFile.delete({ where: { id: res.body.documentId } });
  });
});
