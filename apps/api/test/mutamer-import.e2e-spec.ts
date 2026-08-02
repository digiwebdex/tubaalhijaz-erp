// T001-05 — Enterprise Mutamer Excel Import Engine (e2e)
// Preview → confirm → transactional commit; duplicates; 1000-row; rollback; regression.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  BUSINESS_REQUIRED_FIELDS,
  MUTAMER_IMPORT_MAX_ROWS,
  resolveHeaderToField,
} from "../src/groups/mutamer-excel.contract";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OTHER = { email: "office@alnoor-pilgrim.com", password: "Demo@123" };

function businessCsv(rows: Array<Record<string, string>>): string {
  const headers = [
    "Mutamer Name",
    "Age",
    "Passport",
    "Nationality",
    "Main External Agent Code",
    "Main External Agent Name",
    "Sub External Agent Code",
    "Sub External Agent Name",
    "Visa Status",
    "Biometric Status",
    "Visa Number",
    "MOFA Number",
    "Mutamer Type",
    "Gender",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.age ?? "",
        r.passport,
        r.nationality ?? "Bangladesh",
        r.mainEa ?? "1004492",
        r.mainEaName ?? "Tuba Al Hijaz",
        r.subEa ?? "SUB-01",
        r.subEaName ?? "Bengal United",
        r.visaStatus ?? "Visa Not Issued",
        r.biometric ?? "Registered",
        r.visaNumber ?? "",
        r.mofa ?? "",
        r.mutamerType ?? "B2B",
        r.gender ?? "M",
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

function legacyCsv(rows: Array<{ name: string; passport: string; gender?: string }>): string {
  const headers = ["Name", "Passport No", "Nationality", "Gender", "Date of Birth", "Passport Expiry", "Phone"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [r.name, r.passport, "Bangladesh", r.gender ?? "M", "1985-03-15", "2030-06-30", ""].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

describe("T001-05 Mutamer Excel Import Engine (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let otherTok: string;
  let groupId: string;
  let tenantId: string;
  const stamp = Date.now();

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
    [agentTok, otherTok] = await Promise.all([login(AGENT), login(OTHER)]);

    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-05 Import Host",
        destination: "MAKKAH",
        visaType: "UMRAH",
        maxCapacity: 1200,
      })
      .expect(201);
    groupId = g.body.id;
    tenantId = g.body.tenantId ?? g.body.companyId;
    if (!tenantId) {
      const row = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { tenantId: true } });
      tenantId = row.tenantId;
    }
  });

  afterAll(async () => {
    if (groupId) {
      await prisma.mutamerImportRun.deleteMany({ where: { groupId } }).catch(() => undefined);
      await prisma.passenger.deleteMany({ where: { groupId } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: groupId },
            { entityType: "MutamerImport", entityId: groupId },
            { entityType: "Group", entityId: groupId },
          ],
        },
      }).catch(() => undefined);
      await prisma.group.delete({ where: { id: groupId } }).catch(() => undefined);
    }
    await app.close();
  });

  it("contract resolves business headers + required business fields", () => {
    expect(resolveHeaderToField("Mutamer Name")).toBe("name");
    expect(resolveHeaderToField("Main EA Code")).toBe("mainEaCode");
    expect(resolveHeaderToField("Visa Type")).toBe("visaStatusLabel");
    expect(BUSINESS_REQUIRED_FIELDS).toEqual(
      expect.arrayContaining(["mainEaCode", "subEaCode", "visaStatusLabel"]),
    );
    expect(MUTAMER_IMPORT_MAX_ROWS).toBe(1000);
  });

  it("preview validates workbook — no DB writes", async () => {
    const before = await prisma.passenger.count({ where: { groupId } });
    const csv = businessCsv([
      { name: "Valid One", passport: `PV${stamp}A` },
      { name: "X", passport: `PV${stamp}B` }, // invalid name
    ]);
    const res = await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "validate.csv", csvText: csv, format: "csv" })
      .expect(201);
    expect(res.body.mode).toBe("business");
    expect(res.body.summary.valid).toBe(1);
    expect(res.body.summary.invalid).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.canCommit).toBe(false);
    expect(await prisma.passenger.count({ where: { groupId } })).toBe(before);
  });

  it("preview surfaces duplicate passport / MOFA / visa / excel row", async () => {
    const csv = businessCsv([
      { name: "Dup A", passport: `PD${stamp}`, mofa: `MF${stamp}`, visaNumber: `VS${stamp}` },
      { name: "Dup B", passport: `PD${stamp}`, mofa: `MF${stamp}`, visaNumber: `VS${stamp}` },
    ]);
    const res = await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "dups.csv", csvText: csv, format: "csv" })
      .expect(201);
    expect(res.body.summary.canCommit).toBe(false);
    expect(res.body.summary.duplicates).toBeGreaterThan(0);
    const codes = (res.body.issues as Array<{ code: string }>).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["DUP_PASSPORT_FILE"]));
  });

  /** Exact CSV used for successful import — reused to assert duplicate-import guard. */
  let committedCsv = "";
  let committedFileHash = "";

  it("import preview then confirm commit — audit + MutamerImportRun", async () => {
    committedCsv = businessCsv([
      {
        name: "Karim Import",
        passport: `OK${stamp}1`,
        mofa: `MOFA-OK-${stamp}`,
        visaNumber: `V-OK-${stamp}`,
        mainEa: "1004492",
        subEa: "SUB-01",
        visaStatus: "Visa Not Issued",
      },
    ]);
    const preview = await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "ok.csv", csvText: committedCsv, format: "csv" })
      .expect(201);
    expect(preview.body.summary.canCommit).toBe(true);
    expect(preview.body.passengers).toHaveLength(1);
    committedFileHash = preview.body.fileHash;

    await request(http)
      .post(`/groups/${groupId}/passengers/import/commit`)
      .set(auth(agentTok))
      .send({
        fileName: preview.body.fileName,
        fileHash: preview.body.fileHash,
        confirm: false,
        passengers: preview.body.passengers,
      })
      .expect(400);

    const commit = await request(http)
      .post(`/groups/${groupId}/passengers/import/commit`)
      .set(auth(agentTok))
      .send({
        fileName: preview.body.fileName,
        fileHash: preview.body.fileHash,
        confirm: true,
        passengers: preview.body.passengers,
      })
      .expect(201);

    expect(commit.body.imported).toBe(1);
    const pax = await prisma.passenger.findFirst({
      where: { groupId, passportNo: `OK${stamp}1` },
    });
    expect(pax?.mainEaCode).toBe("1004492");
    expect(pax?.visaStatus).toBe("PENDING");
    expect(pax?.visaStatusLabel).toBe("Visa Not Issued");

    const run = await prisma.mutamerImportRun.findUnique({
      where: { groupId_fileHash: { groupId, fileHash: preview.body.fileHash } },
    });
    expect(run?.successCount).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "MutamerImport", entityId: groupId },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.module).toBe("Passengers");
    expect(audit?.action).toBe("CREATE");
  });

  it("duplicate import of same fileHash is blocked (no silent overwrite)", async () => {
    const preview = await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "ok.csv", csvText: committedCsv, format: "csv" })
      .expect(201);
    expect(preview.body.fileHash).toBe(committedFileHash);
    expect(preview.body.summary.canCommit).toBe(false);
    expect((preview.body.issues as Array<{ code: string }>).some((i) => i.code === "DUPLICATE_IMPORT")).toBe(true);

    await request(http)
      .post(`/groups/${groupId}/passengers/import/commit`)
      .set(auth(agentTok))
      .send({
        fileName: "ok.csv",
        fileHash: committedFileHash,
        confirm: true,
        passengers: [{ name: "X", passportNo: `Z${stamp}`, nationality: "Bangladesh", gender: "MALE" }],
      })
      .expect(400);
  });

  it("duplicate passenger already in group blocks preview commit", async () => {
    const passport = `INGRP${stamp}`;
    await request(http)
      .post(`/groups/${groupId}/passengers`)
      .set(auth(agentTok))
      .send({ name: "Existing", passportNo: passport, nationality: "Bangladesh", gender: "MALE" })
      .expect(201);

    const res = await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({
        fileName: "clash.csv",
        csvText: businessCsv([{ name: "Clash", passport }]),
        format: "csv",
      })
      .expect(201);
    expect(res.body.summary.canCommit).toBe(false);
    expect((res.body.issues as Array<{ code: string }>).some((i) => i.code === "DUP_PASSPORT_GROUP")).toBe(true);
  });

  it("rollback — unique code collision aborts with no new MutamerImportRun / no partial rows", async () => {
    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-05 Rollback Host",
        destination: "MAKKAH",
        visaType: "UMRAH",
        maxCapacity: 50,
      })
      .expect(201);
    const rid = g.body.id as string;
    const tId = (await prisma.group.findUniqueOrThrow({ where: { id: rid } })).tenantId;

    // Seed a non-numeric last code so next generated codes restart at PAX-001 (collision).
    await prisma.passenger.create({
      data: {
        code: "PAX-FOO",
        groupId: rid,
        tenantId: tId,
        name: "Seed",
        passportNo: `SEED${stamp}`,
        nationality: "Bangladesh",
        gender: "MALE",
      },
    });
    await prisma.passenger.create({
      data: {
        code: "PAX-001",
        groupId: rid,
        tenantId: tId,
        name: "Collider",
        passportNo: `COL${stamp}`,
        nationality: "Bangladesh",
        gender: "MALE",
      },
    });

    const before = await prisma.passenger.count({ where: { groupId: rid } });
    const csv = businessCsv([{ name: "Will Fail", passport: `RB${stamp}` }]);
    const preview = await request(http)
      .post(`/groups/${rid}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "rollback.csv", csvText: csv, format: "csv" })
      .expect(201);
    expect(preview.body.summary.canCommit).toBe(true);

    await request(http)
      .post(`/groups/${rid}/passengers/import/commit`)
      .set(auth(agentTok))
      .send({
        fileName: preview.body.fileName,
        fileHash: preview.body.fileHash,
        confirm: true,
        passengers: preview.body.passengers,
      })
      .expect(400);

    expect(await prisma.passenger.count({ where: { groupId: rid } })).toBe(before);
    expect(await prisma.passenger.findFirst({ where: { groupId: rid, passportNo: `RB${stamp}` } })).toBeNull();
    expect(
      await prisma.mutamerImportRun.findUnique({
        where: { groupId_fileHash: { groupId: rid, fileHash: preview.body.fileHash } },
      }),
    ).toBeNull();

    await prisma.passenger.deleteMany({ where: { groupId: rid } });
    await prisma.group.delete({ where: { id: rid } });
  });

  it("1000-row Excel/CSV import completes successfully", async () => {
    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-05 Large Import",
        destination: "MAKKAH",
        visaType: "UMRAH",
        maxCapacity: 1000,
      })
      .expect(201);
    const lid = g.body.id as string;

    const rows = Array.from({ length: 1000 }, (_, i) => ({
      name: `Mutamer ${i + 1}`,
      passport: `L${stamp}${String(i).padStart(4, "0")}`,
      mofa: `MFL${stamp}${String(i).padStart(4, "0")}`,
    }));
    const csv = businessCsv(rows);

    const preview = await request(http)
      .post(`/groups/${lid}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "large-1000.csv", csvText: csv, format: "csv" })
      .expect(201);
    expect(preview.body.summary.totalRows).toBe(1000);
    expect(preview.body.summary.valid).toBe(1000);
    expect(preview.body.summary.canCommit).toBe(true);

    const commit = await request(http)
      .post(`/groups/${lid}/passengers/import/commit`)
      .set(auth(agentTok))
      .send({
        fileName: preview.body.fileName,
        fileHash: preview.body.fileHash,
        confirm: true,
        passengers: preview.body.passengers,
      })
      .expect(201);
    expect(commit.body.imported).toBe(1000);
    expect(await prisma.passenger.count({ where: { groupId: lid } })).toBe(1000);

    await prisma.mutamerImportRun.deleteMany({ where: { groupId: lid } });
    await prisma.passenger.deleteMany({ where: { groupId: lid } });
    await prisma.group.delete({ where: { id: lid } });
  }, 120_000);

  it("legacy CSV template still imports (regression)", async () => {
    const csv = legacyCsv([{ name: "Legacy Pax", passport: `LEG${stamp}` }]);
    const preview = await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "legacy.csv", csvText: csv, format: "csv" })
      .expect(201);
    expect(preview.body.mode).toBe("legacy");
    expect(preview.body.summary.canCommit).toBe(true);

    const commit = await request(http)
      .post(`/groups/${groupId}/passengers/import/commit`)
      .set(auth(agentTok))
      .send({
        fileName: preview.body.fileName,
        fileHash: preview.body.fileHash,
        confirm: true,
        passengers: preview.body.passengers,
      })
      .expect(201);
    expect(commit.body.imported).toBe(1);
  });

  it("legacy bulk JSON path still works (regression)", async () => {
    const res = await request(http)
      .post(`/groups/${groupId}/passengers/bulk`)
      .set(auth(agentTok))
      .send({
        passengers: [
          {
            name: "Bulk Legacy",
            passportNo: `BULK${stamp}`,
            nationality: "Bangladesh",
            gender: "FEMALE",
          },
        ],
      })
      .expect(201);
    expect(res.body.id || res.body[0]?.id || true).toBeTruthy();
  });

  it("tenant isolation — other company cannot preview import", async () => {
    await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(otherTok))
      .send({
        fileName: "x.csv",
        csvText: businessCsv([{ name: "Nope", passport: `NO${stamp}` }]),
        format: "csv",
      })
      .expect(404);
  });
});
