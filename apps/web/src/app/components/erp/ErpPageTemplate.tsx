import type { ReactNode } from "react";
import { ERP } from "./tokens";
import { ErpPageHeader } from "./ErpPageHeader";

export interface ErpPageTemplateProps {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  /** Search + filter row */
  toolbar?: ReactNode;
  /** Main content (usually table) */
  children: ReactNode;
  /** Pagination below table */
  footer?: ReactNode;
  className?: string;
}

/**
 * Global ERP page template (UI-04):
 * Page Title + Primary Action → Search/Filter → Table → Pagination
 * Drawer / dialogs are portaled by callers (siblings).
 */
export function ErpPageTemplate({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  toolbar,
  children,
  footer,
  className,
}: ErpPageTemplateProps) {
  return (
    <div
      className={`p-4 sm:p-6 md:p-7 h-full overflow-y-auto overflow-x-hidden min-w-0 ${className ?? ""}`}
      style={{ backgroundColor: ERP.canvas, scrollbarWidth: "thin" }}
    >
      <ErpPageHeader
        title={title}
        subtitle={subtitle}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />
      {toolbar && <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start">{toolbar}</div>}
      <div className="mb-4">{children}</div>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}
