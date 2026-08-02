# TUBA AL HIJAZ — Master Document Index

**Generated:** 2026-07-31  
**Last reconciled:** 2026-07-31 (S1-07)  
**Scope:** Every project markdown file, deployment artifact, and architectural decision document under `/var/www/TUBAALHIJAZ` (excluding `node_modules`).  
**Note:** Index maintained as living navigation. Sprint closeout: [`SPRINT1_COMPLETION_REPORT.md`](./SPRINT1_COMPLETION_REPORT.md).

### Authority hierarchy (global)

When documents disagree, prefer in this order:

1. **Runtime source of truth** — `apps/api/prisma/schema.prisma`, Nest controllers/services, `apps/web/src/app/routes.tsx`, compose/nginx configs  
2. **Operational runbooks** — `RUNBOOK.md` (live ops), `infra/` compose + nginx (how it actually runs)  
3. **Point-in-time audits** — `docs/PROJECT_AUDIT.md` (2026-07-31 system inventory)  
4. **Phase completion notes** — `docs/{AUTH,FINANCE,OPS,…}.md` (accurate for their phase date; may lag later work)  
5. **Design / inventory precursors** — `docs/AUDIT.md`, Figma README/guidelines (UI intent; not deployment truth)

**Owner note:** No document declares a named human owner. “Owner” below is the **inferred steward role**.

**Absent globally:** root `README.md`, any `CHANGELOG*`, `prompts/`, `planning/`, OpenAPI/Swagger.

---

## 1. Documentation Tree

```
TUBAALHIJAZ/
├── RUNBOOK.md                          # On-call / deploy / Figma reconcile (ops bible)
├── docs/
│   ├── PRODUCT_MASTER_SPEC.md          # Product SoT (features, security, launch)
│   ├── PROJECT_AUDIT.md                # Full system audit (reconciled S1-07)
│   ├── CODE_AUDIT.md                   # Code-level inventory
│   ├── GAP_ANALYSIS.md                 # Gaps → sprint mapping
│   ├── FEATURE_STATUS_MATRIX.md        # Cross-layer feature matrix
│   ├── IMPLEMENTATION_ROADMAP.md       # Sprint plan
│   ├── SPRINT_BACKLOG.md               # Ticket backlog + status
│   ├── SPRINT1_COMPLETION_REPORT.md    # Sprint 1 closeout
│   ├── MASTER_DOCUMENT_INDEX.md        # THIS FILE
│   ├── DOCUMENT_CONFLICTS.md           # Conflict tracker (residual → S1-08)
│   ├── uat/                            # ESP-05 UAT package (human acceptance)
│   │   ├── UAT_MASTER_PLAN.md
│   │   ├── UAT_TEST_CASES.md
│   │   ├── UAT_EXECUTION_CHECKLIST.md
│   │   ├── UAT_BUG_REGISTER.md
│   │   ├── UAT_SIGNOFF.md
│   │   └── GO_LIVE_READINESS.md
│   ├── releases/                       # Release engineering (ESP-06/07 + TRANSFORM)
│   │   ├── v2.0_RELEASE.md             # ESP-07 official release
│   │   ├── v2.0_CHANGELOG.md
│   │   ├── KNOWN_ISSUES.md
│   │   ├── UPGRADE_GUIDE.md
│   │   ├── FINAL_SIGNOFF.md
│   │   ├── PRODUCTION_READINESS.md
│   │   ├── DEPLOYMENT_CHECKLIST.md
│   │   ├── DISASTER_RECOVERY.md
│   │   ├── OPERATIONS_RUNBOOK.md
│   │   ├── RELEASE_NOTES_v2.0.md
│   │   ├── TRANSFORM_002_*.md
│   │   └── TRANSFORM_001/
│   ├── OCR.md                          # OCR permission / review SoT
│   ├── RBAC_CONSISTENCY_REPORT.md      # FE/API RBAC consistency notes
│   ├── AUDIT.md                        # Phase-1 frontend inventory → schema design brief
│   ├── SCHEMA.md                       # ER summary of Prisma models (drift → S1-08)
│   ├── AUTH.md                         # Phases 3–4–6 auth, registration, services
│   ├── FINANCE.md                      # Phase 7 finance ERP
│   ├── OPS.md                          # Phase 8 ops boards + WebSocket
│   ├── FLEET.md                        # Phase 9 fleet ERP
│   ├── AUTOMATION.md                   # Phase 10 automation / BullMQ rules
│   ├── NOTIFICATIONS.md                # Phase 11 notification delivery
│   ├── DASHBOARDS.md                   # Phase 12 live dashboards
│   ├── STORAGE.md                      # Phase 13 MinIO + document vault
│   ├── HARDENING.md                    # Phase 14 security/robustness pass
│   └── CICD.md                         # Phase 16 CI/CD secrets & pipeline narrative
├── infra/
│   ├── README.md                       # Docker stack architecture (Phase 15)
│   ├── docker-compose.yml              # Dev compose
│   ├── docker-compose.prod.yml         # Production compose
│   ├── docker-compose.staging.yml      # Staging overlay
│   ├── docker-compose.monitoring.yml   # Prometheus/Grafana stack
│   ├── Dockerfile.api / Dockerfile.web
│   ├── nginx.web.conf                  # In-container SPA nginx
│   ├── nginx/tubaalhijaz.com.conf      # Host reverse-proxy / TLS
│   ├── .env.example / .env.staging.example
│   ├── Makefile / backup.sh
│   └── monitoring/{prometheus.yml,grafana-datasource.yml}
├── .github/workflows/ci-cd.yml         # Executable CI/CD workflow
├── apps/web/
│   ├── README.md                       # Figma Make export stub
│   ├── ATTRIBUTIONS.md                 # shadcn / Unsplash licenses
│   └── guidelines/Guidelines.md        # Empty Figma AI guidelines template
├── apps/api/                           # (no README)
└── packages/shared/                    # (no README)
```

### Inventory by file

| Path | Purpose | Status | Owner (inferred) | Currency | Duplicates / overlaps | Authoritative? |
|---|---|---|---|---|---|---|
| `RUNBOOK.md` | 2am ops: deploy, rollback, backup restore, triage, scaling notes, Figma import→staging→prod | Active | Platform / On-call | **Current** for ops procedures; §6.0 setup may lag if remotes now exist | Overlaps `docs/CICD.md` (deploy/rollback), `infra/README.md` (compose) | **Yes — ops procedures** |
| `docs/PRODUCT_MASTER_SPEC.md` | Product SoT: modules, security posture, launch policy | Active | Product / Eng lead | **Current post Sprint 1** | Overlaps audits | **Yes — product intent + security posture** |
| `docs/PROJECT_AUDIT.md` | Holistic architecture, modules, DB, API, progress, debt, security | Active (snapshot) | Engineering lead | **Reconciled S1-07** | Summarizes all phase docs | **Yes — cross-cutting status snapshot** |
| `docs/CODE_AUDIT.md` | Per-module code inventory + residual risks | Active | Eng lead | **Reconciled S1-07** | Overlaps PROJECT_AUDIT | **Yes — code-level findings** |
| `docs/GAP_ANALYSIS.md` | Gap IDs → sprint placement | Active | Eng lead | **Reconciled S1-07** | Feeds roadmap/backlog | **Yes — gap backlog** |
| `docs/FEATURE_STATUS_MATRIX.md` | Feature × layer matrix | Active | Eng lead | **Reconciled S1-07** | Overlaps GAP | **Yes — feature status grid** |
| `docs/IMPLEMENTATION_ROADMAP.md` | Sprint objectives & acceptance | Active | Eng lead | **Sprint 1 marked complete** | Overlaps backlog | **Yes — sprint plan** |
| `docs/SPRINT_BACKLOG.md` | Ticket IDs + status | Active | Eng lead | **Sprint 1 tickets Done** | Overlaps roadmap | **Yes — ticket status** |
| `docs/SPRINT1_COMPLETION_REPORT.md` | Sprint 1 closeout (security, deploy, rollback) | Active | Eng lead | **Current** | — | **Yes — Sprint 1 exit record** |
| `docs/RBAC_CONSISTENCY_REPORT.md` | FE UX vs API authz consistency | Active | Security | Current | Overlaps AUTH/OCR | Supporting |
| `docs/OCR.md` | OCR review vs submit permission model | Active | Backend / Security | Yes | AUTH OCR section | **Yes — OCR auth SoT** |
| `docs/AUDIT.md` | Frozen UI inventory → entity/API/schema design brief | Historical design brief | Product / Backend design | **Partly outdated** (routes, bugs, entity names) | Precursor to `SCHEMA.md` + APIs | **Yes for original UI intent / business rules**; **No for live routes** |
| `docs/SCHEMA.md` | Human ER diagram of DB | Reference | Backend | **Partly outdated** (roles, migration applied claim, fleet GPS models incomplete) | Overlaps Prisma + AUDIT §4 | **No — Prisma schema wins** |
| `docs/AUTH.md` | Auth, RBAC, tenancy, registration, service workflows | Active phase note | Backend | **Mostly current**; test counts stale; “notification engine lands” phrasing stale | Overlaps HARDENING (RBAC tests), AUTOMATION (approval side-effects) | **Yes for auth/RBAC/service API narrative** (verify against controllers) |
| `docs/FINANCE.md` | Finance design principles + endpoints | Active | Backend / Finance | **Current** for API design | Overlaps DASHBOARDS (GL reuse) | **Yes for finance API/design** |
| `docs/OPS.md` | Ops REST + Socket.io | Active | Backend / Ops | **Current** | — | **Yes for ops realtime** |
| `docs/FLEET.md` | Fleet API, expiry, GPS MVP | Active | Backend / Fleet | **Mostly current**; Phase-10 BullMQ note outdated | Expiry also in AUTOMATION | **Yes for fleet REST/GPS MVP**; expiry scheduling → see AUTOMATION + code |
| `docs/AUTOMATION.md` | Rule engine, events, queues, scheduled jobs | Active | Backend | **Partly outdated** (claims Groups/OCR pending) | Overlaps NOTIFICATIONS, FLEET expiry, AUTH approval | **Yes for automation architecture**; event emission status → code |
| `docs/NOTIFICATIONS.md` | Channels, templates, queues, REST | Active | Backend | **Current** (stub-safe model still true) | Overlaps AUTOMATION actions | **Yes for notification delivery** |
| `docs/DASHBOARDS.md` | Aggregate endpoints + cache | Active | Backend | **Current** | Overlaps FINANCE reports | **Yes for dashboard API** |
| `docs/STORAGE.md` | MinIO, uploads, vault versioning | Active | Backend / Infra | **Mostly current**; “Phase 17 provisions MinIO” outdated (prod compose already has it) | Overlaps AUTH uploads, HARDENING magic-bytes | **Yes for storage/vault API**; prod topology → infra compose |
| `docs/HARDENING.md` | Pre-deploy security pass | Active | Backend / Security | **Partly outdated** (“no IP in tracked source” false) | Overlaps CICD lint note | **Yes for hardening controls implemented**; secrets hygiene claim needs re-check |
| `docs/CICD.md` | Pipeline narrative + secrets checklist | Active | Platform | **Partly outdated** (“no remote yet”; rollback “Phase 20 will formalize” but RUNBOOK already formalizes) | Overlaps RUNBOOK, `ci-cd.yml` | **Yes for secrets/vars checklist**; pipeline truth → **`ci-cd.yml`** |
| `infra/README.md` | Docker architecture, volumes, healthchecks | Active | Platform | **Current** with minor Phase-17 “put TLS in front” lag (TLS nginx conf exists) | Overlaps RUNBOOK | **Yes for compose architecture** |
| `infra/docker-compose*.yml` | Executable stack definitions | Active | Platform | **Current** | — | **Yes — runtime stack** |
| `infra/nginx/*` | SPA + host TLS/proxy | Active | Platform | **Current** | — | **Yes — edge routing** |
| `infra/.env.example` | Env key catalog | Active | Platform | **Current** | Staging twin in `.env.staging.example` | **Yes for env key names** |
| `infra/backup.sh` | Nightly/manual DB backup | Active | Platform | **Current** | AUTOMATION RUN_BACKUP is separate in-app path | **Yes for VPS backup script** |
| `.github/workflows/ci-cd.yml` | GitHub Actions pipeline | Active | Platform | **Current** (executable) | Narrative in CICD.md | **Yes — CI/CD behavior** |
| `apps/web/README.md` | Figma Make “how to run” stub (`npm i`) | Stale export artifact | Frontend (historical) | **Outdated** (monorepo uses pnpm) | — | **No** |
| `apps/web/ATTRIBUTIONS.md` | Third-party license notes | Active | Frontend / Legal | **Current** | — | **Yes for attributions** |
| `apps/web/guidelines/Guidelines.md` | Empty AI design-guidelines template | Unused placeholder | Design | **Empty / unused** | — | **No** |

---

## 2. Architecture Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `docs/PROJECT_AUDIT.md` §1–2 | Monorepo layout, runtime topology, module list | Snapshot | Eng lead | Yes (2026-07-31) | System shape overview |
| `infra/README.md` | Why separate SPA/API origins; volumes; healthchecks; image tags | Active | Platform | Yes | Container architecture decisions |
| `docs/AUTH.md` (tenancy section) | ALS + Prisma scoped client multi-tenancy | Active | Backend | Yes | Tenancy pattern |
| `docs/AUTOMATION.md` | EventEmitter → BullMQ → actions | Active | Backend | Yes (engine design) | Automation architecture |
| `docs/NOTIFICATIONS.md` | Dispatch → `tuba-notify` → channels | Active | Backend | Yes | Notification architecture |
| `docs/STORAGE.md` | StorageService driver selection | Active | Backend | Yes | Storage architecture |
| `docs/SCHEMA.md` | ER narrative | Reference | Backend | Partial | Human-readable ER only |
| `docs/AUDIT.md` | Original UI→schema design brief | Historical | Product | Partial | Business rules embedded in UI |
| `RUNBOOK.md` §5 | Scaling plan (documented, not acted) | Active | Platform | Yes as plan | Scaling decision record |
| `RUNBOOK.md` §6 | Figma vendor-branch architecture | Active | Frontend/Platform | Yes as intended process | Design→code workflow |
| Compose + nginx configs | Concrete deployment topology | Active | Platform | Yes | How services connect |

**Architectural decisions captured (and where):**

| Decision | Primary doc | Code/config authority |
|---|---|---|
| pnpm monorepo (`apps/*`, `packages/shared`) | PROJECT_AUDIT, root `package.json` | `pnpm-workspace.yaml` |
| Nest monolith + domain modules | Phase docs + PROJECT_AUDIT | `app.module.ts` |
| Separate web/API origins (path collision avoidance) | `infra/README.md` | compose + `VITE_API_URL` + CORS |
| Host nginx `/api/` strip-prefix to Nest root routes | nginx conf + PROJECT_AUDIT | `infra/nginx/tubaalhijaz.com.conf` |
| JWT access + rotating refresh cookie | AUTH.md | `auth/*` |
| DB-driven RBAC permissions | AUTH.md | `PermissionsGuard` + seed |
| Prisma ALS tenant scoping | AUTH.md | `prisma.service.ts` |
| BullMQ on Redis db3, prefix `tuba` | AUTOMATION / NOTIFICATIONS | queue constants |
| MinIO as file SoT (no local uploads volume in prod) | STORAGE + infra README | compose volumes |
| Figma baseline vendor branch | RUNBOOK §6 | `scripts/figma-import.sh` |
| GPS hardware deferred; same ingest path | FLEET.md | `LocationSource.DEVICE` |
| Migrations forward-only; restore backup to undo | RUNBOOK §2 | `prisma migrate deploy` |

---

## 3. Deployment Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `RUNBOOK.md` §1–4 | Deploy, rollback, restore, triage | Active | On-call | Yes | Day-2 operations |
| `RUNBOOK.md` §6.0–6.5 | Staging setup, Figma ship, promote, safety table | Active | Platform | Partially (setup checklist may be incomplete) | Staging/prod separation rules |
| `docs/CICD.md` | Secrets, variables, one-time GitHub setup | Active | Platform | Partial | Secret names / approval gate intent |
| `.github/workflows/ci-cd.yml` | Actual CI jobs, staging vs prod deploy | Active | Platform | Yes | What CI does |
| `infra/README.md` | Local/prod compose usage | Active | Platform | Yes | Building/running containers |
| `infra/docker-compose.prod.yml` | Prod services & limits | Active | Platform | Yes | Prod service graph |
| `infra/docker-compose.staging.yml` | Staging port/project overlay | Active | Platform | Yes | Staging isolation |
| `infra/docker-compose.monitoring.yml` | Observability stack | Active | Platform | Yes | Monitoring deploy |
| `infra/nginx/tubaalhijaz.com.conf` | TLS, `/api/`, WebSocket upgrade | Active | Platform | Yes | Edge routing |
| `infra/nginx.web.conf` | SPA container nginx | Active | Platform | Yes | Static asset serving |
| `infra/Dockerfile.api` / `Dockerfile.web` | Image build | Active | Platform | Yes | Image contents |
| `infra/Makefile` | `make prod` helpers | Active | Platform | Yes | Convenience commands |
| `infra/backup.sh` | DB dump → MinIO | Active | Platform | Yes | Backup execution |
| `infra/.env.example` | Required env keys | Active | Platform | Yes | Config surface |
| `docs/HARDENING.md` | Pre-VPS security checklist (historical phase) | Active | Security | Partial | Controls that were added |
| `docs/STORAGE.md` | MinIO provisioning notes | Active | Platform | Partial | Dev MinIO paths (Windows-centric) |

**No CHANGELOG** exists to track deploy/release history.

---

## 4. Database Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `apps/api/prisma/schema.prisma` | Actual models/enums/indexes | Active code | Backend | Yes | **Schema SoT** |
| `apps/api/prisma/migrations/*` | Applied migration history | Active | Backend | Yes | Migration order |
| `docs/SCHEMA.md` | ER summary for humans | Reference | Backend | Partial | Narrative only |
| `docs/AUDIT.md` §4–5 | Pre-schema entity catalog + conventions | Historical | Product/Backend | Partial | Naming/VAT/SLA business rules |
| `docs/FINANCE.md` | Ledger/wallet/GL rules | Active | Backend | Yes | Finance data semantics |
| `docs/FLEET.md` | Fleet tables added in migration | Active | Backend | Yes (for docs/GPS) | Fleet extensions |
| `docs/STORAGE.md` | UploadedFile versioning fields | Active | Backend | Yes | Vault columns meaning |
| `prisma/seed.ts` / `seed.prod.ts` | Seed semantics | Active code | Backend | Yes | Demo vs prod seed behavior |
| `RUNBOOK.md` §2–3 | Migrate-forward / restore | Active | On-call | Yes | Data recovery policy |

---

## 5. Workflow Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `docs/AUTH.md` Phase 6 | Service request state machine + supplier accept→voucher | Active | Backend | Yes | Booking workflow API |
| `docs/AUTOMATION.md` | Event-driven rules + cron jobs | Active | Backend | Partial | Automation workflows |
| `docs/NOTIFICATIONS.md` | Delivery workflow after SEND_NOTIFICATION | Active | Backend | Yes | Notify pipeline |
| `docs/FINANCE.md` automation hooks | Auto-deduct / auto-invoice | Active | Backend | Yes | Finance side-effects |
| `docs/OPS.md` | Dispatch/flight status machines + realtime | Active | Backend | Yes | Ops board workflows |
| `docs/FLEET.md` | Expiry watchdog + dispatch assign | Active | Backend | Partial | Fleet compliance workflow |
| `docs/AUDIT.md` §3.19 WorkflowMap | Canonical 19-stage group lifecycle (UI spec) | Spec | Product | Spec still valid as product intent | Stage catalog intent |
| `SCHEMA.md` `WorkflowStage` | DB catalog of 19 stages | Reference | Backend | Yes if matches seed | Stage rows |
| `RUNBOOK.md` §6 | Design import → staging → prod workflow | Active | Platform | Yes | Release workflow for UI |
| `.github/workflows/ci-cd.yml` | Engineering delivery workflow | Active | Platform | Yes | CI/CD workflow |

**Note:** There is no standalone `docs/WORKFLOWS.md`. The in-app `WorkflowMap.tsx` page is routed to ComingSoon (see PROJECT_AUDIT).

---

## 6. OCR Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `docs/OCR.md` | Permission model (S1-01), review vs submit gates, audit | Active | Backend / Security | Yes (2026-07-31) | **OCR auth SoT** |
| `docs/AUTH.md` (OCR section) | Endpoint access table for OCR | Active | Backend | Yes | API docs |
| `docs/SCHEMA.md` §7 | `OcrDocument` model sketch | Partial | Backend | Partial | Field-level intent |
| `docs/AUDIT.md` §3.15 | Full OCR Center UI inventory (15 types, thresholds, APIs) | Historical UI spec | Product | Partial (endpoints renamed in impl) | UI/product OCR requirements |
| `docs/PROJECT_AUDIT.md` (OCR sections) | Implementation status, Gemini/Vision | Snapshot | Eng lead | Mostly (perm gap closed S1-01) | OCR maturity overview |
| `docs/AUTOMATION.md` | Mentions `passenger.ocr.completed` (claims OCR pending — **wrong**) | Outdated claim | Backend | No on status | Event name only |
| `docs/HARDENING.md` | Notes group+OCR e2e still stubbed | Outdated claim | Backend | No | — |
| Code: `apps/api/src/ocr/*` | Real pipeline | Active | Backend | Yes | **OCR pipeline SoT** |

**Authoritative OCR stack:** `docs/OCR.md` (auth) + source under `apps/api/src/ocr/` + Prisma `OcrDocument`.

---

## 7. Finance Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `docs/FINANCE.md` | Principles, staff/agent endpoints, CoA seed, tests | Active | Backend/Finance | Yes | Finance API & ledger rules |
| `docs/DASHBOARDS.md` | Reuses Finance `ReportsService` | Active | Backend | Yes | Reporting consistency rule |
| `docs/AUTH.md` / services | Wallet deduct + invoice on completion hooks | Active | Backend | Yes | Cross-module finance triggers |
| `docs/AUTOMATION.md` | `invoice.generated` → PDF/notify rules | Active | Backend | Yes | Post-invoice automation |
| `docs/HARDENING.md` | Financial audit log on pay/slip review | Active | Security | Yes | Audit coverage for finance writes |
| `docs/AUDIT.md` §3.10, §3.14 | UI inventory for agent/staff finance screens | Historical | Product | Partial (routes/UI gating changed) | Screen field requirements |
| `docs/PROJECT_AUDIT.md` | Notes FinanceERP route ComingSoon | Snapshot | Eng lead | Yes | Frontend launch status |
| Prisma finance models | Schema | Active | Backend | Yes | Data model SoT |
| Code: `apps/api/src/finance/*` | Implementation | Active | Backend | Yes | Behavior SoT |

---

## 8. Operations Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `RUNBOOK.md` | Production operations bible | Active | On-call | Yes | Incidents, deploy, restore |
| `docs/OPS.md` | Ops control boards + WebSocket | Active | Backend/Ops | Yes | Ops API/realtime |
| `docs/FLEET.md` | Fleet ops / compliance / dispatch assign | Active | Fleet | Mostly yes | Fleet ops |
| `docs/DASHBOARDS.md` | Ops/CEO/dispatch KPIs | Active | Backend | Yes | Ops metrics API |
| `docs/NOTIFICATIONS.md` | Emergency fan-out / WASender ops | Active | Backend | Yes | Messaging ops |
| `infra/backup.sh` + RUNBOOK §3 | Backup/restore | Active | Platform | Yes | Data protection ops |
| `infra/docker-compose.monitoring.yml` | Grafana/Prometheus | Active | Platform | Yes | Observability ops |
| `docs/AUDIT.md` §3.12–3.13 | OpsControl + OpsDepartments UI inventory | Historical | Product | Partial | Desk/SLA product intent |
| `docs/CICD.md` + workflow | Release operations | Active | Platform | Partial / Yes | Release pipeline |

---

## 9. API Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `docs/AUTH.md` | Auth, companies, users, uploads, services, supplier | Active | Backend | Mostly yes | Those endpoint groups |
| `docs/FINANCE.md` | `/finance/*`, `/agent-finance/*` | Active | Backend | Yes | Finance routes |
| `docs/OPS.md` | `/ops/*` + WS events | Active | Backend | Yes | Ops routes |
| `docs/FLEET.md` | `/fleet/*`, `/vehicles/:id/location` | Active | Backend | Yes | Fleet routes |
| `docs/AUTOMATION.md` | `/automation/*` | Active | Backend | Yes | Automation routes |
| `docs/NOTIFICATIONS.md` | `/notifications/*` | Active | Backend | Yes | Notification routes |
| `docs/DASHBOARDS.md` | `/dashboards/*` | Active | Backend | Yes | Dashboard routes |
| `docs/STORAGE.md` | `/uploads/*`, `/documents/*` | Active | Backend | Yes | Storage/vault routes |
| `docs/AUDIT.md` §6 | Implied API groups (pre-implementation) | Historical | Product | Outdated names | Product API wishlist |
| `docs/PROJECT_AUDIT.md` §4 | Consolidated API overview + gaps | Snapshot | Eng lead | Yes (2026-07-31) | Gap list (OCR perms, Enquiry, audit read) |
| Controllers under `apps/api/src/**` | Live routes | Active | Backend | Yes | **API SoT** |
| E2E specs `apps/api/test/*` | Behavioral contract | Active | Backend | Yes | Guaranteed behavior |

**Missing:** OpenAPI/Swagger, Postman collection, dedicated `docs/API.md`.

---

## 10. Security Documents

| Document | Purpose | Status | Owner | Current? | Authoritative for |
|---|---|---|---|---|---|
| `docs/HARDENING.md` | Validation, throttling, audits, dependency patches, secrets hygiene | Active | Security/Backend | Partial | Controls added in Phase 14 |
| `docs/AUTH.md` | Tokens, RBAC, tenancy isolation | Active | Security/Backend | Yes | AuthN/Z design |
| `docs/CICD.md` | Deploy keys, GHCR, environment approval | Active | Platform | Partial | CI secret handling |
| `RUNBOOK.md` safety table | Staging must blank WASENDER/SMTP | Active | On-call | Yes | Staging blast-radius control |
| `docs/STORAGE.md` | Magic-byte scan, public upload rationale | Active | Security/Backend | Yes | Upload trust model |
| `docs/NOTIFICATIONS.md` | Stub-safe channels when creds blank | Active | Security | Yes | Fail-closed messaging |
| `docs/PROJECT_AUDIT.md` §9 | Consolidated security issues | Snapshot | Eng lead | Yes (2026-07-31) | Current risk register |
| `infra/.env.example` | Placeholder-only secrets | Active | Platform | Yes | What must be set |
| `apps/web/ATTRIBUTIONS.md` | License compliance | Active | Legal | Yes | Third-party attribution |

**Security authority split:**  
- **Controls as implemented** → code + HARDENING  
- **Current residual risks** → PROJECT_AUDIT §9  
- **Operational security** → RUNBOOK (staging notify blank, cookie secure, SSH deploy user)

---

## Quick “where do I look?” map

| Question | Start here | Then verify against |
|---|---|---|
| How do I deploy / rollback / restore? | `RUNBOOK.md` | compose files |
| What secrets does CI need? | `docs/CICD.md` | `ci-cd.yml` |
| What is the system shape today? | `docs/PROJECT_AUDIT.md` | code |
| What tables exist? | `schema.prisma` | `docs/SCHEMA.md` (hint only) |
| How does auth/RBAC work? | `docs/AUTH.md` | guards + seed |
| How do bookings/vouchers work? | `docs/AUTH.md` Phase 6 | `services/*` |
| Finance ledger rules? | `docs/FINANCE.md` | `finance/*` |
| Live ops boards? | `docs/OPS.md` | `ops/*` |
| OCR? | `docs/OCR.md` + code | `ocr/*` controllers |
| Figma update process? | `RUNBOOK.md` §6 | `scripts/figma-import.sh` |
| Docker networking? | `infra/README.md` | compose + nginx |
| Human UAT / go-live sign-off? | `docs/uat/UAT_MASTER_PLAN.md` | checklist + `UAT_SIGNOFF.md` |
| Production readiness / deploy / DR? | `docs/releases/PRODUCTION_READINESS.md` | checklist + `DISASTER_RECOVERY.md` |

---

*Companion report: [`docs/DOCUMENT_CONFLICTS.md`](./DOCUMENT_CONFLICTS.md).*
