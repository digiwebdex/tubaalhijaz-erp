import type { InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { ERP, SEARCH_PLACEHOLDER_BN, SEARCH_PLACEHOLDER_EN } from "./tokens";

export interface ErpSearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  lang?: "bn" | "en";
  onClear?: () => void;
}

/**
 * Global search — one consistent placeholder & layout.
 * Default placeholder (bn): নাম, পাসপোর্ট নম্বর বা গ্রুপ নম্বর দিয়ে খুঁজুন...
 */
export function ErpSearchBar({
  lang = "bn",
  value,
  onClear,
  placeholder,
  className,
  style,
  ...rest
}: ErpSearchBarProps) {
  const ph = placeholder ?? (lang === "bn" ? SEARCH_PLACEHOLDER_BN : SEARCH_PLACEHOLDER_EN);
  const hasValue = typeof value === "string" && value.length > 0;

  return (
    <div className={`relative w-full min-w-0 ${className ?? ""}`} style={style}>
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: ERP.muted }}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        placeholder={ph}
        aria-label={ph}
        className="w-full rounded-lg text-sm focus:outline-none"
        style={{
          height: 40,
          paddingLeft: 36,
          paddingRight: hasValue && onClear ? 36 : 12,
          backgroundColor: ERP.surface,
          border: `1px solid ${ERP.border}`,
          color: ERP.navy,
        }}
        {...rest}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center"
          aria-label={lang === "bn" ? "মুছুন" : "Clear"}
          style={{ color: ERP.muted }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
