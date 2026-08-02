# TUBA AL HIJAZ — Live Dashboards (Phase 12)

The "does the whole system add up" checkpoint. Every KPI, chart, and table across the dashboard
views is a **live aggregate** over the Phase 2–11 + TRANSFORM-002 schema — no mock numbers. Backend:
`apps/api/src/dashboards/`. Frontend: `Dashboards.tsx` (frozen UI, live data swapped in).
T002-09 adds the **Visa & Compliance** board (`GET /dashboards/visa`) that reuses Ops Visa Desk /
Long Stay aggregations (architecture §12).

## Principles
- **Aggregate SQL only.** Prisma `count` / `aggregate` / `groupBy` (COUNT/SUM in Postgres) plus
  `$queryRaw` with `date_trunc` for month/hour time-series. Nothing pulls a full table into JS to sum.
- **Reuse the audited numbers.** Finance figures come from the Phase-7 `ReportsService`
  (`profitAndLoss`, `arAging`, `apAging`, `balanceSheet`), so the CEO/Finance dashboards agree with
  Finance ERP to the riyal — the same GL, one source of truth.
- **Redis cache** (`DashboardCache`, VPS Redis db3, key prefix `tuba:dash:`): heavy rollups are
  read-through cached with a short TTL (CEO/Finance 60s, ops/dispatch/boards/tenant 30s) so a burst
  of page loads hits Redis, not a fresh GL scan. Cache is best-effort — a Redis blip falls through to
  a live query, never an error.

## Endpoints — `/dashboards/*` (gated `VIEW_DASHBOARD`)
| Path | Key figures |
|---|---|
| `GET /dashboards/ceo` | YTD revenue, net profit/margin (P&L), active groups+pax, airlines, AR outstanding, overdue invoices, **active agents**, 8-mo revenue trend, top agents |
| `GET /dashboards/ops` | groups active, arrivals/departures today, completed today, delayed dispatch, open tasks (5 booking tables), hourly arr/dep, dept workload |
| `GET /dashboards/visa` | **T002-09** pipeline by state, MOFA completeness %, biometric backlog, arriving ≤7d not issued, Long Stay red cards (day-85/90), gate readiness — delegated to Ops Visa Desk / Long Stay |
| `GET /dashboards/finance` | cash position (BS cash accounts), AR/AP totals (aging), net profit, AR aging buckets, 8-mo cash trend, top AR entities |
| `GET /dashboards/dispatch` | active/delivered/delayed dispatches, pax moving, live order list (⨝ vehicle/driver/group) |
| `GET /dashboards/arrivals?date=` · `/departures?date=` | flights, total/processed/pending pax, landed count, flight list (⨝ group/tenant) |
| `GET /dashboards/agent[?companyId=]` | wallet balance, active/season groups, outstanding invoices, 8-mo pax trend, groups + invoices, **`visa`** (tenant-scoped pipeline + MOFA %) |
| `GET /dashboards/supplier[?companyId=]` | pending bookings, invoices outstanding, season revenue (supplier sub-ledger), upcoming services, quality score |

Agent/Supplier resolve a representative tenant: the caller's own company, else the first company of
that type (staff viewing the overview page).

## Spot-checks (proven in `dashboards.e2e-spec.ts`, 9 tests)
Each endpoint figure is asserted against a direct table count / the audited reports:
- CEO **active agents** == `count(Company WHERE type='AGENT' AND verificationStatus='VERIFIED')`
- CEO **YTD revenue** ties to the Finance dashboard `totalRevenue` (same GL source)
- Ops **groups active** / **delayed** == direct `Group` / `DispatchOrder` counts
- Finance **AR total** == `arAging` total; the 4 aging buckets sum to it
- Dispatch **active** == `count(DispatchOrder WHERE status IN live)`
- Arrival/Departure **flights** == `count(FlightInfo WHERE direction, scheduledAt today)`
- Cache returns an identical payload on immediate re-fetch
Plus the `VIEW_DASHBOARD` gate (agents get 403). T002-09 adds spot-checks for `/dashboards/visa`
(pipeline / MOFA / biometric / Long Stay red cards) and agent `visa` payload.

## Frontend
`Dashboards.tsx` — views fetch their endpoint (guarded by `isLoggedIn()`), format numbers to the
existing `SAR 8.45M` / `323.7K` style, feed the recharts series, and fall back to the frozen mock data
when logged out. T002-09 replaces ComingSoon visa cards with live `/dashboards/visa` + agent `visa`
widgets and adds the **Visa & Compliance** nav screen. Drill-down links open existing desks
(`/ops-departments`, `/ops-control`) — no business actions from the dashboard.
