import type { ReactNode } from "react";
import { ERP } from "./tokens";

export interface ErpPageHeaderProps {
  title: string;
  subtitle?: string;
  /** Primary CTA (usually ErpButton primary). */
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

/**
 * Global page header — Title + primary action.
 * Part of the ERP page template (UI-04).
 */
export function ErpPageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  className,
}: ErpPageHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-4 mb-5 ${className ?? ""}`}
    >
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: ERP.navy }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: ERP.muted }}>
            {subtitle}
          </p>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}

export interface ErpQuickActionsProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

/** Horizontal quick-action chip row. */
export function ErpQuickActions({
  children,
  label,
  className,
}: ErpQuickActionsProps) {
  return (
    <div className={className}>
      {label && (
        <div className="text-xs font-semibold mb-2" style={{ color: ERP.muted }}>
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
