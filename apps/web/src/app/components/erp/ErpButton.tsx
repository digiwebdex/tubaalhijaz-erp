import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ERP } from "./tokens";

export type ErpButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ErpButtonSize = "sm" | "md" | "lg";

export interface ErpButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ErpButtonVariant;
  size?: ErpButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const SIZE: Record<ErpButtonSize, CSSProperties> = {
  /** Dense table actions — coarse pointers bump via `.erp-btn` media query. */
  sm: { padding: "6px 10px", fontSize: 12, minHeight: 36 },
  md: { padding: "10px 14px", fontSize: 13, minHeight: ERP.touchMin },
  lg: { padding: "12px 18px", fontSize: 14, minHeight: ERP.touchMin },
};

function variantStyle(v: ErpButtonVariant, disabled: boolean): CSSProperties {
  const base: CSSProperties = {
    borderRadius: ERP.radius.sm,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    border: "1px solid transparent",
    transition: "opacity 120ms ease, transform 80ms ease, background-color 120ms ease",
  };
  switch (v) {
    case "primary":
      return { ...base, backgroundColor: ERP.navy, color: "#FFFFFF" };
    case "secondary":
      return {
        ...base,
        backgroundColor: ERP.surfaceSoft,
        color: ERP.navy,
        border: `1px solid ${ERP.border}`,
      };
    case "outline":
      return {
        ...base,
        backgroundColor: "transparent",
        color: ERP.navy,
        border: `1px solid ${ERP.borderStrong}`,
      };
    case "ghost":
      return { ...base, backgroundColor: "transparent", color: ERP.navy };
    case "danger":
      return { ...base, backgroundColor: ERP.destructive, color: "#FFFFFF" };
  }
}

/** Standard ERP button — Primary / Secondary / Outline / Ghost / Danger + loading. */
export function ErpButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  icon,
  children,
  style,
  type = "button",
  ...rest
}: ErpButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      className="erp-btn"
      disabled={isDisabled}
      style={{ ...variantStyle(variant, !!isDisabled), ...SIZE[size], ...style }}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
