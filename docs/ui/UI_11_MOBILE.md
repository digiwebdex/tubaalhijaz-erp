# TUBA AL HIJAZ — UI-11 Responsive · Touch · PWA · A11y

**Sprint:** UI-11  
**Status:** Complete  
**SSOT:** `docs/ui/UI_DESIGN_SYSTEM.md` + companions (esp. `UI_02_NAVIGATION.md`, `UI_ACCESSIBILITY.md`, `UI_04_*`)  
**Scope:** Polish only — responsive layout, touch targets, PWA audit, performance, accessibility.  
**Out of scope:** Redesign, DB/API/backend, RBAC, routes, auth, Finance/Visa/Long Stay/Workflow logic.

---

## 1. Objective

Improve Desktop / Tablet / Mobile / PWA experience across the ERP shell and Enterprise kit **without redesigning screens** or inventing new PWA infrastructure.

---

## 2. Breakpoints (shell)

| Band | Width | Sidebar |
|------|-------|---------|
| **Mobile** | &lt; 768 | Overlay drawer (`100vw` max) |
| **Tablet** | 768–1023 | Permanent rail, **collapsed** by default (64px); user may expand |
| **Desktop** | ≥ 1024 | Permanent rail, **expanded** by default (240px); user may collapse |

Implementation: `useViewport()` in `apps/web/src/app/components/ui/use-mobile.ts`  
Legacy `useIsMobile()` → `viewport === "mobile"`.

---

## 3. Responsive polish

| Area | Change |
|------|--------|
| Shell main | `overflow-x-hidden`, `min-w-0`, `id="erp-main"` |
| Page template | Tighter mobile padding `p-4 sm:p-6 md:p-7` |
| Secondary tabs | Horizontal scroll + `min-h-[44px]` + `role="tablist"` |
| Forms | Single column below `lg`; two columns from tablet/desktop (`lg:grid-cols-2`) |
| Drawers | Mobile **full width**; desktop ≤ **720px** |
| Tables | Horizontal scroll only inside table wrapper; **sticky first column** (default on); touch scroll |
| Popovers | Bell menu `min(20rem, 100vw − 1rem)` — no viewport clip |

**No page-level redesign** — Finance / Visa / Long Stay / Reports content untouched.

---

## 4. Touch targets

| Control | Spec |
|---------|------|
| Token | `ERP.touchMin = 44` |
| `ErpButton` md/lg | `minHeight: 44` |
| `ErpButton` sm | 36 desktop; **44** under `@media (pointer: coarse)` |
| Inputs / selects | Height 44 |
| Shell header / nav / tabs | ≥ 44px |

---

## 5. PWA (existing only — audit)

| Asset | Status |
|-------|--------|
| `index.html` → `/site.webmanifest` | Present |
| Icons `favicon-192` / `512` / apple-touch | Present |
| `theme-color` `#0B1E3F` | Present |
| `display: standalone` | Present |
| Manifest polish (UI-11) | `lang`, `scope`, `purpose: any` / `maskable` (reuse 512) |
| Service worker / offline fallback | **Not implemented** — do not invent |
| Installability | Manifest + icons sufficient for browser install prompts when served HTTPS |

---

## 6. Accessibility

- Gold `:focus-visible` on shell controls + `.erp-btn`
- Escape closes mobile nav drawer + body scroll lock
- Bangla `aria-label`s on menu / language / profile
- Secondary tabs: `role="tab"` / `aria-selected`
- `prefers-reduced-motion`: disable press scale
- Viewport: `viewport-fit=cover` for notched devices

---

## 7. Performance

- Avoid page-wide horizontal scroll (contain overflow)
- Reuse kit components (no parallel UI)
- Reduced-motion respect for press transforms
- No new heavy deps / no layout rewrite

---

## 8. Tests

```bash
cd apps/web
pnpm run typecheck
pnpm run build
pnpm run test:erp
```

Manual: resize Desktop → Tablet (collapsed rail) → Mobile (drawer); open ErpDrawer; scroll wide table with sticky first column.

---

## 9. Rollback

Revert:

- `ERPShell.tsx`, `use-mobile.ts`
- `erp/ErpButton.tsx`, `ErpDrawer.tsx`, `ErpDataTable.tsx`, `ErpForm.tsx`, `ErpPageTemplate.tsx`, `tokens.ts`
- `interactions.css`, `index.html`, `public/site.webmanifest`
- `docs/ui/UI_11_MOBILE.md`

No database or API rollback.
