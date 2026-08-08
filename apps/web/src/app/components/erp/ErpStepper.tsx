import { Check } from "lucide-react";
import { ERP, erpAlpha } from "./tokens";

export interface ErpStepperProps {
  /** Ordered step labels. */
  steps: string[];
  /** Index of the current (in-progress) step; steps before it render as done. */
  current: number;
  /** Accent for completed/active markers (defaults to ERP.accent). */
  accent?: string;
  /** When true, no step renders as "active" (e.g. a rejected request). */
  halted?: boolean;
}

/**
 * Shared ERP vertical stepper / status timeline. Done steps show a check in an
 * accent ring, the active step a filled accent dot, upcoming steps a muted dot.
 * Theme-driven through ERP tokens.
 */
export function ErpStepper({ steps, current, accent, halted = false }: ErpStepperProps) {
  const a = accent ?? ERP.accent;
  return (
    <div className="relative">
      <div className="absolute left-[9px] top-3 bottom-3 w-px" style={{ backgroundColor: ERP.border }} />
      <div className="space-y-5">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current && !halted;
          return (
            <div key={label} className="relative flex gap-3 items-start">
              {done && <div className="absolute left-[9px] -top-5 h-5 w-px" style={{ backgroundColor: erpAlpha(a, 31) }} />}
              <div
                className="z-10 w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center"
                style={
                  done
                    ? { backgroundColor: erpAlpha(a, 13), border: `1px solid ${erpAlpha(a, 38)}` }
                    : active
                    ? { backgroundColor: a }
                    : { backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }
                }
              >
                {done ? (
                  <Check size={9} style={{ color: a }} />
                ) : active ? (
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ERP.surface }} />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ERP.mutedSoft }} />
                )}
              </div>
              <div
                className="text-xs font-semibold pt-0.5"
                style={{ color: done ? a : active ? ERP.navy : ERP.muted }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
