// ─── Canonical Empty / Loading / Error states ────────────────────────────────
// Lifted VERBATIM from the Figma design system so wired pages reuse the designed
// states instead of inventing new ones.
//
// THEME-AWARE (2026-08-07): colours now come from the shared ERP theme tokens
// (components/erp/tokens.ts → --erp-* CSS vars), so these states follow whichever
// theme scope wraps them — Legacy (default) or Design System (.erp-theme-ds). The
// legacy palette values in styles/erp-theme.css reproduce the original look, so
// existing light modules are unchanged. The `tone` prop is retained for call-site
// API compatibility but no longer selects a hardcoded palette.

import type { ReactNode } from "react";
import { FileText, AlertTriangle, AlertCircle } from "lucide-react";
import { ERP, erpAlpha } from "./erp/tokens";

export type Tone = "light" | "dark";

/** Designed empty state — never a blank div. */
export function EmptyState({
  title, hint, icon, action,
}: { title: string; hint?: string; icon?: ReactNode; tone?: Tone; action?: ReactNode }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 flex items-center justify-center">
        {icon ?? (
          <FileText size={32} className="opacity-25" style={{ color: ERP.navy }} />
        )}
      </div>
      <div className="text-sm font-semibold" style={{ color: ERP.navy }}>
        {title}
      </div>
      {hint && (
        <div className="text-xs mt-1" style={{ color: ERP.muted }}>
          {hint}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Designed loading skeleton — never a bare spinner or a flash of mock data.
 *  UI-04: prefer skeleton over full-page spinners. `variant="table"` matches compact rows. */
export function LoadingSkeleton({
  rows = 3,
  variant = "list",
}: {
  rows?: number;
  tone?: Tone;
  variant?: "list" | "table" | "cards";
}) {
  const bar = ERP.skeleton;
  if (variant === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 py-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="rounded-xl h-28 animate-pulse" style={{ backgroundColor: bar }} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 animate-pulse items-center">
          {variant === "table" ? (
            <>
              <div className="w-4 h-4 rounded" style={{ backgroundColor: bar }} />
              <div className="flex-1 h-3.5 rounded" style={{ backgroundColor: bar }} />
              <div className="h-3.5 rounded w-20" style={{ backgroundColor: bar }} />
              <div className="h-3.5 rounded w-14" style={{ backgroundColor: bar }} />
              <div className="h-3.5 rounded w-16" style={{ backgroundColor: bar }} />
            </>
          ) : (
            <>
              <div className="w-4 h-4 rounded" style={{ backgroundColor: bar }} />
              <div className="flex-1 h-4 rounded" style={{ backgroundColor: bar }} />
              <div className="h-4 rounded w-24" style={{ backgroundColor: bar }} />
              <div className="h-4 rounded w-16" style={{ backgroundColor: bar }} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** Designed error state — shown instead of silently falling back to demo data. */
export function ErrorState({
  message, onRetry, retryLabel, lang = "en",
}: {
  message?: string;
  onRetry?: () => void;
  tone?: Tone;
  /** UI-04 — override retry label; defaults Bangla when lang=bn */
  retryLabel?: string;
  lang?: "bn" | "en";
}) {
  const defaultMsg = lang === "bn" ? "ডেটা লোড করা যায়নি" : "Could not load this data";
  const retry = retryLabel ?? (lang === "bn" ? "আবার চেষ্টা করুন" : "Retry");
  return (
    <div
      className="px-4 py-3 rounded-xl flex items-start gap-3"
      style={{
        backgroundColor: erpAlpha(ERP.destructive, 6),
        border: `1px solid ${erpAlpha(ERP.destructive, 40)}`,
      }}
      role="alert"
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: ERP.destructive }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold" style={{ color: ERP.destructive }}>
          {message ?? defaultMsg}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-[10px] font-bold mt-1 underline transition-opacity hover:opacity-75"
            style={{ color: ERP.destructive }}
          >
            {retry}
          </button>
        )}
      </div>
    </div>
  );
}

/** "This screen shows sample data" notice — designed warning banner. */
export function SampleDataBanner({
  detail, className = "mb-5",
}: { detail?: string; tone?: Tone; className?: string }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${className}`}
      style={{
        backgroundColor: erpAlpha(ERP.warning, 8),
        border: `1px solid ${erpAlpha(ERP.warning, 24)}`,
      }}
    >
      <AlertCircle size={14} className="shrink-0" style={{ color: ERP.warning }} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold" style={{ color: ERP.warning }}>Sample data</span>
        <span className="text-xs ml-2" style={{ color: ERP.muted }}>
          {detail ?? "This screen is not connected to live data yet."}
        </span>
      </div>
    </div>
  );
}
