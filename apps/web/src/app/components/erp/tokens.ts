/**
 * UI-04 — ERP component tokens (from UI-01 color / spacing SSOT).
 * Single source for the shared kit — do not invent per-screen palettes.
 *
 * THEME-AWARE (2026-08-07): every color/radius value below is a CSS custom
 * property reference. The concrete palette is supplied by whichever theme scope
 * wraps the subtree — Legacy (default, on :root) or Design System (.erp-theme-ds,
 * set by <ErpThemeProvider theme="ds">). Components read ONLY from ERP.* — never
 * hardcode a colour. See app/styles/erp-theme.css for the two palettes.
 */

export const ERP = {
  /** Strong text / headings (legacy brand navy → DS light foreground). */
  navy: "var(--erp-text-strong)",
  textStrong: "var(--erp-text-strong)",
  /** Dimmed foreground (softer than fg, stronger than muted). */
  fgDim: "var(--erp-fg-dim)",
  /** Primary action surface + its foreground (navy-on-white → gold-on-navy). */
  primaryBg: "var(--erp-primary-bg)",
  primaryFg: "var(--erp-primary-fg)",
  /** Foreground on solid danger/success buttons (white, both themes). */
  onDanger: "var(--erp-on-danger)",
  /** Accent (gold in both themes) + its dim fill / border / hover. */
  gold: "var(--erp-accent)",
  accent: "var(--erp-accent)",
  goldDim: "var(--erp-gold-dim)",
  goldBrd: "var(--erp-gold-brd)",
  goldHov: "var(--erp-gold-hov)",
  /** Page background. */
  canvas: "var(--erp-canvas)",
  /** Card / drawer / input surface + soft secondary surface. */
  surface: "var(--erp-surface)",
  surfaceSoft: "var(--erp-surface-soft)",
  border: "var(--erp-border)",
  borderStrong: "var(--erp-border-strong)",
  muted: "var(--erp-muted)",
  mutedSoft: "var(--erp-muted-soft)",
  /** Skeleton / shimmer bar fill. */
  skeleton: "var(--erp-skeleton)",
  /** Modal / drawer backdrop scrim. */
  scrim: "var(--erp-scrim)",
  destructive: "var(--erp-destructive)",
  destructiveDim: "var(--erp-destructive-dim)",
  success: "var(--erp-success)",
  successDim: "var(--erp-success-dim)",
  warning: "var(--erp-warning)",
  warningDim: "var(--erp-warning-dim)",
  info: "var(--erp-info)",
  infoDim: "var(--erp-info-dim)",
  purple: "var(--erp-cat-purple)",
  purpleDim: "var(--erp-purple-dim)",
  pending: "var(--erp-pending)",
  cancelled: "var(--erp-cancelled)",
  focusRing: "var(--erp-focus-ring)",
  radius: {
    xs: "var(--erp-radius-xs)",
    sm: "var(--erp-radius-sm)",
    md: "var(--erp-radius-md)",
    lg: "var(--erp-radius-lg)",
    xl: "var(--erp-radius-xl)",
    xxl: "var(--erp-radius-2xl)",
    full: "9999px",
  },
  shadow: {
    xs: "var(--erp-shadow-xs)",
    sm: "var(--erp-shadow-sm)",
    md: "var(--erp-shadow-md)",
    lg: "var(--erp-shadow-lg)",
    xl: "var(--erp-shadow-xl)",
    brand: "var(--erp-shadow-brand)",
  },
  /** Themed typography (legacy = inherit/system; DS = Instrument Sans / Inter / JetBrains Mono). */
  font: {
    heading: "var(--erp-font-heading)",
    body: "var(--erp-font-body)",
    data: "var(--erp-font-data)",
  },
  /**
   * Spacing scale (px) — the SINGLE source for padding / margin / gap. Keys are the
   * Tailwind numeric scale (n × 4px), so `p-3`/`gap-2` utilities resolve to the SAME
   * tokens: ERP.space[3] === 12 === Tailwind `p-3`. Pages must never use off-scale px.
   */
  space: {
    0: 0, px: 1, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16,
    5: 20, 6: 24, 7: 28, 8: 32, 9: 36, 10: 40, 11: 44, 12: 48, 14: 56, 16: 64,
    20: 80, 24: 96,
  },
  /** Typography scale — size (px) / weight / leading / tracking. The SSOT for text. */
  text: {
    size: { 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 18: 18, 20: 20, 22: 22, 24: 24, 28: 28, 32: 32 },
    weight: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
    leading: { none: 1, tight: 1.1, snug: 1.25, normal: 1.4, relaxed: 1.6 },
    tracking: { tight: "-0.01em", normal: "0", wide: "0.02em", wider: "0.08em", widest: "0.12em" },
  },
  /** Motion — transition presets. */
  motion: {
    fast: "120ms ease",
    base: "160ms ease",
    slow: "240ms ease",
    color: "background-color 120ms ease, color 120ms ease, border-color 120ms ease",
  },
  /** Stacking order. */
  zIndex: { base: 0, dropdown: 10, sticky: 20, header: 30, drawer: 40, modal: 50, toast: 60, tooltip: 70 },
  /** Responsive breakpoints (px) — mirror the Tailwind screens. */
  breakpoint: { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 },
  /** Opacity scale. */
  opacity: { faint: 0.08, disabled: 0.45, muted: 0.6, hover: 0.75, full: 1 },
  drawerMaxWidth: 720,
  /** Minimum interactive target (UI-11 / WCAG touch). */
  touchMin: 44,
} as const;

/**
 * Categorical accent palette — for module / service identity (Visa, Hotel,
 * Transport…), NOT semantic status. Theme-aware via --erp-cat-* CSS vars.
 */
export const CAT = {
  teal: "var(--erp-cat-teal)",
  sky: "var(--erp-cat-sky)",
  blue: "var(--erp-cat-blue)",
  orange: "var(--erp-cat-orange)",
  purple: "var(--erp-cat-purple)",
  slate: "var(--erp-cat-slate)",
  green: "var(--erp-cat-green)",
} as const;

/**
 * Alpha-composite a (possibly CSS-var) colour to a translucent tint.
 * Replaces the old `${color}NN` hex-alpha suffix, which is invalid for
 * `var(--…)` colours. `color-mix` is theme-agnostic and matches the legacy
 * hex-alpha result over any background.
 */
export function erpAlpha(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/** Status chip semantic map (UI color system). */
export type ErpStatusKind =
  | "pending"
  | "warning"
  | "approved"
  | "completed"
  | "rejected"
  | "cancelled"
  | "info";

export const STATUS_META: Record<
  ErpStatusKind,
  { color: string; labelBn: string; labelEn: string }
> = {
  pending:   { color: ERP.pending,     labelBn: "অপেক্ষমাণ",   labelEn: "Pending" },
  warning:   { color: ERP.warning,     labelBn: "সতর্কতা",     labelEn: "Warning" },
  approved:  { color: ERP.success,     labelBn: "অনুমোদিত",    labelEn: "Approved" },
  completed: { color: ERP.success,     labelBn: "সম্পন্ন",     labelEn: "Completed" },
  rejected:  { color: ERP.destructive, labelBn: "প্রত্যাখ্যাত", labelEn: "Rejected" },
  cancelled: { color: ERP.cancelled,   labelBn: "বাতিল",       labelEn: "Cancelled" },
  info:      { color: ERP.info,        labelBn: "তথ্য",        labelEn: "Info" },
};

export const SEARCH_PLACEHOLDER_BN =
  "নাম, পাসপোর্ট নম্বর বা গ্রুপ নম্বর দিয়ে খুঁজুন...";
export const SEARCH_PLACEHOLDER_EN =
  "Search by name, passport, or group number…";
