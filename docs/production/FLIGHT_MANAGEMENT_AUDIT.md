# FLIGHT MANAGEMENT — END-TO-END AUDIT (LOCAL, no deploy)
Date: 2026-08-04 · Method: schema review + full code sweep + runtime endpoint probes (OPS_STAFF) + browser (agent). Verdict: **Flight Management is a READ + STATUS-tracking system, NOT a full create/assign/edit/delete workflow.**

## Runtime evidence (probed as Operations)
| Operation | Endpoint | Result |
|---|---|---|
| Create flight | `POST /ops/flights` | **404 — missing** |
| Assign to group | `POST /groups/:id/flights` | **404 — missing** |
| Edit flight (full) | `PATCH /ops/flights/:id` | **404 — missing** |
| Edit status only | `PATCH /ops/flights/:id/status` | **200 — exists** |
| Delete flight | `DELETE /ops/flights/:id` | **404 — missing** |
| Read boards | `GET /ops/arrivals` `/ops/departures` | **200 — exists** |

`FlightInfo` rows are created **only by the seed** (`prisma.flightInfo.create` exists nowhere else in the codebase).

## The 7 questions
1. **Ops create a Flight?** ❌ No API. Seed-only.
2. **Ops assign Flight to Group?** ❌ No API. Flights are seeded with a `groupId`; no runtime assign/create.
3. **Ops edit assigned Flight?** ⚠️ Partial — **only `status`** is editable (`PATCH …/status`). Airline, flightNo, route, schedule, pax, terminal, gate cannot be edited via API.
4. **Ops remove assigned Flight?** ❌ No delete API.
5. **Agent Portal displays assigned Flights?** ✅ Yes — group-detail **Flights tab** (read-only) via `GET /groups/:id` → `flightInfos` (browser-verified: 2 flights render). NB: the separate Agent "Flight service" screen is a **"Coming Soon" placeholder** (`FlightComingSoon`, "no /services/flight endpoint yet").
6. **Supplier Portal requires Flight info?** ❌ No — `supplier.controller.ts` has zero flight usage. Suppliers handle hotel/transport/catering acceptance only. (`Ticket.flightInfoId` and `DispatchOrder.flightInfoId` relations exist but no supplier-facing flight requirement.)
7. **Finance / Visa / Dispatch / Timeline updated after Flight assignment?** ❌ No cross-module automation. There is no assignment operation to trigger anything. The only side-effects exist on **status change**: `setFlightStatus` emits WebSocket board events (`flight.status`; `group.arrival` on DELIVERED, `group.departure` on DEPARTED) and writes an audit row — but it does **not** update Finance, Visa, Dispatch, or Timeline **records**. Flights carry no price → no Finance link. No workflow-stage transition is driven by flights. `DispatchOrder`/`Ticket` merely *reference* a flight (set at seed time).

## Existing implementation (works)
- **Ops Arrival/Departure boards** — `ops.service.arrivals/departures` → `flightInfo.findMany`; live via `ops.gateway` WS. Frontend `OpsControl.tsx` (ArrivalBoard/DepartureBoard) with a **status dropdown** → `PATCH /ops/flights/:id/status`.
- **Meet-Assist** — `GET /ops/meet-assist/:flightInfoId`, `PATCH …/step` (per-flight greeter checklist).
- **Agent group Flights tab** — read-only list from `GET /groups/:id`.
- **Model** — `FlightInfo` is complete (direction, airline, flightNo, origin/dest, scheduledAt, terminal, gate, paxCount, status; relations: tickets, dispatchOrders, meetAssist; cascade-delete from Group).

## Missing implementation
Create · Assign · full Edit · Delete — **all absent** (no endpoints, no Ops UI controls beyond status). No Finance/Visa/Dispatch/Timeline automation on assignment. Supplier has no flight requirement.

## Required endpoints (missing — to be built, NOT fabricated)
All under Ops, guard `MANAGE_OPS`, audit + WS broadcast on write:
1. `POST /ops/flights` — create+assign. Body: `groupId, direction, airline, flightNo, originAirport, destAirport, scheduledAt, terminal?, gate?, paxCount`. Server derives `tenantId` from the group and generates `code` (ARR-/DEP-###).
2. `PATCH /ops/flights/:id` — edit any of the above fields (distinct from the existing `/status` route).
3. `DELETE /ops/flights/:id` — remove; must define behavior for linked `DispatchOrder`/`Ticket` (block if present, or `SET NULL`). `MeetAssistTask` cascades.
4. *(optional)* `POST /groups/:id/flights` — sugar for assign-in-group-context (alias of #1).
5. *(optional, business decision)* automation hooks on create/assign: emit `flight.assigned` → Timeline stage + Dispatch pre-order + notification. Requires a business rule spec.

## Files that WOULD change if built (v2.1 feature — NOT changed now)
`apps/api/src/ops/ops.controller.ts`, `ops.service.ts`, new `ops/dto/flight.dto.ts`; `apps/web/src/app/pages/OpsControl.tsx` (create/edit/delete controls). No Prisma schema change needed (model already supports it; only `onDelete` policy for Dispatch/Ticket to decide).

## Decision
Every missing piece needs **new backend endpoints** — there is no existing API to wire, so per the "list required endpoints if missing" rule and the production freeze, this is a **v2.1 feature** (audit + spec delivered), not a support patch. No fake UI added. Files changed by this task: **none** (audit only).
