import type { CSSProperties, ReactNode } from "react";
import { ERP } from "./tokens";

export interface ErpCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  padding?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

const PAD = { sm: 16, md: 20, lg: 24 } as const;

/** Surface card — soft border, no gradient. */
export function ErpCard({
  children,
  title,
  subtitle,
  action,
  padding = "md",
  className,
  style,
}: ErpCardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: ERP.surface,
        border: `1px solid ${ERP.border}`,
        borderRadius: ERP.radius.md,
        boxShadow: "0 1px 2px rgba(11,30,63,0.04)",
        ...style,
      }}
    >
      {(title || action) && (
        <div
          className="flex items-start justify-between gap-3"
          style={{
            padding: `${PAD[padding]}px ${PAD[padding]}px 0`,
          }}
        >
          <div className="min-w-0">
            {title && (
              <div className="text-sm font-bold truncate" style={{ color: ERP.navy }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div className="text-xs mt-0.5" style={{ color: ERP.muted }}>
                {subtitle}
              </div>
            )}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: PAD[padding] }}>{children}</div>
    </div>
  );
}

export interface ErpSectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

/** Section title row inside a page. */
export function ErpSectionHeader({ title, subtitle, action, className }: ErpSectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 mb-3 ${className ?? ""}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-bold" style={{ color: ERP.navy }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
