import type { CSSProperties, ReactNode } from "react";
import { ERP, STATUS_META, type ErpStatusKind } from "./tokens";

export interface ErpBadgeProps {
  children: ReactNode;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

/** Soft pill badge (counts, tags). */
export function ErpBadge({ children, color = ERP.navy, className, style }: ErpBadgeProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: `${color}18`,
        color,
        border: `1px solid ${color}30`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export interface ErpStatusChipProps {
  status: ErpStatusKind;
  /** Override label; defaults to Bangla then English via `lang`. */
  label?: string;
  lang?: "bn" | "en";
}

/** Status chip — Pending / Warning / Approved / Completed / Rejected / Cancelled. */
export function ErpStatusChip({ status, label, lang = "bn" }: ErpStatusChipProps) {
  const meta = STATUS_META[status];
  const text = label ?? (lang === "bn" ? meta.labelBn : meta.labelEn);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{
        backgroundColor: `${meta.color}15`,
        color: meta.color,
        border: `1px solid ${meta.color}28`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} aria-hidden />
      {text}
    </span>
  );
}
