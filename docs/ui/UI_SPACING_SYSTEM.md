# TUBA AL HIJAZ — UI Spacing, Grid, Elevation

**Sprint:** UI-01 · SSOT for space & depth  
**Practice source:** ERPShell, desks, `theme.css`, Tailwind utilities  

---

## 1. Base Unit

| Token | Value |
|-------|-------|
| Base | **8px** |
| Half-step | 4px (icons, tight chips) |
| Quarter | 2px (hairline adjustments only) |

All paddings, gaps, and layout offsets should be multiples of 4; prefer multiples of 8.

---

## 2. Spacing Scale

| Token | px | Tailwind | Use |
|-------|-----|----------|-----|
| `space-0` | 0 | `0` | Collapse |
| `space-0.5` | 2 | `0.5` | Rare |
| `space-1` | 4 | `1` | Icon gaps, chip padding y |
| `space-2` | 8 | `2` | Compact stacks, table cell gap |
| `space-3` | 12 | `3` | Form field gaps, dense lists |
| `space-4` | 16 | `4` | Default component padding |
| `space-5` | 20 | `5` | Card inner comfort |
| `space-6` | 24 | `6` | Section padding (compact) |
| `space-7` | 28 | `7` | **ERP page gutter** (`p-7` desks) |
| `space-8` | 32 | `8` | Section breaks |
| `space-10` | 40 | `10` | Marketing blocks |
| `space-12` | 48 | `12` | Large section gaps |
| `space-16` | 64 | `16` | Hero / marketing only |

**ERP default page padding:** `p-6` or `p-7`.  
**Card padding:** `p-4`–`p-6`.  
**Table cell:** `px-3` / `px-4` · `py-2` / `py-3`.

---

## 3. Grid

| Concept | Spec |
|---------|------|
| Philosophy | CSS Grid / Flex; no 12-column CSS framework required |
| Ops desks | 12-col mental model via `grid-cols-12` when needed |
| KPI row | `grid-cols-2 md:grid-cols-4` common |
| Form | Single column mobile; `md:grid-cols-2` for paired fields |
| Marketing | `max-w-7xl mx-auto px-6 lg:px-10` |
| Gutter | 16–28px page; 16–24px between cards |

**Alignment:** Left-aligned ops content (LTR). Bangla still LTR for this product UI unless a future RTL language is added.

---

## 4. Layout Shell Metrics

| Element | Spec |
|---------|------|
| Sidebar expanded | **240px** |
| Sidebar collapsed | **64px** |
| Header height | **56px** (`h-14`) |
| ERP canvas | `#F5F7FA`, full remaining width |
| Drawer width | Prefer `max-w-md`–`xl` (see component guide) |
| Dialog width | `max-w-md` / `lg` by content |

---

## 5. Radius

| Token | Value | Tailwind | Use |
|-------|-------|----------|-----|
| `radius-sm` | 6px | `rounded-md` | Inputs, small chips |
| `radius-md` | 8px | `rounded-lg` | Buttons, table wrappers |
| `radius-lg` | 12px | `rounded-xl` | Cards |
| `radius-xl` | 16px | `rounded-2xl` | Marketing panels, hero cards |
| `radius-full` | 9999px | `rounded-full` | Avatars, pills, badges |

**ERP preference:** `rounded-lg` / `rounded-xl`. Avoid mixing every radius on one screen.

---

## 6. Elevation & Shadow

Quiet elevation — Stripe/Linear calm, not Material heavy stacks.

| Level | Recipe | Use |
|-------|--------|-----|
| `e0` | none | Flat table rows |
| `e1` | `shadow-sm` / `0 1px 2px rgb(0 0 0 / 0.04)` | Cards at rest |
| `e2` | `shadow-md` soft | Raised panels, sticky header optional |
| `e3` | `shadow-lg` soft | Dialogs, drawers |
| `e4` | stronger + scrim | Modals only |

**Border often replaces shadow** on ERP cards: `border border-black/5` + `e1`.

No colored glow shadows. No multi-layer neon.

---

## 7. Borders

| Token | Spec |
|-------|------|
| Default | `1px` `black/5`–`black/10` or `#E5E7EB` |
| Strong | `black/15` for active table selection |
| Accent | Gold `1–2px` for focus / selected nav |
| Divider | Full-bleed `border-b border-black/5` |

---

## 8. Z-Index Scale

| Layer | z | Use |
|-------|---|-----|
| Base | 0 | Content |
| Sticky | 10 | Table headers, subheaders |
| Header / sidebar | 30–40 | Shell chrome |
| Dropdown | 50 | Menus, popovers |
| Drawer | 50–60 | Detail drawers |
| Modal | 70 | Dialogs |
| Toast | 80+ | Sonner |

Keep shell below overlays.

---

## 9. Animation & Transitions

| Token | Duration | Easing | Use |
|-------|----------|--------|-----|
| `fast` | 120–150ms | ease-out | Hover color, opacity |
| `normal` | 200–250ms | ease-in-out | Drawer slide, dialog |
| `slow` | 300–400ms | ease | Marketing fades |

**Press:** scale ~`0.96`–`0.98` on buttons (`interactions.css`).  
**Skeleton:** shimmer pulse — see accessibility for `prefers-reduced-motion`.  
**Marketing:** `motion/react` allowed on Home; ERP desks prefer CSS transitions.

---

## 10. Density Modes

| Mode | Gaps | Type | Where |
|------|------|------|-------|
| Comfortable | `gap-4`–`6`, `p-6` | `text-sm`+ | Settings, forms |
| Standard | `gap-3`–`4`, `p-5`–`7` | `text-sm` | Most desks |
| Compact | `gap-2`, `py-2` cells | `text-xs` / `10px` | Visa queues, finance tables |

Default for operations: **Standard → Compact on worklists**.

---

## 11. Empty / Loading Geometry

| State | Space |
|-------|-------|
| Empty | Centered block, `py-16`–`24`, icon ~40–48 |
| Skeleton | Match real row/card height; `gap-3` |
| Error | Same footprint as empty; red accent icon |

Use shared `States` patterns — do not invent random paddings.

---

## 12. Anti-patterns

- Arbitrary `13px` / `27px` paddings  
- Cards inside cards inside cards  
- Hero-level spacing on visa queues  
- Huge border-radius (`3xl`) on dense tables  
- Drop shadows on every row  

---

## 13. Quick Reference

```
8px base
page: p-6|p-7
card: p-4|p-6 + rounded-xl + border-black/5 + shadow-sm
table cell: px-3|4 py-2|3
sidebar: 240 / 64 · header: 56
radius: lg|xl · shadow: sm|md
```
