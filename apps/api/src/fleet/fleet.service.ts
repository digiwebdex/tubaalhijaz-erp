import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  DriverStatus, InsuranceStatus, LocationSource, MaintenanceType, Prisma,
  VehicleDocType, VehicleStatus, VehicleType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OpsGateway } from "../ops/ops.gateway";

const DAY = 86_400_000;
const num = (d: Prisma.Decimal | number | null | undefined) =>
  d == null ? 0 : Math.round(Number(d) * 100) / 100;

/** Days from now until `d` (negative = already past). Null-safe. */
function daysUntil(d: Date | null | undefined, now = new Date()): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / DAY);
}
export type ExpirySeverity = "EXPIRED" | "CRITICAL" | "WARNING";
export function severityFor(days: number | null): ExpirySeverity | null {
  if (days == null) return null;
  if (days < 0) return "EXPIRED";
  if (days <= 7) return "CRITICAL";
  if (days <= 30) return "WARNING";
  return null;
}

export interface ExpiringItem {
  kind: "LICENSE" | "REGISTRATION" | "INSPECTION" | "OPERATING_CARD" | "PERMIT" | "OTHER" | "INSURANCE";
  refId: string; // driver / document / policy id
  vehicleId?: string;
  subject: string; // "BUS B-12" | "Md. Karim"
  detail: string; // doc no / provider
  expiryDate: Date;
  daysLeft: number;
  severity: ExpirySeverity;
}

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OpsGateway,
  ) {}

  // Fleet data is internal (platform staff, MANAGE_FLEET-gated) → use the base
  // unscoped client. The tenant extension is a no-op for staff anyway (no companyId).

  // ── Vehicles ────────────────────────────────────────────────────────────────
  async listVehicles(status?: VehicleStatus, type?: VehicleType) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ...(status && { status }), ...(type && { type }) },
      orderBy: { code: "asc" },
      include: {
        documents: { orderBy: { expiryDate: "asc" } },
        insurancePolicies: { where: { status: "ACTIVE" }, orderBy: { endDate: "asc" }, take: 1 },
        supplier: { select: { id: true, name: true } },
      },
    });
    const now = new Date();
    return vehicles.map((v) => {
      const nextDoc = v.documents[0];
      const ins = v.insurancePolicies[0];
      return {
        id: v.id, code: v.code, type: v.type, plateNo: v.plateNo, seats: v.seats,
        status: v.status, notes: v.notes,
        owner: v.supplier ? v.supplier.name : "TUBA-owned",
        supplierId: v.supplierId,
        lastLat: v.lastLat != null ? Number(v.lastLat) : null,
        lastLng: v.lastLng != null ? Number(v.lastLng) : null,
        lastLocationLabel: v.lastLocationLabel,
        lastLocationAt: v.lastLocationAt,
        docCount: v.documents.length,
        nextDocExpiry: nextDoc?.expiryDate ?? null,
        nextDocDays: daysUntil(nextDoc?.expiryDate ?? null, now),
        insuranceExpiry: ins?.endDate ?? null,
        insuranceDays: daysUntil(ins?.endDate ?? null, now),
        docSeverity: severityFor(daysUntil(nextDoc?.expiryDate ?? null, now)),
      };
    });
  }

  async getVehicle(id: string) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { expiryDate: "asc" } },
        insurancePolicies: { orderBy: { endDate: "desc" } },
        fuelLogs: { orderBy: { date: "desc" }, take: 10, include: { driver: { select: { name: true } } } },
        maintenanceRecords: { orderBy: { date: "desc" }, take: 10 },
        locations: { orderBy: { recordedAt: "desc" }, take: 20 },
        supplier: { select: { id: true, name: true } },
      },
    });
    if (!v) throw new NotFoundException("Vehicle not found");
    return v;
  }

  createVehicle(data: {
    code: string; type: VehicleType; plateNo?: string; seats?: number;
    status?: VehicleStatus; supplierId?: string; notes?: string;
  }) {
    return this.prisma.vehicle.create({ data });
  }

  async updateVehicle(id: string, data: Partial<{
    code: string; type: VehicleType; plateNo: string; seats: number;
    status: VehicleStatus; supplierId: string | null; notes: string;
  }>) {
    await this.mustExist("vehicle", id);
    return this.prisma.vehicle.update({ where: { id }, data });
  }

  async deleteVehicle(id: string) {
    await this.mustExist("vehicle", id);
    // History (docs, fuel, maintenance, insurance, locations) cascades; dispatch
    // orders keep their history with vehicleId set null.
    await this.prisma.vehicle.delete({ where: { id } });
    return { ok: true };
  }

  // ── Drivers ─────────────────────────────────────────────────────────────────
  async listDrivers(status?: DriverStatus) {
    const drivers = await this.prisma.driver.findMany({
      where: { ...(status && { status }) },
      orderBy: { name: "asc" },
      include: { supplier: { select: { name: true } } },
    });
    const now = new Date();
    return drivers.map((d) => ({
      id: d.id, name: d.name, nameBn: d.nameBn, phone: d.phone,
      licenseNo: d.licenseNo, licenseExpiry: d.licenseExpiry,
      licenseDays: daysUntil(d.licenseExpiry, now),
      licenseSeverity: severityFor(daysUntil(d.licenseExpiry, now)),
      status: d.status, rating: d.rating != null ? Number(d.rating) : null,
      owner: d.supplier ? d.supplier.name : "TUBA-employed",
      supplierId: d.supplierId,
    }));
  }

  createDriver(data: {
    name: string; nameBn?: string; phone?: string; licenseNo?: string;
    licenseExpiry?: Date; status?: DriverStatus; supplierId?: string;
  }) {
    return this.prisma.driver.create({ data });
  }

  async updateDriver(id: string, data: Partial<{
    name: string; nameBn: string; phone: string; licenseNo: string;
    licenseExpiry: Date | null; status: DriverStatus; supplierId: string | null;
  }>) {
    await this.mustExist("driver", id);
    return this.prisma.driver.update({ where: { id }, data });
  }

  async deleteDriver(id: string) {
    await this.mustExist("driver", id);
    await this.prisma.driver.delete({ where: { id } });
    return { ok: true };
  }

  // ── Vehicle documents ─────────────────────────────────────────────────────
  listDocuments(vehicleId: string) {
    return this.prisma.vehicleDocument.findMany({
      where: { vehicleId }, orderBy: { expiryDate: "asc" },
    });
  }

  async addDocument(vehicleId: string, data: {
    type: VehicleDocType; docNo?: string; issueDate?: Date; expiryDate: Date;
    fileId?: string; notes?: string;
  }) {
    await this.mustExist("vehicle", vehicleId);
    return this.prisma.vehicleDocument.create({ data: { vehicleId, ...data } });
  }

  async updateDocument(id: string, data: Partial<{
    type: VehicleDocType; docNo: string; issueDate: Date | null; expiryDate: Date;
    fileId: string | null; notes: string;
  }>) {
    await this.mustExist("vehicleDocument", id);
    return this.prisma.vehicleDocument.update({ where: { id }, data });
  }

  async deleteDocument(id: string, actorUserId?: string) {
    await this.mustExist("vehicleDocument", id);
    const doc = await this.prisma.vehicleDocument.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        actorUserId, action: "DELETE", module: "Fleet",
        entityType: "VehicleDocument", entityId: id,
        before: { type: doc.type, docNo: doc.docNo, vehicleId: doc.vehicleId },
      },
    }).catch(() => undefined);
    return { ok: true };
  }

  // ── Fuel logs ─────────────────────────────────────────────────────────────
  listFuel(vehicleId?: string, take = 100) {
    return this.prisma.fuelLog.findMany({
      where: { ...(vehicleId && { vehicleId }) },
      orderBy: { date: "desc" }, take,
      include: { vehicle: { select: { code: true } }, driver: { select: { name: true } } },
    });
  }

  async addFuel(data: {
    vehicleId: string; driverId?: string; date: Date; liters: number;
    cost: number; odometerKm?: number; notes?: string;
  }) {
    await this.mustExist("vehicle", data.vehicleId);
    return this.prisma.fuelLog.create({ data });
  }

  async deleteFuel(id: string) {
    await this.mustExist("fuelLog", id);
    await this.prisma.fuelLog.delete({ where: { id } });
    return { ok: true };
  }

  // ── Maintenance ─────────────────────────────────────────────────────────────
  listMaintenance(vehicleId?: string, take = 100) {
    return this.prisma.maintenanceRecord.findMany({
      where: { ...(vehicleId && { vehicleId }) },
      orderBy: { date: "desc" }, take,
      include: { vehicle: { select: { code: true } } },
    });
  }

  async addMaintenance(data: {
    vehicleId: string; type: MaintenanceType; description: string; date: Date;
    cost?: number; odometerKm?: number; nextDueDate?: Date; workshop?: string;
  }) {
    await this.mustExist("vehicle", data.vehicleId);
    return this.prisma.maintenanceRecord.create({ data });
  }

  async updateMaintenance(id: string, data: Partial<{
    type: MaintenanceType; description: string; date: Date; cost: number | null;
    odometerKm: number | null; nextDueDate: Date | null; workshop: string | null;
  }>) {
    await this.mustExist("maintenanceRecord", id);
    return this.prisma.maintenanceRecord.update({ where: { id }, data });
  }

  async deleteMaintenance(id: string) {
    await this.mustExist("maintenanceRecord", id);
    await this.prisma.maintenanceRecord.delete({ where: { id } });
    return { ok: true };
  }

  // ── Insurance ─────────────────────────────────────────────────────────────
  listInsurance(vehicleId?: string) {
    return this.prisma.insurancePolicy.findMany({
      where: { ...(vehicleId && { vehicleId }) },
      orderBy: { endDate: "desc" },
      include: { vehicle: { select: { code: true } } },
    });
  }

  async addInsurance(data: {
    vehicleId: string; provider: string; policyNo: string; startDate: Date;
    endDate: Date; premium?: number; status?: InsuranceStatus;
  }) {
    await this.mustExist("vehicle", data.vehicleId);
    return this.prisma.insurancePolicy.create({ data });
  }

  async updateInsurance(id: string, data: Partial<{
    provider: string; policyNo: string; startDate: Date; endDate: Date;
    premium: number | null; status: InsuranceStatus;
  }>) {
    await this.mustExist("insurancePolicy", id);
    return this.prisma.insurancePolicy.update({ where: { id }, data });
  }

  async deleteInsurance(id: string) {
    await this.mustExist("insurancePolicy", id);
    await this.prisma.insurancePolicy.delete({ where: { id } });
    return { ok: true };
  }

  // ── GPS (MVP: manual / simulated fixes) ─────────────────────────────────────
  // Phase 2 (post-MVP): a hardware-tracker webhook posts to the same shape with
  // source=DEVICE. The map + trail already render whatever is stored, so no UI
  // change is needed when real trackers land. See docs/FLEET.md.
  async updateLocation(vehicleId: string, data: {
    lat: number; lng: number; label?: string; speedKmh?: number; source?: LocationSource;
  }) {
    if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
      throw new BadRequestException("lat/lng out of range");
    }
    await this.mustExist("vehicle", vehicleId);
    const [loc] = await this.prisma.$transaction([
      this.prisma.vehicleLocation.create({
        data: {
          vehicleId, lat: data.lat, lng: data.lng, label: data.label,
          speedKmh: data.speedKmh, source: data.source ?? "MANUAL",
        },
      }),
      this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          lastLat: data.lat, lastLng: data.lng,
          lastLocationLabel: data.label ?? null, lastLocationAt: new Date(),
        },
      }),
    ]);
    return loc;
  }

  /** Latest known position of every vehicle that has one — drives the map screen. */
  async map() {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { status: { not: "RETIRED" }, lastLat: { not: null } },
      orderBy: { code: "asc" },
      include: {
        dispatchOrders: {
          where: { status: { in: ["ASSIGNED", "EN_ROUTE", "DELAYED"] } },
          orderBy: { scheduledAt: "desc" }, take: 1,
          select: { code: true, routeFrom: true, routeTo: true, status: true },
        },
      },
    });
    return vehicles.map((v) => ({
      id: v.id, code: v.code, type: v.type, status: v.status,
      lat: Number(v.lastLat), lng: Number(v.lastLng),
      label: v.lastLocationLabel, at: v.lastLocationAt,
      activeDispatch: v.dispatchOrders[0] ?? null,
    }));
  }

  locationTrail(vehicleId: string, take = 50) {
    return this.prisma.vehicleLocation.findMany({
      where: { vehicleId }, orderBy: { recordedAt: "desc" }, take,
    });
  }

  // ── Dispatch assignment (Vehicle + Driver → DispatchOrder) ───────────────────
  assignableDispatches() {
    return this.prisma.dispatchOrder.findMany({
      where: { status: { in: ["ASSIGNED", "EN_ROUTE", "DELAYED"] } },
      orderBy: { scheduledAt: "asc" },
      include: {
        group: { select: { code: true, tenant: { select: { name: true } } } },
        vehicle: { select: { code: true } }, driver: { select: { name: true } },
      },
    });
  }

  async assignDispatch(dispatchId: string, vehicleId?: string, driverId?: string) {
    if (!vehicleId && !driverId) throw new BadRequestException("Provide a vehicle and/or driver");
    const dispatch = await this.prisma.dispatchOrder.findUnique({ where: { id: dispatchId } });
    if (!dispatch) throw new NotFoundException("Dispatch order not found");
    if (vehicleId) await this.mustExist("vehicle", vehicleId);
    if (driverId) await this.mustExist("driver", driverId);

    const updated = await this.prisma.dispatchOrder.update({
      where: { id: dispatchId },
      data: { ...(vehicleId && { vehicleId }), ...(driverId && { driverId }) },
      include: {
        group: { select: { code: true } },
        vehicle: { select: { id: true, code: true } },
        driver: { select: { id: true, name: true } },
      },
    });
    // Reflect the assignment on the driver's live status.
    if (driverId) {
      await this.prisma.driver.update({ where: { id: driverId }, data: { status: "ON_DUTY" } });
    }
    // Let the live Ops dispatch board update without a manual refresh.
    this.gateway.broadcast("dispatch.status", {
      row: {
        id: updated.id, code: updated.code, status: updated.status,
        vehicle: updated.vehicle?.code ?? null, driver: updated.driver?.name ?? null,
        routeFrom: updated.routeFrom, routeTo: updated.routeTo, pax: updated.pax,
        scheduledAt: updated.scheduledAt, progressPct: updated.progressPct,
      },
    });
    return updated;
  }

  // ── Cost trend (dashboard) ──────────────────────────────────────────────────
  async costTrend(months = 6): Promise<Array<{ month: string; fuel: number; maintenance: number; total: number }>> {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const rows = await this.prisma.$queryRaw<Array<{ month: string; fuel: Prisma.Decimal; maintenance: Prisma.Decimal }>>`
      SELECT to_char(date_trunc('month', d), 'YYYY-MM') AS month,
             SUM(fuel)::numeric        AS fuel,
             SUM(maintenance)::numeric AS maintenance
      FROM (
        SELECT "date" AS d, "cost" AS fuel, 0 AS maintenance FROM "FuelLog"
        UNION ALL
        SELECT "date" AS d, 0 AS fuel, COALESCE("cost", 0) AS maintenance FROM "MaintenanceRecord"
      ) t
      WHERE d >= ${from}
      GROUP BY 1 ORDER BY 1`;
    // Zero-fill any month with no spend so the chart has a continuous axis.
    const byMonth = new Map(rows.map((r) => [r.month, r]));
    const out: Array<{ month: string; fuel: number; maintenance: number; total: number }> = [];
    for (let i = 0; i < months; i++) {
      const dt = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      const r = byMonth.get(key);
      const fuel = num(r?.fuel), maintenance = num(r?.maintenance);
      out.push({ month: key, fuel, maintenance, total: Math.round((fuel + maintenance) * 100) / 100 });
    }
    return out;
  }

  // ── Unified expiring feed (drivers' licenses, vehicle docs, insurance) ───────
  async expiring(withinDays = 30): Promise<ExpiringItem[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + withinDays * DAY);
    const [drivers, docs, policies] = await Promise.all([
      this.prisma.driver.findMany({
        where: { licenseExpiry: { not: null, lte: cutoff } },
        select: { id: true, name: true, licenseNo: true, licenseExpiry: true },
      }),
      this.prisma.vehicleDocument.findMany({
        where: { expiryDate: { lte: cutoff } },
        include: { vehicle: { select: { code: true } } },
      }),
      this.prisma.insurancePolicy.findMany({
        where: { endDate: { lte: cutoff }, status: { not: "CANCELLED" } },
        include: { vehicle: { select: { code: true } } },
      }),
    ]);
    const items: ExpiringItem[] = [];
    for (const d of drivers) {
      const days = daysUntil(d.licenseExpiry, now)!;
      const sev = severityFor(days);
      if (sev) items.push({ kind: "LICENSE", refId: d.id, subject: d.name, detail: d.licenseNo ?? "License", expiryDate: d.licenseExpiry!, daysLeft: days, severity: sev });
    }
    for (const doc of docs) {
      const days = daysUntil(doc.expiryDate, now)!;
      const sev = severityFor(days);
      if (sev) items.push({ kind: doc.type as ExpiringItem["kind"], refId: doc.id, vehicleId: doc.vehicleId, subject: doc.vehicle.code, detail: doc.docNo ?? doc.type, expiryDate: doc.expiryDate, daysLeft: days, severity: sev });
    }
    for (const p of policies) {
      const days = daysUntil(p.endDate, now)!;
      const sev = severityFor(days);
      if (sev) items.push({ kind: "INSURANCE", refId: p.id, vehicleId: p.vehicleId, subject: p.vehicle.code, detail: p.provider, expiryDate: p.endDate, daysLeft: days, severity: sev });
    }
    // Most urgent first.
    return items.sort((a, b) => a.daysLeft - b.daysLeft);
  }

  // ── Dashboard rollup ────────────────────────────────────────────────────────
  async dashboard() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const [byStatus, byDriver, expiring, trend, fuelMTD, maintMTD, fuelYTD, maintYTD, activeDispatch, totalVehicles] =
      await Promise.all([
        this.prisma.vehicle.groupBy({ by: ["status"], _count: true }),
        this.prisma.driver.groupBy({ by: ["status"], _count: true }),
        this.expiring(30),
        this.costTrend(6),
        this.prisma.fuelLog.aggregate({ _sum: { cost: true }, where: { date: { gte: monthStart } } }),
        this.prisma.maintenanceRecord.aggregate({ _sum: { cost: true }, where: { date: { gte: monthStart } } }),
        this.prisma.fuelLog.aggregate({ _sum: { cost: true }, where: { date: { gte: yearStart } } }),
        this.prisma.maintenanceRecord.aggregate({ _sum: { cost: true }, where: { date: { gte: yearStart } } }),
        this.prisma.dispatchOrder.count({ where: { status: { in: ["ASSIGNED", "EN_ROUTE", "DELAYED"] } } }),
        this.prisma.vehicle.count(),
      ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    const active = statusMap["ACTIVE"] ?? 0;
    return {
      fleet: {
        total: totalVehicles,
        active,
        maintenance: statusMap["MAINTENANCE"] ?? 0,
        retired: statusMap["RETIRED"] ?? 0,
      },
      drivers: Object.fromEntries(byDriver.map((d) => [d.status, d._count])),
      expiring: {
        total: expiring.length,
        critical: expiring.filter((e) => e.severity !== "WARNING").length,
        items: expiring.slice(0, 8),
      },
      cost: {
        mtd: num(fuelMTD._sum.cost) + num(maintMTD._sum.cost),
        ytd: num(fuelYTD._sum.cost) + num(maintYTD._sum.cost),
        trend,
      },
      utilization: {
        activeDispatch,
        // vehicles currently committed to a live dispatch, as a % of the active fleet
        pct: active ? Math.min(100, Math.round((activeDispatch / active) * 100)) : 0,
      },
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private async mustExist(
    model: "vehicle" | "driver" | "vehicleDocument" | "fuelLog" | "maintenanceRecord" | "insurancePolicy",
    id: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await (this.prisma[model] as any).findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`${model} not found`);
  }
}
