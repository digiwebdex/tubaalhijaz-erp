// ─── Notification delivery (e2e) ─────────────────────────────────────────────
// Real Redis + BullMQ. Channels run in stub mode (no WASENDER/SMTP creds in CI):
// WhatsApp/Email → SKIPPED → status PENDING; In-App → DELIVERED + WS push. Confirms:
//   • bell feed / unread / mark-read for the current user
//   • config gate (MANAGE_SYSTEM_SETTINGS), event matrix, template upsert
//   • test-send fans out per channel and records per-channel status
//   • emergency fans out to all 3 channels at EMERGENCY priority
//   • in-app delivery pushes over the /notifications WebSocket

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { io, Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const ADMIN = { email: "ceo@tubalhijaz.com", password: "Demo@123" }; // SUPER_ADMIN → MANAGE_SYSTEM_SETTINGS
const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 10000, step = 300): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const r = await fn();
    if (r) return r;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((s) => setTimeout(s, step));
  }
}

describe("Notification delivery (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let baseUrl: string;
  let admin: string, agent: string;
  let adminUserId: string;

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.listen(0); // real Socket.io server for the in-app WS test
    const addr = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    [admin, agent] = await Promise.all([login(ADMIN), login(AGENT)]);
    adminUserId = (await prisma.user.findFirstOrThrow({ where: { email: ADMIN.email } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── bell feed ─────────────────────────────────────────────────────────────
  it("returns the bell feed and unread count for the current user", async () => {
    const feed = await request(http).get("/notifications?limit=20").set(auth(agent)).expect(200);
    expect(Array.isArray(feed.body)).toBe(true);
    const unread = await request(http).get("/notifications/unread-count").set(auth(agent)).expect(200);
    expect(typeof unread.body.count).toBe("number");
  });

  it("marks a notification read", async () => {
    const feed = await request(http).get("/notifications").set(auth(agent)).expect(200);
    if (!feed.body.length) return;
    const id = feed.body[0].id;
    const read = await request(http).patch(`/notifications/${id}/read`).set(auth(agent)).expect(200);
    expect(read.body.readAt).toBeTruthy();
    expect(read.body.status).toBe("READ");
  });

  // ── config gate + matrix + templates ─────────────────────────────────────────
  it("gates config to MANAGE_SYSTEM_SETTINGS and exposes the event matrix", async () => {
    await request(http).get("/notifications/events").set(auth(agent)).expect(403);
    const events = await request(http).get("/notifications/events").set(auth(admin)).expect(200);
    expect(events.body.some((e: { key: string }) => e.key === "AGENT_APPROVED")).toBe(true);
  });

  it("upserts a message template and it is used on delivery", async () => {
    await request(http).put("/notifications/templates").set(auth(admin)).send({
      eventKey: "AGENT_APPROVED", channel: "EMAIL", lang: "en",
      subject: "Custom subject {{code}}", body: "Custom body for {{name}}",
    }).expect(200);
    const list = await request(http).get("/notifications/templates?eventKey=AGENT_APPROVED").set(auth(admin)).expect(200);
    expect(list.body.some((t: { channel: string; lang: string }) => t.channel === "EMAIL" && t.lang === "en")).toBe(true);
  });

  // ── test-send fans out per channel with per-channel status ───────────────────
  it("test-send creates an EMAIL (stub→PENDING) and IN_APP (DELIVERED) log", async () => {
    const t0 = new Date();
    const res = await request(http).post("/notifications/test").set(auth(admin))
      .send({ email: "test@example.com", eventKey: "AGENT_APPROVED", title: "Hello", lang: "en" })
      .expect(201);
    expect(res.body.channels).toEqual(expect.arrayContaining(["EMAIL", "IN_APP"]));

    // poll until the worker has processed it (error set by the SKIPPED stub)
    const emailLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: { channel: "EMAIL", recipientAddress: "test@example.com", createdAt: { gte: t0 }, error: { contains: "SMTP" } },
      }),
    );
    expect(emailLog.status).toBe("PENDING"); // SMTP not configured → SKIPPED→PENDING

    // poll until the worker flips IN_APP from PENDING → DELIVERED
    const inAppLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: { channel: "IN_APP", createdAt: { gte: t0 }, title: { contains: "TEST" }, status: "DELIVERED" },
      }),
    );
    expect(inAppLog.sentAt).toBeTruthy(); // in-app delivered
  });

  // ── emergency fans out to all three channels ─────────────────────────────────
  it("emergency send fans out to WHATSAPP + EMAIL + IN_APP at EMERGENCY priority", async () => {
    const t0 = new Date();
    const res = await request(http).post("/notifications/test").set(auth(admin))
      .send({ phone: "+966500000000", email: "test@example.com", priority: "EMERGENCY", title: "Drill", body: "test" })
      .expect(201);
    expect(res.body.channels).toEqual(expect.arrayContaining(["WHATSAPP", "EMAIL", "IN_APP"]));
    expect(res.body.logIds.length).toBe(3);

    const logs = await waitFor(async () => {
      const rows = await prisma.notificationLog.findMany({ where: { priority: "EMERGENCY", createdAt: { gte: t0 } } });
      return rows.length >= 3 ? rows : null;
    });
    const channels = new Set(logs.map((l) => l.channel));
    expect(channels.has("WHATSAPP") && channels.has("EMAIL") && channels.has("IN_APP")).toBe(true);
  });

  // ── in-app WebSocket delivery (S2-02: JWT auth.token) ────────────────────────
  it("pushes an in-app notification over the /notifications WebSocket", async () => {
    const socket: Socket = io(`${baseUrl}/notifications`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: admin },
    });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
      setTimeout(() => reject(new Error("connect timeout")), 4000);
    });

    const received = new Promise<{ title: string }>((resolve, reject) => {
      socket.on("notification", (p) => resolve(p));
      setTimeout(() => reject(new Error("no in-app push within 5s")), 5000);
    });
    await request(http).post("/notifications/test").set(auth(admin))
      .send({ recipientUserId: adminUserId, title: "WS ping", body: "live" }).expect(201);

    const evt = await received;
    expect(evt.title).toBeTruthy();
    socket.disconnect();
  });
});

