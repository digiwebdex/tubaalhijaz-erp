# TUBA AL HIJAZ — Gap Analysis (Phase 4)

**Date:** 2026-07-31  
**Method:** Compare project documentation × implementation × Prisma × APIs × frontend × infra × deploy × security × OCR × automation.  
**Constraint:** Read-only. No code changes. Classification uses exactly one status per feature.

### Status legend

| Symbol | Meaning |
|---|---|
| ✅ Complete | End-to-end usable for intended actors (API + data + reachable UI where required) |
| 🟡 Partially Implemented | Core path works; significant gaps remain |
| 🔴 Missing | Documented or schema-implied; no usable implementation |
| ⚪ Planned Only | Spec / UI mock / ComingSoon / seed permission only — no real backend path |
| ⚫ Deprecated | Intentionally superseded or abandoned |
| 🔵 Implemented but Hidden | Code works but router/nav blocks reachability |
| 🟣 Dead Code | Implemented UI/logic that is never mounted or never called |

### Comparison axes

1. Project documentation (`docs/*`, `RUNBOOK.md`)  
2. Current implementation (`apps/api`, `apps/web`)  
3. Database schema / migrations / seeds  
4. API implementation  
5. Frontend implementation  
6. Infrastructure (`infra/*`)  
7. Deployment (CI/CD + RUNBOOK)  
8. Security (authz, uploads, audit)  
9. OCR  
10. Automation  

**Sources of truth used when docs conflict:** controllers, `schema.prisma`, `routes.tsx`, compose/nginx. See also `CODE_AUDIT.md`, `DOCUMENT_CONFLICTS.md`.

---

## 1. Executive verdict

| Area | Verdict |
|---|---|
| Core agent journey (register → groups → services → agent finance) | Mostly ✅ / 🟡 |
| Staff ops / fleet / dashboards | ✅ backend + reachable UI; 🟡 UX/RBAC |
| Staff finance / automation admin | 🔵 Hidden UI over ✅ APIs |
| OCR | 🟡 (passport-strong; perms/tests weak) |
| Security hardening | 🟡 (controls exist; several P0 gaps) |
| Mobile / CRM / HR / integrations | ⚪ or 🔴 |
| Documentation accuracy | 🟡 (phase docs lag code) |

---

## 2. Feature classifications (by domain)

### 2.1 Authentication & onboarding

| Feature | Status | Doc vs code |
|---|---|---|
| Login (portal-aware) | ✅ Complete | AUTH.md accurate |
| JWT + refresh rotation | ✅ Complete | — |
| Agent registration wizard | ✅ Complete | — |
| Supplier registration wizard | ✅ Complete | — |
| Company verification state machine | ✅ Complete | — |
| Forgot / reset password | ⚪ Planned Only | AUDIT implies API; UI toast only; no backend |
| Email verification / MFA | 🔴 Missing | Not in schema beyond User fields for lang |
| Login audit trail | 🔴 Missing | `AuditAction.LOGIN` unused |
| Temp password email delivery | 🟡 Partial | Generated in API; email via notify only if configured/rules |

### 2.2 Authorization & multi-tenancy

| Feature | Status | Notes |
|---|---|---|
| DB-driven RBAC matrix | ✅ Complete | Admin UI can edit |
| Permission enforcement on staff modules | 🟡 Partial | Finance/ops/fleet/automation gated; many routes JWT-only |
| Frontend RBAC / nav gating | ✅ Done (S1-05) | UX only — `lib/rbac.ts`; API remains SoT |
| Prisma tenant scoping | 🟡 Partial | Core models OK; UploadedFile etc. manual |
| `REVIEW_OCR_QUEUE` enforcement | ✅ Done (S1-01) | Review routes gated; submit/poll JWT |
| `ACCESS_AUDIT_LOGS` API | 🔴 Missing | Seeded, unused |
| `API_KEY_ACCESS` | ⚪ Planned Only | Permission only |
| API key authentication | 🔴 Missing | — |

### 2.3 Groups, passengers, services

| Feature | Status | Notes |
|---|---|---|
| Group CRUD | ✅ Complete | Agent UI live |
| Passenger CRUD + bulk | ✅ Complete | — |
| Passport OCR intake into group | 🟡 Partial | Works; review gated (S1-01); agent submit/poll JWT; vault live (S1-06) |
| Excel passenger import | ⚫ Deprecated / 🔴 Missing | `xlsx` removed; UI may still hint; no API |
| Group detail service tabs (hotel/transport/…) | 🟢 Wired | Detail tabs use `/services/*`, `/vouchers`, staff `/audit-logs`; see `UI_05_GROUP_PASSENGER.md` |
| Flight info service UI | ⚪ Planned Only | `FlightComingSoon` in AgentPortalServices |
| Visa/hotel/transport/catering/additional APIs | ✅ Complete | — |
| Supplier accept/reject + voucher PDF | ✅ Complete | — |
| Hotel catalogue admin CRUD | 🔴 Missing | Read-only `GET /hotels` |
| 19-stage workflow transitions API | 🟡 Partial | `WorkflowStage` seeded + `currentStage` field; no transition API/UI live |
| WorkflowMap page | ⚪ Planned Only | Route → ComingSoon (spec page exists) |

### 2.4 Finance

| Feature | Status | Notes |
|---|---|---|
| Staff finance API (GL, AR/AP, invoices, P&L/BS) | ✅ Complete | — |
| Auto-deduct wallet / auto-invoice | ✅ Complete | — |
| Agent wallet / slips / statement | ✅ Complete | UI live |
| Staff FinanceERP UI | ✅ Complete | S2-04 — `/finance-erp` → FinanceERP; `FINANCIAL_REPORTS` UX + API |
| Payment slip magic-byte validation | 🟡 Partial | Upload works; skips content scan |
| ZATCA e-invoice / SADAD | ⚪ Planned Only | Marketing/AUDIT copy only |
| Supplier payouts / settlements UI | 🟡 Partial | Ledger concepts exist; no full payout module |

### 2.5 Operations

| Feature | Status | Notes |
|---|---|---|
| Ops boards REST + Socket.io | ✅ Complete | — |
| OpsControl UI | ✅ Complete | Reachable |
| Ops department service desks | 🟡 Partial | Visa/hotel/transport/catering/finance live; CRM/HR/PO ComingSoon |
| Ops WebSocket auth | 🔴 Missing | Open connect by design |
| Ops voucher WhatsApp/email send | 🟡 Partial | Notify engine exists; ops voucher UX incomplete |

### 2.6 Fleet

| Feature | Status | Notes |
|---|---|---|
| Fleet CRUD + compliance + costs | ✅ Complete | UI live |
| Manual GPS ingest | ✅ Complete | MVP |
| Hardware GPS (`DEVICE`) | ⚪ Planned Only | Enum + docs; no webhook auth |
| Driver mobile app | ⚪ Planned Only | Role `DRIVER` seeded; MobileApps ComingSoon |
| Dual expiry cron (Nest + BullMQ) | 🟡 Partial | Works but duplicated |

### 2.7 Documents & storage

| Feature | Status | Notes |
|---|---|---|
| MinIO / local storage drivers | ✅ Complete | — |
| Public upload + presign | 🟡 Partial | Works; security gaps |
| Document vault API (versioning) | ✅ Complete | — |
| Agent Documents Vault UI | ✅ Done (S1-06) | Screen map → `DocumentsVaultScreen`; portal UX via `company.type` |
| Virus scanning (ClamAV) | ⚪ Planned Only | `scanBuffer` stub; always CLEAN |
| Orphan upload GC | 🔴 Missing | — |

### 2.8 OCR

| Feature | Status | Notes |
|---|---|---|
| Passport OCR (Gemini) | 🟡 Partial | Strong path; review gate done (S1-01); full OCR e2e still missing |
| Google Vision provider | 🟡 Partial | Fallback; no structured extract |
| 15 document types in schema/UI | 🟡 Partial | Only passport has real parser |
| Auto-accept threshold | 🟣 Dead Code | Computed, never applied |
| OCR review permission | ✅ Done (S1-01) | — |
| OCR e2e tests | 🔴 Missing | — |
| Reject reason persistence | 🔴 Missing | — |
| SuperAdmin OCR console | ⚪ Planned Only | SAComingSoon |

### 2.9 Notifications

| Feature | Status | Notes |
|---|---|---|
| In-app notifications + bell | ✅ Complete | REST + live WS (S2-02) |
| WhatsApp / Email channels | 🟡 Partial | Live when env set; stub otherwise |
| Template admin API | ✅ Complete | — |
| Template admin UI | 🔵 Implemented but Hidden | Inside AutomationNotifications |
| Unified dispatch (all creates) | 🟡 Partial | Voucher + fleet bypass worker |
| Notifications WebSocket auth | ✅ Done (S2-02) | JWT rooms; query spoof rejected; FE `notifySocket` |

### 2.10 Automation

| Feature | Status | Notes |
|---|---|---|
| Rule engine + BullMQ actions | ✅ Complete | — |
| Scheduled backups | ✅ Complete | — |
| Seeded ENGINE rules | 🟡 Partial | Some disabled; legacy R02–R12 inert |
| Emit agent/supplier.registered | 🔴 Missing | Catalog only |
| Rule `cronExpr` → scheduler | 🔴 Missing | Hardcoded schedules only |
| Automation admin UI | ✅ Complete | S2-05 — `/automation` → AutomationNotifications; `CONFIGURE_WORKFLOWS` |
| Docs claiming notify still stubbed | ⚫ Deprecated (doc claim) | Code is live; AUTOMATION.md outdated |

### 2.11 Dashboards & admin

| Feature | Status | Notes |
|---|---|---|
| 8 dashboard APIs | ✅ Complete | — |
| Dashboards UI | 🟡 Partial | Core tabs live; agent/supplier widgets incomplete |
| SuperAdmin companies/users/RBAC | ✅ Complete | — |
| SuperAdmin workflow/AI/audit/settings | ⚪ Planned Only | ComingSoon screens |
| Enquiry / contact form API | 🔴 Missing | `Enquiry` model in schema; no controller; Contact UI discards |
| Public marketing stats API | ⚪ Planned Only | AUDIT optional |

### 2.12 Infrastructure & deployment

| Feature | Status | Notes |
|---|---|---|
| Prod Docker stack | ✅ Complete | — |
| Host nginx TLS /api proxy | ✅ Complete | Conf in repo |
| Monitoring compose | ✅ Complete | Optional |
| Backup script | ✅ Complete | — |
| CI/CD workflow file | ✅ Complete | — |
| GitHub remote / secrets / staging env | 🟡 Partial | Documented; RUNBOOK §6.0 may be incomplete on host |
| Offsite backup (`OFFSITE_*`) | 🟡 Partial | Supported if env set; often blank |
| Horizontal API scale | ⚪ Planned Only | RUNBOOK §5 |

### 2.13 Frontend / i18n / design

| Feature | Status | Notes |
|---|---|---|
| Shared bn/en i18n core | ✅ Complete | `@tuba/shared` |
| ERP page bilingual adoption | 🔴 Missing | English hardcoded |
| DesignSystem / I18nSystem pages | ⚪ Planned Only | ComingSoon routes |
| `apps/web/README.md` npm stub | ⚫ Deprecated | Misleading vs pnpm monorepo |
| `guidelines/Guidelines.md` empty | 🟣 Dead Code | Unused template |
| react-dnd dependency | 🟣 Dead Code | Unused |

### 2.14 Security (cross-cutting)

| Feature | Status | Notes |
|---|---|---|
| ValidationPipe + throttling | ✅ Complete | — |
| Magic-byte upload scan | 🟡 Partial | Not on all paths |
| Public upload confirm | ✅ Done (S1-02) | confirmToken + ownership; audit; e2e |
| Audit log read/export | 🔴 Missing | — |
| Frontend authz | 🔴 Missing | — |
| Staging notify fail-safe | ✅ Complete | Blank env → skip |

---

## 3. Gap register (actionable)

Each gap lists impacts, dependencies, effort, risk, and recommended sprint.

**Effort key:** S ≤1 day · M 1–3 days · L 3–7 days · XL 1–2+ weeks  
**Risk:** Low / Medium / High / Critical (likelihood × impact)

---

### G-01 — Gate OCR with `REVIEW_OCR_QUEUE`

| | |
|---|---|
| **Status today** | ✅ **Closed (S1-01)** — `@RequirePermissions("REVIEW_OCR_QUEUE")` on list/override/approve/reject; submit + poll remain JWT; audit on review mutations; e2e in `ocr-rbac.e2e-spec.ts` |
| **Business impact** | (Resolved) Unauthorized approve path closed at API |
| **Technical impact** | Reused existing decorator/guard; no parallel auth |
| **Security impact** | Review PII actions permission-gated; deploy new API image to live |
| **Dependencies** | PermissionsGuard, seed matrix; FE OCRCenter path gated (S1-05) |
| **Effort** | S–M |
| **Risk** | Low remaining (UI still shows OCR to all staff until frontend RBAC) |
| **Sprint** | **Sprint 1 (Security)** — backend done |

### G-02 — Harden public upload confirm / presign

| | |
|---|---|
| **Status today** | ✅ **Closed (S1-02)** — confirmToken + ownership/tenancy checks; size/TTL; AuditLog; optional JWT on public upload routes; e2e `upload-confirm.e2e-spec.ts`. Orphan GC job still backlog. |
| **Business impact** | (Resolved) Cross-tenant confirm IDOR closed; multipart registration unchanged |
| **Technical impact** | Reused UploadsController/StorageService; meta holds token hash (no migration) |
| **Security impact** | Confirm capability-bound; deploy new API image to live |
| **Dependencies** | UploadsController, StorageService, JwtAuthGuard optional Bearer |
| **Effort** | M |
| **Risk** | Low remaining (clients using presign must send `confirmToken`) |
| **Sprint** | **Sprint 1 (Security)** — backend done |

### G-03 — Audit log read API + broader write coverage

| | |
|---|---|
| **Status today** | ✅ Read API + SuperAdmin UI (**S2-01**); 🟡 sparse writes (S2-02) |
| **Business impact** | Staff with `ACCESS_AUDIT_LOGS` can investigate trail; write coverage still incomplete |
| **Technical impact** | `GET /audit-logs` filters/pagination; SuperAdmin Audit Logs screen; broaden login/OCR/upload writes still open |
| **Security impact** | Read gated; tenant JWTs rejected; API is authz SoT |
| **Dependencies** | `ACCESS_AUDIT_LOGS`, SuperAdmin screen, Prisma AuditLog |
| **Effort** | M remaining (writes) |
| **Risk** | Medium (write gaps) |
| **Sprint** | **S2-01 done; S2-02 remaining** |

### G-04 — Frontend RBAC (nav + route guards)

| | |
|---|---|
| **Status today** | ✅ **Closed (S1-05)** — `lib/rbac.ts` + `RequireAuth path` + ERPShell module filter + SA/Dash nav + OCR review actions; selftest |
| **Business impact** | (Resolved UX) Agents/suppliers no longer see staff module switcher; staff see only permitted modules |
| **Technical impact** | Session `permissions[]` + `company.type` for portals; **no** staff role-name hardcoding |
| **Security impact** | **Not a security boundary.** API checks unchanged; UI only hides/redirects |
| **Dependencies** | `api.ts` user shape, routes, shell |
| **Effort** | M |
| **Risk** | Low (mis-mapped PATH_ANY_OF can over-hide — fix map, not API) |
| **Sprint** | **Sprint 1** — done |

### G-05 — Unhide Agent Documents Vault

| | |
|---|---|
| **Status today** | ✅ **Closed (S1-06)** — `documents` screenMap → existing `DocumentsVaultScreen` |
| **Business impact** | (Resolved) Agents reach vault list/upload/version UI |
| **Technical impact** | One-line screen map wire; no rewrite. Access: `/agent-portal` UX via `company.type===AGENT` (S1-05); API JWT + tenancy |
| **Security impact** | Low — API still tenant-scopes `/documents` |
| **Dependencies** | `/documents` API (✅) |
| **Effort** | S |
| **Risk** | Low |
| **Sprint** | **Sprint 1** — done |

### G-06 — Unhide FinanceERP for finance roles

| | |
|---|---|
| **Status today** | ✅ Complete (S2-04) |
| **Business impact** | Finance staff use staff Finance ERP UI |
| **Technical impact** | `/finance-erp` → FinanceERP; UX `FINANCIAL_REPORTS`; authed live APIs (no mock fallthrough) |
| **Security impact** | API `@RequirePermissions` remains SoT; FE gate is UX only |
| **Dependencies** | G-04, finance APIs ✅ |
| **Effort** | M |
| **Risk** | Medium |
| **Sprint** | **Sprint 2 — done** |

### G-07 — Unhide Automation / Notification admin UI

| | |
|---|---|
| **Status today** | ✅ Complete (S2-05) |
| **Business impact** | Ops can tune automation rules in UI |
| **Technical impact** | `/automation` → AutomationNotifications; UX + API `CONFIGURE_WORKFLOWS` |
| **Security impact** | API `@RequirePermissions` remains SoT; FE gate is UX only |
| **Dependencies** | Automation + Notifications APIs ✅ |
| **Effort** | S–M |
| **Risk** | Medium |
| **Sprint** | **Sprint 2 — done** |

### G-08 — Unify notification dispatch paths

| | |
|---|---|
| **Status today** | 🟡 Partial |
| **Business impact** | Agents miss in-app/WS updates for vouchers; expiry alerts inconsistent |
| **Technical impact** | Route voucher + ExpiryService through `NotificationsService.dispatch` |
| **Security impact** | Low |
| **Dependencies** | NotificationsModule, ServicesService, ExpiryService |
| **Effort** | M |
| **Risk** | Medium |
| **Sprint** | **Sprint 2** |

### G-09 — Deduplicate expiry scheduling

| | |
|---|---|
| **Status today** | 🟡 Partial (duplicate 06:00 jobs) |
| **Business impact** | Duplicate alerts; confusing logs |
| **Technical impact** | Keep BullMQ path; remove or gate Nest `@Cron` |
| **Security impact** | Low |
| **Dependencies** | Fleet ExpiryService, AutomationScheduler |
| **Effort** | S |
| **Risk** | Low–Medium |
| **Sprint** | **Sprint 2** |

### G-10 — OCR e2e + failure surface

| | |
|---|---|
| **Status today** | ✅ Complete (S2-06) |
| **Business impact** | OCR regressions caught in CI; stuck PENDING recoverable |
| **Technical impact** | Stub-provider e2e; `validation.lastError`; `POST /ocr/documents/:id/reprocess` |
| **Security impact** | Low |
| **Dependencies** | OCR module, Redis, test harness |
| **Effort** | M |
| **Risk** | Medium |
| **Sprint** | **Sprint 2 — done** |

### G-11 — Contact / Enquiry API

| | |
|---|---|
| **Status today** | 🔴 Missing (schema model only) |
| **Business impact** | Marketing leads discarded |
| **Technical impact** | `POST /enquiries` + Contact form enums; throttle/captcha |
| **Security impact** | Medium if open without throttle |
| **Dependencies** | Enquiry model, Contact.tsx |
| **Effort** | S–M |
| **Risk** | Low |
| **Sprint** | **Sprint 3** |

### G-12 — Password reset

| | |
|---|---|
| **Status today** | ⚪ Planned Only |
| **Business impact** | Locked-out users need ops intervention |
| **Technical impact** | Token table or reuse RefreshToken pattern + email |
| **Security impact** | High if weak; Medium if absent |
| **Dependencies** | Notifications email channel |
| **Effort** | M–L |
| **Risk** | Medium |
| **Sprint** | **Sprint 3** |

### G-13 — Non-passport OCR parsers / autoAccept

| | |
|---|---|
| **Status today** | 🟡 Partial / 🟣 autoAccept dead |
| **Business impact** | Trade license/NID/cheque OCR promised in UI underdeliver |
| **Technical impact** | Per-type parsers; wire autoAccept policy |
| **Security impact** | Medium (auto-approve mistakes) |
| **Dependencies** | Gemini prompts, review UX |
| **Effort** | L–XL |
| **Risk** | Medium |
| **Sprint** | **Sprint 3–4** |

### G-14 — Excel passenger import

| | |
|---|---|
| **Status today** | ⚫ Deprecated dep / 🔴 feature |
| **Business impact** | Large groups slow to onboard |
| **Technical impact** | Safe parser (not npm xlsx); map columns; validate passport rules |
| **Security impact** | Medium (file parse vulns historically) |
| **Dependencies** | Groups/passengers, uploads |
| **Effort** | L |
| **Risk** | Medium |
| **Sprint** | **Sprint 4** |

### G-15 — Authenticate or restrict `/ops` WebSocket

| | |
|---|---|
| **Status today** | ✅ **Closed (S1-03)** — JWT handshake + `VIEW_DASHBOARD` + tenant JWT reject; logged failures; e2e |
| **Business impact** | (Resolved) Anonymous `/ops` subscribe closed |
| **Technical impact** | Reused JwtService + PermissionsGuard on existing OpsGateway (no second gateway) |
| **Security impact** | Ops WS gated; redeploy API + web for live |
| **Dependencies** | OpsGateway, opsSocket.ts, AuthModule Jwt export |
| **Effort** | M |
| **Risk** | Low remaining (anonymous wall displays need a staff JWT now) |
| **Sprint** | **Sprint 1** — done |

### G-16 — Restrict `/metrics` exposure

| | |
|---|---|
| **Status today** | ✅ **Closed (S1-04)** — nginx `^~ /api/metrics` → 404; scrape via `api:3210` on docker-net; `/health` unchanged |
| **Business impact** | (Resolved) Prometheus text no longer world-readable via `/api/metrics` |
| **Technical impact** | Edge deny in `infra/nginx/tubaalhijaz.com.conf` (applied on host); no second metrics endpoint |
| **Security impact** | Low remaining (loopback `/metrics` still available to local processes — intentional for scrape) |
| **Dependencies** | nginx, prometheus.yml, API loopback bind |
| **Effort** | S |
| **Risk** | Low (re-apply nginx block if vhost is overwritten from an old copy) |
| **Sprint** | **Sprint 1** — done |

### G-17 — ERP i18n (Bengali)

| | |
|---|---|
| **Status today** | 🔴 Missing on ERP pages |
| **Business impact** | Product default lang unused in ERP |
| **Technical impact** | Migrate pages to `t()` / STRINGS |
| **Security impact** | None |
| **Dependencies** | `@tuba/shared` |
| **Effort** | XL |
| **Risk** | Low |
| **Sprint** | **Sprint 4+** |

### G-18 — Documentation drift cleanup

| | |
|---|---|
| **Status today** | 🟡 Partial — **Sprint SoT done (S1-07)**; residual phase docs open (**S1-08**) |
| **Business impact** | Wrong ops decisions if SCHEMA/AUTOMATION still trusted over Prisma/code |
| **Technical impact** | SoT set (`PRODUCT_MASTER_SPEC`, audits, matrix, roadmap, backlog) current; still fix SCHEMA roles/migrations, AUTOMATION OCR/notify claims, AUDIT routes, HARDENING IP |
| **Security impact** | Low (HARDENING IP claim false) |
| **Dependencies** | Docs only |
| **Effort** | M remaining (S1-08) |
| **Risk** | Low |
| **Sprint** | **S1-07 done; S1-08 residual** |

### G-19 — Staging / CI remote verification

| | |
|---|---|
| **Status today** | 🟡 Partial |
| **Business impact** | Cannot safely ship Figma/design updates |
| **Technical impact** | Confirm remotes, secrets, staging clone, DNS |
| **Security impact** | Medium if staging has live notify creds |
| **Dependencies** | RUNBOOK §6, CICD.md |
| **Effort** | M (ops) |
| **Risk** | Medium |
| **Sprint** | **Sprint 2 (Platform)** |

### G-20 — Hardware GPS / driver mobile

| | |
|---|---|
| **Status today** | ⚪ Planned Only |
| **Business impact** | Live fleet tracking / driver UX deferred |
| **Technical impact** | Device webhook + mobile clients |
| **Security impact** | High when built (device auth) |
| **Dependencies** | Fleet location API already MVP-ready |
| **Effort** | XL |
| **Risk** | Low until scoped |
| **Sprint** | **Backlog / Phase 2 product** |

### G-21 — External integrations (NUSUK/MOFA/ZATCA)

| | |
|---|---|
| **Status today** | ⚪ Planned Only |
| **Business impact** | Manual ministry workflows remain |
| **Technical impact** | New integration services + secrets |
| **Security impact** | High when built |
| **Dependencies** | Vendor APIs, SystemSettings UI |
| **Effort** | XL |
| **Risk** | Low until scoped |
| **Sprint** | **Backlog** |

### G-22 — CRM / HR / Procurement desks

| | |
|---|---|
| **Status today** | ⚪ Planned Only |
| **Business impact** | OpsDepartments incomplete for non-service desks |
| **Technical impact** | New models + APIs (SCHEMA deferrals) |
| **Security impact** | Medium |
| **Dependencies** | Schema expansions |
| **Effort** | XL |
| **Risk** | Low |
| **Sprint** | **Backlog** |

---

## 4. Cross-axis comparison summary

### Documentation vs implementation

| Doc claim | Reality | Gap type |
|---|---|---|
| AUTOMATION: Groups/OCR pending | Modules live | Doc outdated |
| AUTOMATION: notify stubbed | Notify engine live | Doc outdated |
| SCHEMA: migrations not applied | 11 migrations in prod path | Doc outdated |
| SCHEMA: old role names | SUPER_ADMIN / OPS_STAFF… | Doc outdated |
| AUDIT: finance/automation routes live | ComingSoon | Doc + launch drift |
| HARDENING: no VPS IP in repo | Present in RUNBOOK/CICD | Doc false |
| FINANCE.md “wires FinanceERP” | UI hidden | Hidden feature |
| STORAGE: Phase 17 MinIO future | MinIO in prod compose | Doc outdated |

### Database vs API

| Schema asset | API | Gap |
|---|---|---|
| `Enquiry` | None | 🔴 |
| `AuditLog` | Writes only | 🔴 read |
| `WorkflowStage` / `Group.currentStage` | No transition API | 🟡 |
| `OcrDocument` ×15 types | Generic parse ×14 | 🟡 |
| `LocationSource.DEVICE` | Manual only | ⚪ |
| `UploadedFile.scanStatus` | Always CLEAN | ⚪ |
| Permission `API_KEY_ACCESS` | No auth mechanism | ⚪ |

### API vs frontend

| API | Frontend | Status |
|---|---|---|
| `/finance/*` | FinanceERP hidden | 🔵 |
| `/automation/*` + notify admin | AutomationNotifications hidden | 🔵 |
| `/documents` vault | DocumentsVaultScreen live (S1-06) | ✅ |
| `/ocr/*` | OCRCenter live | 🟡 (perms) |
| `/ops/*` | OpsControl live | ✅ |
| `/fleet/*` | FleetERP live | ✅ |
| `/agent-finance/*` | AgentPortalFinance live | ✅ |
| `/enquiries` | Contact mock | 🔴 |
| Audit logs | SAComingSoon | 🔴 |

### Infrastructure / deployment

| Capability | Status |
|---|---|
| Compose prod stack | ✅ |
| Nginx TLS config | ✅ |
| Monitoring | ✅ (optional) |
| CI workflow | ✅ |
| Staging isolation design | ✅ documented / 🟡 provision |
| Offsite backup | 🟡 |
| Doc accuracy for deploy | 🟡 |

### Security

| Control | Status |
|---|---|
| AuthN JWT | ✅ |
| AuthZ API (partial) | 🟡 |
| AuthZ UI | 🔴 |
| Upload hardening | 🟡→🔴 gaps |
| OCR authz | 🔴 |
| Audit accountability | 🔴 |
| Secrets hygiene examples | ✅ |
| Staging notify blank | ✅ |

### OCR

| Capability | Status |
|---|---|
| Passport pipeline | 🟡 |
| Vision/Gemini | 🟡 |
| Review UI | ✅ reachable |
| Permissions/tests | ✅ review RBAC e2e; full pipeline e2e still Sprint 2 |
| Multi-type extraction | 🟡/⚪ |

### Automation

| Capability | Status |
|---|---|
| Engine | ✅ |
| Admin UI | 🔵 |
| Event coverage | 🟡 |
| Doc accuracy | 🟡 (stale) |
| Expiry scheduling | 🟡 duplicate |

---

## 5. Recommended sprint plan

### Sprint 1 — Security & honesty (1 week) — ✅ complete (impl + SoT)

Shipped: G-01, G-02, G-04, G-05, G-15, G-16, G-18 (SoT). Residual phase-doc G-18 → **S1-08**.  
**Exit met:** OCR gated; upload confirm hardened; shell hides forbidden modules; vault visible; Sprint SoT reconciled (`SPRINT1_COMPLETION_REPORT.md`).

### Sprint 2 — Unlock staff tools (1 week)

Ship: G-03, G-06, G-07, G-08, G-09, G-10, G-19  
**Exit:** Finance + Automation UIs reachable with RBAC; audit readable; notify paths unified; expiry single-scheduled; OCR e2e green; staging verified.

### Sprint 3 — Product completeness (1–2 weeks)

Ship: G-11, G-12, start G-13  
**Exit:** Contact leads captured; password reset; richer OCR types or honest UI scope reduction.

### Sprint 4+ — Scale features

G-14, G-17, G-20, G-21, G-22 as product prioritizes.

---

## 6. Counts (approximate)

| Status | Feature rows (this doc §2) |
|---|---|
| ✅ Complete | ~28 |
| 🟡 Partial | ~24 |
| 🔴 Missing | ~18 |
| ⚪ Planned Only | ~14 |
| 🔵 Hidden | ~4 |
| 🟣 Dead Code | ~4 |
| ⚫ Deprecated | ~3 |

---

## 7. Explicit non-goals (out of gap closure)

- Rewriting Figma UI  
- Horizontal scale / managed Postgres (RUNBOOK plan only)  
- Building native mobile apps this quarter unless G-20 prioritized  

---

*Companion: [`FEATURE_STATUS_MATRIX.md`](./FEATURE_STATUS_MATRIX.md). No code was modified.*
