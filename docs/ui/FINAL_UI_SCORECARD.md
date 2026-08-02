# TUBA AL HIJAZ — Final UI Scorecard

**Sprint:** UI-12 Enterprise Product Certification  
**Date:** 2026-08-02  
**Scale:** 0–10 (integer). Higher is better.  
**Method:** Static audit of `apps/web` + `docs/ui` + self-tests; no production traffic metrics.

See also: [UI_12_CERTIFICATION.md](./UI_12_CERTIFICATION.md), [LEGACY_COMPONENT_REPORT.md](./LEGACY_COMPONENT_REPORT.md), [DEAD_CODE_REPORT.md](./DEAD_CODE_REPORT.md).

---

## Scorecard

| Dimension | Score | Rationale |
|-----------|------:|-----------|
| **Design Consistency** | **7** | Navy/gold SSOT + kit on core desks; Fleet/Admin/Agent Finance still parallel dialects |
| **Navigation** | **9** | UI-02 global rail, RBAC UX gates, portal tabs, mobile drawer — solid |
| **Accessibility** | **7** | Focus/Escape/touch/reduced-motion on shell+kit; legacy pages incomplete; no a11y CI gate |
| **Performance** | **7** | Kit reuse, overflow containment; large monolithic page bundles warn at build |
| **Responsive** | **8** | UI-11 viewport bands, drawer full-width, 44px targets; legacy tables remain risk |
| **Bangla UX** | **7** | Default `bn`; kit desks bilingual; many legacy modules English-hardcoded |
| **Component Reuse** | **6** | Strong on 6 kit modules; ErpCard unused; many desks still bespoke |
| **Code Consistency** | **6** | Clear kit vs legacy split; ActionBtn/FInput/SBadge dialects persist |
| **Maintainability** | **7** | Docs UI-01…UI-11 complete; huge files + orphan ComingSoon pages add friction |
| **Overall Product Readiness (UI)** | **7** | Conditional production readiness for transformed desks; not full-kit certified |

**Average (unweighted):** 7.1 / 10  

---

## Readiness bands

| Band | Score | Meaning |
|------|------:|---------|
| Not ready | 0–4 | Unsafe for ops |
| Conditional | 5–7 | Core paths OK; debt accepted |
| Strong | 8–9 | Broad kit coverage |
| Exemplary | 10 | Full kit + a11y CI + no legacy desks |

**Current band:** Conditional (7).

---

## Dimension notes

### Design Consistency — 7
Tokens and dual-surface model documented. Transformed modules match Enterprise Kit. Incomplete migration holds the score below 8.

### Navigation — 9
Best-in-transform area. Deduct 1 for secondary-tab overflow complexity and multi-path highlight quirks (documented in UI-02 risks).

### Accessibility — 7
UI-01 + UI-11 foundations present. Deduct for unaudited legacy desks and lack of automated a11y checks.

### Performance — 7
No runaway new deps; Vite chunk &gt;500kB warning remains.

### Responsive — 8
Shell/kit meet UI-11 contract. Deduct for legacy page overflow risk.

### Bangla UX — 7
Default language correct. Terminology consistency incomplete across unmigrated modules.

### Component Reuse — 6
Kit exists and is proven; adoption incomplete; some kit exports unused.

### Code Consistency — 6
Architecture rule “extend don’t invent” held for APIs; UI still has two chrome generations.

### Maintainability — 7
Excellent sprint docs. Codebase size and orphan routes reduce score.

### Overall Product Readiness — 7
Ops can run certified desks. Full enterprise UI claim blocked until legacy modules migrate and SSOT index is updated.

---

## Gate checklist (UI)

| Gate | Status |
|------|--------|
| Typecheck | Pass |
| ERP kit selftest | Pass |
| Website smoke selftest | Pass |
| Nav / RBAC selftests | Pass |
| UI sprint docs UI-02…UI-11 | Pass |
| UI_DESIGN_SYSTEM links UI-05…UI-11 | **Fail** (gap) |
| 100% ErpDataTable on all ERP pages | **Fail** |
| PWA offline SW | **N/A / not shipped** |
| Zero English-only staff desks | **Fail** |

---

## Sign-off (UI certification)

| Role | Status |
|------|--------|
| UI transform (UI-01…UI-11) | Documented Complete |
| UI-12 verification | **Conditional Pass** |
| Full Enterprise Kit certification | **Deferred** |

No production deploy decision is implied by this scorecard alone — pair with `docs/releases/` business certifications and staging smoke.
