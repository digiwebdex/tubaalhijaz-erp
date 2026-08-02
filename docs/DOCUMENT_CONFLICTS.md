# TUBA AL HIJAZ — Document Conflicts & Gaps

**Generated:** 2026-07-31  
**Last reconciled:** 2026-07-31 (S1-07 — Sprint SoT docs)  
**Companion:** [`docs/MASTER_DOCUMENT_INDEX.md`](./MASTER_DOCUMENT_INDEX.md)  
**Sprint closeout:** [`docs/SPRINT1_COMPLETION_REPORT.md`](./SPRINT1_COMPLETION_REPORT.md)  

**Maintenance:** After Sprint 1, planning/audit SoT documents were updated in place. This file still tracks **residual** conflicts in phase docs (SCHEMA, AUTOMATION, AUDIT, HARDENING, web README). Prefer the **Authoritative** column + runtime code.

---

## 1. Duplicate documents

Documents that cover the same topic with overlapping (sometimes conflicting) claims. Prefer the **Authoritative** column.

| Topic | Documents involved | Relationship | Authoritative source |
|---|---|---|---|
| Deploy / rollback / image tags | `RUNBOOK.md` §1–2, `docs/CICD.md` (rollback “Phase 20”), `infra/README.md` | Triple coverage | **`RUNBOOK.md`** for procedure; **`ci-cd.yml`** for automation; compose for mechanics |
| CI secrets & approval gate | `docs/CICD.md`, `RUNBOOK.md` §6.0, workflow comments | Duplicate checklist | **`docs/CICD.md`** for secret names; **`ci-cd.yml`** for behavior |
| Docker stack architecture | `infra/README.md`, `RUNBOOK.md`, `docs/PROJECT_AUDIT.md` §1 | Complementary duplicates | **`infra/README.md` + compose files** |
| Entity / schema design | `docs/AUDIT.md` §4, `docs/SCHEMA.md`, Prisma schema | AUDIT was design brief; SCHEMA is summary; Prisma is truth | **`schema.prisma`** |
| Auth + RBAC | `docs/AUTH.md`, `docs/OCR.md`, `docs/RBAC_CONSISTENCY_REPORT.md`, `docs/HARDENING.md`, audits | Overlap intentional | **`docs/AUTH.md` + `docs/OCR.md`** + code; FE UX = `apps/web/.../lib/rbac.ts` |
| Service booking workflow | `docs/AUTH.md` Phase 6, `docs/AUTOMATION.md` (voucher rules), `docs/FINANCE.md` (auto-invoice) | Split across phases | Controllers + these three together; no single doc |
| Notification delivery | `docs/NOTIFICATIONS.md`, `docs/AUTOMATION.md` (SEND_NOTIFICATION stub era), `docs/AUTH.md` (“when notification engine lands”) | Stale vs current | **`docs/NOTIFICATIONS.md`** |
| Fleet expiry scheduling | `docs/FLEET.md` (in-process cron; “when BullMQ lands”), `docs/AUTOMATION.md` (BullMQ expiry sweep) | Conflicting timeline | **Code** (both `@Cron` and BullMQ exist); doc narrative → update FLEET |
| Uploads / storage | `docs/AUTH.md` Phase 4, `docs/STORAGE.md`, `docs/HARDENING.md` | Progressive phases | **`docs/STORAGE.md`** for final storage; AUTH for registration linking |
| Finance numbers on dashboards | `docs/FINANCE.md`, `docs/DASHBOARDS.md` | Explicit reuse — good duplicate | Either; both agree on GL reuse |
| System status / progress | Phase docs’ “Full suite: N tests”, `docs/CICD.md` (178), `docs/PROJECT_AUDIT.md` | Competing snapshots | **`PROJECT_AUDIT.md`** for status; **CI run** for live test count |
| Security posture | `docs/HARDENING.md`, `docs/PROJECT_AUDIT.md` §9 | HARDENING = what was done; AUDIT = residual risk | Both — different jobs |
| Frontend route map | `docs/AUDIT.md` §1, `apps/web/.../routes.tsx`, `docs/PROJECT_AUDIT.md` | AUDIT stale vs code | **`routes.tsx`** |

### Near-duplicates that should stay (different audiences)

| Keep both | Why |
|---|---|
| `RUNBOOK.md` + `infra/README.md` | Ops incidents vs developer compose onboarding |
| `docs/CICD.md` + `ci-cd.yml` | Human checklist vs executable pipeline |
| `docs/SCHEMA.md` + Prisma | Human ER vs machine schema |
| Phase docs + `PROJECT_AUDIT.md` | Deep domain notes vs cross-cutting snapshot |

---

## 2. Outdated documents

| Document | Outdated claim | Reality (as of 2026-07-31) | Severity |
|---|---|---|---|
| `docs/SCHEMA.md` header | Init migration “NOT applied anywhere yet” | 11 migrations exist; API runs `migrate deploy` on boot; prod DB in use | **High** |
| `docs/SCHEMA.md` §1 roles | `CEO, OPS_MANAGER, FINANCE_OFFICER, AGENT_SUPPORT, IT_ADMIN, SUPPLIER_LIAISON…` | Seed/code: `SUPER_ADMIN, OPS_STAFF, FINANCE_STAFF, FLEET_STAFF, CEO_VIEWER, AGENT, SUPPLIER, DRIVER` | **High** |
| `docs/SCHEMA.md` §6 Fleet | Omits `VehicleDocument`, `VehicleLocation`, denormalized `last*` GPS fields | Added in `20260718100000_fleet_docs_locations_gps` / documented in FLEET.md | Medium |
| `docs/AUDIT.md` §1 routes | Lists `/finance-erp`, `/automation`, etc. as live ERP pages | Several routes serve `ComingSoon`; launch gating changed | **High** |
| `docs/AUDIT.md` §3.5 Login | Fake 1.1s login; prototype quick-nav | Real `/auth/login` wired (AUTH.md) | Medium |
| `docs/AUDIT.md` §7 bugs | `setError` crash; OpsDepartments `<X>` import | PROJECT_AUDIT notes these appear fixed | Medium |
| `docs/AUTOMATION.md` | “Groups CRUD + OCR are still pending from Phase 5” | Groups + OCR modules exist and emit events | **High** |
| `docs/AUTOMATION.md` | SEND_NOTIFICATION “channel send still stubbed → PENDING, lands with Notification Engine” | Phase 11 `NOTIFICATIONS.md` delivered real channels (stub only when env blank) | **High** |
| `docs/AUTOMATION.md` | Full suite **86 tests** | Later docs claim 93 → 102 → 178 | Low (historical) |
| `docs/FLEET.md` | “When BullMQ lands in Phase 10 the scan moves onto the queue” | Phase 10 AUTOMATION already has BullMQ expiry escalation; in-process `@Cron` also remains | Medium |
| `docs/AUTH.md` | “Replace with e-mail delivery when the notification engine lands” | Notification engine exists | Medium |
| `docs/AUTH.md` | “20 integration tests” / suite total **44** | Suite grew; CI cites ~178 | Low |
| `docs/HARDENING.md` | Group+OCR e2e “remain stubbed pending Phase-5” | Modules landed; OCR still lacks dedicated e2e | Medium |
| `docs/HARDENING.md` §6 | `git grep` found **no** VPS IP in tracked source | `RUNBOOK.md`, `docs/CICD.md`, `docs/AUTOMATION.md` contain `187.77.144.38` | Medium |
| `docs/CICD.md` | “project has no remote yet” / create GitHub repo | Verify live remotes; claim may be stale or still true depending on clone | Medium |
| `docs/CICD.md` | “Rollback (Phase 20 will formalize)” | `RUNBOOK.md` already formalizes rollback | Medium |
| `docs/STORAGE.md` | “Production MinIO is provisioned on the VPS in Phase 17” | Prod compose includes MinIO; VPS ops assume it | Medium |
| `docs/STORAGE.md` | Windows paths `C:\Users\DBL\minio\...` | Linux VPS production path differs | Low (dev-era note) |
| `infra/README.md` | “put TLS in front (Phase 17)” as follow-up | `infra/nginx/tubaalhijaz.com.conf` already documents TLS/Cloudflare | Low–Medium |
| `apps/web/README.md` | `npm i` / `npm run dev` for Design System Setup | Monorepo uses **pnpm** workspace scripts | **High** (misleading) |
| `apps/web/guidelines/Guidelines.md` | Placeholder “Add your own guidelines” | Never filled; not project design system | Medium (unused) |
| Phase docs test totals | 20 / 44 / 58 / 67 / 86 / 93 / 102 / 178 | Each was true at phase close; none is a stable SoT | Low |

### Still accurate enough (do not archive)

- `docs/FINANCE.md`, `docs/OPS.md`, `docs/DASHBOARDS.md`, `docs/NOTIFICATIONS.md` — endpoint narratives largely match code (`OPS.md` includes S1-03 WS auth)  
- `RUNBOOK.md` ops procedures — primary live ops doc  
- `docs/PROJECT_AUDIT.md`, `CODE_AUDIT.md`, `GAP_ANALYSIS.md`, `FEATURE_STATUS_MATRIX.md`, `PRODUCT_MASTER_SPEC.md` — **reconciled S1-07** for Sprint 1 security/UI items  

### Sprint 1 reconciliation notes (S1-07)

| Topic | Pre-Sprint claim | Post-Sprint SoT |
|---|---|---|
| OCR review perms | Ungated / Frontend 🔴 | `REVIEW_OCR_QUEUE` on review routes; FE OCRCenter UX gated |
| Upload confirm | Public IDOR | confirmToken + ownership (S1-02) |
| `/ops` WebSocket | Open / Permissions 🔴 | JWT + `VIEW_DASHBOARD`; reject tenant JWTs |
| `/metrics` | Public scrape risk | nginx deny `/api/metrics`; scrape `api:3210` |
| Frontend RBAC | Missing | UX gates in `lib/rbac.ts` (API remains SoT) |
| Documents Vault | ComingSoon / dead map | `DocumentsVaultScreen` live in AgentPortal |
| Launch policy | Misleading routes comment | Narrow-honest comment in `routes.tsx`; Finance/Automation still ComingSoon |

Residual high-severity rows in §2 (SCHEMA roles/migrations, AUTOMATION OCR/notify, AUDIT route inventory, HARDENING IP, web README npm) remain open under backlog **S1-08**.

---

## 3. Missing documentation

| Gap | Why it matters | Suggested artifact |
|---|---|---|
| **Root `README.md`** | New engineers have no entrypoint; only RUNBOOK + phase docs | Root README pointing to MASTER index + quickstart |
| **`CHANGELOG*`** | No release/history trail for prod tags | `CHANGELOG.md` or release notes per IMAGE_TAG |
| ~~**`docs/OCR.md`**~~ | ~~Missing~~ | **Exists** — permission/review SoT (extend with providers/queue detail as needed) |
| **`docs/API.md` or OpenAPI** | API knowledge scattered across 8 phase files | Aggregated reference or generated OpenAPI |
| **`docs/GROUPS.md` / passengers** | Groups landed after AUTOMATION’s “pending” note; no phase doc | Groups + passenger + bulk import doc |
| **Frontend architecture doc** | Figma vendor model only in RUNBOOK §6; no SPA structure guide | `docs/FRONTEND.md` (routing, auth client, i18n debt) |
| **`prompts/` / `planning/`** | Referenced in handoff expectations; folders do not exist | Create if process needs them, or document absence in README |
| **Owner / RACI** | No document names owners | Add Owner field to MASTER index stewardship |
| **Environment matrix** | Prod vs staging vs CI env differences spread across files | Single `docs/ENVIRONMENTS.md` |
| **Threat model / security runbook** | HARDENING is a phase note; PROJECT_AUDIT lists issues; no remediation tracker | Security backlog doc |
| **Mobile / driver API** | AUDIT §3.20 defines surface; no backend doc; ComingSoon UI | Defer until Phase 2 mobile |
| **Enquiry / public marketing API** | AUDIT implies `POST /enquiries`; unimplemented | Document as deferred or implement |
| **apps/api README** | API package has no local README | Short package README with e2e/run commands |
| **packages/shared README** | Shared contract undocumented for consumers | README listing exports + i18n rules |
| **ESLint / code-style guide** | CICD notes no ESLint | Optional CONTRIBUTING.md |

---

## 4. Broken references

| Source | Reference | Problem |
|---|---|---|
| `docs/CICD.md` | “Rollback (Phase 20 will formalize)” | Phase 20 doc does not exist; procedure lives in `RUNBOOK.md` |
| `docs/CICD.md` / `RUNBOOK.md` §6.0 | “repo has never been pushed” / create remote | May be false on this host; no verification artifact in docs |
| `docs/AUTOMATION.md` | “Groups CRUD + OCR … pending from Phase 5” | Phase 5 doc does not exist; modules exist in code |
| `docs/AUTH.md` | “when the notification engine lands” | Points to future that already shipped (`NOTIFICATIONS.md`) |
| `docs/FLEET.md` | “When BullMQ lands in Phase 10” | Phase 10 already landed; cross-ref should be past tense |
| `docs/STORAGE.md` | “Production MinIO … Phase 17” | Phase 17 doc missing; MinIO already in prod compose |
| `infra/README.md` | “TLS in front (Phase 17)” | Same; nginx TLS conf already in repo |
| `docs/HARDENING.md` | “see the run report” for test totals | No linked run report file in repo |
| `docs/AUDIT.md` | Implied APIs: `/auth/forgot-password`, `/agent-applications`, `/ocr/jobs`, `/public/stats` | Not implemented under those paths (or at all) |
| `docs/AUDIT.md` | Entity names `WalletLedgerEntry`, `OCRJob`, `TopUp`, `Arrival` | Final schema uses different names (`WalletTransaction`, `OcrDocument`, etc.) |
| `apps/web/README.md` | Figma Make standalone project instructions | Does not describe monorepo; `npm` vs `pnpm` |
| `apps/web/guidelines/Guidelines.md` | HTML comment template only | No real guidelines to follow |
| `RUNBOOK.md` | `docs/CICD.md` + `VITE_API_URL_STAGING` variable | Staging var mentioned; ensure it exists in GitHub — not documented in CICD.md table (CICD lists only `VITE_API_URL`) |
| `docs/NOTIFICATIONS.md` | Frontend AutomationNotifications screens | Route currently ComingSoon — doc implies reachable admin UI |
| `docs/FINANCE.md` | “Wires FinanceERP.tsx” | Staff FinanceERP route is ComingSoon |
| `docs/SCHEMA.md` | Permissions “exact 10 keys” | Implementation has **11** (includes `MANAGE_FLEET`) |

### Cross-links that work

| From | To | OK? |
|---|---|---|
| `RUNBOOK.md` → `docs/CICD.md` | Secrets list | Yes (content may lag) |
| `infra/.env.example` → `docs/NOTIFICATIONS.md` | Stub mode | Yes |
| `.github/workflows/ci-cd.yml` → `docs/CICD.md` | Required secrets | Yes |
| `docs/PROJECT_AUDIT.md` → other docs | Related reading | Yes |

---

## 5. Documentation that should be archived

“Archive” means move to e.g. `docs/archive/` or mark a clear **Historical** banner — **not done in this pass**.

| Document | Archive recommendation | Keep for |
|---|---|---|
| `docs/AUDIT.md` | **Archive as design archaeology** after extracting still-unique business rules (SLAs, VAT, 19 stages, passport 6-month rule) into a living `docs/PRODUCT_RULES.md` | UI field inventory, original bugs list |
| `apps/web/README.md` | **Replace or archive**; current text is a Figma Make stub that misleads | Figma file URL (move into ATTRIBUTIONS or FRONTEND.md) |
| `apps/web/guidelines/Guidelines.md` | **Archive or delete** if unused; empty template adds noise | Nothing today |
| Phase test-count footers (all phase docs) | Do not archive whole files; **stamp “test count historical as of Phase N”** | Endpoint tables remain valuable |
| `docs/SCHEMA.md` role/migration header | Do not archive whole file; **rewrite header** or supersede with generated ER | ER diagrams for humans |

### Do **not** archive

| Document | Reason |
|---|---|
| `RUNBOOK.md` | Live ops dependency |
| `docs/PROJECT_AUDIT.md` | Current system snapshot |
| `docs/FINANCE.md`, `OPS.md`, `NOTIFICATIONS.md`, `DASHBOARDS.md`, `AUTH.md` (core sections) | Active API references |
| `infra/README.md` + compose/nginx | Deployment SoT companions |
| `docs/HARDENING.md` | Security control inventory (update claims, don’t bury) |
| `docs/CICD.md` | Secrets checklist still needed |
| `docs/MASTER_DOCUMENT_INDEX.md` / this file | Navigation & conflict tracking |

---

## 6. Conflict matrix (factual contradictions)

| # | Claim A | Claim B | Resolution |
|---|---|---|---|
| 1 | SCHEMA: migration not applied | RUNBOOK/infra: migrate on boot in prod | Prefer **ops/code** |
| 2 | SCHEMA roles CEO/OPS_MANAGER… | AUTH/seed SUPER_ADMIN/OPS_STAFF… | Prefer **AUTH + seed + Prisma** |
| 3 | AUTOMATION: OCR/Groups pending | Code + PROJECT_AUDIT: modules exist | Prefer **code** |
| 4 | AUTOMATION: notify still stubbed | NOTIFICATIONS: real WA/SMTP/in-app | Prefer **NOTIFICATIONS** |
| 5 | FLEET: expiry not on BullMQ yet | AUTOMATION: BullMQ expiry sweep exists | Prefer **code** (both mechanisms present) |
| 6 | HARDENING: no VPS IP in repo | RUNBOOK/CICD/AUTOMATION embed IP | Prefer **HARDENING is wrong** |
| 7 | CICD: rollback not formalized | RUNBOOK §2/§6.5 formalizes rollback | Prefer **RUNBOOK** |
| 8 | AUDIT: finance/automation are ERP routes | `routes.tsx`: ComingSoon for those paths | Prefer **`routes.tsx`** |
| 9 | FINANCE/NOTIFICATIONS docs: UIs wired | Launch routes block FinanceERP & AutomationNotifications | Prefer **`routes.tsx`** for reachability; docs for API wiring |
| 10 | SCHEMA: 10 permissions | Seed: 11 including MANAGE_FLEET | Prefer **seed/Prisma** |
| 11 | web README: npm scripts | Root: pnpm workspace | Prefer **root package.json** |
| 12 | STORAGE/infra: Phase 17 still future for MinIO/TLS | Prod compose + nginx conf present | Prefer **infra artifacts** |

---

## 7. Recommended documentation hygiene

1. Add **Status / Last-verified / Owner** headers to every `docs/*.md`.  
2. Stamp phase docs: “Historical test count; do not treat as current CI total.”  
3. ~~Write `docs/OCR.md`~~ done; still need a root **`README.md`** linking this index.  
4. Move `docs/AUDIT.md` → `docs/archive/FRONTEND_AUDIT_PHASE1.md` after extracting product rules.  
5. Fix SCHEMA header + roles, or generate SCHEMA from Prisma (**S1-08**).  
6. Treat **`ci-cd.yml` + RUNBOOK + schema.prisma + routes.tsx`** as the four non-negotiable authorities.  
7. Add a **`CHANGELOG.md`** keyed to git SHA / `IMAGE_TAG` for production.  
8. Resolve IP/host documentation policy: either redact from git or accept HARDENING claim as obsolete (**S1-08**).  
9. Keep Sprint SoT (`PRODUCT_MASTER_SPEC`, audits, matrix, roadmap, backlog) updated at each sprint closeout.

---

*End of conflict report. Sprint SoT docs updated under S1-07; residual phase-doc fixes tracked as S1-08.*
