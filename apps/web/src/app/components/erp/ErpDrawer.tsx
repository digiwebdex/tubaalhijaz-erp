import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { ERP } from "./tokens";
import { ErpButton } from "./ErpButton";
import { MOBILE_BREAKPOINT } from "../ui/use-mobile";

export interface ErpDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Sticky footer — typically Save / Cancel */
  footer?: ReactNode;
  /** Optional tab strip under header */
  tabs?: ReactNode;
  /** Max width px — capped at 720 (UI-04); mobile always full width (UI-11) */
  maxWidth?: number;
  lang?: "bn" | "en";
}

/**
 * Right-side drawer — desktop ≤720px, mobile full width, scrollable body, sticky footer.
 */
export function ErpDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  tabs,
  maxWidth = ERP.drawerMaxWidth,
  lang = "bn",
}: ErpDrawerProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = Math.min(maxWidth, ERP.drawerMaxWidth);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0"
        style={{ backgroundColor: ERP.scrim }}
        aria-label={lang === "bn" ? "বন্ধ করুন" : "Close overlay"}
        onClick={onClose}
      />
      <aside
        className="relative flex flex-col h-full shadow-xl min-w-0"
        style={{
          width: isMobile ? "100%" : `min(${width}px, 100vw)`,
          maxWidth: "100vw",
          backgroundColor: ERP.surface,
          borderLeft: isMobile ? "none" : `1px solid ${ERP.border}`,
        }}
      >
        <header
          className="flex items-start gap-3 px-4 sm:px-5 h-auto min-h-14 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${ERP.border}` }}
        >
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: ERP.navy }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-0.5 truncate" style={{ color: ERP.muted }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg flex items-center justify-center shrink-0"
            aria-label={lang === "bn" ? "বন্ধ" : "Close"}
            style={{
              color: ERP.muted,
              backgroundColor: ERP.canvas,
              width: ERP.touchMin,
              height: ERP.touchMin,
              minWidth: ERP.touchMin,
              minHeight: ERP.touchMin,
            }}
          >
            <X size={18} />
          </button>
        </header>

        {tabs && (
          <div className="px-4 sm:px-5 py-2 shrink-0 overflow-x-auto" style={{ borderBottom: `1px solid ${ERP.border}` }}>
            {tabs}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-4" style={{ scrollbarWidth: "thin" }}>
          {children}
        </div>

        {footer && (
          <footer
            className="px-4 sm:px-5 py-3 shrink-0 flex flex-wrap items-center justify-end gap-2"
            style={{ borderTop: `1px solid ${ERP.border}`, backgroundColor: ERP.surface }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}

/** Convenience sticky footer: Cancel + Save */
export function ErpDrawerFooterActions({
  onCancel,
  onSave,
  saving,
  lang = "bn",
  saveLabel,
  cancelLabel,
  saveDisabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  lang?: "bn" | "en";
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
}) {
  return (
    <>
      <ErpButton variant="secondary" onClick={onCancel} disabled={saving}>
        {cancelLabel ?? (lang === "bn" ? "বাতিল" : "Cancel")}
      </ErpButton>
      <ErpButton variant="primary" onClick={onSave} loading={saving} disabled={saveDisabled}>
        {saveLabel ?? (lang === "bn" ? "সংরক্ষণ" : "Save")}
      </ErpButton>
    </>
  );
}
