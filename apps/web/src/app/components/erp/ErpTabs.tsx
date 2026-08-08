import type { CSSProperties, ReactNode } from "react";
import { ERP } from "./tokens";

export interface ErpTab {
  id: string;
  label: ReactNode;
  /** Optional leading icon (any component, e.g. a lucide icon). */
  icon?: React.ElementType;
  /** Optional per-tab accent for icon + active underline (defaults to ERP.accent). */
  accent?: string;
}

export interface ErpTabsProps {
  tabs: ErpTab[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Shared ERP horizontal tab bar — icon + label, active underline, keyboard-
 * accessible. Theme-driven (Legacy / DS) entirely through ERP tokens.
 */
export function ErpTabs({ tabs, active, onChange, ariaLabel, className }: ErpTabsProps) {
  return (
    <div
      className={`flex items-center gap-0.5 overflow-x-auto ${className ?? ""}`}
      style={{ borderBottom: `1px solid ${ERP.border}` }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        const accent = t.accent ?? ERP.accent;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: isActive ? ERP.navy : ERP.muted, outlineColor: ERP.accent, background: "transparent", border: "none", cursor: "pointer" }}
          >
            {Icon && <Icon size={12} style={{ color: isActive ? accent : ERP.mutedSoft }} />}
            {t.label}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ backgroundColor: accent }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
