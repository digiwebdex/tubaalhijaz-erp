import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ERP } from "./tokens";

export interface ErpModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Optional leading icon in the header. */
  icon?: ReactNode;
  children: ReactNode;
  /** Sticky footer (actions). */
  footer?: ReactNode;
  /** Max width in px (default 560). */
  width?: number;
}

/**
 * ErpModal — the shared centered dialog for content/forms/reviews (anything that
 * is NOT a simple yes/no confirmation — use ErpConfirmDialog for those, or
 * ErpDrawer for side panels). Scrim + Escape + backdrop close, portalled to body,
 * header (icon/title/subtitle + close) / scrollable body / sticky footer.
 * Theme-driven through ERP tokens. Reuse this for every modal dialog.
 */
export function ErpModal({ open, onClose, title, subtitle, icon, children, footer, width = 560 }: ErpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: ERP.zIndex.modal }}>
      <button type="button" aria-label="Close" className="absolute inset-0" style={{ backgroundColor: ERP.scrim }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full flex flex-col overflow-hidden"
        style={{ maxWidth: width, maxHeight: "90vh", background: ERP.surface, border: `1px solid ${ERP.border}`, borderRadius: ERP.radius.lg, boxShadow: ERP.shadow.xl }}
      >
        <div className="flex items-start justify-between gap-3" style={{ padding: `${ERP.space[4]}px ${ERP.space[5]}px`, borderBottom: `1px solid ${ERP.border}` }}>
          <div className="flex items-center gap-3 min-w-0">
            {icon != null && (
              <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: ERP.radius.md, background: ERP.goldDim, border: `1px solid ${ERP.goldBrd}` }}>
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate" style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[16], fontWeight: ERP.text.weight.bold, color: ERP.navy }}>{title}</div>
              {subtitle && <div className="truncate" style={{ fontSize: ERP.text.size[12], color: ERP.muted, marginTop: ERP.space[0.5] }}>{subtitle}</div>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex items-center justify-center shrink-0" style={{ width: 30, height: 30, borderRadius: ERP.radius.sm, border: "none", background: "transparent", cursor: "pointer", color: ERP.muted }}>
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto" style={{ padding: `${ERP.space[5]}px`, scrollbarWidth: "thin" }}>
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2" style={{ padding: `${ERP.space[3]}px ${ERP.space[5]}px`, borderTop: `1px solid ${ERP.border}`, background: ERP.surfaceSoft }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
