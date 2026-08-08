import { ERP } from "./tokens";

export interface ErpToggleProps {
  /** Current on/off state. */
  on: boolean;
  /** Fired when the user flips the switch. */
  onToggle: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
}

/**
 * ErpToggle — the shared on/off switch (settings, feature flags, row toggles).
 * Theme-driven through ERP tokens (accent when on, soft surface when off).
 * Use this everywhere a boolean switch is needed — do not hand-roll toggles.
 */
export function ErpToggle({ on, onToggle, disabled = false, size = "md", ariaLabel }: ErpToggleProps) {
  const sm = size === "sm";
  const w = sm ? 32 : 36;
  const h = sm ? 18 : 20;
  const knob = sm ? 14 : 16;
  const pad = 2;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className="relative rounded-full shrink-0"
      style={{
        width: w,
        height: h,
        backgroundColor: on ? ERP.accent : ERP.surfaceSoft,
        border: `1px solid ${on ? ERP.accent : ERP.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? ERP.opacity.disabled : 1,
        transition: ERP.motion.color,
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          top: pad,
          left: pad,
          width: knob,
          height: knob,
          backgroundColor: on ? ERP.primaryFg : ERP.surface,
          boxShadow: ERP.shadow.xs,
          transform: on ? `translateX(${w - knob - pad * 2}px)` : "translateX(0)",
          transition: `transform ${ERP.motion.fast}`,
        }}
      />
    </button>
  );
}
