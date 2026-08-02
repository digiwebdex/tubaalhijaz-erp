# TUBA AL HIJAZ — UI-04 Component Standard

**Sprint:** UI-04  
**Status:** Complete  
**SSOT:** UI-01 design docs + this kit  
**Code:** `apps/web/src/app/components/erp/*`  

---

## 1. Purpose

Standardize **reusable ERP UI components** as the foundation for remaining screens.

- No business module redesign in this sprint  
- No API / RBAC / workflow changes  
- Pages adopt these components in later UI sprints  

---

## 2. Import

```ts
import {
  ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable, ErpPagination,
  ErpDrawer, ErpForm, ErpField, ErpConfirmDialog, ErpDeleteDialog,
  ErpPageTemplate, ErpStatusChip, erpToast, EmptyState, LoadingSkeleton,
} from "../components/erp";
```

Canonical states remain in `States.tsx` and are re-exported from the kit.

---

## 3. Components standardized

| Component | File | Notes |
|-----------|------|--------|
| Button | `ErpButton` | primary / secondary / outline / ghost / danger + loading |
| Badge | `ErpBadge` | soft pill |
| Status chip | `ErpStatusChip` | pending / warning / approved / completed / rejected / cancelled / info |
| Card | `ErpCard` | soft border, no gradient |
| Section header | `ErpSectionHeader` | |
| Page header | `ErpPageHeader` | title + primary action |
| Page template | `ErpPageTemplate` | global layout shell |
| Quick actions | `ErpQuickActions` | |
| Search | `ErpSearchBar` | Bangla placeholder default |
| Filter | `ErpFilterPanel` | collapsed by default |
| Data table | `ErpDataTable` | sticky header, sort, select, actions |
| Pagination | `ErpPagination` | |
| Drawer | `ErpDrawer` | right, max 720px, sticky footer |
| Form | `ErpForm` / `ErpField` / inputs | max 2 columns |
| Confirm / Delete | `ErpConfirmDialog` / `ErpDeleteDialog` | never custom delete UI |
| Toast | `erpToast` | wraps existing `sonner` |
| Empty / Loading / Error | `States.tsx` | skeleton variants: list / table / cards |

---

## 4. Global page template

```
Page Title + Primary Action
Search + Filter
Table
Pagination
(+ Drawer / Confirm as overlays)
```

Use `ErpPageTemplate` for new list pages. Do not invent random chrome.

---

## 5. Status chip colors

| Status | Color | Bangla |
|--------|-------|--------|
| Pending | `#6B7280` | অপেক্ষমাণ |
| Warning | `#D97706` | সতর্কতা |
| Approved / Completed | `#16A34A` | অনুমোদিত / সম্পন্ন |
| Rejected | `#DC2626` | প্রত্যাখ্যাত |
| Cancelled | `#6B7280` | বাতিল |
| Info | `#2563EB` | তথ্য |

---

## 6. Empty / Loading / Error

| State | Rule |
|-------|------|
| Empty | Icon + Bangla title e.g. `কোনো তথ্য পাওয়া যায়নি` + primary action |
| Loading | **Skeleton only** (`LoadingSkeleton`) — avoid full-page spinners |
| Error | `ErrorState` + retry (`আবার চেষ্টা করুন`) |

---

## 7. Toast

Use `erpToast.success / error / info / loading` — same Sonner host as today. No second system.

---

## 8. Accessibility

- Focus: gold ring via `interactions.css` on inputs; buttons use `erp-btn` press scale  
- Dialogs/drawers: Escape closes; `aria-modal` / labels  
- Required fields: visible `*` + `sr-only` “required”  
- Status: color **and** text  
- Bangla typography: callers apply `fontFor(lang)` on page roots  

---

## 9. Responsive

| Surface | Behavior |
|---------|----------|
| Search / filter | Stack on mobile; row on `md+` |
| Form | 1 col mobile, 2 col `md+` |
| Table | Horizontal scroll; sticky header |
| Drawer | Full viewport width under 720px |

---

## 10. Adoption rule (later sprints)

New or refactored ERP screens **must** use this kit for the primitives above.  
Do not copy-paste hex/button styles into pages.

---

## 11. Tests

`pnpm run test:erp` — token / status / placeholder contracts.
