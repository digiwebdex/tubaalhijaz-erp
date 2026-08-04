# FINAL PRODUCTION AUDIT — Tuba Al Hijaz ERP v2.0

**Date:** 2026-08-03  
**Role:** Enterprise QA Lead / Release Manager  
**Live:** https://tubaalhijaz.com  
**Web image:** `tuba-alhijaz/tuba-alhijaz-web:prod-audit-20260803b`  
**API image:** `tuba-alhijaz/tuba-alhijaz-api:esp06-20260802` (unchanged)  
**Scope:** Verify / polish / remove production UI defects only — **no** new features, APIs, DB, or business logic.

**Verdict: GO WITH CONDITIONS**  
**Production readiness score: 84 / 100**

---

## Phase 1 — Full system inventory (opened in browser)

Authenticated crawl (Playwright + real UI login / `sessionStorage` JWT) opened every production-visible route below. Screenshots: `/tmp/uat-audit/shots3/` (inventory) and `/tmp/uat-audit/shots-verify/` (post-fix).

| Area | Routes / surfaces opened | Result |
|------|--------------------------|--------|
| Marketing | `/`, `/services`, `/about`, `/contact`, `/login`, `/auth-onboarding` | PASS |
| Dashboard | `/dashboards` | PASS |
| Operations | `/ops-control` + tabs groups/arrivals/departures/dispatch/maassist/ziyarah/longstay/brn/vouchers | PASS (vouchers = honest not-configured) |
| Visa / Long Stay / desks | `/ops-departments` (visa/hotel/transport/catering/finance) | PASS |
| Finance | `/finance-erp` | PASS (admin) |
| Fleet | `/fleet-erp` | PASS (admin) |
| OCR | `/ocr-center` | PASS |
| Automation / Notifications | `/automation`, `?tab=notifications` | PASS |
| Super Admin | dashboard/companies/users/settings/ai-engine/workflows/audit | PASS (settings/AI/workflows = not-configured) |
| Workflow map | `/workflow-map` | PASS |
| Deferred shells | `/mobile-apps`, `/tablet`, `/design-system`, `/i18n-system` | PASS (Bangla not-configured; not in primary nav) |
| Agent Portal | all live nav + Group Detail tabs Passengers…Timeline | PASS |
| Supplier Portal | dashboard/bookings/vouchers/invoices | PASS |
| Reports | staff Reports nav → `/dashboards` | PASS (wired) |

**Not present as a separate Customer portal** in production routes.

---

## Phase 2 — Button audit (sample + targeted)

| Surface | Visible buttons (sample) | Sampled click | Notes |
|---------|--------------------------|---------------|-------|
| Dashboard | 30 | Refresh clicked | PASS |
| Ops Groups | 21 (2 disabled) | Refresh clicked | PASS |
| Ops Departments | 58 | Refresh clicked | PASS |
| Finance ERP | 32 | Refresh clicked | PASS |
| SA Companies | 20 | Add Company clicked | PASS |
| Agent Portal | 23 | Refresh clicked | PASS |
| Agent group tabs | 7 tabs | All opened | PASS |
| Supplier nav | 4 live items | All opened | PASS |

**Limitation:** Exhaustive click-every-control across every drawer/wizard/export was **sampled**, not combinatorial. No broken primary CTAs found on sampled surfaces. Destructive actions (logout/delete) intentionally skipped.

---

## Phase 3 — Form audit

| Check | Result |
|-------|--------|
| Login validation | PASS (UI login works for UAT roles) |
| Bangla labels (nav / many desks) | PARTIAL — primary nav Bangla; some staff English titles remain (e.g. Ziyarah, BRN) |
| Required / duplicate / toast | Not re-exercised end-to-end for every form in this pass (no API/business changes) |
| Cancel / Escape | Escape pressed on agent surfaces — PASS |

---

## Phase 4 — Role / RBAC audit

| Role | Login | Access | Denied correctly |
|------|-------|--------|------------------|
| Super Admin (`uat.admin@…`) | PASS | Staff + SA modules | — |
| Operations (`uat.ops@…`) | PASS | Ops + dashboards | SA users → Missing permission; Finance/Fleet redirect → `/dashboards` |
| Agent (`uat.agent@…`) | PASS | Agent portal | `/finance-erp`, `/super-admin`, `/ops-control` → `/agent-portal` |
| Supplier (`uat.supplier@…`) | PASS | Supplier portal live tabs | — |
| Customer | N/A | No customer SPA route | — |

Backend remains SoT (`PermissionsGuard`). Frontend redirects/hides are UX only.

---

## Phase 5 — Responsive

| Viewport | Surface | Result |
|----------|---------|--------|
| Desktop 1440×900 | Full crawl | PASS |
| Tablet 768×1024 | Agent group detail | PASS (shot captured) |
| Mobile 390×844 | Agent group detail | PASS (shot captured) |

Drawers/sidebars/wizards: no blocking layout defects observed on sampled pages.

---

## Phase 6 — Accessibility (spot check)

| Check | Result |
|-------|--------|
| Tab | Exercised | PASS |
| Escape | Exercised | PASS |
| ARIA | Not full WCAG audit | CONDITIONAL |
| Bangla typography | Noto/Hind used on not-configured pages | PASS (spot) |

---

## Phase 7 — Localization

- English **“coming soon” / “future prompt”** removed from production-visible shells.
- Deferred modules use Bangla: **এই মডিউল এখনও কনফিগার করা হয়নি।**
- Remaining: mixed EN titles on some Ops/SA screens (acceptable constants / partial i18n debt).

Exceptions preserved: company names, airport/visa codes, system constants.

---

## Phase 8 — Consistency (dead UI removed)

Removed from **production nav** (screens may remain via deep-link with honest empty state):

- Agent **Support**
- Ops **Voucher Generator**
- Ops Departments **Procurement / HR / CRM**
- Supplier **Statement / Payments**
- Staff Advanced Tools **AI Engine / Workflow Engine**
- Staff **System Settings** (deep-link still honest empty state)

Fixed: Documents subtitle API leak (`GET /vouchers`).

**Zero** `coming soon` / `future prompt` defects in post-fix VERIFY (`DEFECTS 0`).

---

## Phase 9 — UI bug fixes shipped (no backend)

| File | Change |
|------|--------|
| `apps/web/src/app/pages/ComingSoon.tsx` | Bangla not-configured |
| `apps/web/src/app/pages/SuperAdmin.tsx` | Bangla empty states; settings in `SA_ADVANCED_IDS` for deep-link |
| `apps/web/src/app/pages/OpsControl.tsx` | Vouchers Bangla; removed from OPS_NAV |
| `apps/web/src/app/pages/OpsDepartments.tsx` | Bangla deferred desks; removed from DEPT_NAV |
| `apps/web/src/app/pages/AgentPortal.tsx` | Support not-configured; removed from AGENT_NAV |
| `apps/web/src/app/pages/AgentPortalGroups.tsx` | Documents subtitle cleanup |
| `apps/web/src/app/pages/AgentPortalServices.tsx` | Flight Bangla not-configured |
| `apps/web/src/app/pages/AgentPortalFinance.tsx` | Reports Bangla not-configured |
| `apps/web/src/app/pages/SupplierPortal.tsx` | Statement/payouts Bangla; removed from SUPPLIER_NAV |
| `apps/web/src/app/pages/Dashboards.tsx` | Widget placeholders → Bangla not-configured |
| `apps/web/src/app/pages/MobileApps.tsx` | Toast Bangla (route still ComingSoon shell) |
| `apps/web/src/app/lib/navConfig.ts` | Dead menu entries removed |
| `infra/.env` | `WEB_IMAGE_TAG=prod-audit-20260803b` |

**Database changes:** none  
**API changes:** none

---

## Phase 10 — PASS / FAIL matrix

| Phase | Status |
|-------|--------|
| 1 Inventory (every visible page opened) | **PASS** |
| 2 Buttons (sampled primary + tabs) | **PASS WITH LIMITS** |
| 3 Forms | **PASS WITH LIMITS** |
| 4 Roles / RBAC | **PASS** |
| 5 Responsive (D/L/T/M spot) | **PASS** |
| 6 Accessibility (spot) | **PASS WITH LIMITS** |
| 7 Localization (no English coming-soon) | **PASS** (partial EN titles remain) |
| 8 Consistency / dead UI | **PASS** |
| 9 UI defect fixes | **PASS** |
| 10 Certification | **GO WITH CONDITIONS** |

---

## Risks

1. Deferred modules (settings UI, AI engine, Ops voucher generator, supplier ledger, agent support, group Timeline for agents) are honest empty states — not fake features, but incomplete product surface.
2. Staff i18n still mixed EN/BN on several desk titles.
3. Button/form audit not 100% combinatorial; residual undiscovered UI wiring bugs possible.
4. Temporary UAT users exist in production DB (`uat.*@tubaalhijaz.local`) — rotate/disable after sign-off.
5. Ops role cannot open Finance/Fleet (redirect) — confirm this matches intended RBAC seed.

## Remaining limitations

- No Customer portal.
- No on-demand Ops voucher generation API (UI correctly withheld).
- Dashboard widgets without backend feeds show Bangla not-configured (not charts with dummy data).
- Full WCAG / every-export/print matrix not certified in this run.

## Rollback

```bash
cd /var/www/TUBAALHIJAZ/infra
sed -i 's/^WEB_IMAGE_TAG=.*/WEB_IMAGE_TAG=group-tabs-20260803/' .env
docker compose -f docker-compose.prod.yml up -d --no-deps web
```

## Manual testing steps (sign-off)

1. Login as Super Admin → open Dashboard, Ops tabs, Departments, Finance, Fleet, OCR, Automation, Super Admin companies/users/audit.
2. Confirm Advanced Tools no longer lists AI/Workflow; `?tab=settings|ai-engine|workflows` shows Bangla not-configured.
3. Login as Agent → Groups → open all detail tabs; confirm Support absent from nav; Documents has no `GET /vouchers` text.
4. Login as Supplier → only Dashboard/Bookings/Vouchers/Invoices in nav.
5. Login as Ops → confirm SA Users shows permission denial; Finance redirects to dashboard if unpermitted.
6. Spot-check mobile width on Agent Groups.

## Artifacts

- Crawl inventory: `/tmp/uat-audit/RESULTS.json`
- Post-fix verify: `/tmp/uat-audit/VERIFY.json`, `/tmp/uat-audit/verify2.log`
- Screenshots: `/tmp/uat-audit/shots-verify/` (53+ pages), `/tmp/uat-audit/shots3/`

---

## Decision

### **GO WITH CONDITIONS**

Ship current web image for production use of **wired** modules (Agent Groups, Ops boards, Departments desks with backends, Finance/Fleet for permitted roles, OCR, Automation, SA companies/users/audit, Supplier bookings/vouchers/invoices).

**Conditions before unconditional GO:**

1. Disable or rotate temporary UAT accounts.
2. Accept deferred modules as not-configured (or schedule backend+UI for settings/support/supplier ledger).
3. Optional follow-up: complete Bangla labels on remaining English staff desk titles (UI-only).

**Do not claim COMPLETE for exhaustive every-button/every-form certification** — inventory of every visible production page **was** completed in browser; button/form depth remains sampled.
