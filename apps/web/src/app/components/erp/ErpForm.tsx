import type { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ERP } from "./tokens";

export interface ErpFormProps {
  children: ReactNode;
  /** Max two columns on md+ */
  columns?: 1 | 2;
  className?: string;
  onSubmit?: (e: FormEvent) => void;
}

/** Form layout — single column below tablet; two columns from `lg` (UI-04 / UI-11). */
export function ErpForm({ children, columns = 2, className, onSubmit }: ErpFormProps) {
  const grid =
    columns === 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4";
  return (
    <form className={`${grid} ${className ?? ""}`} onSubmit={onSubmit}>
      {children}
    </form>
  );
}

/** Full-width field spanning both columns. */
export function ErpFormRow({ children, span = 1 }: { children: ReactNode; span?: 1 | 2 }) {
  return <div className={span === 2 ? "lg:col-span-2" : undefined}>{children}</div>;
}

export interface ErpFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label + control + inline error — Bangla-first labels from caller. */
export function ErpField({ label, htmlFor, required, error, hint, children }: ErpFieldProps) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold mb-1.5"
        style={{ color: ERP.navy }}
      >
        {label}
        {required && (
          <span className="ml-0.5" style={{ color: ERP.destructive }} aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> required</span>}
      </label>
      {children}
      {hint && !error && (
        <div className="text-[11px] mt-1" style={{ color: ERP.muted }}>
          {hint}
        </div>
      )}
      {error && (
        <div className="text-[11px] mt-1 font-medium" style={{ color: ERP.destructive }} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

const controlBase = {
  width: "100%",
  height: ERP.touchMin,
  minHeight: ERP.touchMin,
  padding: "0 12px",
  borderRadius: ERP.radius.sm,
  border: `1px solid ${ERP.border}`,
  backgroundColor: ERP.surface,
  color: ERP.navy,
  fontSize: ERP.text.size[13],
} as const;

export function ErpInput({
  error,
  style,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      style={{
        ...controlBase,
        borderColor: error ? ERP.destructive : ERP.border,
        ...style,
      }}
      aria-invalid={error || undefined}
      {...rest}
    />
  );
}

export function ErpTextarea({
  error,
  style,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      style={{
        ...controlBase,
        height: "auto",
        minHeight: 88,
        padding: ERP.space[3],
        borderColor: error ? ERP.destructive : ERP.border,
        resize: "vertical",
        ...style,
      }}
      aria-invalid={error || undefined}
      {...rest}
    />
  );
}

export function ErpSelect({
  error,
  style,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      style={{
        ...controlBase,
        borderColor: error ? ERP.destructive : ERP.border,
        ...style,
      }}
      aria-invalid={error || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}
