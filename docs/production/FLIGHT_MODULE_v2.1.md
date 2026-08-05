# ENTERPRISE FLIGHT MANAGEMENT MODULE — v2.1 (LOCAL, not deployed)
Status: **Backend COMPLETE + verified. Frontend pending.** New feature → **v2.1** (per versioning policy). Built in the isolated local stack; no deploy.

## Data model (additive migration `20260804210010_flight_management_module`, backward-compatible)
- **FlightInfo** enriched: `aircraft, boardingAt, departureAt, arrivalAt, capacity, availableSeats` (existing fields kept; 7 existing flights intact).
- **FlightStatus** enum + `IN_TRANSIT, ARRIVED, CANCELLED, RESCHEDULED` (BOARDING/DEPARTED/DELAYED already existed).
- **FlightAssignment** (new): M:N join `flightInfoId × groupId` + `seatsAllocated` (@@unique). One flight → many groups. Existing `FlightInfo.groupId` kept as the primary group for backward compatibility.
- **Ticket** + `pnr, ticketNumber, seatNumber` (already had passenger + flight links) → PNR / ticket / seat mapping.

## Backend (new module `apps/api/src/flights/`)
RBAC: all writes `@RequirePermissions("MANAGE_OPS")` (Operations + Super Admin); reads open to any authenticated user (agents = read-only). Every write writes an AuditLog (module "Flights").
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/flights` | list (filters: direction, status, q, groupId) + assignment/ticket counts |
| GET | `/flights/:id` | detail (assignments+groups, tickets+passengers, meet-assist) |
| GET | `/flights/:id/assignments` | groups on a flight |
| POST | `/flights` | create Flight Master (auto code ARR-/DEP-, seats from capacity) |
| PATCH | `/flights/:id` | edit master fields (recomputes availableSeats on capacity change) |
| DELETE | `/flights/:id` | remove (blocks if dispatch orders exist) |
| POST | `/flights/:id/assign` | assign flight → group (+ seat allocation, over-capacity guard) |
| DELETE | `/flights/:id/assign/:groupId` | unassign (protects primary group) |
| POST | `/flights/:id/tickets` | map ticket: passenger + PNR + ticketNumber + seat |
| PATCH | `/flights/:id/tickets/:ticketId` | edit ticket/seat/PNR |
| PATCH | `/flights/:id/status` | operational status transition + terminal-state guard |

**Seat ledger:** `availableSeats = capacity − Σ assignment.seatsAllocated`, recomputed on assign/unassign/capacity-edit; over-allocation → 400.
**Operations lifecycle:** SCHEDULED→CHECK_IN/BOARDING→DEPARTED→IN_TRANSIT→ARRIVED (+ DELAYED/CANCELLED/RESCHEDULED); transitions from a terminal state (ARRIVED/DELIVERED/CANCELLED) are blocked (400).

## Automation (P4)
- **Meet & Assist — direct:** arriving flight reaching LANDING/ARRIVED/DELIVERED auto-provisions the 7-step greeter checklist (verified: 7 steps).
- **Domain events emitted** into the existing rule engine: `flight.status.changed`, `flight.assigned` (added to `automation/events.ts`). Timeline / Notifications / Dispatch / Visa Desk / Hotel / Transport reactions attach as **AutomationRules on these event keys** — the platform's real, admin-configurable automation mechanism (nothing hardcoded/faked). Rule packs for flight events are the remaining automation config item.

## Verification (backend)
- **API:** 21/21 (create, availableSeats math, M:N assign to 2 groups, over-capacity 400, ticket+PNR+seat, status→BOARDING/CANCELLED, terminal guard 400, RBAC agent 403 on writes + 200 read, arrival→Meet&Assist 7 steps, delete→404).
- **Database:** AuditLog 10 Flights rows (CREATE/UPDATE/DELETE); seat ledger + assignment persistence correct; test data cleaned.
- **Regression:** 7 existing flights intact; `/ops/arrivals`, `/ops/flights/:id/status`, agent `/groups/:id` all 200 — existing flight features unaffected.
- **TypeScript:** api `tsc --noEmit` clean.

## Remaining
- **P5 Frontend:** Ops flight-management UI (Flight Master list + create/edit, assign-to-groups w/ seat allocation, ticket/PNR/seat mapping, status control) + agent read-only. No fake UI — wired to the endpoints above.
- **P6 Browser verification + regression + this doc finalized.**
- Automation rule packs for `flight.status.changed` / `flight.assigned` (Timeline/Notify/Dispatch/Visa/Hotel/Transport) — configured via the Automation admin.

## Files
New: `apps/api/src/flights/{flights.module,flights.controller,flights.service}.ts`; migration `20260804210010_flight_management_module`. Edited: `app.module.ts` (register), `automation/events.ts` (2 event keys), `schema.prisma`. Backups in `/root/tuba-local-bak/`.

---
## P5 Frontend + P6 Browser verification — DONE (2026-08-04)
- **New Ops page** `apps/web/src/app/pages/FlightManagement.tsx` at route `/flight-management` (gated `P.MANAGE_OPS`), added to the app nav (ops-core group) via `navConfig.ts`. Uses real ERP components (ErpDataTable/ErpDrawer/ErpForm/ErpConfirmDialog) wired to the `/flights` endpoints — no fake UI.
- Features: flight list (code/dir/route/aircraft/seats/status), New Flight + Edit drawer (all master fields), Manage drawer (status control, group assignment w/ seat allocation + unassign, ticket/PNR/seat mapping).
- **Frontend wiring:** added `MANAGE_OPS` to the web RBAC `P` enum; route gate; lazy route; nav item (Plane icon).
- **Browser-verified (headless):** Ops lands on the page, heading + New Flight render, **create through the UI works end-to-end** (form → POST /flights → row appears), **0 console errors**; **RBAC** — agent redirected to /agent-portal (blocked).
- **Regression:** `/ops-control`, `/dashboards`, `/fleet-erp` render with 0 real console errors; 7 existing flights intact; existing Ops boards + agent group tab unaffected. web `tsc --noEmit` clean.

## STATUS: MODULE COMPLETE (local, not deployed) — all 4 verification pillars green (API 21/21 · DB · Browser · Regression).
Files (web): `pages/FlightManagement.tsx` (new), `routes.tsx`, `lib/rbac.ts`, `lib/navConfig.ts`. Files (api): `flights/*` (new), `app.module.ts`, `automation/events.ts`, `schema.prisma` + migration.
