# TUBA AL HIJAZ — Sprint Backlog

**Date:** 2026-07-31  
**Sources (exclusive):** `PROJECT_AUDIT.md`, `MASTER_DOCUMENT_INDEX.md`, `DOCUMENT_CONFLICTS.md`, `CODE_AUDIT.md`, `GAP_ANALYSIS.md`  
**Plan detail:** [`IMPLEMENTATION_ROADMAP.md`](./IMPLEMENTATION_ROADMAP.md)  

**Constraint:** Backlog only. No application code changes. No new requirements beyond the source audits.

### Status values for backlog items

| Status | Meaning |
|---|---|
| `Todo` | Not started |
| `Blocked` | Waiting on dependency |
| `Ready` | Unblocked; may already be covered by prior ticket |
| `Done` | Completed |

### Priority

P0 Critical Security · P1 Production Readiness · P2 Business Features · P3 UX Improvements · P4 Future Enhancements

---

## Sprint 1 — Critical security & launch honesty

**Goal:** Secure OCR/uploads/exposure; honest agent launch; doc drift fix.  
**Exit (from PROJECT_AUDIT / GAP):** OCR 403 for agents on approve; vault live; RBAC nav; metrics/ops restricted; docs corrected.

| ID | Title | Priority | Complexity | Gap | Depends on | Status |
|---|---|---|---|---|---|---|
| S1-01 | Enforce `REVIEW_OCR_QUEUE` on OCR override/approve/reject; keep agent submit if needed | P0 | S–M | G-01 | — | Done |
| S1-02 | Harden `POST /uploads/:id/confirm` (+ presign binding); abuse/size controls | P0 | M | G-02 | — | Done |
| S1-03 | Restrict or JWT-auth `/ops` WebSocket (nginx allowlist acceptable) | P0 | M | G-15 | — | Done |
| S1-04 | Restrict `/metrics` to internal/localhost or nginx auth | P0 | S | G-16 | — | Done |
| S1-05 | Frontend RBAC: ERPShell + route guards from `permissions`/role (**UX only** — do not replace API auth) | P0 | M | G-04 | — | Done |
| S1-06 | Unhide Agent Documents Vault (replace ComingSoon map) | P0 | S | G-05 | `/documents` API ✅ | Done |
| S1-07 | Documentation drift reconciliation (Sprint 1 SoT docs + `SPRINT1_COMPLETION_REPORT`) | P0 | S–M | G-18 / PA-01 | S1-01…S1-06 | Done |
| S1-08 | Fix residual phase-doc drift (SCHEMA roles/migrations, AUTOMATION OCR/notify, AUDIT routes, HARDENING IP) | P1 | M | G-18 | `DOCUMENT_CONFLICTS` | Todo |
| S1-09 | E2E: AGENT 403 on OCR approve; OPS_STAFF 200 path | P0 | S | G-01 | S1-01 | Done (covered by `ocr-rbac.e2e-spec`) |
| S1-10 | E2E: upload confirm cannot finalize foreign/orphan id | P0 | S | G-02 | S1-02 | Done (covered by `upload-confirm.e2e-spec`) |

---

## Sprint 2 — Production readiness

**Goal:** Unlock staff UIs; audit API; notify/expiry stability; OCR tests; staging verify.  
**Unblocked:** S1-05 (frontend RBAC UX) complete — safe to unhide Finance/Automation with permission gates.

| ID | Title | Priority | Complexity | Gap | Depends on | Status |
|---|---|---|---|---|---|---|
| S2-01 | Audit log read API + SuperAdmin UI (`GET /audit-logs`, filters, `ACCESS_AUDIT_LOGS`) | P1 | M | G-03 | — | Done |
| S2-02 | Secure `/notifications` WebSocket (JWT auth.token; reject anon/spoof) | P1 | M | GO-LIVE residual / NOTIFICATIONS | — | Done |
| S2-02b | Broaden audit writes: login, OCR review, uploads | P1 | M | G-03 | S2-01 | Todo |
| S2-03 | Notification pipeline consolidation & expiry scheduler cleanup (all async notify → `dispatch`/`tuba-notify`; single BullMQ 06:00 expiry) | P1 | M | G-08, G-09 | — | Done |
| S2-03b | SuperAdmin audit log UI wired to API | P1 | M | G-03 | S2-01, S1-05 | Done (covered by S2-01 UI) |
| S2-04 | Enable Finance ERP — route `/finance-erp` → FinanceERP; nav + `FINANCIAL_REPORTS` UX gate; no mock when authed | P1 | M | G-06 | S1-05 | Done |
| S2-05 | Enable Automation Admin — `/automation` → AutomationNotifications; `CONFIGURE_WORKFLOWS` UX + API gate | P1 | S–M | G-07 | S1-05 | Done |
| S2-06 | OCR end-to-end test coverage (stub provider; passport/visa/invoice; retry; reprocess; audit; tenant isolation) | P1 | M | G-10 | S1-01 | Done |
| S2-06b | Route voucher notify through `NotificationsService.dispatch` | P1 | M | G-08 | — | Done (covered by S2-03) |
| S2-07 | Route fleet expiry alerts through `dispatch` (idempotent codes) | P1 | M | G-08 | — | Done (covered by S2-03) |
| S2-08 | Deduplicate 06:00 expiry — BullMQ primary; Nest cron gated/removed | P1 | S | G-09 | — | Done (covered by S2-03) |
| S2-09 | OCR e2e (stub provider → approve → passenger) + persist process errors | P1 | M | G-10 | S1-01 | Done (covered by S2-06) |
| S2-10 | Verify staging/CI: remote, GHCR, clone, approval gate, blank staging notify env | P1 | M | G-19 | RUNBOOK §6 / CICD | Todo |
| S2-11 | Payment-slip multipart runs magic-byte `validateUpload` | P1 | S | CA-01 | — | Todo |
| S2-12 | Align notification template vars with automation `vars` / event keys | P1 | S–M | CA-02 | — | Todo |

---

## Sprint 3 — Business features

**Goal:** Leads, password reset, OCR honesty/depth, registration events.

| ID | Title | Priority | Complexity | Gap | Depends on | Status |
|---|---|---|---|---|---|---|
| S3-01 | `POST /enquiries` + wire Contact form (stable enums, throttle) | P2 | S–M | G-11 | Enquiry model ✅ | Todo |
| S3-02 | Password reset (token + email via notify SMTP) | P2 | M–L | G-12 | SMTP config | Todo |
| S3-03 | Decision: implement non-passport OCR parsers **or** passport-only UI | P2 | S | G-13 | Product | Todo |
| S3-04a | Implement priority non-passport parsers (+ optional autoAccept policy) | P2 | L–XL | G-13 | S3-03, S1-01 | Blocked |
| S3-04b | Alternative: remove/hide non-passport types from OCR UI | P2 | S–M | G-13 | S3-03 | Blocked |
| S3-05 | Emit `agent.registered` / `supplier.registered` domain events | P2 | S | CA-03 | — | Todo |
| S3-06 | Wire Login forgot-password affordance to S3-02 | P2 | S | G-12 | S3-02 | Blocked |

---

## Sprint 4 — UX improvements & hygiene

**Goal:** Import at scale, AgentPortal i18n, debt/ops hygiene.

| ID | Title | Priority | Complexity | Gap | Depends on | Status |
|---|---|---|---|---|---|---|
| S4-01 | Safe CSV/Excel passenger import (not abandoned npm xlsx) | P3 | L | G-14 | S1-02, bulk passengers ✅ | Todo |
| S4-02 | AgentPortal critical-path bn/en via `@tuba/shared` `t()` | P3 | L | G-17 | shared i18n ✅ | Todo |
| S4-03 | Remove unused `react-dnd`; scrub dead mocks on auth-guarded pages | P3 | S | PA-02 | — | Todo |
| S4-04 | VPS disk cleanup + verify or document `OFFSITE_*` backups | P3 | S–M | PA-03 | infra backup.sh | Todo |
| S4-05 | Wire Agent group detail ComingSoon tabs to existing service APIs | P2/P3 | M–L | GAP §2.3 | services ✅ | Todo |
| S4-06 | Hotel catalogue admin CRUD (beyond read-only `GET /hotels`) | P3 | M–L | GAP §2.3 | Hotel model ✅ | Todo |
| S4-07 | Archive/replace misleading `apps/web/README.md` npm stub | P3 | S | DOC conflicts | — | Todo |

---

## Backlog — P4 future enhancements

Do not pull into a sprint until P0–P1 exit criteria are met (`IMPLEMENTATION_ROADMAP`).

| ID | Title | Priority | Complexity | Gap | Status |
|---|---|---|---|---|---|
| B-01 | Hardware GPS webhook (`LocationSource.DEVICE`) + device auth | P4 | XL | G-20 | Todo |
| B-02 | Driver / Agent / Ops mobile apps | P4 | XL | G-20 | Todo |
| B-03 | NUSUK / MOFA / ZATCA live integrations | P4 | XL | G-21 | Todo |
| B-04 | CRM / HR / Procurement desk backends + UI | P4 | XL | G-22 | Todo |
| B-05 | API key authentication for `API_KEY_ACCESS` | P4 | L | GAP §2.2 | Todo |
| B-06 | ClamAV / real virus scan (`scanBuffer`) | P4 | L | GAP §2.7 | Todo |
| B-07 | Workflow stage transition API + WorkflowMap live route | P4 | L | GAP §2.3 | Todo |
| B-08 | Horizontal API scale / managed Postgres (RUNBOOK §5) | P4 | XL | PROJECT_AUDIT out-of-scope | Todo |
| B-09 | Full staff ERP Bengali i18n | P4 | XL | G-17 remainder | Todo |
| B-10 | DesignSystem / I18nSystem / Tablet routes (product decision) | P4 | M | GAP §2.13 | Todo |
| B-11 | Root README + `docs/OCR.md` + CHANGELOG (missing docs from MASTER index) | P3/P4 | M | MASTER_DOCUMENT_INDEX | Todo |
| B-12 | Emit/consume rules for `group.completed`, OCR completed, `agent.rejected` as needed | P2/P4 | M | CODE_AUDIT events | Todo |

---

## Priority board (all open work)

### P0 — Critical security
- ~~S1-01…S1-07, S1-09, S1-10~~ **Done** (see `SPRINT1_COMPLETION_REPORT.md`)  

### P1 — Production readiness
- S1-08 (residual phase-doc drift)  
- S2-01 … S2-12  

### P2 — Business features
- S3-01 … S3-06  
- S4-05 (tabs)  
- B-12 (optional event rules)  

### P3 — UX improvements
- S4-01 … S4-04, S4-06, S4-07  
- B-11 (docs hygiene)  

### P4 — Future
- B-01 … B-10  

---

## Suggested assignment order (Sprint 1)

Parallelizable tracks from audits:

| Track | Items | Owner hint |
|---|---|---|
| A — API security | S1-01, S1-02, S1-09, S1-10 | Backend |
| B — Edge exposure | S1-03, S1-04 | Backend + Platform |
| C — Frontend honesty | S1-05, S1-06, S1-07 | Frontend |
| D — Docs | S1-08 | Anyone |

---

## Definition of Done (every backlog item)

From acceptance patterns in `PROJECT_AUDIT.md` §10 and `GAP_ANALYSIS.md`:

1. Implements only scope listed in the linked Gap/CA/PA ID  
2. Permissions enforced where a permission key already exists in seed  
3. E2E or ops verification noted in the item  
4. Docs updated if behavior changes (per `DOCUMENT_CONFLICTS` / MASTER authority)  
5. Rollback path understood (`RUNBOOK` image tag / feature gate)  
6. No secrets committed; staging notify env stays blank when touching notify  

---

## Counts

| Bucket | Items |
|---|---|
| Sprint 1 | 10 |
| Sprint 2 | 12 |
| Sprint 3 | 7 (incl. 03 decision + 04a/04b alternatives) |
| Sprint 4 | 7 |
| Backlog P4+ | 12 |
| **Total** | **~48** |

---

*End of sprint backlog. Implementation not started. No application code modified.*
