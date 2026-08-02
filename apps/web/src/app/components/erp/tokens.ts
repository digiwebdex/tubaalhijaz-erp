/**
 * UI-04 — ERP component tokens (from UI-01 color / spacing SSOT).
 * Single source for shared kit — do not invent per-screen palettes.
 */

export const ERP = {
  navy: "#0B1E3F",
  gold: "#C9A24B",
  canvas: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceSoft: "#FBFCFD",
  border: "rgba(11,30,63,0.11)",
  borderStrong: "rgba(11,30,63,0.18)",
  muted: "rgba(11,30,63,0.55)",
  mutedSoft: "rgba(11,30,63,0.38)",
  destructive: "#DC2626",
  success: "#16A34A",
  warning: "#D97706",
  info: "#2563EB",
  pending: "#6B7280",
  cancelled: "#6B7280",
  focusRing: "0 0 0 3px rgba(201,162,75,0.18)",
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  drawerMaxWidth: 720,
  /** Minimum interactive target (UI-11 / WCAG touch). */
  touchMin: 44,
} as const;

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
