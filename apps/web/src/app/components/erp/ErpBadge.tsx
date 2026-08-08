import type { CSSProperties, ReactNode } from "react";
import { ERP, STATUS_META, erpAlpha, type ErpStatusKind } from "./tokens";

export interface ErpBadgeProps {
  children: ReactNode;
  color?: string;
  /** Leading status dot. */
  dot?: boolean;
  size?: "sm" | "md";
  className?: string;
  style?: CSSProperties;
}

/** Soft pill badge (counts, tags, status). */
export function ErpBadge({ children, color = ERP.navy, dot = false, size = "md", className, style }: ErpBadgeProps) {
  const sm = size === "sm";
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sm ? 4 : 6,
        padding: sm ? "1px 6px" : "2px 8px",
        borderRadius: ERP.radius.full,
        fontSize: sm ? 9 : 11,
        fontWeight: sm ? 700 : 600,
        backgroundColor: erpAlpha(color, 9),
        color,
        border: `1px solid ${erpAlpha(color, 19)}`,
        ...style,
      }}
    >
      {dot && <span style={{ width: 5, height: 5, borderRadius: ERP.radius.full, backgroundColor: color, flexShrink: 0 }} />}
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
        backgroundColor: erpAlpha(meta.color, 8),
        color: meta.color,
        border: `1px solid ${erpAlpha(meta.color, 16)}`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} aria-hidden />
      {text}
    </span>
  );
}
