import type { ReactNode } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { ERP, erpAlpha } from "./tokens";

export interface ErpFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Bangla-first toggle label */
  labelBn?: string;
  labelEn?: string;
  lang?: "bn" | "en";
  /** Optional active filter count badge */
  activeCount?: number;
  className?: string;
}

/**
 * Slide-down filter panel — collapsed by default (controlled).
 */
export function ErpFilterPanel({
  open,
  onOpenChange,
  children,
  labelBn = "ফিল্টার",
  labelEn = "Filters",
  lang = "bn",
  activeCount,
  className,
}: ErpFilterPanelProps) {
  const label = lang === "bn" ? labelBn : labelEn;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-3 rounded-lg text-sm font-semibold min-h-[40px]"
        style={{
          backgroundColor: open ? erpAlpha(ERP.gold, 9) : ERP.surface,
          border: `1px solid ${open ? erpAlpha(ERP.gold, 33) : ERP.border}`,
          color: ERP.navy,
        }}
      >
        <Filter size={15} style={{ color: ERP.muted }} aria-hidden />
        {label}
        {typeof activeCount === "number" && activeCount > 0 && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: erpAlpha(ERP.gold, 16), color: ERP.navy }}
          >
            {activeCount}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: ERP.muted }}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="mt-3 rounded-xl p-4"
          style={{
            backgroundColor: ERP.surface,
            border: `1px solid ${ERP.border}`,
          }}
          role="region"
          aria-label={label}
        >
          {children}
        </div>
      )}
    </div>
  );
}
