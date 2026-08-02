# TUBA AL HIJAZ — Ops Control live boards (Phase 8)

Backend: `apps/api/src/ops/`. Frontend: `OpsControl.tsx` + `apps/web/src/app/lib/opsSocket.ts`.

## WebSocket gateway
- Socket.io, namespace **`/ops`**, room **`ops`** (`OpsGateway`). Authorized boards join `ops` and receive operational events. Data is ops-wide (not per-tenant financial); initial board load still comes from authenticated REST.
- **Auth (S1-03):** handshake must include access JWT via `auth.token` (or `Authorization: Bearer` / `?token=`). Server verifies JWT, requires `VIEW_DASHBOARD` (same RBAC as `/ops/*` REST), and **rejects tenant JWTs** (`companyId` set — agents/suppliers). Failures are logged (`OpsGateway` warn) and surface as client `connect_error`.
- **Gotcha fixed:** NestJS `@WebSocketServer()` injects the *root* namespace — emitting on it never reaches `/ops` clients. The gateway captures `client.nsp` on connect and broadcasts through it.
- Events (unchanged): `flight.status` `{direction, row}` · `dispatch.status` `{row}` · `dispatch.created` `{row}` · `group.arrival` / `group.departure` · `meetassist.updated` · `ziyarah.changed` / `longstay.changed` / `brn.changed`.

## REST endpoints — `/ops/*` (gated on VIEW_DASHBOARD → internal staff only)
| Method | Path | Purpose |
|---|---|---|
| GET | `/ops/groups?status=` | Group Master (agent, pax, hotel, city, dates, visa, opsStatus) |
| GET | `/ops/arrivals?date=` · `/ops/departures?date=` | Boards: FlightInfo ⨝ Group ⨝ assigned Vehicle/Driver |
| PATCH | `/ops/flights/:id/status` | Advance a flight's status → broadcasts `flight.status` |
| GET · POST | `/ops/dispatches` | Dispatch board list / create (→ `dispatch.created`) |
| PATCH | `/ops/dispatches/:id/status` | State machine ASSIGNED→EN_ROUTE→COMPLETED (+DELAYED/CANCELLED), progress %, → `dispatch.status` |
| POST | `/ops/dispatches/:id/flag-delayed` | Manual ops "flag delayed" (note required) |
| GET · PATCH | `/ops/meet-assist/:flightInfoId(/step)` | Lazily-built 7-step checklist; toggle a step |
| GET · POST · PATCH | `/ops/ziyarah(/:id/status)` | Ziyarah trips |
| GET · POST · PATCH | `/ops/long-stays(/:id)` | Long-stay tracking + renewals |
| GET · POST · PATCH | `/ops/brns(/:id/status)` | BRN management |

## Frontend live wiring
`useOpsEvents(handlers, onReconnect)` (opsSocket.ts): one shared auto-reconnecting `/ops` socket.
Handshake sends `auth.token` from `getAccessToken()` on every (re)connect. Returns a live
`connected` boolean (drives the board's LIVE pulse badge). Board rows are patched in-memory from
the socket events — a flight-status change elsewhere updates the row in **< 1 s with no page
reload**. socket.io-client reconnects after a drop, and `onReconnect` re-fetches the visible board
so nothing is missed while offline.

## Observability (edge)
- **`GET /health`** — public liveness (via `/api/health`); unchanged.
- **`GET /metrics`** — Prometheus scrape on the API. **Not** exposed on the public internet (S1-04):
  nginx `location ^~ /api/metrics { deny all; return 404; }`. Scrapers use docker-net
  `http://api:3210/metrics` (`infra/monitoring/prometheus.yml`). Host bind remains `127.0.0.1:3210`.

## Tests
`ops.e2e-spec.ts`: staff gate, boards, dispatch CRUD, Meet & Assist / Ziyarah / LongStay / BRN,
headline live `flight.status` (JWT on socket).  
`ops-ws-auth.e2e-spec.ts` (S1-03): valid JWT connects; missing/invalid JWT rejected; agent JWT
blocked; authorized board still receives `flight.status`.
