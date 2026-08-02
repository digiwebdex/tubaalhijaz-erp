# TUBA AL HIJAZ — Code Audit (Phase 3)

**Date:** 2026-07-31  
**Method:** Read-only inspection of `apps/api/src/**` (~106 TS files), `apps/web/src/**` (~88 TS/TSX), `packages/shared/**`, `infra/**`, Prisma schema/migrations/seeds.  
**Constraint:** No application code was modified. This document records how the system **actually works**.

**Companion docs:** `PROJECT_AUDIT.md` (system inventory), `MASTER_DOCUMENT_INDEX.md`, `DOCUMENT_CONFLICTS.md`.

### Authority for this audit

| Question | Source of truth |
|---|---|
| HTTP routes / permissions | Nest controllers + guards |
| Data model | `apps/api/prisma/schema.prisma` |
| UI reachability | `apps/web/src/app/routes.tsx` + page `useState` maps |
| Runtime topology | `infra/docker-compose*.yml` + nginx confs |

---

## Executive summary

The backend is a **mature NestJS monolith** with JWT+RBAC, Prisma multi-tenancy, three in-process BullMQ workers (automation, notifications, OCR), MinIO storage, and broad domain coverage (groups → services → finance → ops → fleet).

The frontend is a **Figma-origin SPA** with a real API client. After Sprint 1: permission-aware nav (S1-05 UX); Agent Documents Vault live (S1-06). Staff `FinanceERP` / `AutomationNotifications` remain route-`ComingSoon` (Sprint 2). API remains the authorization boundary.

**Highest-severity code findings:** ~~public upload confirm IDOR~~ (S1-02); ~~OCR missing `REVIEW_OCR_QUEUE`~~ (S1-01); ~~open `/ops` WS~~ (S1-03); ~~public `/metrics`~~ (S1-04); ~~no FE nav RBAC~~ (S1-05 UX); ~~vault ComingSoon~~ (S1-06); ~~no audit-log read API~~ (S2-01). Remaining: sparse audit writes (S2-02); dual 06:00 expiry paths; notification bypasses that skip the delivery worker.

---

# Part A — Cross-cutting systems (1–20)

## 1. Authentication Flow

### Architecture
```
Login → argon2 verify → access JWT (Bearer) + refresh (httpOnly cookie tuba_rt)
JwtAuthGuard (global) → Passport JWT strategy → req.user + tenant ALS seed
Refresh rotates token; reuse of rotated token revokes entire family
```

| Piece | Path |
|---|---|
| Controller | `apps/api/src/auth/auth.controller.ts` |
| Service | `apps/api/src/auth/auth.service.ts` |
| Strategy | `apps/api/src/auth/jwt.strategy.ts` |
| Guard | `apps/api/src/common/guards/jwt-auth.guard.ts` |
| App setup | `apps/api/src/setup-app.ts` (ALS, cookies, ValidationPipe, CORS) |
| Client | `apps/web/src/app/lib/api.ts` (memory + sessionStorage access token; single-flight refresh) |

### Current status
**Complete for MVP login/register/refresh.** Portal tabs enforced (`agent` / `supplier` / `admin`). Registration creates PENDING company + user; temp password returned once if omitted.

### Dependencies
`JWT_SECRET`, `JWT_EXPIRES_IN` (15m), `JWT_REFRESH_EXPIRES_DAYS` (14), `COOKIE_SECURE`, `CORS_ORIGIN`; packages `argon2`, `@nestjs/jwt`, `passport-jwt`, `cookie-parser`, throttler.

### APIs
| Method | Path | Access |
|---|---|---|
| POST | `/auth/login` | Public, 10/min |
| POST | `/auth/register/agent` | Public, 5/min |
| POST | `/auth/register/supplier` | Public, 5/min |
| POST | `/auth/refresh` | Public (cookie), 30/min |
| POST | `/auth/logout` | Public |
| GET | `/auth/me` | JWT |

### Database models
`User`, `Role`, `RefreshToken`, `Company` (+ profiles), `UploadedFile` (claimed on register).

### UI screens
`Login.tsx`, `AuthOnboarding.tsx` (wired). Forgot-password affordance is dead.

### Permissions
None on auth routes. Admin portal requires `companyId === null` (platform staff).

### Risks
- Default `JWT_SECRET=dev-secret` / `COOKIE_SECURE=false` if misconfigured  
- Open registration (spam PENDING companies)  
- No login/logout audit despite `AuditAction.LOGIN` in schema  
- Temp password in registration JSON response  

### Missing
Password reset/change, MFA, email verification, account lockout, API-key auth (`API_KEY_ACCESS` unused).

---

## 2. Authorization & RBAC

### Architecture
Global `PermissionsGuard` reads `@RequirePermissions(...)` metadata → loads permission set for `user.role` from DB with **60s in-memory cache**. Roles/permissions are rows; Super Admin can PATCH matrix (SUPER_ADMIN role itself locked).

| Piece | Path |
|---|---|
| Decorator | `common/decorators/require-permissions.decorator.ts` |
| Guard | `common/guards/permissions.guard.ts` |
| Admin API | `users/users.controller.ts` |
| Seed matrix | `prisma/seed.ts`, `seed.prod.ts` |

### Current status
**Partial.** Annotated staff modules are gated. Many business modules are JWT + tenancy only. Seeded permission still lacking route enforcement: `API_KEY_ACCESS`. `ACCESS_AUDIT_LOGS` enforced on `GET /audit-logs` (S2-01). `REVIEW_OCR_QUEUE` enforced on OCR review routes (S1-01).

### Permissions (11)
`VIEW_DASHBOARD`, `MANAGE_USERS`, `APPROVE_COMPANIES`, `FINANCIAL_REPORTS`, `EDIT_FINANCIAL_RECORDS`, `CONFIGURE_WORKFLOWS`, `REVIEW_OCR_QUEUE`, `ACCESS_AUDIT_LOGS`, `MANAGE_SYSTEM_SETTINGS`, `API_KEY_ACCESS`, `MANAGE_FLEET`

### Roles (8)
`SUPER_ADMIN`, `OPS_STAFF`, `FINANCE_STAFF`, `FLEET_STAFF`, `CEO_VIEWER`, `AGENT`, `SUPPLIER`, `DRIVER`  
Tenant roles (`AGENT`/`SUPPLIER`/`DRIVER`) typically have **zero** permission rows — isolation is via tenancy + controller checks.

### Gated vs ungated (summary)
| Gated | JWT / role-check only |
|---|---|
| `/ops/*`, `/dashboards/*` → `VIEW_DASHBOARD` | `/groups/*`, `/passengers/*` |
| `/finance/*` → FINANCIAL_* | `/services/*`, `/supplier/*` |
| `/fleet/*` → `MANAGE_FLEET` | `/ocr/*` |
| `/automation/*` → `CONFIGURE_WORKFLOWS` | `/documents/*` |
| `/users`, `/roles` → `MANAGE_USERS` | `/agent-finance/*` (agent companyType check) |
| Notify config → `MANAGE_SYSTEM_SETTINGS` | `/companies/:id` GET |

### UI
`RequireAuth` = token + optional path UX gate (`lib/rbac.ts`, S1-05). ERPShell / SA / Dash nav filtered by permissions. **UX only** — API remains the authz boundary.

### Risks
60s permission cache lag; staff with JWT can still probe JWT-only (ungated) API routes; FE hide is not a security control.

### Missing
FE RBAC UX done (S1-05); still needed: audit/API-key route enforcement; permission cache invalidation on matrix PATCH; fine-grained keys for groups/services/documents.

---

## 3. Multi-tenancy

### Architecture
```
setup-app.ts opens AsyncLocalStorage per request
JwtAuthGuard seeds { userId, roleKey, companyId, companyType }
prisma.scoped = Prisma $extends that injects tenantId / companyId / supplierId filters
platform staff (companyId null) → passthrough (see all)
```

| Piece | Path |
|---|---|
| ALS | `common/tenant-context.ts` |
| Extension | `prisma/prisma.service.ts` |
| Dead middleware | `common/middleware/tenant-context.middleware.ts` (unused; ALS wired in setup-app) |

### Current status
**Core works** for agent/supplier scoped models (groups, bookings, invoices, OCR, etc.). Documented supplier fail-closed maps prevent reading agent-owned rows.

### Database
Agent map: `tenantId` / `companyId` on operational/finance models.  
Supplier map: `supplierId` on bookings/fleet assignment models.  
**Not auto-scoped:** `UploadedFile`, `User`, `Company`, catalogs — rely on manual checks.

### Risks
- Models missing from scope map pass through for tenant users  
- Pattern of “scoped read then unscoped write” is fragile  
- Staff see all vault docs / OCR unless they filter  
- Registration `updateMany({ id in fileIds, companyId: null })` can claim orphan uploads (UUID squat risk)  

### Missing
`UploadedFile` in scope maps; consistent scoped writes; staff cross-tenant reads behind permissions.

---

## 4. Upload Pipeline

### Architecture
1. **Public multipart** `POST /uploads?kind=` → validate magic bytes → `StorageService.store` → `UploadedFile`  
2. **Presigned** `POST /uploads/presign` → browser PUT to MinIO → `POST /uploads/:id/confirm` (re-scan bytes)  
3. **Vault** `POST /documents` (auth) — versioned by `(companyId, kind)`  
4. **Specialized:** supplier booking upload, payment-slip multipart, OCR consumes prior `uploadedFileId`

| Piece | Path |
|---|---|
| Uploads | `uploads/uploads.controller.ts` |
| Validation | `storage/file-type.ts` |
| Vault | `documents/*` |

### Current status
**MVP complete** (10 MB, PDF/JPEG/PNG/WEBP/TIFF/SVG). Throttled 20/min.

### APIs
| Method | Path | Auth |
|---|---|---|
| POST | `/uploads` | **Public** |
| POST | `/uploads/presign` | **Public** |
| POST | `/uploads/:id/confirm` | **Public** |
| GET | `/uploads/:id/file` | JWT + ownership |
| POST | `/documents` | JWT |

### Risks
- ~~Public confirm = IDOR if UUID known~~ → **S1-02:** confirmToken + ownership; cross-tenant 404  
- Storage abuse (throttle only)  
- Payment slips skip `validateUpload`  
- SVG + `Content-Disposition: inline` XSS risk  
- `scanStatus: CLEAN` without real AV (`scanBuffer` stub)  

### Missing
ClamAV; signed upload sessions; orphan GC; upload audit logs.

---

## 5. OCR Pipeline

### Architecture
```
Upload → POST /ocr/documents → OcrDocument(PENDING) → BullMQ tuba-ocr
OcrProcessor → read MinIO → Gemini|Vision → parsers/MRZ → IN_REVIEW
Human override → approve (passport→Passenger) / reject
Emit passenger.ocr.completed
```

Files under `apps/api/src/ocr/` (10 files). Frontend: `OCRCenter.tsx` + `OcrIntakeModal` in `AgentPortalGroups.tsx`.

### Current status
**Production-shaped for passports** (especially Gemini). 14 other document types accept enum values but use **generic regex** extraction. Review is always manual (`autoAccept` computed but unused).

### APIs (all JWT, **no permission decorator**)
`POST/GET /ocr/documents`, `GET /ocr/documents/:id`, `POST .../override|approve|reject`

### Database
`OcrDocument` (+ enums `OcrDocumentType` ×15, `OcrReviewStatus`). No FK to `UploadedFile` (stores `fileUrl` string). No `rejectReason` / `errorMessage` columns.

### UI
`/ocr-center` routed + auth. Agent intake modal passport-only. SuperAdmin OCR = ComingSoon. ERPShell “Documents” → `/ocr-center` (not vault).

### Permissions
`REVIEW_OCR_QUEUE` seeded for OPS_STAFF / SUPER_ADMIN — **enforced** on list/override/approve/reject (S1-01); submit/poll remain JWT.

### Risks
Any authenticated tenant user can approve passports → create passengers; failed jobs leave `PENDING` with no error surface; Gemini confidence synthetic (0.9).

### Missing
Permission gates; auto-approve path; type-specific parsers/actions; OCR e2e; re-queue endpoint; persist reject reason.

---

## 6. Google Vision Integration

### Architecture
`apps/api/src/ocr/vision.client.ts` — lazy `@google-cloud/vision` import; `textDetection` or `documentTextDetection` (dense for passports); returns word confidences + full text. No structured field extraction (MRZ parser consumes text).

### Status
**Implemented fallback provider.** Selected when `OCR_PROVIDER=google-vision` or Gemini unconfigured.

### Dependencies
`GOOGLE_APPLICATION_CREDENTIALS`; package `@google-cloud/vision`.

### Risks
No preflight “configured?” check when forced via env — fails at job runtime. `documentType` ignored by Vision client.

### Missing
Structured passport extraction on Vision path; provider health endpoint.

---

## 7. Gemini Integration

### Architecture
`apps/api/src/ocr/gemini.client.ts` — raw HTTPS to Generative Language API (`generateContent`); API key header; passport mode requests JSON (MRZ + VIZ fields); other types get free-text transcription.

### Status
**Preferred provider** when `GEMINI_API_KEY` set (default pick). Model `GEMINI_MODEL` or `gemini-flash-latest`.

### Dependencies
`GEMINI_API_KEY`, `GEMINI_MODEL`; no SDK (fetch/HTTPS).

### Risks
Synthetic mean confidence 0.9; blocked prompts throw; JSON parse failure falls back to raw text.

### Missing
Retry/fallback to Vision on Gemini failure; cost/rate limiting visibility.

---

## 8. Notifications

### Architecture
```
NotificationsService.dispatch → NotificationLog(PENDING) per channel
→ BullMQ tuba-notify → NotificationsWorker
→ WhatsApp (WASender) | Email (SMTP) | IN_APP (Socket.io /notifications)
Templates: DB MessageTemplate → fallback @tuba/shared NOTIF_TEMPLATES
```

### Status
**Live engine.** Channels stub-safe: missing creds → SKIPPED (stored as PENDING). In-app always works.

### Dependencies
`WASENDER_*`, `SMTP_*`, Redis, `StorageService` (email PDFs), `@tuba/shared` templates.

### APIs
Feed: `GET /notifications`, unread, mark-read (JWT).  
Admin: events/templates/test (`MANAGE_SYSTEM_SETTINGS`).

### Database
`NotificationEvent`, `MessageTemplate`, `NotificationLog`.

### UI
ERPShell bell — REST + live `/notifications` WS (S2-02 JWT). `AutomationNotifications.tsx` fully wired but **`/automation` → ComingSoon**.

### Risks / bypasses
1. `ServicesService.ensureVoucher` writes `NotificationLog` **without** queue → no WS push  
2. `ExpiryService.runScan` bulk-creates IN_APP logs directly  
3. Template vars mismatch (`{{agent_name}}` vs `{{name}}`)  
4. Domain event keys (`agent.approved`) ≠ notification keys (`AGENT_APPROVED`)  

### Missing
SMS/push; wire admin UI; unify all creates through `dispatch()` (WS auth done S2-02).

---

## 9. Automation

### Architecture
```
Domain emit(EventEmitter2) → AutomationDispatcher @OnEvent("**")
→ match rules → enqueue actions on tuba-automation
→ AutomationProcessor executes actions → AutomationRunLog
```

### Status
**Live.** Seeded ENGINE rules with structured actions. Legacy R02–R12 string actions are **display-only** (ignored by parser).

### Actions
`SEND_NOTIFICATION`, `ESCALATE`, `GENERATE_QR`, `GENERATE_PDF`, `GENERATE_INVOICE`, `GENERATE_VOUCHER`, `RUN_BACKUP`

### Events emitted today
`agent.approved/rejected`, `group.created/completed`, `passenger.ocr.completed`, `service.status.changed`, `booking.confirmed`, `invoice.generated`, `voucher.generated`, `document.expiring` (from scheduler).

### Never emitted (catalog only)
`agent.registered`, `supplier.registered`, `group.import.completed`.

### Scheduled (BullMQ)
Daily backup 02:00; weekly cloud backup Sun 03:00; expiry escalation 06:00.

### APIs
`/automation/*` — `CONFIGURE_WORKFLOWS`.

### UI
Built page unrouted; SuperAdmin automation = ComingSoon.

### Risks
No seeded rule for OCR completed; `AR-BKG-01` disabled (voucher already on accept); `cronExpr` on rules not wired to schedulers.

### Missing
Emit registration events; route admin UI; replace Nest fleet cron with single path.

---

## 10. Finance

### Architecture
Append-only `LedgerEntry` (AGENT/SUPPLIER/GENERAL); double-entry via `LedgerService.postJournal`; wallet with `SELECT FOR UPDATE` + `WalletTransaction.balanceAfter`; auto-deduct on booking confirm; auto-invoice on COMPLETED.

### Status
**Backend mature.** Agent finance UI live. Staff `FinanceERP.tsx` wired but route ComingSoon.

### APIs
Staff `/finance/*` (FINANCIAL_REPORTS / EDIT_FINANCIAL_RECORDS).  
Agent `/agent-finance/*` (company-scoped).

### Models
`Wallet`, `WalletTransaction`, `PaymentSlip`, `ChartAccount`, `LedgerEntry`, `Invoice`/`Item`, `Receipt`/`Allocation`, `Statement`, `CurrencyRate`, `FinanceEntry`.

### UI
`AgentPortalFinance.tsx` (live); `FinanceERP.tsx` (blocked); Ops finance desk reads invoices; Dashboards finance tab live.

### Risks
Router blocks staff ERP; ERPShell still links `/finance-erp`; mock data remains in FinanceERP for logged-out mode.

### Missing
Un-gate staff UI; AP payout workflow; agent dashboard KPIs; stronger doc-hub download UX.

---

## 11. Operations

### Architecture
`OpsService` + REST `/ops/*` + Socket.io `/ops` gateway (room `ops`). Mutations audit + broadcast. Fleet assign also broadcasts dispatch status.

### Status
**Operational.** `OpsControl.tsx` live with `useOpsEvents`. `OpsDepartments` — service desks live; CRM/HR/Procurement ComingSoon panels.

### APIs
All `/ops/*` require `VIEW_DASHBOARD`. WebSocket `/ops` requires JWT + `VIEW_DASHBOARD` (S1-03); tenant JWTs rejected.

### Models
`Group`, `FlightInfo`, `DispatchOrder`, `MeetAssistTask`, `ZiyarahTrip`, `LongStay`, `BRN`, bookings.

### UI
`/ops-control`, `/ops-departments` auth-routed.

### Risks
~~Open ops WebSocket~~ (closed S1-03); voucher board may be UI-only; no agent ops visibility (by design).

### Missing
CRM/HR/Procurement backends; optional authenticated sockets; voucher send from ops.

---

## 12. Fleet

### Architecture
CRUD + docs + fuel/maintenance/insurance + denormalized GPS `last*` + trail; `ExpiryService` Nest `@Cron` 06:00; dispatch assign → Ops gateway.

### Status
**MVP complete.** UI `/fleet-erp` live. GPS is **manual/simulated** (`LocationSource.MANUAL`); `DEVICE` reserved.

### APIs
`/fleet/*` + `POST /vehicles/:id/location` — all `MANAGE_FLEET`.

### Models
`Vehicle`, `VehicleDocument`, `VehicleLocation`, `Driver`, `FuelLog`, `MaintenanceRecord`, `InsurancePolicy`.

### Risks
Dual expiry with BullMQ at 06:00; mock fallback when logged out; no hardware auth model.

### Missing
Device GPS; driver app; fleet costs → GL.

---

## 13. Documents

### Architecture
Versioned vault on `UploadedFile` (`version`, `isLatest`, `supersedesId`, `expiryDate`) via MinIO. Separate from OCR and registration uploads.

### Status
**API complete.** Agent UI **`DocumentsVaultScreen` live** (S1-06) against `/documents`. ERPShell staff “Documents” module → `/ocr-center` (permission `REVIEW_OCR_QUEUE`); agent vault is inside Agent Portal nav.

### APIs
`GET/POST /documents`, `GET /documents/versions` — JWT only, no permission key.

### Risks
Discoverability broken; staff vault listing is cross-tenant without dedicated permission.

### Missing
Vault screen wired (S1-06). Remaining: richer version-history UI polish; vault expiry automation (fleet has expiry; vault docs do not escalate the same way).

---

## 14. Dashboard

### Architecture
`DashboardsService` aggregates + reuses `ReportsService` for finance parity; Redis cache `tuba:dash:` (30–60s TTL, fail-open).

### Status
**Live APIs + UI** at `/dashboards` (8 tabs). Agent/supplier widgets partially ComingSoon inside page.

### APIs
`/dashboards/{ceo,ops,finance,dispatch,arrivals,departures,agent,supplier}` — `VIEW_DASHBOARD`.

### Risks
Mock fallbacks when logged out; hardcoded shell labels; FinanceDash links to ComingSoon `/finance-erp`.

### Missing
Cache invalidation hooks; complete agent/supplier widgets; frontend permission gate.

---

## 15. APIs (surface overview)

~130+ HTTP endpoints across modules; **no global Nest prefix** (nginx adds `/api/` externally). Global ValidationPipe (`whitelist`, `forbidNonWhitelisted`). Throttler 200/min (skip in `NODE_ENV=test`).

| Area | Prefix | Gate |
|---|---|---|
| Auth | `/auth` | Public / JWT |
| Health/Metrics | `/health` public; `/metrics` internal (S1-04) | Edge-denied |
| Uploads | `/uploads` | Mostly public |
| Companies/Users | `/companies`, `/users`, `/roles` | Permissions |
| Groups/Pax | `/groups`, `/passengers` | JWT+tenant |
| Services/Supplier | `/services`, `/supplier`, `/hotels`, `/vouchers` | JWT+role |
| OCR | `/ocr` | JWT only |
| Ops | `/ops` | VIEW_DASHBOARD |
| Fleet | `/fleet`, `/vehicles` | MANAGE_FLEET |
| Finance | `/finance`, `/agent-finance` | FINANCIAL_* / agent |
| Dashboards | `/dashboards` | VIEW_DASHBOARD |
| Documents | `/documents` | JWT |
| Notifications | `/notifications` | JWT / MANAGE_SYSTEM_SETTINGS |
| Automation | `/automation` | CONFIGURE_WORKFLOWS |

WebSockets: `/ops`, `/notifications`.

**Missing public APIs:** enquiry POST, forgot-password, audit-log GET, OpenAPI spec.

---

## 16. Queues

| Queue | Worker | Concurrency | Retries |
|---|---|---|---|
| `tuba-automation` | `AutomationProcessor` | 5 | 3 / exp 2s |
| `tuba-notify` | `NotificationsWorker` | 8 | 4 / exp 3s |
| `tuba-ocr` | `OcrProcessor` | 3 | 3 / exp 2s |

All in-process; Redis db3; Bull prefix `tuba`; raw BullMQ (not `@nestjs/bull`). Shared connection helper in `automation.constants.ts`.

### Risks
Redis outage breaks all async paths; workers not horizontally split yet (documented as future).

---

## 17. Event System

`EventEmitterModule.forRoot({ wildcard: true, delimiter: "." })`. Single domain subscriber: `AutomationDispatcher` `@OnEvent("**")`.

Emitters: `companies.service`, `groups.service`, `services.service`, `invoice.service`, `ocr.service`, automation processor (re-emit expiry), automation test endpoint.

Socket gateway `emit`s are separate (not domain bus).

### Missing
Registration emits; import-completed; rules for OCR/rejected/group.completed; docs sync with code.

---

## 18. Background Workers

| Worker | Role |
|---|---|
| AutomationProcessor | Rule actions + scheduled backups/expiry |
| NotificationsWorker | Channel delivery |
| OcrProcessor | Document OCR |
| ExpiryService `@Cron` | Fleet/doc alerts (parallel to BullMQ) |

All inside API process today.

---

## 19. Storage

`StorageService`: MinIO when `MINIO_ENDPOINT` set, else local `STORAGE_DIR`. Keys `{yyyy}/{mm}/{rand}-{name}`. Bucket auto-ensure. Presign PUT/GET.

Prod: MinIO volume `miniodata` is file SoT (no uploads volume on API).

### Risks
Default MinIO creds in code fallbacks; no lifecycle GC; no encryption config in app.

---

## 20. Audit Logs

### Architecture
`AuditLog` model with `AuditAction` enum. Writes scattered via `prisma.auditLog.create` (no central service).

### Written today
Registrations; company edit/verification; user/role changes; invoice pay; payment-slip review; fleet doc delete; ops creates/updates; service creates/transitions; supplier accept/reject.

### Not written
Login/logout; OCR; uploads/vault; groups/passengers; most fleet CRUD; automation/notification config; finance entry create.

### Status
**Read + write.** `GET /audit-logs` gated `ACCESS_AUDIT_LOGS` (S2-01); SuperAdmin UI wired. Write coverage still sparse/inconsistent (S2-02). Some finance/fleet writes `.catch(() => undefined)` swallow failures. Ops audits often omit `ip`.

### UI
SuperAdmin Audit Logs = ComingSoon.

### Missing
`GET /audit-logs`; central AuditService; login events; OCR/upload coverage.

---

# Part B — Module reports

## Auth module
| | |
|---|---|
| **Architecture** | Nest AuthModule + Passport JWT + refresh family |
| **Status** | Complete MVP |
| **Dependencies** | Prisma, argon2, JWT env, throttler |
| **APIs** | `/auth/*` (see §1) |
| **DB** | User, Role, RefreshToken, Company… |
| **UI** | Login, AuthOnboarding |
| **Permissions** | N/A (public + JWT me) |
| **Risks** | Weak defaults; open register; no login audit |
| **Missing** | Reset/MFA/verify; API keys |

## Users / RBAC admin
| | |
|---|---|
| **Architecture** | UsersController CRUD + role permission PATCH |
| **Status** | Complete |
| **Dependencies** | MANAGE_USERS, AuditLog |
| **APIs** | `/users`, `/roles`, `/permissions` |
| **DB** | User, Role, Permission, RolePermission |
| **UI** | SuperAdmin User & Role screens (live) |
| **Permissions** | MANAGE_USERS |
| **Risks** | 60s cache; no frontend enforcement of resulting matrix |
| **Missing** | Cache bust; self-service profile |

## Companies
| | |
|---|---|
| **Architecture** | Verification state machine + emits agent.approved/rejected |
| **Status** | Complete |
| **APIs** | `/companies` list/patch/verification (APPROVE_COMPANIES); GET :id JWT |
| **DB** | Company, AgentProfile, SupplierProfile, Guarantor, BankAccount… |
| **UI** | SuperAdmin Company Management |
| **Risks** | — |
| **Missing** | agent.registered / supplier.registered emits |

## Groups & Passengers
| | |
|---|---|
| **Architecture** | Tenant-scoped CRUD + bulk passengers; emits group.created/completed |
| **Status** | Complete API; agent UI partial |
| **APIs** | `/groups*`, `/passengers*` — JWT only |
| **DB** | Group, Passenger, Season, WorkflowStage |
| **UI** | AgentPortalGroups (detail tabs often ComingSoon) |
| **Permissions** | Tenancy only |
| **Risks** | Staff can mutate all groups via unscoped client |
| **Missing** | Excel import; stage transition API; staff UI |

## Services & Supplier
| | |
|---|---|
| **Architecture** | Shared ServiceRequestStatus machine; auto supplier assign; accept→voucher PDF + wallet deduct; complete→invoice |
| **Status** | High / MVP |
| **APIs** | `/services/*`, `/supplier/*`, `/hotels`, `/vouchers` |
| **DB** | Visa/Hotel/Transport/Catering/Additional, Voucher, Hotel, BRN |
| **UI** | AgentPortalServices, SupplierPortal, OpsDepartments desks |
| **Permissions** | Role checks in service layer |
| **Risks** | Notify bypass on voucher; hotel catalogue read-only |
| **Missing** | Flight service (UI ComingSoon); hotel admin CRUD |

## Finance module
See §10.

## Ops module
See §11.

## Fleet module
See §12.

## OCR module
See §5–7.

## Documents module
See §13.

## Dashboards module
See §14.

## Notifications module
See §8.

## Automation module
See §9.

## Storage / Uploads
See §4 and §19.

## Health / Metrics
| | |
|---|---|
| **Architecture** | Public `/health` (includes shared i18n key count); Prometheus `/metrics` + MetricsInterceptor |
| **Status** | Complete |
| **Risks** | `/metrics` edge-denied (S1-04); loopback scrape intentional |
| **UI** | None (Grafana via infra monitoring compose) |

## Shared package (`@tuba/shared`)
| | |
|---|---|
| **Architecture** | `i18n.ts` (STRINGS, formatters), `notifications.ts` (templates), `types.ts` (ApiHealthResponse only) |
| **Status** | Thin but used by API PDFs/notifications and web re-export |
| **Missing** | Shared DTOs / Zod / OpenAPI types |

## Frontend application
| | |
|---|---|
| **Architecture** | Vite React Router; `api.ts`; `ERPShell`; LangContext; opsSocket |
| **Status** | Mixed — agent core live; staff ERPs mixed; several ComingSoon |
| **Routed live** | agent-portal, supplier-portal, ops-*, fleet-erp, ocr-center, dashboards, super-admin |
| **Blocked despite code** | finance-erp, automation, workflow/mobile/tablet/design/i18n (vault unblocked S1-06) |
| **Permissions** | None in UI |
| **Risks** | Over-exposed module switcher; mock fallouts; i18n ERP English-only |
| **Missing** | Role-aware routes; logout calling `api.logout()`; agent dashboard KPIs |

## Infrastructure
| Artifact | Role |
|---|---|
| `docker-compose.prod.yml` | postgres, redis, minio, api, web |
| `docker-compose.staging.yml` | Port/project isolation overlay |
| `docker-compose.monitoring.yml` | Prometheus/Grafana/exporters |
| `Dockerfile.api/web` | Multi-stage builds; API runs migrate deploy |
| `nginx/tubaalhijaz.com.conf` | TLS, `/api/` proxy, WS upgrade |
| `nginx.web.conf` | SPA fallback |
| `backup.sh` | pg_dump → MinIO |
| `.env.example` | Key catalog |

**Status:** Production-shaped. Scripts: Figma import + theme codemods (not runtime).

## Database / migrations / seeds
| Item | Detail |
|---|---|
| Schema | ~51 models, 47 enums (`schema.prisma`) |
| Migrations | 11 forward-only folders (init → document vault) |
| `seed.ts` | Dev wipe + full demo (`Demo@123`) |
| `seed.prod.ts` | Idempotent reference + ADMIN_* superuser |

---

# Part C — Priority risk register (code-derived)

| P | Risk | Area |
|---|---|---|
| P0 | ~~`POST /uploads/:id/confirm` public IDOR~~ | Closed S1-02 |
| P0 | ~~OCR routes lack `REVIEW_OCR_QUEUE`~~ | Closed S1-01 |
| P0 | No audit log read API; sparse write coverage | Audit |
| P1 | Frontend no RBAC; shell shows all modules | Frontend |
| P1 | ~~Agent Documents Vault ComingSoon-mapped~~ | Closed S1-06 |
| P1 | Dual 06:00 expiry (Nest cron + BullMQ) | Fleet / Automation |
| P1 | Notification bypasses (voucher, fleet expiry) | Notifications |
| P1 | ~~Open `/ops` WebSocket~~ | Closed S1-03 |
| P2 | `autoAccept` unused; 14 types generic parse | OCR |
| P2 | FinanceERP / Automation UI blocked while APIs live | Launch consistency |
| P2 | Template variable / event-key mismatches | Automation ↔ Notify |
| P2 | ~~Public `/metrics`~~ | Closed S1-04 |
| P2 | Payment slip upload skips magic-byte scan | Uploads |
| P3 | Shared types thin; ERP i18n English-only | Shared / Frontend |
| P3 | Registration events never emitted | Automation |

---

# Part D — How a request actually flows (reference)

### Authenticated agent books a hotel
1. Browser `api.post('/services/hotel', …)` with Bearer  
2. `JwtAuthGuard` + ALS seed → `ServicesService.create` via `prisma.scoped`  
3. Auto-assign supplier → status ASSIGNED; AuditLog CREATE  
4. Supplier accepts → CONFIRMED → wallet auto-deduct → voucher PDF to MinIO → VOUCHER_ISSUED → emit `booking.confirmed` / `voucher.generated`  
5. Automation may GENERATE_QR; Notifications may email (if SMTP set)  
6. Later COMPLETED → auto-invoice + GL + emit `invoice.generated`

### Passport OCR
1. `POST /uploads?kind=PASSPORT` (often public)  
2. `POST /ocr/documents` → queue  
3. Worker Gemini/Vision → MRZ → IN_REVIEW → event  
4. Reviewer approve → Passenger row (if group + fields valid)

### Staff ops board
1. `GET /ops/arrivals` (VIEW_DASHBOARD)  
2. PATCH flight status → AuditLog + Socket.io `flight.status`  
3. `OpsControl` patches row in <1s via `useOpsEvents`

---

*End of Phase 3 code audit. Understanding-only; no fixes applied.*
