// ─── Canonical Empty / Loading / Error states ────────────────────────────────
// Lifted VERBATIM from the Figma design system so wired pages reuse the designed
// states instead of inventing new ones:
//   • light Empty + Loading Skeleton → DesignSystem.tsx "Empty State" / "Loading Skeleton"
//   • light Error                    → DesignSystem.tsx input error state (#DC2626/#FEF2F2/#991B1B)
//   • dark Empty                     → OpsDepartments "No messages yet" (rgba(11,30,63,0.50))
//   • dark Error                     → ERPShell urgent notification (#EF4444 / rgba(239,68,68,0.04) / #F87171)
//   • dark Skeleton                  → dark surface token (rgba(11,30,63,0.38), same family as ERPShell 0.05/0.07)
// No new visual language: these are the existing tokens, reused.

import type { ReactNode } from "react";
import { FileText, AlertTriangle, AlertCircle } from "lucide-react";

const NAVY = "#0B1E3F";
export type Tone = "light" | "dark";

/** Designed empty state — never a blank div. */
export function EmptyState({
  title, hint, icon, tone = "light", action,
}: { title: string; hint?: string; icon?: ReactNode; tone?: Tone; action?: ReactNode }) {
  const dark = tone === "dark";
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 flex items-center justify-center">
        {icon ?? (
          <FileText
            size={32}
            className={dark ? "opacity-25" : "opacity-20"}
            style={{ color: dark ? "rgba(11,30,63,0.66)" : NAVY }}
          />
        )}
      </div>
      <div
        className="text-sm font-semibold"
        style={{ color: dark ? "rgba(11,30,63,0.76)" : NAVY }}
      >
        {title}
      </div>
      {hint && (
        <div className="text-xs mt-1" style={{ color: dark ? "rgba(11,30,63,0.50)" : "#9CA3AF" }}>
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
  tone = "light",
  variant = "list",
}: {
  rows?: number;
  tone?: Tone;
  variant?: "list" | "table" | "cards";
}) {
  const bar = tone === "dark" ? "rgba(11,30,63,0.38)" : "#EDE9E3";
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
  message, onRetry, tone = "light", retryLabel, lang = "en",
}: {
  message?: string;
  onRetry?: () => void;
  tone?: Tone;
  /** UI-04 — override retry label; defaults Bangla when lang=bn */
  retryLabel?: string;
  lang?: "bn" | "en";
}) {
  const dark = tone === "dark";
  const defaultMsg = lang === "bn" ? "ডেটা লোড করা যায়নি" : "Could not load this data";
  const retry = retryLabel ?? (lang === "bn" ? "আবার চেষ্টা করুন" : "Retry");
  return (
    <div
      className="px-4 py-3 rounded-xl flex items-start gap-3"
      style={{
        backgroundColor: dark ? "rgba(239,68,68,0.04)" : "#FEF2F2",
        border: `1px solid ${dark ? "rgba(239,68,68,0.25)" : "#DC2626"}`,
      }}
      role="alert"
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: dark ? "#EF4444" : "#DC2626" }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold" style={{ color: dark ? "#DC2626" : "#991B1B" }}>
          {message ?? defaultMsg}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-[10px] font-bold mt-1 underline transition-opacity hover:opacity-75"
            style={{ color: dark ? "#DC2626" : "#991B1B" }}
          >
            {retry}
          </button>
        )}
      </div>
    </div>
  );
}

/** "This screen shows sample data" notice.
 *  Structure lifted VERBATIM from the Figma expiring-docs alert banner
 *  (AgentPortal @ 0f07548 line 664): `{COLOR}10` fill + `{COLOR}30` border + icon +
 *  bold label + muted detail. Recoloured to amber #F59E0B, the design's existing
 *  warning colour (AgentPortal notification feed, FleetERP/Dashboards warning states).
 *  No new visual language — the designed banner in the designed warning tone. */
export function SampleDataBanner({
  detail, tone = "light", className = "mb-5",
}: { detail?: string; tone?: Tone; className?: string }) {
  const AMBER = "#F59E0B";
  const dark = tone === "dark";
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${className}`}
      style={{
        backgroundColor: dark ? `${AMBER}10` : "#FFFBEB",
        border: `1px solid ${AMBER}30`,
      }}
    >
      <AlertCircle size={14} className="shrink-0" style={{ color: AMBER }} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold" style={{ color: AMBER }}>Sample data</span>
        <span className="text-xs ml-2" style={{ color: dark ? "rgba(11,30,63,0.66)" : "#92400E" }}>
          {detail ?? "This screen is not connected to live data yet."}
        </span>
      </div>
    </div>
  );
}
