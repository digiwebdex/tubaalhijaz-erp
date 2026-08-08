# ERP Component Library — the single source of truth

Every module (Agent Portal ✓, Super Admin, Operations, Finance, Supplier …) MUST consume
these components. **Do not hand-roll a UI pattern if an equivalent exists here.** If a new
reusable pattern is genuinely needed: (1) add it to this library, (2) document it in this file,
(3) reuse it everywhere.

All components read **only** from the theme tokens in `tokens.ts` (`ERP.*` colours / `ERP.space`
/ `ERP.text` / `ERP.radius` / `ERP.shadow` / `ERP.motion` / `ERP.zIndex` / `ERP.breakpoint`
/ `ERP.opacity`, plus `CAT` categorical accents and `erpAlpha()`). Theme (Legacy / Design System)
is selected per subtree by `<ErpThemeProvider theme="ds">`.

## Tokens & theming
| Export | Purpose |
|---|---|
| `ERP` | All design tokens (colour/space/text/radius/shadow/motion/zIndex/breakpoint/opacity) |
| `CAT` | Categorical accents (teal/sky/blue/orange/purple/slate/green) for module/service identity |
| `erpAlpha(color, pct)` | Translucent tint of a (var-based) colour via `color-mix` |
| `ErpThemeProvider` / `useErpTheme` | Scope a subtree to `legacy` or `ds` theme |

## Primitives
| Component | Use for |
|---|---|
| `ErpButton` | All buttons (primary/secondary/outline/ghost/danger, sizes, loading, icon) |
| `ErpBadge` | Soft pill badge / count / tag (`dot`, `size` variants) |
| `ErpStatusChip` | Semantic status chip (pending/warning/approved/completed/rejected/cancelled/info) |
| `ErpToggle` | **On/off switch** (settings, feature flags, row toggles) |
| `ErpInput` / `ErpTextarea` / `ErpSelect` | Form controls |
| `ErpField` / `ErpForm` / `ErpFormRow` | Field label + control layout |
| `ErpSearchBar` | Search input with clear |
| `ErpTabs` | Horizontal tab bar (icon + label + active accent) |

## Surfaces & layout
| Component | Use for |
|---|---|
| `ErpCard` / `ErpSectionHeader` | Surface card / section title+subtitle+action |
| `ErpPageTemplate` / `ErpPageHeader` / `ErpQuickActions` | Page scaffold |
| `ErpStatCard` | KPI / stat card (accent border, data-font value, optional `delta` trend) |
| `ErpStepper` | Vertical status timeline / stepper |
| `ErpDataTable` | **Every record/data table** (sorting, selection, sticky header, empty/loading; `flush` to embed in a card) |
| `ErpPagination` | Table pagination |
| `ErpFilterPanel` | Filter toggle panel |

## Overlays
| Component | Use for |
|---|---|
| `ErpModal` | **Generic centered dialog** for content/forms/reviews (scrim, Esc/backdrop close, header/body/footer) |
| `ErpConfirmDialog` / `ErpDeleteDialog` | Yes/no confirmations (destructive delete) |
| `ErpDrawer` / `ErpDrawerFooterActions` | Side panel for forms/detail |
| `erpToast` | Toast notifications |

## States
| Component | Use for |
|---|---|
| `EmptyState` | Designed empty state (never a blank div) |
| `LoadingSkeleton` | Skeleton loader (list/table/cards) |
| `ErrorState` | Error with retry |
| `SampleDataBanner` | "Sample data" notice |

### Changelog
- 2026-08-07 (Module 3): themeable token system; added `ErpTabs`, `ErpStatCard`, `ErpStepper`; `flush` on `ErpDataTable`; `dot`/`size` on `ErpBadge`.
- 2026-08-07 (Module 4): added `ErpToggle` (switch) and `ErpModal` (generic dialog); `delta` on `ErpStatCard`.
