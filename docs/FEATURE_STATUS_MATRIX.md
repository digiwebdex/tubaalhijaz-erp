# TUBA AL HIJAZ — Feature Status Matrix (Phase 4)

**Date:** 2026-07-31  
**Companion:** [`GAP_ANALYSIS.md`](./GAP_ANALYSIS.md)  
**Constraint:** Documentation only. No code changes.

### Column legend

| Column | Meaning |
|---|---|
| Backend | Service/domain logic in Nest |
| Frontend | Reachable UI (not merely a file on disk) |
| Database | Prisma model / migration support |
| API | HTTP (or WS) surface |
| Permissions | Correct `@RequirePermissions` / role checks |
| Testing | Automated e2e (or notable unit) coverage |
| Deployment | Runnable in prod compose / CI path |
| Documentation | Accurate current docs |
| Status | One of ✅ 🟡 🔴 ⚪ ⚫ 🔵 🟣 |
| Priority | P0 / P1 / P2 / P3 / P4 (backlog) |

### Cell shorthand

| Cell | Meaning |
|---|---|
| ✅ | Present / adequate |
| 🟡 | Partial / weak |
| 🔴 | Absent / broken for purpose |
| ⚪ | N/A or not applicable |
| 🔵 | Built but not exposed |
| — | Not required for this feature |

### Status symbols (Status column)

✅ Complete · 🟡 Partial · 🔴 Missing · ⚪ Planned · ⚫ Deprecated · 🔵 Hidden · 🟣 Dead code

---

## Matrix

| Feature | Backend | Frontend | Database | API | Permissions | Testing | Deployment | Documentation | Status | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| Login (portal-aware) | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| JWT access + refresh rotation | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| Agent registration | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| Supplier registration | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| Company verification workflow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Forgot / reset password | 🔴 | 🟡 | 🔴 | 🔴 | — | 🔴 | — | 🟡 | ⚪ | P2 |
| Login / logout audit | 🔴 | 🔴 | ✅ | 🔴 | 🔴 | 🔴 | — | 🟡 | 🔴 | P1 |
| User admin CRUD | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| RBAC matrix editor | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Frontend RBAC / nav gating | — | ✅ | — | — | ⚪ | ✅ | — | ✅ | ✅ | — |
| Prisma multi-tenancy (scoped) | ✅ | — | ✅ | ✅ | 🟡 | ✅ | ✅ | 🟡 | 🟡 | P1 |
| Group CRUD | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | ✅ | — |
| Passenger CRUD + bulk | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | ✅ | — |
| Excel passenger import | 🔴 | 🟡 | — | 🔴 | — | 🔴 | — | 🟡 | ⚫/🔴 | P3 |
| Group detail service tabs | ✅ | 🟡 | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | 🟡 | P2 |
| Flight service UI | 🟡 | ⚪ | ✅ | 🟡 | 🟡 | 🔴 | ✅ | 🟡 | ⚪ | P3 |
| Visa booking workflow | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Hotel booking workflow | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Transport booking workflow | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Catering booking workflow | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Additional services workflow | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Supplier portal accept/reject | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Voucher PDF generation | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Hotel catalogue admin | 🔴 | 🔴 | ✅ | 🟡 | 🔴 | 🔴 | — | 🟡 | 🔴 | P3 |
| 19-stage workflow transitions | 🟡 | ⚪ | ✅ | 🔴 | 🔴 | 🔴 | — | 🟡 | 🟡 | P3 |
| WorkflowMap screen | — | ⚪ | — | — | — | 🔴 | — | ✅ | ⚪ | P4 |
| Staff finance API (GL/AR/AP/P&L) | ✅ | 🔵 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔵 | P1 |
| Auto wallet deduct / auto invoice | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Agent wallet / payment slips | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| FinanceERP staff UI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Payment-slip content scan | 🟡 | — | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 | 🟡 | P2 |
| ZATCA / SADAD integrations | 🔴 | ⚪ | 🔴 | 🔴 | — | 🔴 | — | ⚪ | ⚪ | P4 |
| Ops boards REST | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Ops Socket.io live boards | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| OpsControl UI | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| OpsDepartments service desks | ✅ | 🟡 | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 | 🟡 | P2 |
| CRM / HR / Procurement desks | 🔴 | ⚪ | 🔴 | 🔴 | — | 🔴 | — | ⚪ | ⚪ | P4 |
| Fleet ERP CRUD + compliance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Fleet manual GPS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Fleet hardware GPS | 🟡 | ⚪ | ✅ | 🟡 | 🟡 | 🔴 | — | ✅ | ⚪ | P4 |
| Driver mobile app | 🔴 | ⚪ | 🟡 | 🔴 | 🟡 | 🔴 | — | ⚪ | ⚪ | P4 |
| Expiry alerts (single schedule) | 🟡 | — | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | 🟡 | P1 |
| MinIO object storage | ✅ | — | ✅ | ✅ | — | ✅ | ✅ | 🟡 | ✅ | — |
| Public file upload pipeline | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Upload confirm hardening | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Document vault API | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | — |
| Agent Documents Vault UI | ✅ | ✅ | ✅ | ✅ | ⚪ | ✅ | ✅ | ✅ | ✅ | — |
| Virus scan (ClamAV) | ⚪ | — | ✅ | — | — | 🔴 | — | ✅ | ⚪ | P3 |
| OCR passport pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | 🟡 | P1 |
| OCR Gemini provider | ✅ | — | — | — | — | 🔴 | ✅ | 🟡 | 🟡 | P1 |
| OCR Google Vision provider | ✅ | — | — | — | — | 🔴 | 🟡 | 🟡 | 🟡 | P2 |
| OCR non-passport types | 🟡 | 🟡 | ✅ | ✅ | 🔴 | 🔴 | ✅ | 🟡 | 🟡 | P2 |
| OCR `autoAccept` policy | 🟣 | — | ✅ | — | — | 🔴 | — | 🟡 | 🟣 | P2 |
| OCR `REVIEW_OCR_QUEUE` gate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| OCR e2e suite | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ | — |
| In-app notifications + bell | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| WhatsApp delivery (WASender) | ✅ | — | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | P2 |
| Email delivery (SMTP) | ✅ | — | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | P2 |
| Notification admin UI | ✅ | 🔵 | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🔵 | P1 |
| Notifications WS client | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Unified notify dispatch | ✅ | — | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| Single fleet expiry schedule | ✅ | — | — | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| Automation rule engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Automation scheduled backups | ✅ | — | ✅ | — | — | 🟡 | ✅ | ✅ | ✅ | — |
| Domain event coverage | 🟡 | — | ✅ | ✅ | — | 🟡 | ✅ | 🟡 | 🟡 | P2 |
| Automation admin UI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Dashboard APIs (8) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Dashboards UI completeness | ✅ | 🟡 | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | 🟡 | P2 |
| SuperAdmin companies/users | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| SuperAdmin audit / settings / AI | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | — | 🟡 | 🟡 | P2 |
| Contact / Enquiry capture | 🔴 | 🟡 | ✅ | 🔴 | — | 🔴 | — | 🟡 | 🔴 | P2 |
| Audit log writes (sensitive) | 🟡 | ⚪ | ✅ | — | — | 🟡 | ✅ | 🟡 | 🟡 | P1 |
| Audit log read / export API | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| API key authentication | 🔴 | 🔴 | 🟡 | 🔴 | ⚪ | 🔴 | — | 🟡 | ⚪ | P4 |
| Health endpoint | ✅ | — | — | ✅ | — | 🟡 | ✅ | ✅ | ✅ | — |
| Prometheus metrics | ✅ | — | — | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | — |
| Prod Docker stack | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| Nginx TLS + `/api` proxy | — | — | — | — | — | — | ✅ | ✅ | ✅ | — |
| Monitoring (Prom/Grafana) | — | — | — | — | — | — | ✅ | ✅ | ✅ | — |
| DB backup script | ✅ | — | ✅ | — | — | 🟡 | ✅ | ✅ | ✅ | — |
| Offsite backup | 🟡 | — | — | — | — | 🔴 | 🟡 | ✅ | 🟡 | P2 |
| CI/CD workflow | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | 🟡 | ✅ | — |
| Staging environment live | 🟡 | 🟡 | 🟡 | 🟡 | — | 🟡 | 🟡 | 🟡 | 🟡 | P1 |
| Shared i18n core (bn/en) | ✅ | 🟡 | — | — | — | 🔴 | ✅ | ✅ | 🟡 | P3 |
| ERP bilingual UI | — | 🔴 | — | — | — | 🔴 | — | ✅ | 🔴 | P3 |
| DesignSystem / I18nSystem pages | — | ⚪ | — | — | — | 🔴 | — | ✅ | ⚪ | P4 |
| Mobile apps (Driver/Agent/Ops) | 🔴 | ⚪ | 🟡 | 🔴 | 🟡 | 🔴 | — | ⚪ | ⚪ | P4 |
| NUSUK / MOFA / ZATCA gateways | 🔴 | ⚪ | 🔴 | 🔴 | — | 🔴 | — | ⚪ | ⚪ | P4 |
| BullMQ queues (3 workers) | ✅ | — | — | — | — | ✅ | ✅ | 🟡 | ✅ | — |
| EventEmitter domain bus | ✅ | — | — | — | — | ✅ | ✅ | 🟡 | ✅ | — |
| `apps/web` Figma README (npm) | — | — | — | — | — | — | — | 🔴 | ⚫ | P3 |
| Empty Guidelines.md | — | — | — | — | — | — | — | 🔴 | 🟣 | P4 |
| Unused react-dnd | — | 🟣 | — | — | — | — | — | 🟡 | 🟣 | P3 |

---

## Priority rollup

| Priority | Count (approx) | Themes |
|---|---|---|
| **P0** | 0 open (Sprint 1 closed) | ~~OCR perms, upload harden, FE RBAC, vault, ops WS, metrics~~ → see `SPRINT1_COMPLETION_REPORT.md` |
| **P1** | 9 | Audit writes breadth, staging (~~OCR e2e~~ → S2-06; ~~Automation~~ → S2-05; ~~FinanceERP~~ → S2-04; ~~notify/expiry~~ → S2-03) |
| **P2** | 16 | Enquiry, password reset, richer OCR, desks, WhatsApp/SMTP ops, dashboards polish |
| **P3** | 10 | Excel import, i18n ERP, hotel admin, workflow transitions, doc cleanup |
| **P4** | 10 | Mobile, hardware GPS, ZATCA/NUSUK, CRM/HR, design-system pages |

---

## How to read conflicts in this matrix

1. **Backend ✅ + Frontend 🔵** → API ready; unlock UI with RBAC (~~FinanceERP~~ → S2-04; ~~Automation~~ → S2-05).  
2. ~~**Backend ✅ + Frontend 🟣** → Wire nav (Documents Vault).~~ → **Done S1-06**.  
3. **Database ✅ + API 🔴** → Schema ahead of product (Enquiry, audit read, API keys).  
4. ~~**Permissions 🔴** on OCR review~~ → **Done S1-01**; many agent JWT-only routes remain intentional/partial.  
5. ~~**Testing 🔴 + Deployment ✅** → Full OCR pipeline e2e~~ → **Done S2-06** (`ocr-pipeline.e2e-spec.ts`).  

6. **Documentation** — Sprint SoT reconciled S1-07; residual SCHEMA/AUTOMATION drift → S1-08.

---

## Suggested use

- Sprint planning: filter **Priority = P0/P1** and **Status ∈ {🔴, 🟡, 🔵, 🟣}**.  
- Release readiness: require P0 = closed before calling a “secure launch.”  
- Doc hygiene: rows with Documentation ≠ ✅ and Status ✅ are drift candidates (`DOCUMENT_CONFLICTS.md`).

---

*End of Feature Status Matrix. No application code was modified.*
