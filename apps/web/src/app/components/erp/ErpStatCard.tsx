import type { CSSProperties, ReactNode } from "react";
import { ERP } from "./tokens";

export interface ErpStatCardProps {
  label: ReactNode;
  /** Rendered in the data font; pass a preformatted string (e.g. "SAR 1,200"). */
  value: ReactNode;
  icon?: ReactNode;
  /** Accent for the top border + value colour (defaults to ERP.accent). */
  accent?: string;
  hint?: ReactNode;
  /** Optional trend indicator shown top-right (green ▲ up / red ▼ down). */
  delta?: { val: string; up: boolean };
  onClick?: () => void;
  style?: CSSProperties;
}

/**
 * Shared ERP KPI / stat card — surface panel, accent top-border, data-font value.
 * Theme-driven through ERP tokens. Becomes a <button> when `onClick` is given.
 */
export function ErpStatCard({ label, value, icon, accent, hint, delta, onClick, style }: ErpStatCardProps) {
  const a = accent ?? ERP.accent;
  const inner = (
    <>
      {delta ? (
        <div className="flex items-start justify-between" style={{ marginBottom: ERP.space[1.5] }}>
          {icon != null ? <div style={{ fontSize: ERP.text.size[18] }}>{icon}</div> : <span />}
          <span className="inline-flex items-center gap-1" style={{ fontSize: ERP.text.size[12], fontWeight: ERP.text.weight.semibold, color: delta.up ? ERP.success : ERP.destructive }}>
            {delta.up ? "▲" : "▼"} {delta.val}
          </span>
        </div>
      ) : (
        icon != null && <div style={{ fontSize: ERP.text.size[18], marginBottom: ERP.space[1.5] }}>{icon}</div>
      )}
      <div style={{ fontFamily: ERP.font.data, fontSize: ERP.text.size[20], fontWeight: ERP.text.weight.bold, color: a, lineHeight: ERP.text.leading.tight }}>
        {value}
      </div>
      <div style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[10], color: ERP.muted, marginTop: ERP.space[1.5], letterSpacing: "0.02em" }}>
        {label}
      </div>
      {hint != null && (
        <div style={{ fontSize: ERP.text.size[10], color: ERP.mutedSoft, marginTop: ERP.space[0.5] }}>{hint}</div>
      )}
    </>
  );
  const base: CSSProperties = {
    textAlign: "left",
    background: ERP.surface,
    border: `1px solid ${ERP.border}`,
    borderTop: `2px solid ${a}`,
    borderRadius: ERP.radius.md,
    padding: `${ERP.space[3.5]}px ${ERP.space[4]}px`,
    ...style,
  };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...base, cursor: "pointer", width: "100%" }}>
        {inner}
      </button>
    );
  }
  return <div style={base}>{inner}</div>;
}
