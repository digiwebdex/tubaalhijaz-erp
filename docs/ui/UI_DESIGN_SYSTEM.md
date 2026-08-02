# TUBA AL HIJAZ — Enterprise Design System

**Sprint:** UI-01  
**Status:** Documentation foundation (Single Source of Truth)  
**Scope:** UI foundation only — no page redesign, no code changes  
**Date:** 2026-08-01  

---

## 1. Purpose

This design system is the **Single Source of Truth (SSOT)** for all future ERP UI work across Tuba Al Hijaz.

It captures what the product already is, then freezes the vocabulary for:

- Colors, type, spacing, elevation  
- Components, states, interaction  
- Language (Bangla default)  
- Operations-first layout density  

Later UI sprints **extend** this system. They do not invent parallel palettes, fonts, or component dialects.

---

## 2. Design Goals

| Goal | Meaning |
|------|---------|
| Simple | One clear action per region; no decorative chrome |
| Clean | Light surfaces, quiet borders, restrained gold accent |
| Professional | Navy authority; finance/ops-grade density |
| Operations First | Tables, queues, drawers, KPIs before marketing polish |
| Minimal Clicks | Drill from dashboard → desk → action without detours |
| Inspired UX | Clarity of Apple / Stripe / Linear / Notion / Google Workspace — **not copied** |

**Not goals:** Consumer social UI, purple-glow dashboards, card soup, emoji status systems.

---

## 3. Authority & Source Map

| Layer | Authority |
|-------|-----------|
| Product / architecture | `docs/PRODUCT_MASTER_SPEC.md`, TRANSFORM docs |
| Visual tokens (code) | `apps/web/src/styles/theme.css` |
| Fonts | `apps/web/src/styles/fonts.css` |
| Micro-interactions | `apps/web/src/styles/interactions.css` |
| Living reference page | `apps/web/src/app/pages/DesignSystem.tsx` |
| Shell | `apps/web/src/app/components/ERPShell.tsx` |
| Shared states | `apps/web/src/app/components/States.tsx` |
| Language | `LangContext` default `"bn"` + `@tuba/shared` i18n |

**Companion docs (this sprint):**

| Doc | Topic |
|-----|-------|
| [UI_COLOR_SYSTEM.md](./UI_COLOR_SYSTEM.md) | Palette, modules, status |
| [UI_TYPOGRAPHY.md](./UI_TYPOGRAPHY.md) | Fonts, scale, Bangla |
| [UI_SPACING_SYSTEM.md](./UI_SPACING_SYSTEM.md) | Grid, spacing, radius, elevation |
| [UI_COMPONENT_GUIDE.md](./UI_COMPONENT_GUIDE.md) | Buttons, forms, tables, drawers… |
| [UI_ICON_GUIDE.md](./UI_ICON_GUIDE.md) | Lucide sizes & usage |
| [UI_ACCESSIBILITY.md](./UI_ACCESSIBILITY.md) | Focus, contrast, i18n a11y |
| [UI_02_NAVIGATION.md](./UI_02_NAVIGATION.md) | App shell + global nav (UI-02) |
| [UI_03_DASHBOARD.md](./UI_03_DASHBOARD.md) | Operations Today dashboard (UI-03) |
| [UI_04_COMPONENT_STANDARD.md](./UI_04_COMPONENT_STANDARD.md) | Reusable ERP kit (UI-04) |
| [UI_04_FORM_STANDARD.md](./UI_04_FORM_STANDARD.md) | Form / drawer / dialog rules |
| [UI_04_TABLE_STANDARD.md](./UI_04_TABLE_STANDARD.md) | Table / search / filter rules |

---

## 4. Dual Surface Model (do not collapse)

The product has **two** light surfaces. Both are valid.

| Surface | Background | Where |
|---------|------------|--------|
| **Marketing** | `#F4F1EC` (warm cream = `--background`) | Home, About, Services, public pages |
| **ERP / Ops** | `#F5F7FA` (cool gray) | ERPShell, portals, Login, desks, dashboards |

Cards elevate to `#FFFFFF` / `#FBFCFD`.  
Toasts use a dark chrome (`#0D1E3A`) on an otherwise light app.

---

## 5. Brand Pillars

| Token | Value | Role |
|-------|-------|------|
| Navy | `#0B1E3F` | Authority, text, primary actions |
| Gold | `#C9A24B` | Accent, focus ring, active highlights |
| Destructive | `#DC2626` | Errors, danger |
| Success | `#16A34A` | Completed / ready |

Module accents (Visa teal, Hotel blue, Ops coral, etc.) color **context**, never replace Navy as the structural ink.

---

## 6. Language (non-negotiable)

| Rule | Detail |
|------|--------|
| **Default** | Bangla (`bn`) |
| Optional | English (`en`) |
| Toggle | Global (`LangProvider` / shell / nav) |
| Every component | Must support Bangla copy, numerals (`toLocalNum`), dates, and `fontFor("bn")` / `lineHeightFor("bn")` |

Arabic (`--font-arabic`) is decorative / RTL specimen only — **not** a third UI language in this system.

---

## 7. Layout Primitives

| Primitive | Spec |
|-----------|------|
| ERP shell | Sidebar 240 / 64 · header `h-14` · canvas `#F5F7FA` |
| Page gutter | Prefer `p-6` / `p-7` for desks |
| Content max (marketing) | `max-w-7xl` + `px-6 lg:px-10` |
| Grid | 8px base unit (see spacing doc) |
| Density | Ops tables: compact `text-[10px]`–`text-xs`; marketing: more air |

---

## 8. Component Philosophy

1. **Reuse before invent** — `States`, `ERPShell`, existing desk patterns.  
2. **Hand-rolled ERP patterns are the living system** — shadcn under `components/ui/` exists but is largely unused by pages; do not dual-track without a later adoption sprint.  
3. **States are first-class** — Empty, Loading (skeleton), Error, Sample banner.  
4. **No business actions without confirmation density** — destructive actions stay visually loud (`#DC2626`).  
5. **Drawers for detail, tables for worklists** — operations first.

---

## 9. Interaction Baseline

| State | Behavior |
|-------|----------|
| Hover | Soft opacity / module tint; not large shadow jumps |
| Active | Slight scale (`~0.96`) on press |
| Focus | Gold ring / gold border (see accessibility) |
| Disabled | Opacity ~40–50%; no pointer events |
| Loading | Skeleton or `Loader2` spin — never blank white forever |
| Motion | Purposeful; respect `prefers-reduced-motion` |

---

## 10. Dark Mode

| Fact | Policy for UI-01 |
|------|------------------|
| `.dark` CSS tokens exist in `theme.css` | Reserved |
| No runtime theme toggle in product | **Light is the shipped default** |
| Ops “dark tone” in `States` | Soft navy alphas on light canvas — not full dark theme |

Future dark mode must reuse the same token names — not a second ad-hoc palette.

---

## 11. Responsive Policy

| Breakpoint | Tailwind | Use |
|------------|----------|-----|
| sm | 640 | Stack → row CTAs |
| md | 768 | Marketing nav; `useIsMobile` |
| lg | 1024 | Login brand panel; denser grids |
| xl | 1280 | Marketing type / hero |

ERP desks are **desktop-first**. Mobile must not break; full tablet redesign is out of UI-01.

---

## 12. What UI-01 Explicitly Does Not Do

- No database / API / RBAC / workflow / OCR / visa / finance / Long Stay / automation changes  
- No page redesign  
- No component rewrite  
- No new design tool file required for this sprint  

---

## 13. Adoption Rule (for later sprints)

Any new UI screen must:

1. Use Navy / Gold / module accent from [UI_COLOR_SYSTEM.md](./UI_COLOR_SYSTEM.md)  
2. Use type + Bangla rules from [UI_TYPOGRAPHY.md](./UI_TYPOGRAPHY.md)  
3. Use spacing / radius from [UI_SPACING_SYSTEM.md](./UI_SPACING_SYSTEM.md)  
4. Use component recipes from [UI_COMPONENT_GUIDE.md](./UI_COMPONENT_GUIDE.md)  
5. Pass accessibility expectations in [UI_ACCESSIBILITY.md](./UI_ACCESSIBILITY.md)  

**STOP** — UI-01 ends at documentation.
