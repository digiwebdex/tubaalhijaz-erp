# TUBA AL HIJAZ — Project Audit Report

**Date:** 2026-07-31  
**Scope:** Full read-only inventory of the production ERP monorepo at `/var/www/TUBAALHIJAZ`  
**Method:** Source, docs, schema, infra, and CI inspected. No application code was changed.  
**Product:** Umrah/Hajj operations ERP (agents, suppliers, ops, finance, fleet, OCR, automation).

> Related docs (do not replace this report): `docs/AUDIT.md` (frontend inventory / schema design source), `RUNBOOK.md`, and domain docs under `docs/`.  
> Folders **`prompts/`** and **`planning/`** do **not** exist in this repository.

---

## 1. Overall Architecture

### Monorepo layout

```
TUBAALHIJAZ/
├── apps/
│   ├── api/          NestJS 11 + Prisma 6 + BullMQ (transactional backend)
│   └── web/          React 18 + Vite 6 + Tailwind 4 (SPA; Figma Make origin)
├── packages/
│   └── shared/       @tuba/shared — i18n strings, notification templates, types
├── infra/            Docker Compose, Dockerfiles, nginx, monitoring, backup
├── docs/             Domain + ops documentation (12 files + this audit)
├── scripts/          Figma import + theme codemods
├── .github/workflows/ci-cd.yml
├── package.json      pnpm workspace root
└── RUNBOOK.md        On-call / deploy / Figma reconcile
```

### Runtime topology (production)

```
Internet → Cloudflare → Host nginx (TLS)
                          ├─ /          → web container (nginx SPA :8080→host 8095)
                          └─ /api/      → api container (NestJS :3210)
                                            ├─ PostgreSQL 16
                                            ├─ Redis 7 (BullMQ + dashboard cache, db3)
                                            └─ MinIO (documents, vouchers, backups)
Monitoring (optional compose): Prometheus, Grafana, node/cAdvisor/postgres/redis exporters
```

**Stack summary**

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 7, Vite 6, Tailwind 4, Radix/shadcn, MUI, Socket.io client |
| Backend | NestJS 11, Passport JWT, argon2, class-validator, prom-client |
| Data | PostgreSQL + Prisma (51 models, 47 enums, 11 migrations) |
| Queues | BullMQ on Redis — `tuba-automation`, `tuba-notify`, `tuba-ocr` |
| Storage | MinIO (prod) / local disk (dev fallback) |
| OCR | Google Gemini (preferred) + Google Cloud Vision fallback |
| Notify | WhatsApp (WASender), SMTP email, in-app Socket.io |
| Package mgr | pnpm 11 workspaces |

### Architectural patterns

- **Modular NestJS monolith** — domain modules under `apps/api/src/*`, global JWT + permissions + throttling guards.
- **Multi-tenancy** — Prisma AsyncLocalStorage extension (`prisma.scoped`) filters by `tenantId` / `companyId` / `supplierId` from JWT.
- **Event-driven automation** — Nest `EventEmitter` (`@OnEvent("**")`) → rule match → BullMQ actions.
- **Separate SPA origin** — web and API are different origins (CORS); host nginx prefixes `/api/` for browsers while Nest serves routes at root inside the container.
- **Figma vendor branch model** — `figma-baseline` holds pristine exports; wiring lives on `staging`/`main`; `scripts/figma-import.sh` classifies FAST/RECONCILE/WIRE-NEEDED.

### What is *not* present

- No `prompts/` or `planning/` directories.
- No root README (ops entrypoints are `RUNBOOK.md` + `infra/README.md` + `docs/*`).
- No native mobile apps (UI specs exist as ComingSoon pages).
- No API global prefix (`/api` is nginx-only).
- No unit tests (`*.spec.ts`); e2e only.

---

## 2. Module List

### Backend (`apps/api/src`)

| Module | Responsibility | Maturity |
|---|---|---|
| `auth` | Login/register, JWT + refresh cookies, `/auth/me` | Complete |
| `users` | User CRUD, roles, permission matrix | Complete |
| `companies` | Agent/supplier registry + verification | Complete |
| `uploads` | Public multipart/presign upload pipeline | Complete |
| `storage` | MinIO / local drivers | Complete |
| `groups` | Groups + passengers (incl. bulk) | Complete |
| `services` | Visa/hotel/transport/catering/additional + supplier portal | High (MVP) |
| `finance` | Staff ERP + agent wallet/slips/statements | High |
| `ops` | Boards, dispatch, M&A, ziyarah, BRN, long-stay + WS `/ops` | High |
| `fleet` | Vehicles, drivers, fuel, maintenance, insurance, GPS MVP | High (MVP) |
| `ocr` | Async OCR + review queue (Gemini/Vision) | Functional |
| `documents` | Versioned document vault | Complete |
| `dashboards` | 8 role aggregates (Redis-cached) | Complete |
| `notifications` | Multi-channel delivery + templates + WS `/notifications` | Functional |
| `automation` | Rules engine, cron backups, expiry escalation | Functional |
| `metrics` / `health` | Prometheus + health | Complete |
| `prisma` / `common` | DB, guards, ALS tenant context, logging | Complete |

### Frontend pages (`apps/web/src/app/pages`)

| Area | Pages | Route status |
|---|---|---|
| Marketing | Home, Services, About, Contact | Public |
| Auth | Login, AuthOnboarding | Public |
| Agent | AgentPortal (+ Groups/Services/Finance modules) | Auth |
| Staff ERP | SupplierPortal, OpsControl, OpsDepartments, FleetERP, OCRCenter, Dashboards, SuperAdmin | Auth (mounted) |
| Built but gated | FinanceERP, AutomationNotifications | Route → `ComingSoon` |
| Spec / docs | WorkflowMap, MobileApps, Tablet, DesignSystem, I18nSystem | Route → `ComingSoon` |

### Shared (`packages/shared`)

- `i18n.ts` — `STRINGS`, `t()`, Bengali numerals/dates, fonts
- `notifications.ts` — bilingual templates + interpolate
- `types.ts` — minimal (`ApiHealthResponse` placeholder)

### Infra / ops

- Compose: `docker-compose.yml` (dev), `.prod.yml`, `.staging.yml`, `.monitoring.yml`
- Nginx: container SPA (`nginx.web.conf`) + host vhost (`nginx/tubaalhijaz.com.conf`)
- CI/CD: `.github/workflows/ci-cd.yml` (test → GHCR → deploy)
- Scripts: Figma import, light-theme codemods
- Backup: `infra/backup.sh` → MinIO `tuba-backups/`

---

## 3. Database Overview

**Schema:** `apps/api/prisma/schema.prisma` (~1725 lines)  
**Docs:** `docs/SCHEMA.md` (slightly stale on role key names vs seed — trust Prisma + seed for roles)

### Scale

- **~51 models**, **47 enums**, **11 forward migrations**
- Tenancy columns: `tenantId` (agent company), `supplierId` (supplier company)
- Season dimension embedded in business codes (e.g. `GRP-1446-…`)

### Migrations (applied order)

1. `20260717040000_init`
2. `20260717050000_refresh_tokens`
3. `20260717060000_uploaded_files`
4. `20260717070000_ocr_pipeline`
5. `20260717080000_service_workflows`
6. `20260717120000_finance`
7. `20260717140000_ops_and_finance_guards`
8. `20260718100000_fleet_docs_locations_gps`
9. `20260718160000_automation_engine`
10. `20260718180000_notification_delivery`
11. `20260718200000_document_vault_versioning`

API boot runs `prisma migrate deploy` (forward-only; rollback = restore backup).

### Domain model groups

| Domain | Key models |
|---|---|
| Platform / RBAC | `Season`, `WorkflowStage`, `Role`, `Permission`, `RolePermission`, `User`, `RefreshToken`, `AuditLog` |
| Tenancy | `Company`, `AgentProfile`, `Guarantor`, `AgentSeasonQuota`, `SupplierProfile`, `BankAccount`, `Enquiry` |
| Storage | `UploadedFile` (vault versioning by company+kind) |
| Ops core | `Group`, `Passenger`, `FlightInfo`, `Ticket`, `MeetAssistTask`, service bookings, `BRN`, `Voucher`, `LongStay`, `ZiyarahTrip` |
| Fleet | `Vehicle`, `VehicleDocument`, `VehicleLocation`, `Driver`, `DispatchOrder`, `FuelLog`, `MaintenanceRecord`, `InsurancePolicy` |
| Finance | `Wallet`, `WalletTransaction`, `PaymentSlip`, `ChartAccount`, `LedgerEntry`, `Invoice`/`Item`, `Receipt`/`Allocation`, `Statement`, `CurrencyRate`, `FinanceEntry` |
| OCR | `OcrDocument` |
| Automation / notify | `AutomationRule`, `AutomationRunLog`, `NotificationEvent`, `MessageTemplate`, `NotificationLog` |

### Seeds

| File | Use |
|---|---|
| `prisma/seed.ts` | Dev wipe + full demo dataset (password `Demo@123`) |
| `prisma/seed.prod.ts` | Idempotent reference data + one `SUPER_ADMIN` from `ADMIN_*` env |

### Schema gaps (model exists, little/no API)

- `Enquiry` — contact form has no `POST /enquiries`
- Audit log — writes exist; no read/export API
- Hotel catalogue — read-only `GET /hotels`; no admin CRUD
- Virus scan status on uploads — field exists, always treated clean

---

## 4. API Overview

**Base (container):** routes at `/` (e.g. `/auth/login`)  
**Browser (prod nginx):** `/api/*` → API  
**Auth:** Bearer access JWT (default 15m) + httpOnly refresh cookie `tuba_rt`  
**Guards (global):** Throttler → JwtAuth → Permissions  
**Realtime:** Socket.io namespaces `/ops`, `/notifications`

### Endpoint surface (~130+ HTTP routes)

| Prefix | Capability |
|---|---|
| `/auth/*` | Login, agent/supplier register, refresh, logout, me |
| `/health`, `/metrics` | Liveness public; Prometheus scrape internal (S1-04 nginx denies `/api/metrics`) |
| `/uploads*` | Public multipart/presign; confirmToken+ownership on confirm (S1-02); JWT file fetch |
| `/companies*` | List/verify (staff), self read/patch |
| `/groups*`, `/passengers*` | Group + passenger CRUD/bulk |
| `/hotels`, `/services/*`, `/vouchers` | Booking workflows |
| `/supplier/*` | Accept/reject/upload bookings |
| `/ocr/documents*` | Submit, list, override, approve, reject |
| `/ops/*` | Control boards (requires `VIEW_DASHBOARD`) |
| `/fleet/*`, `/vehicles/*/location` | Fleet ERP (`MANAGE_FLEET`) |
| `/finance/*` | Staff finance (`FINANCIAL_REPORTS` / `EDIT_FINANCIAL_RECORDS`) |
| `/agent-finance/*` | Agent wallet/slips (review queue staff-gated) |
| `/dashboards/*` | Aggregates (`VIEW_DASHBOARD`) |
| `/documents*` | Vault list/versions/upload |
| `/notifications*` | Inbox + admin event/template/test |
| `/automation*` | Rules CRUD/test/runs (`CONFIGURE_WORKFLOWS`) |
| `/users`, `/roles`, `/permissions` | Admin RBAC (`MANAGE_USERS`) |

### Roles & permissions (implementation)

**Roles (seeded):** `SUPER_ADMIN`, `OPS_STAFF`, `FINANCE_STAFF`, `FLEET_STAFF`, `CEO_VIEWER`, `AGENT`, `SUPPLIER`, `DRIVER`

**Permissions (11):**  
`VIEW_DASHBOARD`, `MANAGE_USERS`, `APPROVE_COMPANIES`, `FINANCIAL_REPORTS`, `EDIT_FINANCIAL_RECORDS`, `CONFIGURE_WORKFLOWS`, `REVIEW_OCR_QUEUE`, `ACCESS_AUDIT_LOGS`, `MANAGE_SYSTEM_SETTINGS`, `API_KEY_ACCESS`, `MANAGE_FLEET`

**Seeded but unwired to routes:** `ACCESS_AUDIT_LOGS`, `API_KEY_ACCESS` (`REVIEW_OCR_QUEUE` wired S1-01)

### Queues & scheduler

| Queue | Worker | Role |
|---|---|---|
| `tuba-ocr` | `OcrProcessor` | Document OCR |
| `tuba-notify` | `NotificationsWorker` | Channel delivery |
| `tuba-automation` | `AutomationProcessor` | Rule actions |

**Cron / repeatables:** fleet expiry (`@Cron` 06:00), daily DB backup (02:00), weekly cloud backup (Sun 03:00), expiry escalation sweep (06:00 via BullMQ).

### OCR pipeline

1. Upload file → MinIO/`UploadedFile`  
2. `POST /ocr/documents` → `OcrDocument` + BullMQ job  
3. Worker: Gemini or Vision → parsers/MRZ → duplicate check → `IN_REVIEW`  
4. Human override → approve (passport can auto-create passenger) / reject  
5. Emits `passenger.ocr.completed` for automation  

Env: `OCR_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GOOGLE_APPLICATION_CREDENTIALS`

---

## 5. Current Progress

The platform is a **late-stage MVP / early production** system: backend domain coverage is broad and e2e-tested; frontend is a Figma-origin SPA with partial honest launch gating; live VPS ops docs and Docker stack exist.

| Phase (from docs) | Theme | Status |
|---|---|---|
| 1 | Frontend audit / schema design | Done (`docs/AUDIT.md`) |
| 3–6 | Auth, registration, services | Done |
| 7 | Finance ERP | Backend done; staff UI route gated ComingSoon |
| 8 | Ops control | Done (API + wired UI) |
| 9 | Fleet | Done (GPS hardware Phase 2) |
| 10 | Automation | Backend done; UI route ComingSoon |
| 11 | Notifications | Backend done; external channels need creds |
| 12 | Dashboards | Done |
| 13 | Storage / vault | Done |
| 14 | Hardening | Done (rate limits, validation, audit writes) |
| 15 | Docker | Done |
| 16 | CI/CD | Workflow present; repo/GHCR/staging setup called out as incomplete in RUNBOOK §6.0 |
| 17–18 | VPS / monitoring / backups | Documented + compose present; disk/shared-box constraints noted |
| OCR | Gemini/Vision pipeline | Implemented post-main schema phases |
| Agent launch | Narrow marketing + agent portal | Partially applied (staff routes still mounted) |

**Tests:** 12 e2e suites under `apps/api/test/` (CI claims ~178 tests). No frontend tests. No unit tests.

**Deploy model:** GitHub Actions → GHCR images → SSH + compose; manual production approval environment. Manual build-on-box fallback documented.

---

## 6. Completed Features

- JWT auth with rotating refresh tokens, argon2 passwords, portal-aware login  
- Agent & supplier registration wizards with file uploads  
- Company verification state machine + SuperAdmin company/user/RBAC screens (partial SA UI)  
- Groups & passengers (incl. bulk create)  
- Service booking workflows (visa/hotel/transport/catering/additional) + supplier accept/reject + vouchers  
- Agent finance: wallet, payment slips, statements, documents  
- Staff finance API: ledger, AR/AP, invoices, receipts, P&L, BS, FX, cash  
- Ops control boards + Socket.io live updates  
- Ops department service queues (status patch)  
- Fleet ERP (CRUD + docs + fuel/maintenance/insurance + manual GPS + expiry alerts)  
- OCR center UI + async OCR + review approve/reject  
- Document vault with versioning  
- 8 live dashboards (API + UI)  
- Automation rule engine + scheduled backups/escalations  
- Notification engine (in-app always; WA/email when configured)  
- Multi-tenant Prisma scoping + RBAC e2e matrix  
- MinIO storage, magic-byte validation, throttling, logging/metrics  
- Docker production stack, host nginx TLS config, monitoring compose, backup script  
- Shared bilingual notification templates + i18n helpers  
- On-call runbook and domain documentation set  

---

## 7. Incomplete Features

### Frontend launch / wiring gaps

| Item | Notes |
|---|---|
| Staff Finance UI | `FinanceERP.tsx` exists; route serves `ComingSoon` |
| Automation / Notification admin UI | `AutomationNotifications.tsx` fully wired but route ComingSoon |
| Agent Documents Vault | ✅ Live (S1-06) — `DocumentsVaultScreen` wired in AgentPortal |
| Agent group detail tabs | Hotel/transport/catering/docs/timeline panels ComingSoon |
| Flight service tab | Explicit ComingSoon in AgentPortalServices |
| SuperAdmin | Workflow, Automation, AI, OCR, Notifications, Audit, Settings = ComingSoon |
| Contact enquiry | Form UI only; no API |
| Forgot password | Toast/dead affordance |
| Workflow map / mobile / tablet / design-system / i18n-system | Spec pages not launched |
| Frontend RBAC | ✅ UX gates (S1-05) — `lib/rbac.ts` hides modules/routes; API still enforces 403 |
| ERP i18n | Pages hardcoded English; bn/en toggle mostly chrome-only |
| Excel passenger import | Removed vulnerable `xlsx`; feature deferred |
| Deep-linking | Agent portal uses `useState` screens, not URL routes |

### Backend / product gaps

| Item | Notes |
|---|---|
| ~~`REVIEW_OCR_QUEUE` not on OCR controller~~ | Closed S1-01 — review gated; submit/poll JWT |
| Audit log read/export API | Missing despite permission + UI mock |
| API key auth | Permission seeded; not implemented |
| Enquiry API | Model only |
| Hotel master CRUD | Catalogue seed/read only |
| Hardware GPS / DEVICE locations | Phase 2 |
| Virus scanning | `scanStatus` placeholder |
| OCR e2e suite | Not present |
| External notify channels | Stub/SKIPPED without `WASENDER_*` / `SMTP_*` |
| Some automation rules | e.g. hotel→voucher seeded disabled |
| Staging environment | Documented; RUNBOOK says not fully provisioned |
| GitHub remote / CI secrets | RUNBOOK §6.0: “repo has never been pushed” (verify current remote state before relying on CI) |
| Public stats API | Mentioned in AUDIT; marketing still static |

### Missing repo areas

- No `prompts/` or `planning/` documentation trees  
- No ESLint pipeline (API “lint” = `tsc --noEmit`)  
- Root product README absent  

---

## 8. Technical Debt

1. **Stale route comment vs reality** — `routes.tsx` claims “narrow honest launch” (only agent portal), but supplier/ops/fleet/OCR/dashboards/super-admin still mount full pages.  
2. **`docs/AUDIT.md` route map stale** — still lists finance/automation as live ERP routes.  
3. **`docs/SCHEMA.md` role names** — document lists CEO/OPS_MANAGER/…; code/seed uses `SUPER_ADMIN`/`OPS_STAFF`/….  
4. **Figma/UI dual ownership** — design exports and API wiring coexist in the same files; reconcile process is heavy (vendor branch + script).  
5. **Mock data still in ERP pages** — fall-back arrays for signed-out demos remain; auth makes them mostly unreachable but code stays noisy.  
6. **Unused dependency** — `react-dnd` (Kanban drag unused).  
7. **Dead handlers / pinned dates** — AUDIT §7: dead buttons, pinned “today” `2025-07-16`, Contact select values = localized strings.  
8. **Tenant middleware unused** — `TenantContextMiddleware` exists; ALS setup inlined in `setup-app.ts`.  
9. **Separate web/API origins** — intentional (path collision), but complicates cookies/CORS and staging setups.  
10. **No unit tests; no frontend tests** — regression safety is e2e-only and API-centric.  
11. **Shared VPS constraints** — RUNBOOK: ~8 GB RAM, disk ~94%, Coolify/Supabase neighbors; scaling plan is documented but not executed.  
12. **Language product conflict** — SuperAdmin/settings copy mentions EN+AR; platform i18n is bn/en.  
13. **`packages/shared` types thin** — no shared DTO/schema package; frontend types duplicated ad hoc.  
14. **CI test count drift** — docs cite 86 → 102 → 178; keep a single source of truth.  

---

## 9. Security Issues

Severity is relative to a multi-tenant financial/ops ERP handling IDs, passports, and payments.

### High / should fix soon

| Issue | Detail |
|---|---|
| **Public upload endpoints** | Multipart/presign remain `@Public()` (registration). Confirm hardened S1-02 (`confirmToken` + ownership; cross-tenant 404; audited). Size/type caps + 20/min throttle in place; orphan GC / signed registration sessions still backlog. |
| **OCR permission gap** | Closed S1-01 for review actions; agents may still submit/poll. Frontend OCRCenter path/actions gated S1-05 (UX). |
| **No frontend authorization** | `RequireAuth` checks session only; ERPShell shows all modules. Relies entirely on API 403s; UX can leak existence of screens and cause noisy probing. |
| **Public `/metrics`** | Closed S1-04 — nginx denies `/api/metrics`; scrapers use docker-net `api:3210/metrics`; API loopback-bound. |
| **Host/IP in RUNBOOK** | Live host IP documented in tracked `RUNBOOK.md` (HARDENING claimed no IPs in source — outdated claim). |

### Medium

| Issue | Detail |
|---|---|
| Refresh cookie / CSRF | Cookie auth on `/auth` with credentials CORS — ensure SameSite and production `COOKIE_SECURE=true`. |
| Staging notification safety | RUNBOOK requires blank WASENDER/SMTP on staging; misconfig could message real agents. |
| Secrets on disk | `infra/.env` present on VPS (0600) — correct pattern; ensure backups of `.env` are equally protected; never commit. |
| Demo passwords | Dev seed `Demo@123` — must never run full wipe seed against production. |
| Audit trail incomplete for ops | Financial actions audited; many OCR/ops mutations may lack full audit coverage; no audit *read* API for compliance review. |
| Virus scan not implemented | Uploaded files marked clean by default. |

### Lower / hygiene

| Issue | Detail |
|---|---|
| Dependency posture | Hardening reduced audit to ~1 low; keep overrides (`vite`, `react-router`) current. |
| Rate limits | Global 200/min is lenient; auth tighter — revisit under abuse. |
| API key permission | Dead permission may confuse auditors. |
| Enquiry spam | Contact form currently client-only (no backend spam risk yet); when wired, needs captcha/throttle. |

### Controls already in place (positive)

- argon2id passwords, refresh rotation + reuse detection  
- Global ValidationPipe (whitelist + forbidNonWhitelisted)  
- Tenant isolation e2e (cross-tenant → 404)  
- RBAC matrix e2e  
- Magic-byte content checks on uploads  
- Throttling on auth/uploads  
- No secrets in `*.example` templates  
- Compose resource limits; Redis memory cap  

---

## 10. Recommended Next Sprint

**Goal:** Close the highest security and launch-integrity gaps without expanding scope into Phase-2 mobile/GPS.

### Sprint theme: “Secure the queues & finish honest launch”

| Priority | Work item | Why |
|---|---|---|
| P0 | ~~Gate OCR routes with `REVIEW_OCR_QUEUE`~~ | Done S1-01 — redeploy API to live |
| P0 | ~~Align launch policy / vault~~ | Launch policy documented in SoT (S1-07); vault wired S1-06; residual `routes.tsx` comment → S1-08/PA-01 if code comment still stale |
| P1 | Frontend nav gating from `ApiUser.permissions` / role (hide modules user cannot use) | Defense in depth + UX |
| P1 | Harden public uploads (stricter MIME/size, optional registration-token binding, metrics/alerts on volume) | Storage abuse |
| P1 | Add OCR e2e (submit → process stub/mock provider → approve → passenger created) | CI gap |
| P1 | `GET /audit-logs` (filter/export) behind `ACCESS_AUDIT_LOGS` + SuperAdmin screen | Compliance |
| P2 | Un-gate Automation UI *or* keep ComingSoon but stop claiming Phase 11 frontend complete | Product honesty |
| P2 | Un-gate FinanceERP for finance roles only (after mock-data scrub) | Staff productivity |
| P2 | `POST /enquiries` + Contact form stable enum values | Marketing lead capture |
| P2 | ~~Restrict `/metrics`~~ | Done S1-04 |
| P2 | Confirm CI remote, GHCR, staging clone, and production approval gate match RUNBOOK §6.0 | Deploy reliability |
| P3 | ERP i18n pass (bn) for AgentPortal critical paths | Product requirement (Bangla default) |
| P3 | Remove unused `react-dnd`; scrub dead mock constants from auth-guarded pages | Debt |
| P3 | Disk cleanup + backup offsite (`OFFSITE_*`) verification on the VPS | Ops risk (disk ~94%) |

### Suggested sprint exit criteria

1. OCR cannot be approved without `REVIEW_OCR_QUEUE` (e2e proves 403 for AGENT).  
2. Route map and launch comment match what is actually reachable.  
3. Agent can open Documents Vault end-to-end against API.  
4. Upload abuse controls documented and enforced in code.  
5. Audit log readable by SuperAdmin.  
6. Staging notification env verified blank; prod SMTP/WASender status documented.  

### Explicitly out of sprint

- Hardware GPS / driver mobile apps  
- NUSUK/MOFA/ZATCA live integrations  
- Excel import reintroduction  
- Horizontal API scaling / external managed Postgres  
- Full ERP Bengali translation of every staff screen  

---

## Appendix A — Key file index

| Path | Role |
|---|---|
| `package.json` / `pnpm-workspace.yaml` | Monorepo root |
| `apps/api/src/app.module.ts` | Nest module graph |
| `apps/api/prisma/schema.prisma` | DB schema |
| `apps/api/src/ocr/*` | OCR implementation |
| `apps/web/src/app/routes.tsx` | Frontend route map |
| `apps/web/src/app/lib/api.ts` | API client + session |
| `packages/shared/src/*` | Shared i18n/templates |
| `infra/docker-compose.prod.yml` | Production stack |
| `infra/nginx/tubaalhijaz.com.conf` | Host reverse proxy |
| `infra/.env.example` | Env key catalog |
| `.github/workflows/ci-cd.yml` | CI/CD |
| `RUNBOOK.md` | On-call operations |
| `docs/*.md` | Domain + prior audits |

## Appendix B — Environment configuration (names only)

**Infra / compose:** `POSTGRES_*`, `MINIO_*`, `STORAGE_BUCKET`, `JWT_*`, `COOKIE_SECURE`, `BIND_ADDR`, `*_PORT`, `REGISTRY`, `IMAGE_TAG`, `WEB_IMAGE_TAG`, `API_IMAGE_TAG`, `VITE_API_URL`, `WEB_ORIGIN`, `WASENDER_*`, `SMTP_*`, `GRAFANA_*`, `OFFSITE_*`

**API (additional):** `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `PORT`, `HOST`, `OCR_PROVIDER`, `GEMINI_*`, `GOOGLE_APPLICATION_CREDENTIALS`, `COMPANY_ADDRESS`, `COMPANY_VAT_NUMBER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `NODE_ENV`

**Web:** `VITE_API_URL`

Secrets live in `infra/.env` (gitignored, mode 0600 on VPS). Do not commit real values.

---

*End of audit. This file is documentation only; no application code was modified to produce it.*
