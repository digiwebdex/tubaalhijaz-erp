# TUBA AL HIJAZ — UI Color System

**Sprint:** UI-01 · SSOT for color  
**Code source:** `apps/web/src/styles/theme.css`  
**Default theme:** Light  

---

## 1. Principles

1. **Navy is structure** — text, chrome, primary buttons.  
2. **Gold is accent** — focus, active, rare highlights — never large fill fields.  
3. **Module color is context** — sidebar active tint, KPI chips, desk identity.  
4. **Status color is meaning** — success / warning / danger / info only for state.  
5. **Bangla-first UI still uses the same palette** — color is language-agnostic.

---

## 2. Core Brand Palette

| Name | Hex | CSS / usage |
|------|-----|-------------|
| Navy | `#0B1E3F` | Primary ink, ERP header text, primary CTA fill |
| Navy deep | `#061224` | Dark token `--background` when `.dark` |
| Gold | `#C9A24B` | Accent, focus ring, active borders, secondary emphasis |
| Gold soft | `#C9A24B` @ 10–20% | Active nav pill, soft highlights |
| White | `#FFFFFF` | Card / dialog surface |
| Soft white | `#FBFCFD` | Secondary card / inset panel |
| Marketing bg | `#F4F1EC` | `--background` (public site) |
| ERP canvas | `#F5F7FA` | Shell main area, portals |
| Border quiet | `#E5E7EB` / `black/5`–`black/10` | Dividers, table lines |
| Muted text | `#6B7280` / `navy/55` | Secondary labels |
| Destructive | `#DC2626` | Errors, delete, overdue |
| Success | `#16A34A` | Complete, paid, approved |
| Warning | `#D97706` | Pending, attention |
| Info | `#2563EB` | Informational links / tips |

---

## 3. Semantic Tokens (theme.css)

Map product language → existing CSS variables where defined:

| Semantic | Light token / practice |
|----------|------------------------|
| Background (marketing) | `--background` → `#F4F1EC` |
| Foreground | `--foreground` → navy family |
| Primary | Navy fill / gold accent depending on surface |
| Card | `#FFFFFF` / `--card` |
| Destructive | `#DC2626` / `--destructive` |
| Border | `--border` / `border-black/5`–`10` |
| Ring / focus | Gold `#C9A24B` |
| Muted | Gray / navy opacity |

**ERP note:** Prefer explicit `#F5F7FA` canvas in shell; do not force marketing cream into desks.

---

## 4. Module Accent Colors

Used for identity chips, soft active states, and KPI accents — **not** for body text.

| Module | Accent | Typical use |
|--------|--------|-------------|
| Visa | `#0D9488` | Visa desks, pipeline |
| Hotel | `#2563EB` | Hotel inventory / booking |
| Transport | `#EA580C` | Transport desks |
| Catering | `#9333EA` | Catering |
| Finance | `#16A34A` | Invoices, AR/AP |
| Fleet | `#475569` | Fleet |
| Ops / Dispatch | `#DC4E2A` | Operations coral |
| Long Stay | Teal-adjacent / navy | Prefer Visa teal or navy + status |

**Rule:** One module accent per view chrome. Do not rainbow a single toolbar.

---

## 5. Status Colors

| Status | Hex | Bangla label examples | English |
|--------|-----|----------------------|---------|
| Success / Done | `#16A34A` | সম্পন্ন, অনুমোদিত, পরিশোধিত | Done, Approved, Paid |
| Warning / Pending | `#D97706` | অপেক্ষমাণ, সতর্কতা | Pending, Warning |
| Danger / Error | `#DC2626` | ব্যর্থ, বাতিল, বকেয়া | Failed, Rejected, Overdue |
| Info | `#2563EB` | তথ্য, নির্দেশনা | Info |
| Neutral / Draft | `#6B7280` | খসড়া, নতুন | Draft, New |
| In progress | Module accent or `#0D9488` | চলমান | In progress |

### Badge recipe

- Soft fill: status @ ~10–15% opacity  
- Text: solid status hex (or navy for neutral)  
- Border: optional 1px status @ 20%  
- Radius: `rounded-full` or `rounded-md` — pick one per surface and keep it  

---

## 6. Surfaces & Elevation Tints

| Layer | Fill | Border |
|-------|------|--------|
| Canvas (ERP) | `#F5F7FA` | — |
| Canvas (marketing) | `#F4F1EC` | — |
| Card | `#FFFFFF` | `black/5`–`8` |
| Nested panel | `#FBFCFD` / `navy/[0.02]` | `black/5` |
| Header / sidebar | `#FFFFFF` or soft navy tint | bottom/side border |
| Overlay scrim | `black/40`–`50` | — |
| Toast | `#0D1E3A` text light | — |

Shadows: see [UI_SPACING_SYSTEM.md](./UI_SPACING_SYSTEM.md) — prefer soft gray shadows, not colored glows.

---

## 7. Interactive Color States

| State | Primary (navy) | Accent (gold) | Destructive |
|-------|----------------|---------------|-------------|
| Default | `#0B1E3F` fill, white text | Gold border / text | `#DC2626` fill or text |
| Hover | Navy ~90% / slight lift | Gold underline or soft bg | Darker red |
| Active | Press scale; slightly darker | Gold soft fill | Darker red |
| Focus | Gold ring 2px | Gold ring | Gold or red ring |
| Disabled | Opacity 40–50% | Same | Same |
| Loading | Keep color; show spinner | — | — |

---

## 8. Charts & Data Viz (guidance)

- Prefer Navy + Gold + one module accent + gray.  
- Success/danger only for variance that carries meaning.  
- Avoid rainbow series beyond 5 hues.  
- Grid lines: `#E5E7EB`.  

---

## 9. Dark Mode Tokens (reserved)

`.dark` overrides exist in `theme.css`. **Not product-wired.**

When activated later:

- Keep semantic names  
- Preserve Gold as focus/accent  
- Recalculate contrast for Bangla body text  
- Do not invent a third navy  

Until then: ship **light only**.

---

## 10. Contrast Checklist (ops)

| Pair | Expectation |
|------|-------------|
| Navy on white | Pass for body |
| White on navy | Pass for buttons |
| Gold on white | Accent only — not long body text |
| Muted gray on `#F5F7FA` | Secondary labels only |
| Status on soft fill | Text uses solid status, not 40% tint |

---

## 11. Anti-patterns

- Purple-indigo default “AI dashboard” gradients  
- Gold as full-page background  
- Mixing marketing cream into every ERP table  
- Status meaning carried only by color (always pair with Bangla/EN label)  
- Hardcoded one-off hexes that fight Navy/Gold  

---

## 12. Adoption

New UI must pick colors from this document or from `theme.css` tokens that map here.  
Module accents only from the table in §4 unless Product adds a seeded module.
