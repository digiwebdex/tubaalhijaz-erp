# TUBA AL HIJAZ — UI Component Guide

**Sprint:** UI-01 · SSOT for component recipes  
**Scope:** Document patterns as they exist / as they should converge — **no rewrites in this sprint**  

**Living code:** desks + `ERPShell` + `States.tsx` + `DesignSystem.tsx`  
**UI-04 kit:** `apps/web/src/app/components/erp/*` — **prefer this** for new ERP UI.  
**Note:** `components/ui/*` (shadcn) remains available but is not the ERP SSOT. Do not dual-track visuals.

---

## 1. Universal Rules

1. Bangla labels by default; English via `t()` / lang toggle.  
2. Navy primary · Gold accent · module color for context.  
3. Every interactive control has hover, focus, disabled, loading where applicable.  
4. Destructive actions use `#DC2626` and confirmation density.  
5. Reuse `EmptyState` / `LoadingState` / `ErrorState` / `SampleDataBanner` from `States.tsx`.

---

## 2. Buttons

### Variants

| Variant | Appearance | Use |
|---------|------------|-----|
| Primary | Navy `#0B1E3F` fill, white text | Main CTA: সংরক্ষণ, জমা দিন |
| Secondary | White / soft fill, navy text, quiet border | Alternate action |
| Accent / Gold outline | Gold border or soft gold bg | Highlight rare actions |
| Ghost | Transparent, navy text | Toolbar, table row actions |
| Destructive | `#DC2626` fill or text | Delete, reject |
| Link | Text + underline on hover | Inline navigation |

### Sizes

| Size | Padding | Type | Use |
|------|---------|------|-----|
| sm | `px-2.5 py-1` | `text-xs` | Tables |
| md | `px-3 py-2` | `text-sm` | Default |
| lg | `px-4 py-2.5` | `text-sm`–`base` | Marketing / empty CTA |

### States

| State | Behavior |
|-------|----------|
| Hover | Slightly lighter/darker; cursor pointer |
| Active | Scale ~0.96 (`interactions.css`) |
| Focus | Gold ring (see accessibility) |
| Disabled | Opacity ~40–50%; `pointer-events-none` |
| Loading | Spinner (`Loader2`) + disable double-submit; keep label or “অপেক্ষা করুন…” |

**Bangla:** Prefer short verbs. Do not truncate mid-word — widen button or wrap to two lines sparingly.

---

## 3. Inputs & Forms

### Text / number / select / textarea

| Part | Spec |
|------|------|
| Height | ~36–40px (`h-9` / `h-10`) |
| Radius | `rounded-lg` |
| Border | `black/10` → focus Gold |
| Label | Above field, `text-xs` font-medium, Bangla first |
| Helper | Muted caption under field |
| Error | Red text + red border; Bangla message required |
| Disabled | Muted bg, reduced opacity |

### Patterns

- Pair related fields in `md:grid-cols-2`, `gap-3`–`4`.  
- Required marker: subtle `*` in danger or navy — consistent per form.  
- Passport / IDs: `font-mono` for values.  
- Money: right-align numbers; localize display.  
- Search: icon left (Lucide `Search`), clear optional.

### Validation UX

1. Inline error after blur or submit  
2. Do not rely on color alone  
3. Focus first invalid field on submit  

---

## 4. Cards

| Part | Spec |
|------|------|
| Surface | `#FFFFFF` or `#FBFCFD` |
| Border | `border-black/5` |
| Radius | `rounded-xl` |
| Padding | `p-4`–`p-6` |
| Shadow | `shadow-sm` |
| Title | `text-sm`–`lg` semibold navy |
| Meta | muted caption |

**KPI card:** Big number (`kpi` scale) + Bangla label + optional module accent bar/dot.  
**Avoid:** Nested cards; marketing “feature card grids” inside ops desks.

---

## 5. Badges & Chips

| Kind | Style |
|------|-------|
| Status | Soft fill + solid status text (see color system) |
| Module | Module accent soft fill |
| Count | Navy/gray pill on nav items |

Radius: `rounded-full` or `rounded-md` — one convention per desk.  
Always include readable Bangla/EN text — icon-only badges need `aria-label`.

---

## 6. Tables (operations core)

| Part | Spec |
|------|------|
| Wrapper | White card, `rounded-xl`, overflow auto |
| Header | Sticky optional; `text-[10px]`–`xs`, muted/semibold |
| Row | `border-b border-black/5`; hover `navy/[0.02]` |
| Cell | `px-3|4 py-2|3`, `text-xs` |
| Selection | Gold/navy left border or soft bg |
| Actions | Ghost icon buttons end column |
| Empty | `EmptyState` inside wrapper |
| Loading | Skeleton rows matching column count |

**Density:** Compact for queues.  
**Bangla:** Headers may wrap to 2 lines; do not force single-line ellipsis on Bangla headers.

---

## 7. Drawer

| Part | Spec |
|------|------|
| Placement | Right (LTR) |
| Width | `md`–`xl` by content |
| Overlay | `black/40`–`50` |
| Header | Title (Bangla) + close |
| Body | Scroll; form or detail sections `gap-4` |
| Footer | Primary + secondary actions sticky |

Use for record detail / edit without leaving the worklist.  
Escape and overlay click close — unless dirty form (confirm).

---

## 8. Dialogs / Modals

| Part | Spec |
|------|------|
| Width | `max-w-md` default; `lg` for complex |
| Radius | `rounded-xl` |
| Elevation | `e3` + scrim |
| Structure | Title · body · actions (cancel left/secondary, confirm right/primary) |
| Destructive | Red confirm; Bangla explicit verb |

Prefer dialogs for **confirmations**; drawers for **editing**.

---

## 9. Sidebar

| Part | Spec |
|------|------|
| Width | 240 expanded / 64 collapsed |
| Active item | Soft gold or module tint + navy text |
| Icons | Lucide 18–20; labels Bangla |
| Groups | Section labels muted uppercase sparingly (EN) or Bangla short headers |
| Collapse | Icons remain; tooltips for labels |

RBAC may hide items (UX only) — backend remains source of truth.

---

## 10. Header

| Part | Spec |
|------|------|
| Height | `h-14` |
| Content | Page context, search (if any), lang toggle, user menu, notifications entry |
| Bg | White / soft border-b |
| No | Heavy gradients, promo banners |

---

## 11. Navigation (marketing)

Top nav on public pages: brand strong, Bangla links, lang toggle.  
Do not copy marketing nav chrome into ERP shell.

---

## 12. States

### Empty

- Icon (muted)  
- Bangla title + one sentence  
- Optional single CTA  

### Loading

- Full-page: centered spinner or skeleton layout  
- Inline: button spinner / row skeletons  
- Never infinite blank canvas  

### Error

- Bangla message + retry action  
- Log/detail for support optional, collapsed  

### Sample / demo banner

- Use `SampleDataBanner` pattern when showing non-production data  

### Skeleton

- Match final layout geometry  
- Shimmer; respect reduced motion  

---

## 13. Toasts

- Dark chrome (`#0D1E3A`) via sonner — acceptable exception  
- Short Bangla message; action link rare  
- Success / error variants  

---

## 14. Tabs

- Underline or soft pill active (gold/navy)  
- Bangla labels; scroll horizontally on narrow widths  

---

## 15. Tabs / Filters / Toolbars

- Left: title + count  
- Right: filters, primary CTA  
- `gap-2`–`3`; keep one primary button  

---

## 16. Icons in Components

See [UI_ICON_GUIDE.md](./UI_ICON_GUIDE.md).  
Buttons: icon + label preferred in Bangla UI for clarity.

---

## 17. Forms + Tables + Drawer (ops recipe)

```
[ Header title + primary CTA ]
[ Filter bar ]
[ Table worklist ]
    → row click → Drawer detail
        → primary save / secondary cancel
[ Empty | Skeleton | Error as needed ]
```

Minimal clicks: list → drawer → save.

---

## 18. Anti-patterns

- shadcn + hand-rolled duplicates on the same screen  
- English-only labels  
- Multiple primary buttons in one footer  
- Modal stacks three deep  
- Card grids replacing worklist tables for queues  

---

## 19. Future Convergence (not UI-01)

A later sprint may adopt `components/ui` primitives **mapped to these recipes** — tokens first, then gradual replacement. No parallel visual language.
