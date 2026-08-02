# TUBA AL HIJAZ — Implementation Roadmap

**Date:** 2026-07-31  
**Sources (exclusive):**  
`PROJECT_AUDIT.md` · `MASTER_DOCUMENT_INDEX.md` · `DOCUMENT_CONFLICTS.md` · `CODE_AUDIT.md` · `GAP_ANALYSIS.md`  

**Constraint:** No new requirements invented. No application code changed in this phase.

### Priority bands

| Band | Meaning |
|---|---|
| **P0** | Critical security — block or harden before calling launch “secure” |
| **P1** | Production readiness — staff tools, compliance, deploy reliability |
| **P2** | Business features — leads, password reset, OCR depth, notify quality |
| **P3** | UX / hygiene — i18n, debt cleanup, ops disk/backup |
| **P4** | Future enhancements — mobile, GPS hardware, ministry integrations, CRM/HR |

### Complexity scale (from GAP_ANALYSIS)

| Code | Meaning |
|---|---|
| **S** | ≤ 1 day |
| **M** | 1–3 days |
| **L** | 3–7 days |
| **XL** | 1–2+ weeks |

### Gap ID index

Work items reference `GAP_ANALYSIS.md` **G-01…G-22**. Additional items already listed in `PROJECT_AUDIT.md` §10 / `CODE_AUDIT.md` Part C are tagged **PA-** / **CA-** when they refine a gap without inventing scope.

---

## Roadmap overview

```
Sprint 1 (P0)     Secure the platform + honest agent launch
Sprint 2 (P1)     Unlock staff tools + compliance + staging
Sprint 3 (P2)     Business completeness (leads, reset, OCR depth)
Sprint 4 (P3/P2)  UX, import, hygiene
Backlog (P4)      Mobile / GPS / NUSUK-MOFA-ZATCA / CRM-HR
```

| Sprint | Theme | Band | Duration (indicative) | Complexity |
|---|---|---|---|---|
| 1 | Critical security & launch honesty | P0 (+ P1 quick wins) | ~1 week | M–L |
| 2 | Production readiness | P1 | ~1 week | L |
| 3 | Business features | P2 | 1–2 weeks | L–XL |
| 4 | UX & scale-up features | P3 (+ remaining P2) | 1–2 weeks | L–XL |
| Backlog | Future enhancements | P4 | Unscheduled | XL |

---

## Sprint 1 — Critical security & launch honesty

### Objective
Close P0 security holes and restore honest agent-facing launch integrity so passport OCR, uploads, ops sockets, and navigation cannot be abused or misrepresented.

### Business value
- Protect pilgrim PII (passport OCR approve path)
- Reduce storage abuse / registration file hijack risk
- Stop agents seeing staff modules they cannot use
- Deliver already-built Documents Vault to agents
- Align ops/docs with reality (fewer wrong decisions)

### Technical scope
| ID | Work | Band | Complexity |
|---|---|---|---|
| G-01 | ✅ Gate OCR review with `REVIEW_OCR_QUEUE` (split submit vs approve) — **S1-01 done** | P0 | S–M |
| G-02 | ✅ Harden public upload confirm/presign (confirmToken + ownership) — **S1-02 done** | P0 | M |
| G-15 | ✅ Authenticate `/ops` WebSocket (JWT + VIEW_DASHBOARD) — **S1-03 done** | P0 | M |
| G-16 | ✅ Restrict `/metrics` (nginx deny `/api/metrics`; scrape via docker-net) — **S1-04 done** | P0 | S |
| G-04 | ✅ Frontend RBAC UX — hide modules + route guards from `permissions` — **S1-05 done** | P0/P1 | M |
| G-05 | ✅ Unhide Agent Documents Vault (`ComingSoon` → `DocumentsVaultScreen`) — **S1-06 done** | P0/P1 | S |
| PA-01 | ✅ Launch policy documented — `routes.tsx` narrow-honest comment + SoT docs (S1-07) | P0 | S |
| G-18 | 🟡 Sprint SoT reconciled (**S1-07**); residual SCHEMA/AUTOMATION/AUDIT/HARDENING phase drift → **S1-08** | P1 docs | M |

**Out of scope (explicit):** hardware GPS, mobile apps, NUSUK/MOFA/ZATCA, Excel import, full ERP i18n, horizontal scale (`PROJECT_AUDIT` §10).

### Dependencies
- Existing seed permission `REVIEW_OCR_QUEUE` (already assigned to OPS_STAFF)
- `/documents` API already complete
- `ApiUser.permissions[]` already returned by auth client
- Nginx + compose bind addresses for metrics/ops exposure
- Doc authority hierarchy in `MASTER_DOCUMENT_INDEX.md`

### Risks
| Risk | Mitigation |
|---|---|
| OCR gate breaks agent passport intake | Allow AGENT submit; require REVIEW only for override/approve/reject |
| Upload token change breaks registration wizard | Keep public multipart path; harden confirm/presign first; e2e registration pipeline |
| Frontend RBAC hides modules staff need | Map permissions from seed matrix; SuperAdmin sees all |
| Ops wall displays break if JWT required | Prefer nginx IP allowlist for wall hosts if JWT not acceptable |

### Deliverables
1. ✅ OCR approve/reject/override return 403 without `REVIEW_OCR_QUEUE`  
2. ✅ Upload confirm not freely IDOR-able  
3. ✅ ERPShell module list filtered by role/permissions  
4. ✅ Agent Documents Vault reachable and working  
5. ✅ `/metrics` and `/ops` socket not world-readable  
6. ✅ Sprint SoT docs reconciled (`SPRINT1_COMPLETION_REPORT.md`); residual phase-doc rows → S1-08  
7. ✅ `routes.tsx` launch comment matches narrow-honest policy  

### Acceptance criteria
1. ✅ E2E: AGENT cannot `POST /ocr/documents/:id/approve` (403); OPS_STAFF can.  
2. ✅ E2E: unauthenticated confirm of another user’s upload id fails.  
3. ✅ Logged-in AGENT does not see Finance/Fleet/Ops modules in shell (or sees only permitted).  
4. ✅ Agent opens Documents Vault, lists/uploads via `/documents`.  
5. ✅ Metrics not scrapeable from public internet path (`/api/metrics` → 404).  
6. 🟡 Sprint planning/audit SoT current; SCHEMA/AUTOMATION high-severity claims still tracked under **S1-08**.  

### Sprint 1 status
**Complete for implementation + SoT reconciliation** (S1-01…S1-07, S1-09, S1-10). Remaining doc ticket: **S1-08** (phase-doc deep fix). Redeploy API/web images on live for code tickets; nginx metrics deny already on host. Details: `docs/SPRINT1_COMPLETION_REPORT.md`.

### Rollback considerations
- Feature flags / env for OCR permission enforcement if emergency reopen needed  
- Image/tag rollback via `RUNBOOK.md` §2 (`IMAGE_TAG=<sha>`) — schema-forward only  
- Doc-only changes: revert markdown commits independently  
- Upload confirm: keep backward-compatible multipart `/uploads` if presign flow regresses  

### Estimated complexity
**M–L** (~1 week for 1–2 engineers). Highest risk items: G-02, G-15.

---

## Sprint 2 — Production readiness

### Objective
Unlock already-built staff surfaces safely, close compliance (audit), stabilize async jobs (notify/expiry), add OCR regression tests, and verify staging/CI per RUNBOOK.

### Business value
- Finance and automation operators work in UI instead of API/DB  
- Compliance can query audit trails  
- Agents receive consistent in-app/email notifications for vouchers  
- CI catches OCR regressions  
- Safe Figma/design promotion path via staging  

### Technical scope
| ID | Work | Band | Complexity |
|---|---|---|---|
| G-03 | ✅ Read API + SuperAdmin UI (`GET /audit-logs`, `ACCESS_AUDIT_LOGS`) — **S2-01 done**; broaden writes still **S2-02b** | P1 | M–L |
| — | ✅ Secure `/notifications` WebSocket (JWT `auth.token`, rooms from JWT) — **S2-02 done** | P1 | M |
| G-06 | ✅ Unhide FinanceERP for finance roles (`/finance-erp` → FinanceERP; UX `FINANCIAL_REPORTS`) — **S2-04 done** | P1 | M |
| G-07 | ✅ Unhide AutomationNotifications at `/automation` (`CONFIGURE_WORKFLOWS`) — **S2-05 done** | P1 | S–M |
| G-08 | ✅ Unify voucher + fleet expiry (+ supplier reject) through `NotificationsService.dispatch` — **S2-03 done** | P1 | M |
| G-09 | ✅ Deduplicate 06:00 expiry (BullMQ `expiry-escalation` only; Nest `@Cron` removed) — **S2-03 done** | P1 | S |
| G-10 | ✅ OCR e2e + failure surface (error stored; re-queue) — **S2-06 done** | P1 | M |
| G-19 | Verify GitHub remote, GHCR, staging clone, approval gate, staging WASENDER/SMTP blank | P1 | M (ops) |
| CA-01 | Payment-slip upload runs magic-byte `validateUpload` (`CODE_AUDIT`) | P1/P2 | S |
| CA-02 | Fix template var / event-key mismatches for seeded rules (`CODE_AUDIT`) | P1/P2 | S–M |

**Depends on Sprint 1:** G-04 (RBAC) before exposing Finance/Automation UIs.

### Dependencies
- Sprint 1 frontend RBAC  
- Finance / automation / notifications APIs already ✅  
- Redis + e2e harness for OCR tests  
- RUNBOOK §6.0 / `docs/CICD.md` for staging checklist  

### Risks
| Risk | Mitigation |
|---|---|
| FinanceERP still shows mock data when logged in | Enforce `isLoggedIn()` empty/error states; no mock for authed |
| Audit API exposes cross-tenant data | Staff-only + permission; never tenant-scoped leak of other companies’ PII beyond staff role |
| Notify unify double-sends | Idempotent codes on NotificationLog (pattern already used in fleet expiry) |
| Staging misconfig sends WhatsApp | Verify blank keys; RUNBOOK safety table |

### Deliverables
1. ✅ SuperAdmin audit log viewer backed by API (S2-01)  
1b. ✅ `/notifications` WebSocket JWT-auth (S2-02)  
2. ✅ `/finance-erp` live for `FINANCIAL_REPORTS` (S2-04); ✅ `/automation` live for `CONFIGURE_WORKFLOWS` (S2-05)  


3. ✅ Voucher/expiry/reject notifications go through worker (S2-03)  
4. ✅ Single expiry schedule (S2-03)  
5. ✅ OCR e2e in CI (S2-06)  
6. Staging verification checklist signed off  
7. Payment slips content-validated  

### Acceptance criteria
1. User with `ACCESS_AUDIT_LOGS` can list recent finance approve/pay events.  
2. ✅ `FINANCE_STAFF` reaches FinanceERP live data; AGENT redirected (S2-04).  
3. ✅ `CONFIGURE_WORKFLOWS` reaches automation UI; AGENT cannot (S2-05).  
4. Accept hotel booking → agent receives IN_APP via dispatch/worker (not orphan PENDING-only row without path).  
5. Only one expiry job creates alerts at 06:00.  
6. ✅ CI OCR e2e green; failed OCR job surfaces `validation.lastError`; `POST …/reprocess` (S2-06).  
7. Staging `.env` has blank `WASENDER_API_KEY` / `SMTP_HOST`.  

### Rollback considerations
- Re-route Finance/Automation to ComingSoon if severe UI bugs  
- Audit API additive — disable route without migration rollback  
- Notify unify: keep dual-write briefly behind flag if needed  
- Expiry: re-enable Nest cron only if BullMQ scheduler fails  

### Estimated complexity
**L** (~1 week). Critical path: G-03 + G-06 + G-08.

---

## Sprint 3 — Business features

### Objective
Close product gaps that lose leads or lock out users, and either deepen OCR beyond passports or honestly narrow the UI to passport-only.

### Business value
- Marketing contact form stops discarding leads  
- Agents/suppliers can reset passwords without ops  
- OCR product promise matches capability (or UI stops over-promising)  

### Technical scope
| ID | Work | Band | Complexity |
|---|---|---|---|
| G-11 | `POST /enquiries` + Contact form stable enums + throttle | P2 | S–M |
| G-12 | Password reset flow (token + email via notify channel) | P2 | M–L |
| G-13 | Non-passport OCR parsers and/or wire `autoAccept` **or** reduce UI to passport-only honesty | P2 | L–XL |
| CA-03 | Emit `agent.registered` / `supplier.registered` for automation rules (`CODE_AUDIT`) | P2 | S |

### Dependencies
- Enquiry model already in Prisma (`GAP_ANALYSIS`)  
- SMTP configured for reset emails (else stub/pending)  
- Sprint 1 OCR permission model before autoAccept  

### Risks
| Risk | Mitigation |
|---|---|
| Open enquiry spam | Throttle + optional captcha (noted in GAP) |
| Weak reset tokens | Single-use, short TTL, rate limit (security impact called out in G-12) |
| AutoAccept wrong passports | Keep human review default; autoAccept only high-confidence policy |

### Deliverables
1. Working contact → Enquiry persistence  
2. Forgot-password end-to-end when SMTP live  
3. OCR type scope decision implemented (parsers **or** UI honesty)  
4. Registration domain events emitted  

### Acceptance criteria
1. Contact submit creates `Enquiry` row with stable type/subject enums.  
2. Reset link invalidates after use; wrong email does not reveal account existence (standard practice implied by security impact).  
3. Either: trade-license/NID extraction demoable, **or** OCR UI only offers passport.  
4. Approving agent registration can trigger rules on `agent.registered` if enabled.  

### Rollback considerations
- Enquiry API additive  
- Password reset: disable endpoint; users fall back to admin temp password  
- OCR parsers: feature-flag per documentType  

### Estimated complexity
**L–XL** (1–2 weeks). G-13 dominates.

---

## Sprint 4 — UX improvements & remaining P2/P3

### Objective
Improve agent onboarding scale (Excel import with safe parser), ERP Bengali UX on critical paths, and operational hygiene called out in audits.

### Business value
- Large groups onboard faster  
- Bangla-default product promise starts holding in AgentPortal  
- Less disk/ops risk; cleaner frontend debt  

### Technical scope
| ID | Work | Band | Complexity |
|---|---|---|---|
| G-14 | Excel/CSV passenger import (not unmaintained npm `xlsx`) | P3/P2 | L |
| G-17 | ERP i18n pass for AgentPortal critical paths | P3 | XL (phased: critical paths first = L) |
| PA-02 | Remove unused `react-dnd`; scrub dead mocks on auth pages (`PROJECT_AUDIT`) | P3 | S |
| PA-03 | VPS disk cleanup + verify `OFFSITE_*` backup (`PROJECT_AUDIT`) | P3 | S–M (ops) |
| — | Group detail ComingSoon tabs → wire to existing service APIs (`GAP_ANALYSIS` §2.3) | P2/P3 | M–L |
| — | Hotel catalogue admin CRUD (`GAP_ANALYSIS` 🔴) | P3 | M–L |

### Dependencies
- Bulk passenger API already exists  
- `@tuba/shared` STRINGS  
- Offsite env keys in `infra/.env.example`  

### Risks
| Risk | Mitigation |
|---|---|
| Spreadsheet parse vulns | Prefer CSV + strict column map; avoid abandoned xlsx (`GAP`/`HARDENING` history) |
| i18n incomplete mid-pass | Ship AgentPortal only first; leave staff English |

### Deliverables
1. Import passengers from file with validation (passport 6-month rule from AUDIT business rules)  
2. AgentPortal critical strings via `t()`  
3. Dependency/debt cleanup  
4. Offsite backup verified or explicitly deferred in RUNBOOK  

### Acceptance criteria
1. Import 50-row CSV into a group with validation errors reported per row.  
2. Toggle bn/en updates AgentPortal Groups/Finance chrome + primary labels.  
3. `react-dnd` removed from web package if unused.  
4. Ops confirms backup artifact in offsite bucket **or** documents on-box-only policy.  

### Rollback considerations
- Import behind permission/flag  
- i18n: strings fallback to English keys  
- Offsite: leave blank env (already fail-safe)  

### Estimated complexity
**L–XL**.

---

## Backlog — Future enhancements (P4)

Do **not** schedule until P0–P1 closed. From `GAP_ANALYSIS` G-20…G-22 and `PROJECT_AUDIT` out-of-sprint list:

| ID | Item | Notes |
|---|---|---|
| G-20 | Hardware GPS (`DEVICE`) + driver mobile app | Fleet ingest shape already MVP-ready |
| G-21 | NUSUK / MOFA / ZATCA live integrations | Spec’d in AUDIT/SuperAdmin mocks only |
| G-22 | CRM / HR / Procurement desks | SCHEMA deliberate deferrals |
| — | API key authentication (`API_KEY_ACCESS`) | Permission seeded only |
| — | ClamAV / real virus scan | `scanBuffer` stub |
| — | Horizontal API scale / managed Postgres | RUNBOOK §5 plan only |
| — | WorkflowMap live + stage transition API | Spec + DB catalog only |
| — | DesignSystem / I18nSystem / Tablet / MobileApps routes | ComingSoon |
| — | Full staff ERP Bengali | After AgentPortal pass |

Each backlog item remains **⚪ Planned Only** until product prioritizes.

---

## Cross-sprint dependency graph

```
G-01 OCR perms ─────────────┐
G-02 Upload harden ─────────┤
G-04 Frontend RBAC ─────────┼──► Sprint 2 UI unhide (G-06, G-07)
G-05 Vault unhide ──────────┤
G-15 / G-16 exposure ───────┘
         │
         ▼
G-03 Audit API ──► SuperAdmin audit screen
G-08 Notify unify ──► depends on NotificationsModule (exists)
G-10 OCR e2e ──► after G-01 permission model stable
         │
         ▼
G-12 Password reset ──► SMTP (notify channel)
G-13 OCR depth ──► after G-01
G-14 Import ──► after upload harden (G-02)
```

---

## Definition of “production-ready” (from audits)

A release may be called **secure production-ready** when Sprint **1** acceptance criteria pass.  
A release may be called **operator-ready** when Sprint **1 + 2** pass (finance/automation/audit/staging).  
Sprints **3–4** improve commercial completeness and UX; they are not blockers for security readiness.

---

## Traceability

| Roadmap item | Origin |
|---|---|
| G-01…G-22 | `GAP_ANALYSIS.md` §3 |
| Sprint themes 1–4 | `GAP_ANALYSIS.md` §5 |
| PA-01 routes honesty | `PROJECT_AUDIT.md` §10 |
| PA-02 react-dnd / mocks | `PROJECT_AUDIT.md` §10 |
| PA-03 disk / OFFSITE | `PROJECT_AUDIT.md` §10 / RUNBOOK via audits |
| CA-01 payment-slip scan | `CODE_AUDIT.md` Part C |
| CA-02 template/event keys | `CODE_AUDIT.md` Part C |
| CA-03 registration events | `CODE_AUDIT.md` Part C |
| Doc cleanup list | `DOCUMENT_CONFLICTS.md` |
| Authority / missing docs | `MASTER_DOCUMENT_INDEX.md` |

---

*Companion backlog: [`SPRINT_BACKLOG.md`](./SPRINT_BACKLOG.md).*
