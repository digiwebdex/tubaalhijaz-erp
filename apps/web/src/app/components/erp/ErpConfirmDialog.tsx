import { useEffect, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ERP, erpAlpha } from "./tokens";
import { ErpButton } from "./ErpButton";

export interface ErpConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger → red confirm (delete) */
  variant?: "default" | "danger";
  loading?: boolean;
  lang?: "bn" | "en";
}

/**
 * Standard confirmation dialog — never invent per-screen modals for delete.
 */
export function ErpConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  loading,
  lang = "bn",
}: ErpConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const confirm =
    confirmLabel ??
    (variant === "danger"
      ? lang === "bn"
        ? "মুছে ফেলুন"
        : "Delete"
      : lang === "bn"
        ? "নিশ্চিত করুন"
        : "Confirm");
  const cancel = cancelLabel ?? (lang === "bn" ? "বাতিল" : "Cancel");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="erp-confirm-title">
      <button
        type="button"
        className="absolute inset-0"
        style={{ backgroundColor: ERP.scrim }}
        aria-label={cancel}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-xl shadow-lg overflow-hidden"
        style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}
      >
        <div className="px-5 py-4 flex items-start gap-3">
          {variant === "danger" && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: erpAlpha(ERP.destructive, 8) }}
            >
              <AlertTriangle size={18} style={{ color: ERP.destructive }} aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="erp-confirm-title" className="text-base font-bold" style={{ color: ERP.navy }}>
              {title}
            </h2>
            {description && (
              <div className="text-sm mt-1.5" style={{ color: ERP.muted }}>
                {description}
              </div>
            )}
          </div>
        </div>
        <div
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: `1px solid ${ERP.border}`, backgroundColor: ERP.surfaceSoft }}
        >
          <ErpButton variant="secondary" onClick={onClose} disabled={loading}>
            {cancel}
          </ErpButton>
          <ErpButton
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirm}
          </ErpButton>
        </div>
      </div>
    </div>
  );
}

/** Delete confirmation — fixed Bangla/EN copy pattern. */
export function ErpDeleteDialog({
  open,
  onClose,
  onConfirm,
  entityLabel,
  loading,
  lang = "bn",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** e.g. group code / passenger name */
  entityLabel?: string;
  loading?: boolean;
  lang?: "bn" | "en";
}) {
  const title = lang === "bn" ? "মুছে ফেলার নিশ্চিতকরণ" : "Confirm delete";
  const description =
    lang === "bn"
      ? entityLabel
        ? `"${entityLabel}" মুছে ফেলবেন? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।`
        : "এই আইটেমটি মুছে ফেলবেন? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।"
      : entityLabel
        ? `Delete “${entityLabel}”? This cannot be undone.`
        : "Delete this item? This cannot be undone.";

  return (
    <ErpConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      variant="danger"
      loading={loading}
      lang={lang}
    />
  );
}
