# TUBA AL HIJAZ — Fleet ERP (Phase 9)

Backend: `apps/api/src/fleet/`. Frontend: `apps/web/src/app/pages/FleetERP.tsx` (new page, route `/fleet-erp`).

Fleet data is internal (TUBA-owned + supplier vehicles/drivers). Every endpoint is gated on
the new **`MANAGE_FLEET`** permission (granted to `FLEET_STAFF` and `SUPER_ADMIN`). The service
uses the **unscoped** Prisma client — fleet rows aren't tenant-owned, and staff carry no
`companyId`, so the tenant extension is a no-op for them anyway.

## Data model (added this phase)
- **`VehicleDocument`** — registration (Istimara), inspection (Fahes), operating card, permit… each
  with `expiryDate` (the expiry-scan key) and an optional `fileId` scan in object storage.
- **`VehicleLocation`** — GPS fix history (`lat`/`lng` `Decimal(9,6)`, `label`, `speedKmh`, `source`).
- **`Vehicle.last{Lat,Lng,LocationLabel,LocationAt}`** — denormalized latest fix so the **map reads
  O(1)** with no join/subquery. `updateLocation` writes the history row and these fields in one txn.
- Enums `VehicleDocType`, `LocationSource` (`MANUAL` | `DEVICE`).
- Migration `20260718100000_fleet_docs_locations_gps`.

## REST — `/fleet/*` (all gated `MANAGE_FLEET`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/fleet/dashboard` | Rollup: fleet counts, driver availability, expiring summary, MTD/YTD cost + 6-mo trend, utilization |
| GET | `/fleet/vehicles?status=&type=` · `/fleet/vehicles/:id` | Vehicle master (derived next-doc/insurance expiry + severity) / full detail |
| POST · PATCH · DELETE | `/fleet/vehicles(/:id)` | Vehicle CRUD (delete cascades docs/fuel/maintenance/insurance/locations; nulls dispatch) |
| GET · POST · PATCH · DELETE | `/fleet/drivers(/:id)` | Driver CRUD (license-expiry severity computed) |
| GET · POST | `/fleet/vehicles/:id/documents` | Vehicle documents |
| PATCH · DELETE | `/fleet/documents/:docId` | Edit / remove a document |
| GET · POST · DELETE | `/fleet/fuel(/:id)` | Fuel logs (filter `?vehicleId=`) |
| GET · POST · PATCH · DELETE | `/fleet/maintenance(/:id)` | Maintenance records |
| GET · POST · PATCH · DELETE | `/fleet/insurance(/:id)` | Insurance policies |
| GET | `/fleet/expiring?days=30` | **Unified** expiry feed — driver licences + vehicle docs + insurance, one sorted list |
| GET | `/fleet/cost-trend?months=6` | Monthly fuel + maintenance spend (continuous, zero-filled) |
| POST | `/fleet/expiry/scan` | Run the compliance watchdog now → `{scanned, created}` |
| GET | `/fleet/map` · `/fleet/vehicles/:id/trail` | Latest position of every vehicle / one vehicle's trail |
| GET · POST | `/fleet/dispatches` · `/fleet/dispatches/:id/assign` | Assignable orders / assign Vehicle+Driver |
| POST | **`/vehicles/:id/location`** | GPS ingest (kept at the spec's exact path, no `/fleet` prefix) |

## Expiry watchdog (`ExpiryService`)
`@nestjs/schedule` `@Cron(EVERY_DAY_AT_6AM)` scans every driver licence, vehicle document, and
insurance policy and raises an in-app `NotificationLog` for each item that has crossed the **30-day**
or **7-day** window (or already lapsed). **Idempotent:** each alert's `code` is deterministic
(`FLEET-EXP-<kind>-<refId>-<bucket>`) and `NotificationLog.code` is unique, so `createMany({
skipDuplicates })` means re-running never double-alerts; a doc that decays 30-day → 7-day earns a
*second* alert (different bucket) — intended escalation. `runScan()` is the reusable unit of work,
also exposed via `POST /fleet/expiry/scan`.

> **Phase 10 note:** this runs in-process (no Redis) — right-sized for a once-a-day job. When
> BullMQ lands in Phase 10 the scan moves onto the queue unchanged; `runScan()` is already the job body.

## Dispatch assignment
`POST /fleet/dispatches/:id/assign {vehicleId?, driverId?}` sets the DispatchOrder's vehicle/driver,
flips the driver to `ON_DUTY`, and **broadcasts `dispatch.status` on the Ops `/ops` gateway** (FleetModule
imports OpsModule) so the live Ops dispatch board (Phase 8) updates without a refresh.

## GPS — MVP vs Phase 2
MVP is **manual / simulated** fixes: ops (or a test) posts `{lat,lng,label,speedKmh}` to
`POST /vehicles/:id/location`, and the map renders whatever is stored. **Phase 2 (post-MVP)** is a
hardware-tracker webhook posting the *same shape* with `source=DEVICE` — the map, trail, and
`last*` denormalization already consume it, so no UI/query change is needed when real trackers land.
This is the documented hardware integration point.

## Frontend — `FleetERP.tsx`
New page in `ERPShell` (module `fleet`, slate `#475569`, `Truck`). Nine screens: Dashboard
(KPIs + pure-SVG/div cost-trend bars + utilization gauge + expiring feed), Vehicle Master (+ detail
drawer), Driver Master, Compliance (unified expiry feed + scan button + per-vehicle docs), Fuel,
Maintenance, Insurance, GPS Map (pure-SVG lat/lng projection with pins + a "simulate location"
control), Dispatch Assignment. Mirrors FinanceERP conventions; each screen fetches live data guarded
by `isLoggedIn()` and falls back to mock data in the frozen-demo state. No new dependencies. The
`GLOBAL_MODS` fleet entry now routes to `/fleet-erp`.

## Tests
`fleet.e2e-spec.ts` (12): `MANAGE_FLEET` gate; vehicle/driver/document/fuel/maintenance/insurance
CRUD; unified expiry feed (seeded EXPIRED + CRITICAL, correct sort); watchdog scan **is real and
idempotent** (second scan creates 0); 6-month cost-trend aggregation; GPS fix → map + trail read-back
+ out-of-range 400; dispatch assignment reflects on the driver; dashboard rollup.

> The shared dev DB is reached through a single SSH tunnel — run the full e2e suite with
> **`--runInBand`** (parallel suites saturate the tunnel and fail `/auth/login`).
