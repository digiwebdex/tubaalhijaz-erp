# TUBA AL HIJAZ — UI Typography

**Sprint:** UI-01 · SSOT for type  
**Code sources:** `apps/web/src/styles/fonts.css`, `theme.css`, `@tuba/shared` i18n helpers  

---

## 1. Principles

1. **Bangla is default** — type must look correct in `bn` first.  
2. **English is optional** — same scale, tighter line-height.  
3. **Operations density** — desks use smaller type than marketing.  
4. **One sans family per language** — no decorative display fonts in ERP.  
5. **Numbers & dates localize** — `toLocalNum`, `localDate`, `localSAR`.  

---

## 2. Font Families

| Role | Family | CSS variable | When |
|------|--------|--------------|------|
| UI Latin / mixed | Plus Jakarta Sans | `--font-sans` | English UI; mixed labels |
| Bangla body/UI | Noto Sans Bengali | `--font-bengali` | `lang === "bn"` |
| Arabic (decorative) | Noto Sans Arabic | `--font-arabic` | Specimens / RTL demos — **not** a product language |
| Mono / codes | JetBrains Mono | `--font-mono` | IDs, passport numbers, technical |

**Helper:** `fontFor(lang)` from shared i18n — use on text containers when switching language.

**Root size:** `--font-size: 16px` (browser default scale base).

---

## 3. Line Height by Language

| Context | Bangla (`bn`) | English (`en`) |
|---------|---------------|----------------|
| Body | **1.75** | **1.50** |
| Dense table | 1.4–1.5 | 1.35–1.45 |
| Headings | 1.25–1.35 | 1.2–1.3 |

**Helper:** `lineHeightFor(lang)` — apply on paragraphs and form helper text.

Bangla glyphs need more vertical room; do not force English line-height onto Bangla desks.

---

## 4. Type Scale

Aligned to current Tailwind usage in the product.

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `display` | `text-3xl`–`text-5xl` | 600–700 | Marketing hero only |
| `h1` | `text-2xl` / `text-3xl` | 600–700 | Page title (desk) |
| `h2` | `text-xl` | 600 | Section |
| `h3` | `text-lg` | 600 | Card title |
| `body` | `text-sm` / `text-base` | 400–500 | Default copy |
| `label` | `text-xs` / `text-[11px]` | 500–600 | Form labels |
| `caption` | `text-[10px]`–`text-xs` | 400–500 | Meta, timestamps |
| `table` | `text-[10px]`–`text-xs` | 400–500 | Ops tables |
| `kpi` | `text-2xl`–`text-3xl` | 700 | Dashboard numbers |
| `mono` | `text-xs` | 500 | Codes |

**ERP default body:** `text-sm` on `#F5F7FA` with navy text.  
**Marketing default:** `text-base` on cream with more breathing room.

---

## 5. Weight & Emphasis

| Weight | Use |
|--------|-----|
| 400 | Body |
| 500 | Labels, nav items |
| 600 | Titles, buttons |
| 700 | KPI figures, brand wordmark emphasis |

Avoid 800/900 in ERP tables. Gold text for emphasis is rare — prefer weight + navy.

---

## 6. Bangla Content Rules

| Rule | Detail |
|------|--------|
| Default strings | Author Bangla first in `t()` maps |
| Numerals | `toLocalNum()` for counts, amounts display |
| Currency | `localSAR()` (or existing money formatters) |
| Dates / times | `localDate()`, `localTime()` |
| Truncation | Prefer wrap; ellipsis only on single-line IDs |
| Mixed scripts | Passport Latin IDs stay Latin; labels Bangla |
| Button labels | Short verbs: সংরক্ষণ, বাতিল, অনুমোদন |

Every new component **must** accept Bangla without clipping at default widths. If a control breaks on Bangla, the control is wrong — not the language.

---

## 7. English Content Rules

| Rule | Detail |
|------|--------|
| Optional | User toggles to `en` |
| Same layout | Do not ship a second page structure |
| Line-height | Use `lineHeightFor("en")` |
| Length | English often shorter — do not enlarge hit targets only for EN |

---

## 8. Text Color Pairing

| Role | Color |
|------|-------|
| Primary text | `#0B1E3F` |
| Secondary | `#6B7280` or `navy/55` |
| Inverse | `#FFFFFF` on navy / toast |
| Link | Navy or Info `#2563EB`; hover gold underline optional |
| Danger text | `#DC2626` |
| Success text | `#16A34A` |

Do not set long Bangla paragraphs in Gold.

---

## 9. Tables & Forms Typography

| Element | Spec |
|---------|------|
| Column header | `text-[10px]`–`xs`, semibold, muted or navy |
| Cell | `text-xs`, navy |
| Form label | `text-xs` font-medium |
| Helper | `text-[10px]`–`xs`, muted |
| Error | `text-xs`, `#DC2626` |
| Placeholder | muted; Bangla placeholders required when `bn` |

---

## 10. Marketing vs ERP

| | Marketing | ERP |
|--|-----------|-----|
| Hero | Large display OK | No display type |
| Paragraph width | Comfortable measure | Dense, scannable |
| Font switch | Same families | Same families |

---

## 11. Anti-patterns

- Inter / Roboto / Arial as new defaults  
- Bangla in a Latin-only webfont  
- Shrinking Bangla to `text-[9px]` for “fit”  
- ALL-CAPS Bangla  
- Decorative Arabic as the only label for Bangla users  

---

## 12. Checklist for New UI

- [ ] `fontFor(lang)` applied where language switches  
- [ ] `lineHeightFor(lang)` on body blocks  
- [ ] Bangla strings present (not English-only placeholders)  
- [ ] Numerals/dates localized  
- [ ] No clipping at `bn` default  
