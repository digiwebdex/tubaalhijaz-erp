# UAT Master Plan — TUBA AL HIJAZ ERP

**Program:** Enterprise Stabilization **ESP-05**  
**Type:** User Acceptance Testing package (documentation only)  
**Date:** 2026-08-02  
**Code freeze:** Observed — **no** database, API, frontend, RBAC, workflow, automation, finance, visa, Long Stay, notification, or OCR changes in this sprint  

**Business authority:** [`business/TUBA_BUSINESS_OPERATION_MAP.md`](../../business/TUBA_BUSINESS_OPERATION_MAP.md)  
**Technical authority:** `docs/releases/TRANSFORM_*`, `docs/T001_*` / `docs/T002_*` completion reports, `docs/ui/UI_12_CERTIFICATION.md`, `docs/stabilization/ESP_0*`  

Companion package:

| Document | Purpose |
|----------|---------|
| [`UAT_TEST_CASES.md`](./UAT_TEST_CASES.md) | Executable scenarios with Result fields |
| [`UAT_EXECUTION_CHECKLIST.md`](./UAT_EXECUTION_CHECKLIST.md) | Run-day tracker |
| [`UAT_BUG_REGISTER.md`](./UAT_BUG_REGISTER.md) | Defect log (Critical→Low) |
| [`UAT_SIGNOFF.md`](./UAT_SIGNOFF.md) | Department + MD signatures |
| [`GO_LIVE_READINESS.md`](./GO_LIVE_READINESS.md) | Go / No-Go criteria |

---

## 1. Purpose

Validate that **real business roles** can complete **implemented** ERP journeys on a staging or production-smoke environment — without inventing features, redesigning UI, or changing architecture.

This UAT package turns prior **technical** acceptance (TRANSFORM-001/002, ESP-01…04) into **human business** acceptance.

---

## 2. Scope

### In scope (implemented)

| Domain | Evidence (do not invent beyond these) |
|--------|----------------------------------------|
| Auth / portals | Login portal tabs, JWT + refresh, logout — T001/auth e2e, ESP-04 |
| Agent Groups / Passengers | Create group (Nusuk spine), add/bulk passengers — T001-01…04, UI-05 |
| Mutamer Excel import | Preview/commit — T001-05 |
| Passport OCR intake | Upload → OCR submit → staff review/approve — T001-06 (Group List OCR flag-gated T001-07) |
| Readiness gates | `gateVisa` / `gatePackage` / `gatePayment` / `gateBill` — T001-02, Ops Group Master T001-09 |
| Visa Desk + pipeline | Staff transitions NEW→…→COMPLETED / REJECTED — T002-02…05 |
| MOFA completeness + optional MOFA bill | T002-06 (bill **feature-flagged**) |
| Long Stay host + Day-85 | T002-07 / T002-08 |
| Agent payment | Wallet, payment slips, statement — agent-finance APIs |
| Staff Finance desks | Invoices, receipts, vouchers, AR/AP, cash (primary Finance ERP) — S2-04 / UI-09 |
| CEO / executive | Dashboards Ops Today, Executive/Reports, Visa & Compliance — T002-09 / UI-03 / UI-08 |
| RBAC / tenancy | Agent cannot open staff desks; cross-tenant 404 — ESP-04 / rbac e2e |

### Explicitly out of scope for this UAT

| Item | Reason |
|------|--------|
| Live MOFA / Nusuk / Absher government API | Not implemented (staff/Umrah Co updates only) |
| Forgot / reset password | Not implemented |
| Invented hotel/transport/catering end-to-end “happy path” redesign | Partial / separate supplier desks — only cover if already in seeded demo path |
| Fleet / Super Admin deep CRUD / Automation rule authoring | Stabilization migrated chrome; not TRANSFORM smoke target |
| Feature development, bug fixes, UI redesign | ESP-05 rule |
| Claiming 100% Enterprise Kit on every screen | UI-12 conditional pass |

### Feature flags testers must record

| Flag | Default (typical) | Affects |
|------|-------------------|---------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | off | Group-list OCR path |
| `VISA_REQUIRE_PASSPORT_RETURN` | off | ISSUED → COMPLETED vs PASSPORT_RETURNED |
| `ENABLE_MOFA_PROCESSING_BILL` | off | MOFA bill finance desk |
| `REQUIRE_HAJI_WHATSAPP` | off | Group create WhatsApp required |
| `REFRESH_COOKIE_PATH` | `/api/auth` behind nginx | Session refresh after access JWT expiry (ESP-04) |

---

## 3. Roles & demo accounts (seed)

Password for all seeded users (non-prod / known demo): `Demo@123` — **change or restrict on shared smoke hosts**.

| Role | Email (seed) | Portal / entry |
|------|--------------|----------------|
| Agent | `ahmad@rashidi-travel.com` | `/login` → Agent → `/agent-portal` |
| Ops / Visa staff | `ops@tubalhijaz.com` | Admin portal → Ops / Visa / OCR |
| Finance | `finance@tubalhijaz.com` | `/finance-erp` |
| CEO Viewer | `chairman@tubalhijaz.com` | `/dashboards` |
| Super Admin | `ceo@tubalhijaz.com` | Full staff (use sparingly in UAT) |

Second agent for isolation checks: `office@alnoor-pilgrim.com`.

---

## 4. Environment prerequisites

1. API + Web healthy; HTTPS if production-smoke.  
2. Postgres migrated through Long Stay / Day-85 migrations.  
3. Workers listening: automation, notify, OCR.  
4. Seed or agreed UAT dataset (at least one agent company, verified Umrah Co if testing visa master).  
5. WhatsApp/email: **skip-safe** OK — document channel result (sent / skipped).  
6. ESP-04 cookie path applied if testing behind `/api` (re-login after deploy).

---

## 5. Execution model

| Phase | Activity | Owner |
|-------|----------|-------|
| P0 | Environment dry-run + account access | IT |
| P1 | Agent journey (UAT-AGT-*) | Agent ops lead + IT support |
| P2 | Operations / gates / OCR / import (UAT-OPS-*) | Operations Manager |
| P3 | Visa Desk pipeline (UAT-VIS-*) | Visa Manager |
| P4 | Long Stay + Day-85 (UAT-LS-*) | Operations / Visa |
| P5 | Finance desks (UAT-FIN-*) | Finance Manager |
| P6 | CEO dashboards (UAT-CEO-*) | Managing Director / CEO Viewer |
| P7 | Bug triage + retest | IT + department leads |
| P8 | Sign-off + Go-Live readiness | All signatories |

**Severity → Go-Live (see [`GO_LIVE_READINESS.md`](./GO_LIVE_READINESS.md)):**

- **Critical / High:** must be **0** open to GO  
- **Medium:** may be accepted with owner + date  
- **Low:** documented in bug register  

---

## 6. Mapping to Business Operation Map

| Operation Map stage | UAT coverage |
|---------------------|--------------|
| Agent | UAT-AGT-* |
| Passport / OCR / Group intake | UAT-AGT + UAT-OPS OCR/import |
| Group + readiness gates | UAT-OPS gates |
| Visa | UAT-VIS-* |
| Long Stay / day-85 | UAT-LS-* |
| Finance settlement (agent credit + staff desks) | UAT-AGT payment + UAT-FIN-* |
| Reports | UAT-CEO-* |
| Hotel / Transport / Catering / Voucher field ops | **Partial** — only if already reachable in demo; not expanded here |

---

## 7. Final report (ESP-05)

1. **Scope** — §2  
2. **UAT coverage** — test case IDs in [`UAT_TEST_CASES.md`](./UAT_TEST_CASES.md)  
3. **Departments** — Agent, Operations, Visa, Finance, CEO/MD, IT  
4. **Business scenarios** — §6 + test suites  
5. **Deliverables** — six files under `docs/uat/`  
6. **Open risks** — flags, thin prod data, WA skip-safe, UI-12 legacy modules, ESP-04 deploy  
7. **Go-Live criteria** — [`GO_LIVE_READINESS.md`](./GO_LIVE_READINESS.md)  
8. **Recommendations** — complete human sign-off; run Day-85 with controlled entry dates; keep MOFA bill / passport-return flags explicit; do not start Transformation-003 until business sign-off  

---

## 8. Stop conditions

ESP-05 **stops** at documentation.  
No implementation, no bug fixing, no new features, no UI changes in this sprint.
