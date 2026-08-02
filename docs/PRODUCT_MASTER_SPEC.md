# TUBA AL HIJAZ — Product Master Specification

**Version:** 1.0  
**Date:** 2026-07-31  
**Status:** Canonical product / architecture source of truth  

This document consolidates the audit corpus into one specification for product, engineering, and operations.

**Compiled from:**  
`PROJECT_AUDIT.md` · `MASTER_DOCUMENT_INDEX.md` · `DOCUMENT_CONFLICTS.md` · `CODE_AUDIT.md` · `GAP_ANALYSIS.md` · `FEATURE_STATUS_MATRIX.md` · `IMPLEMENTATION_ROADMAP.md` · `SPRINT_BACKLOG.md`  
(plus operational facts recorded in those audits from `RUNBOOK.md` / `infra/` / domain phase docs)

### How to use this document

| Concern | Authority |
|---|---|
| Product intent, roles, modules, workflows, roadmap | **This file** |
| Runtime behavior when docs disagree | **Code** (`apps/api`, `apps/web`, `schema.prisma`) |
| Day-2 ops (deploy/restore/incident) | **`RUNBOOK.md`** |
| Sprint execution detail | **`IMPLEMENTATION_ROADMAP.md`** + **`SPRINT_BACKLOG.md`** |
| Feature completeness snapshot | **`FEATURE_STATUS_MATRIX.md`** / **`GAP_ANALYSIS.md`** |

When this spec and code diverge after a release, **update this file** in the same change set (or immediately after). Do not treat outdated phase docs (`docs/AUTOMATION.md` OCR-pending claims, `docs/SCHEMA.md` role names, etc.) as authoritative — see `DOCUMENT_CONFLICTS.md`.

---

## 1. Product vision

**TUBA AL HIJAZ** is an Umrah/Hajj **operations ERP** that connects:

- **External agents** (B2B travel agencies) who register groups of pilgrims and buy services  
- **Suppliers** (hotels, transport, catering) who fulfill bookings  
- **Internal staff** who run verification, ops control rooms, finance, fleet, OCR review, and automation  

The product digitizes the full lifecycle from **agent onboarding → group/passenger intake → service booking → payment → vouchers → ground operations → settlement**, with bilingual (Bengali default / English) messaging and document intelligence (OCR).

**UI origin:** Figma Make export reconciled onto a wired React SPA via a vendor-branch (`figma-baseline`) workflow — design and API wiring coexist; blind re-export is forbidden.

**Language product:** Platform i18n contract is **`bn` | `en`** (Bangla default). ERP screens are not yet fully bilingual (known gap).

---

## 2. Business goals

| Goal | How the platform supports it |
|---|---|
| Scale agency onboarding | Self-serve agent/supplier registration + staff verification |
| Operate large pilgrim groups | Groups, passengers, bulk create, OCR passport intake |
| Fulfill multi-service packages | Visa, hotel, transport, catering, additional services + supplier portal |
| Control money safely | Agent prepaid wallet, double-entry GL, invoices, AR/AP, payment slips |
| Run live ground ops | Arrival/departure boards, dispatch, meet & assist, ziyarah, BRN, long stay |
| Maintain fleet compliance | Vehicles, drivers, docs, fuel, maintenance, insurance, expiry alerts |
| Reduce manual document work | Async OCR (Gemini / Vision) + human review queue |
| Automate notifications & chores | Event-driven rules → WhatsApp / email / in-app; scheduled backups |
| Stay auditable & operable | Audit writes (expanding), Prometheus/Grafana, backups, gated production deploys |

**Near-term readiness goals** (from roadmap):

1. **Secure production-ready** — Sprint 1 P0 security closed  
2. **Operator-ready** — Sprint 1+2 (staff finance/automation UIs, audit read, staging)  
3. **Commercially complete** — Sprints 3–4 (leads, reset, OCR depth/honesty, import, i18n)

---

## 3. User roles

Roles are **DB rows** (not hardcoded in guards, except login portal tab checks).

| Role key | Actor | Typical access |
|---|---|---|
| `SUPER_ADMIN` | Platform administrator | Full permissions; user/RBAC; company approval; system settings |
| `OPS_STAFF` | Operations | Dashboards, ops boards, company approve, workflows, OCR review (intended) |
| `FINANCE_STAFF` | Finance | Financial reports + edit records; audit access (intended) |
| `FLEET_STAFF` | Fleet | `MANAGE_FLEET` |
| `CEO_VIEWER` | Executive | Dashboards + financial reports (read) + audit (intended) |
| `AGENT` | External agency user | Tenant-scoped groups/services/agent-finance; **no** staff permission keys |
| `SUPPLIER` | External supplier user | Supplier-scoped bookings; fail-closed on agent data |
| `DRIVER` | Driver app (future) | Seeded for mobile; app not shipped |

### Permission keys (11)

`VIEW_DASHBOARD` · `MANAGE_USERS` · `APPROVE_COMPANIES` · `FINANCIAL_REPORTS` · `EDIT_FINANCIAL_RECORDS` · `CONFIGURE_WORKFLOWS` · `REVIEW_OCR_QUEUE` · `ACCESS_AUDIT_LOGS` · `MANAGE_SYSTEM_SETTINGS` · `API_KEY_ACCESS` · `MANAGE_FLEET`

**Known gaps:** `API_KEY_ACCESS` seeded but not route-enforced. ~~`ACCESS_AUDIT_LOGS`~~ → **enforced on `GET /audit-logs` (S2-01)**. Frontend RBAC UX done (S1-05).

**OCR (`REVIEW_OCR_QUEUE`):** Enforced on review queue list + override/approve/reject/reprocess (S1-01 / S2-06). Submit (`POST /ocr/documents`) and poll (`GET /ocr/documents/:id`) stay JWT + tenancy so agents can enqueue and track jobs.

### Company types

| Type | Meaning |
|---|---|
| `AGENT` | Travel agency tenant (`tenantId` ownership) |
| `SUPPLIER` | Hotel / transport / catering (`supplierId` assignment) |

Verification: `PENDING → UNDER_REVIEW → VERIFIED | REJECTED | SUSPENDED`.

---

## 4. Module catalog

### 4.1 Backend modules (`apps/api/src`)

| Module | Responsibility | Maturity (audit) |
|---|---|---|
| Auth | Login, register, JWT, refresh | Complete |
| Users | User/role/permission admin | Complete |
| Companies | Registry + verification | Complete |
| Uploads / Storage | Files → MinIO/local | Complete (security harden pending) |
| Groups | Groups + passengers | Complete |
| Services | Bookings + supplier portal + vouchers | High (MVP) |
| Finance | GL, wallet, invoices, agent finance | High |
| Ops | Boards + Socket.io `/ops` | High |
| Fleet | Fleet ERP + GPS MVP + expiry | High (MVP) |
| OCR | Async OCR + review | Functional |
| Documents | Versioned vault | Complete (UI partially hidden) |
| Dashboards | Aggregates + Redis cache | Complete |
| Notifications | Multi-channel delivery | Functional |
| Automation | Rules + scheduled jobs | Functional |
| Health / Metrics | `/health`, Prometheus `/metrics` | Complete |

### 4.2 Frontend surfaces (`apps/web`)

| Surface | Route | Launch state |
|---|---|---|
| Marketing | `/`, `/services`, `/about`, `/contact` | Public |
| Auth | `/login`, `/auth-onboarding` | Public |
| Agent portal | `/agent-portal` | Auth; primary launch surface |
| Supplier portal | `/supplier-portal` | Auth; mounted |
| Ops control / departments | `/ops-control`, `/ops-departments` | Auth; mounted |
| Fleet ERP | `/fleet-erp` | Auth; mounted |
| OCR Center | `/ocr-center` | Auth; mounted |
| Dashboards | `/dashboards` | Auth; mounted |
| Super Admin | `/super-admin` | Auth; partial screens |
| Finance ERP | `/finance-erp` | ✅ Live (S2-04) — `FINANCIAL_REPORTS` UX + API gate |
| Automation / notifications admin | `/automation` | ✅ Live (S2-05) — `CONFIGURE_WORKFLOWS` UX + API gate |
| Spec pages | workflow-map, mobile-apps, tablet, design-system, i18n-system | ComingSoon |

### 4.3 Shared library

`@tuba/shared`: bilingual `STRINGS` / formatters; notification template catalog; minimal shared types.

---

## 5. Workflow diagrams (textual)

### 5.1 Canonical 19-stage group lifecycle (product model)

From UI/schema design (WorkflowMap / `WorkflowStage` catalog):

```
Phase 1 — Pre-travel & onboarding
  1 Agent Registration → 2 Verification → 3 Agent Approval
  → 4 Group Creation → 5 Pax OCR/Excel → 6 Flight & Ticket

Phase 2 — Service booking & finance
  7 Visa → 8 Hotel → 9 Transport → 10 Catering
  → 11 Invoice → 12 Payment → 13 Voucher

Phase 3 — On-ground operations
  14 Notifications → 15 Arrival → 16 Stay → 17 Departure
  → 18 Final Statement → 19 Archive (7-year retention intent)
```

`Group.currentStage` points at this catalog. **Full transition API/UI is not complete** (partial / planned).

### 5.2 Agent → supplier → finance happy path

```
Agent registers (PENDING)
    → Staff verifies (VERIFIED) → automation: welcome notify
Agent creates Group + Passengers (manual / OCR)
    → POST /services/{hotel|transport|catering|visa|additional}
    → status REQUESTED → ASSIGNED (auto-route supplier)
Supplier accepts
    → CONFIRMED → wallet auto-deduct (idempotent)
    → voucher PDF (MinIO) → VOUCHER_ISSUED
    → events: booking.confirmed, voucher.generated
Staff/ops mark COMPLETED
    → auto-invoice + GL journal + invoice.generated
Finance marks invoice paid
    → receipt + AR settlement + audit PROCESS
```

### 5.3 Service request state machine

Shared by visa / hotel / transport / catering / additional:

```
REQUESTED → ASSIGNED → CONFIRMED → VOUCHER_ISSUED → COMPLETED
                ↘ REJECTED (reason) ↗ (re-assignable)
Any legal → CANCELLED (agents: cancel only)
```

### 5.4 Company verification state machine

```
PENDING → UNDER_REVIEW → VERIFIED
                ↘ REJECTED (reason required)
VERIFIED ⇄ SUSPENDED
REJECTED → UNDER_REVIEW (resubmit path)
```

### 5.5 Passport OCR pipeline

```
Upload file (POST /uploads)
  → Register OCR job (POST /ocr/documents)  [OcrDocument PENDING]
  → BullMQ tuba-ocr (attempts: 3, exponential backoff)
  → Gemini (preferred) or Google Vision
  → parsers + MRZ checks → IN_REVIEW
  → On failure: validation.lastError persisted; job retries; ops may POST …/reprocess
  → Human override / approve / reject
  → Approve PASSPORT → create Passenger (if group + fields)
  → emit passenger.ocr.completed
```

**E2E (S2-06):** `apps/api/test/ocr-pipeline.e2e-spec.ts` — stub provider covers passport / visa / invoice, retry, reprocess, audit, duplicate passport, tenant isolation.

### 5.6 Automation & notification pipeline

```
Domain service emit(eventKey)
  → EventEmitter2 (**)
  → AutomationDispatcher matches AutomationRule
  → BullMQ tuba-automation (one job per action)
  → Actions: SEND_NOTIFICATION | ESCALATE | GENERATE_* | RUN_BACKUP
       ↓
NotificationsService.dispatch
  → NotificationLog per channel
  → BullMQ tuba-notify
  → WhatsApp | Email | IN_APP (Socket.io /notifications)
```

### 5.7 Design release workflow (Figma)

```
figma-baseline (pristine exports)
        ↘ merge design delta
staging (wired code) → verify staging.tubaalhijaz.com
        ↘ ff-only merge
main → CI test → GHCR → production approval gate → tubaalhijaz.com
```

---

## 6. Database overview

| Fact | Value |
|---|---|
| ORM | Prisma 6 |
| Engine | PostgreSQL 16 |
| Scale | ~51 models, ~47 enums, 11 forward migrations |
| Schema file | `apps/api/prisma/schema.prisma` |
| Dev seed | `seed.ts` (wipe + demo; password `Demo@123`) |
| Prod seed | `seed.prod.ts` (reference data + `ADMIN_*` superuser) |

### Domain groups

| Domain | Key models |
|---|---|
| Platform / RBAC | Season, WorkflowStage, Role, Permission, RolePermission, User, RefreshToken, AuditLog |
| Tenancy | Company, AgentProfile, Guarantor, AgentSeasonQuota, SupplierProfile, BankAccount, Enquiry |
| Storage | UploadedFile (versioning: version, isLatest, supersedesId, expiryDate, scanStatus) |
| Ops core | Group, Passenger, FlightInfo, Ticket, MeetAssistTask, service bookings, BRN, Voucher, LongStay, ZiyarahTrip |
| Fleet | Vehicle, VehicleDocument, VehicleLocation, Driver, DispatchOrder, FuelLog, MaintenanceRecord, InsurancePolicy |
| Finance | Wallet, WalletTransaction, PaymentSlip, ChartAccount, LedgerEntry, Invoice/Item, Receipt/Allocation, Statement, CurrencyRate, FinanceEntry |
| OCR | OcrDocument |
| Automation / notify | AutomationRule, AutomationRunLog, NotificationEvent, MessageTemplate, NotificationLog |

### Multi-tenant columns

- Agent-owned rows: `tenantId → Company`  
- Supplier assignment: `supplierId → Company`  
- Business codes embed Hijri season (e.g. `GRP-1446-…`)

### Migration policy

- Applied on API boot: `prisma migrate deploy`  
- **Forward-only** — schema rollback requires **backup restore**, not migrate down  

### Schema ahead of API (known)

Enquiry (no POST API) · AuditLog read API missing · API keys · DEVICE GPS · ClamAV scan · full workflow transitions  

---

## 7. API architecture

### Style

- NestJS modular monolith  
- **No Nest global prefix** — routes at `/auth`, `/groups`, …  
- Browser reaches API via host nginx **`/api/`** → container `:3210`  
- SPA and API are **separate origins** (CORS `WEB_ORIGIN` / `CORS_ORIGIN`) to avoid path collisions with SPA routes  

### Cross-cutting middleware / guards

```
ThrottlerGuard (200/min global; tighter on auth/uploads)
  → JwtAuthGuard (@Public bypass; seeds tenant ALS)
  → PermissionsGuard (@RequirePermissions)
  → ValidationPipe (whitelist, forbidNonWhitelisted, transform)
  → LoggingInterceptor + MetricsInterceptor
```

### Major route groups

| Prefix | Purpose | Typical gate |
|---|---|---|
| `/auth/*` | Login, register, refresh, me | Public / JWT |
| `/uploads/*` | File upload / presign / confirm / stream | Mostly public upload; file GET JWT |
| `/companies`, `/users`, `/roles` | Admin registry / RBAC | Permissions |
| `/groups`, `/passengers` | Groups & pax | JWT + tenancy |
| `/services/*`, `/supplier/*`, `/hotels`, `/vouchers` | Bookings | JWT + role checks |
| `/ocr/*` | OCR pipeline | JWT submit/poll; `REVIEW_OCR_QUEUE` for review |
| `/ops/*` | Ops boards | `VIEW_DASHBOARD` |
| `/fleet/*`, `/vehicles/*/location` | Fleet | `MANAGE_FLEET` |
| `/finance/*`, `/agent-finance/*` | Finance | FINANCIAL_* / agent company |
| `/dashboards/*` | Aggregates | `VIEW_DASHBOARD` |
| `/documents/*` | Vault | JWT + tenancy |
| `/notifications/*` | Inbox + admin templates | JWT / `MANAGE_SYSTEM_SETTINGS` |
| `/automation/*` | Rules | `CONFIGURE_WORKFLOWS` |
| `/health`, `/metrics` | Ops | `/health` public; `/metrics` internal only (S1-04 nginx deny) |

### Realtime

| Namespace | Purpose |
|---|---|
| `/ops` | Ops board live events (JWT + VIEW_DASHBOARD — S1-03) |
| `/notifications` | In-app push — JWT via `auth.token` (S2-02); rooms from JWT; ERPShell listens + REST bell |

### Client

`apps/web/src/app/lib/api.ts`: Bearer access token (memory + sessionStorage); httpOnly refresh cookie; single-flight 401 retry.

### Testing

- E2E suites under `apps/api/test/` (CI ~178 tests historically)  
- No unit `*.spec.ts`; no frontend test suite  
- OCR dedicated e2e: ✅ **S2-06** (`ocr-pipeline.e2e-spec.ts` + `ocr-rbac.e2e-spec.ts`)  


---

## 8. Security model

### Authentication

- Passwords: **argon2id**  
- Access JWT (HS256, default 15m): `{ sub, email, role, companyId, companyType }`  
- Refresh: random secret, SHA-256 in `RefreshToken`, httpOnly cookie `tuba_rt` (`REFRESH_COOKIE_PATH`, default `/auth`; nginx `/api` prefix → `/api/auth`), rotation + reuse → revoke family  
- Portal tab enforcement: agent / supplier / admin  

### Authorization

- DB-driven permissions via `PermissionsGuard` (60s cache)  
- Tenant isolation via `prisma.scoped`  
- Agents/suppliers typically have **zero** permission rows — tenancy + controller checks  

### Defense in depth (current)

| Control | Status |
|---|---|
| ValidationPipe | ✅ |
| Rate limits (auth/uploads) | ✅ |
| Magic-byte upload validation | 🟡 (not all paths) |
| Audit writes on sensitive actions | 🟡 (writes present; read API gated `ACCESS_AUDIT_LOGS`) |
| Staging notify blank = fail-safe | ✅ |
| Frontend RBAC | ✅ UX gates (S1-05) — **not** a security boundary; API remains SoT |
| OCR `REVIEW_OCR_QUEUE` | ✅ review routes gated (S1-01); submit/poll JWT |
| OCR file ownership on submit | ✅ tenant cannot bind another company's upload (ESP-04) |
| Upload confirm public IDOR | ✅ hardened (S1-02: confirmToken + ownership) |
| Refresh cookie Path under `/api` | ✅ `REFRESH_COOKIE_PATH` (ESP-04) |
| Open `/ops` WebSocket | ✅ JWT + VIEW_DASHBOARD (S1-03) |
| Open `/notifications` WebSocket | ✅ JWT-only rooms from token (S2-02); query spoof rejected |
| Public `/metrics` | ✅ nginx denies `/api/metrics` (S1-04); scrape via docker-net |

### Secrets

- Live secrets only in `infra/.env` (0600, gitignored)  
- Templates: `infra/.env.example`, staging example, API notification example  
- Never commit real JWT/DB/MinIO/SMTP/WASender values  

### Explicit non-goals (for now)

MFA, API-key auth, ClamAV — listed as future/planned in gap analysis.

---

## 9. Multi-tenancy model

```
Request
  → ALS store opened (setup-app)
  → JwtAuthGuard sets { userId, roleKey, companyId, companyType }
  → prisma.scoped injects filters:
       AGENT   → tenantId / companyId per model map
       SUPPLIER→ supplierId (bookings/fleet); agent maps fail-closed
       STAFF   → companyId null → passthrough (see all)
  → Raw prisma.* reserved for auth/admin/system
```

**Rules:**

1. Agents only see their company’s groups, bookings, invoices, OCR docs, etc.  
2. Suppliers only see rows where they are `supplierId`.  
3. Platform staff bypass auto-scope; must be constrained by **permissions**.  
4. Cross-tenant fetch-by-id for tenants → **404** (not 403) when scoped.  

**Gaps:** `UploadedFile` not in auto-scope map; some staff vault/OCR listings are cross-tenant by design of passthrough — tighten with permissions (roadmap).

---

## 10. OCR architecture

| Piece | Detail |
|---|---|
| Queue | BullMQ `tuba-ocr`, prefix `tuba`, Redis db3 |
| Worker | In-process `OcrProcessor` (concurrency 3) |
| Providers | Gemini (preferred if key set) or Google Cloud Vision |
| Selection | `OCR_PROVIDER` or auto: Gemini if `GEMINI_API_KEY` else Vision |
| Passport | MRZ TD3 + ICAO check digits; structured Gemini JSON |
| Other types | Enum supports 15 types; **generic regex parser** for non-passport |
| Review | Always human today (`autoAccept` computed but unused) |
| Approve | PASSPORT → may create `Passenger` |
| Event | `passenger.ocr.completed` |
| UI | `/ocr-center` + agent `OcrIntakeModal` |

**Permission gate (S1-01 / S2-06):** `REVIEW_OCR_QUEUE` on list/override/approve/reject/reprocess; agents keep submit + poll.  
**Failure surface (S2-06):** provider/storage errors written to `OcrDocument.validation.lastError` (still PENDING); `POST /ocr/documents/:id/reprocess` re-enqueues.

---

## 11. AI integrations

| Integration | Role | Config |
|---|---|---|
| **Google Gemini** | Primary OCR (passport structured + generic transcription) | `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-flash-latest`) |
| **Google Cloud Vision** | Fallback / alternate OCR (dense document text) | `GOOGLE_APPLICATION_CREDENTIALS` |

There is **no** separate “AI Engine” product module in production — SuperAdmin “AI Engine” UI is ComingSoon. OCR is the live AI surface.

**Not in scope yet:** Textract, Claude, Tesseract (appear only in frozen UI inventory / mocks).

---

## 12. Notification architecture

| Channel | Implementation | When live |
|---|---|---|
| WhatsApp | WASender HTTP API | `WASENDER_API_KEY` set |
| Email | nodemailer SMTP (+ PDF attachments from storage) | `SMTP_HOST` set |
| In-app | `NotificationLog` + Socket.io `/notifications` | Always |

**Orchestration:** `NotificationsService.dispatch` → per-channel logs → queue `tuba-notify` (concurrency 8, 4 retries).  
**Templates:** DB `MessageTemplate` overrides → fallback `@tuba/shared` catalog; language from recipient (`bn` default).  
**Emergency:** priority preempts queue; fans out to all channels unless explicit channel list.  
**Admin:** event channel matrix + template CRUD (`MANAGE_SYSTEM_SETTINGS`).  
**UI:** ERPShell bell (REST + JWT `/notifications` WS); Automation Admin at `/automation` (S2-05).

**Async path (S2-03):** All asynchronous notifications (automation, voucher ready, supplier reject, fleet expiry) go through `dispatch` → existing `tuba-notify` worker. No second queue. Deterministic `NotificationLog.code` makes fleet expiry re-dispatch a no-op.

**Fleet expiry schedule (S2-03):** Single BullMQ repeatable `expiry-escalation` at 06:00 (`AutomationScheduler` → `runExpiryEscalation` → `ExpiryService.runScan`). Nest `@Cron` twin removed.

**Known defects to close:** template variable mismatches (S2-12); ~~notify bypasses / dual expiry~~ → **done (S2-03)**.

**Staging rule:** never set WASENDER/SMTP on staging (prevents messaging real contacts).

---

## 13. Deployment architecture

```
Internet
  → Cloudflare (proxied DNS, SSL Full strict)
  → Host nginx (TLS, real IP)
        /          → web container (nginx SPA)
        /api/      → api container :3210  (WS upgrade for sockets)
        /grafana/  → monitoring (when enabled)

api container
  → PostgreSQL 16 (volume pgdata)
  → Redis 7 (BullMQ + cache, AOF, memory cap)
  → MinIO (volume miniodata — documents + backups)
```

| Artifact | Role |
|---|---|
| `infra/docker-compose.prod.yml` | Production stack + resource limits |
| `infra/docker-compose.staging.yml` | Isolated ports/project/volumes |
| `infra/Dockerfile.api` / `Dockerfile.web` | Multi-stage images; API runs migrate on boot |
| `infra/nginx/tubaalhijaz.com.conf` | Host reverse proxy |
| `.github/workflows/ci-cd.yml` | test → GHCR → deploy |

**Environments:**

| Env | Branch | Dir | Deploy gate | Notify creds |
|---|---|---|---|---|
| Production | `main` | `/var/www/TUBAALHIJAZ` | Required reviewers | Live (when configured) |
| Staging | `staging` | `/var/www/TUBAALHIJAZ-staging` | Auto | **Must stay blank** |

**Images:** `tuba-alhijaz-{api,web}:<git-sha>`; independent `API_IMAGE_TAG` / `WEB_IMAGE_TAG`.

---

## 14. Monitoring

| Component | Role |
|---|---|
| Prometheus | Scrapes node, cAdvisor, postgres, redis, API `/metrics` (7d / 512MB cap) |
| Grafana | Dashboards; subpath `/grafana/` when nginx live |
| Exporters | node, cAdvisor, postgres, redis (BullMQ depth keys) |
| API metrics | `prom-client` + MetricsInterceptor (latency, 5xx) |
| Health | `GET /health` |

**Ops practice:** `docker compose ps`, service logs, Grafana tunnel, Redis queue lengths for stuck BullMQ jobs (`RUNBOOK`).

**Harden (S1-04):** `/api/metrics` denied at host nginx; Prometheus scrapes `api:3210/metrics` on the docker network.

---

## 15. Backup strategy

| Layer | Mechanism |
|---|---|
| Database | Nightly `pg_dump` (gzip) via `infra/backup.sh` + automation `RUN_BACKUP` |
| Retention | MinIO `tuba-backups/daily/` (~14d), `weekly/` (~90d); staging dir `/var/backups/tuba/` |
| Offsite | Optional S3-compatible via `OFFSITE_*` env (often unset) |
| Files | MinIO volume is source of truth for uploads/vouchers/PDFs |
| Redis | AOF; not a primary business backup |

Manual: `cd infra && ./backup.sh`.

---

## 16. Disaster recovery

| Scenario | Response |
|---|---|
| Bad application release | Set `IMAGE_TAG` / split tags to previous SHA; `compose up -d` (`RUNBOOK` §2) — **&lt; ~2 minutes** if image local |
| Bad schema migration | **Do not** migrate down; **restore DB from backup** (`RUNBOOK` §3); stop API during restore |
| Data corruption | Restore dump into scratch DB first; then cut over |
| Stuck queues / leaked PG connections | Restart API container; inspect Grafana/redis depths |
| Disk full | Prune Docker builders/images; enforce Prometheus size cap |
| Staging incident | Disposable; reset from main; never point staging notify at prod creds |

**RPO/RTO (practical, from current design):**  
- RPO ≈ last successful nightly (or manual) dump; improve with offsite + more frequent dumps if required  
- RTO ≈ restore procedure time + API boot/migrate  

**Scaling DR posture (documented, not required for MVP):** free disk → resize VPS → externalize Postgres → Redis/MinIO → replicate API.

---

## 17. Coding standards

Derived from how the repo is already built and hardened:

### Monorepo

- Package manager: **pnpm** workspaces (`apps/*`, `packages/*`)  
- Build order: shared → web/api  
- Do not add a second `pnpm-workspace.yaml` inside apps (Figma import SKIPPED)  

### Backend

- NestJS modules by domain; thin controllers; services own transactions  
- Prefer `prisma.scoped` for tenant data; raw `prisma` only for auth/admin/system  
- Declare `@RequirePermissions` on every staff-sensitive route; do not rely on frontend  
- DTOs with `class-validator`; never accept unvalidated `Record` bodies  
- Emit domain events for side-effects; do not hardcode notification fan-out in random services (route through NotificationsService)  
- Audit sensitive mutations (`AuditLog`)  
- Lint gate today: `tsc --noEmit` (no ESLint config yet)  

### Frontend

- Wire data via `lib/api.ts`; gate live fetches on `isLoggedIn()`  
- Authed users must not see fabricated mock KPIs (honest empty/error states)  
- Preserve Figma markup; keep wiring (`useState`/`api.*`/States components) on reconcile  
- Use `@tuba/shared` for user-facing strings going forward (ERP migration pending)  
- `RequireAuth` = token + optional path UX gate (`lib/rbac.ts`, S1-05)  
- **Frontend RBAC is UX only** (hide menus/pages, disable actions). Backend `@RequirePermissions` / tenancy remain the sole security boundary — never remove API checks or trust client `permissions[]`.  

### Shared

- Bengali-first `STRINGS`; APIs return raw numbers/ISO/enums — format on client  
- Notification templates: `{{var}}` placeholders; keep API vars aligned with templates  

### Security / secrets

- No secrets in git; examples use `CHANGE_ME`  
- Conventional commits for changes (`feat`, `fix`, `chore`, …) when committing  

### Testing

- Prefer e2e for cross-module flows (`pnpm --filter @tuba/api test:e2e --runInBand`)  
- New P0/P1 features need e2e or explicit ops verification in DoD  

### Figma / design

- Never blind-copy export over `apps/web`  
- Use `scripts/figma-import.sh`; classify FAST / RECONCILE / WIRE-NEEDED / ADAPTED  

---

## 18. Release process

### Happy path

```
1. Develop on feature branch → PR to staging (or main per team practice)
2. CI: install → build shared → typecheck → postgres/redis/minio → migrate → seed → e2e → build
3. staging push: build-push :sha+:staging → auto-deploy staging (no approval)
4. Verify on staging (signed in); notify env blank
5. ff-only merge staging → main
6. main: build-push :sha+:latest → deploy job waits on production environment approval
7. Approve → SSH → git pull → compose pull/up
8. Verify /health + smoke critical paths
```

### Manual / bootstrap

Build on VPS with `IMAGE_TAG=$(git rev-parse --short HEAD) compose up -d --build` when registry unavailable.

### Rollback

Pin previous image tag in `infra/.env`; re-up. Schema issues → backup restore.

### Definition of release readiness

| Gate | Meaning |
|---|---|
| Secure | Sprint 1 acceptance criteria |
| Operator-ready | Sprint 1+2 |
| Feature-complete (commercial) | Through Sprint 3–4 as prioritized |

---

## 19. Future roadmap

Summarized from `IMPLEMENTATION_ROADMAP.md` / `GAP_ANALYSIS.md` — **no new scope**.

### Near term

| Sprint | Band | Theme |
|---|---|---|
| 1 | P0 | OCR perms, upload harden, ops WS/metrics, frontend RBAC, vault unhide, doc drift |
| 2 | P1 | Audit API/UI, Finance+Automation unhide, notify unify, expiry dedupe, OCR e2e, staging verify |
| 3 | P2 | Enquiry API, password reset, OCR depth or honesty, registration events |
| 4 | P3 | Passenger import, AgentPortal i18n, debt cleanup, offsite/disk hygiene |

### Later (P4 backlog)

- Hardware GPS (`DEVICE`) + driver/agent/ops mobile apps  
- NUSUK / MOFA / ZATCA live integrations  
- CRM / HR / Procurement desks  
- API key authentication  
- ClamAV virus scanning  
- Workflow transition API + live WorkflowMap  
- Horizontal scale / managed Postgres  
- Full staff ERP Bengali  

### Explicitly deferred

Horizontal re-architecture, Excel via abandoned npm `xlsx`, building native apps before P0–P1 close.

---

## 20. Document map (where to go next)

| Need | Document |
|---|---|
| This SoT | `PRODUCT_MASTER_SPEC.md` |
| Feature ✅/🟡/🔴 matrix | `FEATURE_STATUS_MATRIX.md` |
| Gap impacts & sprints | `GAP_ANALYSIS.md` / `IMPLEMENTATION_ROADMAP.md` / `SPRINT_BACKLOG.md` |
| Code-level behavior | `CODE_AUDIT.md` |
| Doc conflicts / archive list | `DOCUMENT_CONFLICTS.md` / `MASTER_DOCUMENT_INDEX.md` |
| On-call | `RUNBOOK.md` |
| Domain deep-dives (may lag) | `docs/AUTH.md`, `FINANCE.md`, `OPS.md`, … — verify against code |

---

## 21. Current known gaps (must not be forgotten)

Tracked in gap analysis; called out here so the SoT stays honest:

1. ~~OCR review permission not enforced~~ → **done (S1-01)**  
2. ~~Public upload confirm IDOR risk~~ → **done (S1-02)**  
3. ~~Frontend has no RBAC~~ → **done (S1-05)** — UX only; API remains SoT  
4. ~~Open `/ops` WebSocket~~ → **done (S1-03)**; ~~public `/metrics`~~ → **done (S1-04)**  
5. ~~FinanceERP ComingSoon~~ → **done (S2-04)**; ~~Automation ComingSoon~~ → **done (S2-05)**; ~~Documents Vault dead-mapped~~ → **done (S1-06)**  
6. ~~Audit log read API missing~~ → **done (S2-01)** — `GET /audit-logs` + SuperAdmin Audit Logs screen; write coverage still sparse (**S2-02b**)  
7. ~~Dual 06:00 expiry jobs; notify bypasses~~ → **done (S2-03)** — single BullMQ expiry schedule; all async notify via `dispatch`/`tuba-notify`  

8. Enquiry / password reset / Excel import incomplete  
9. ERP mostly English despite bn default  
10. Residual phase-doc drift (SCHEMA roles, AUTOMATION “OCR pending”) → track **S1-08**  

**Sprint 1 status:** implementation tickets S1-01…S1-07 complete (see `docs/SPRINT1_COMPLETION_REPORT.md`). Redeploy API + web images on live for code tickets; nginx metrics deny already applied on host.

Closing order: **Sprint 2 → 3 → 4 → P4 backlog**.

---

*End of Product Master Specification v1.0. No application code was modified to produce this document.*
