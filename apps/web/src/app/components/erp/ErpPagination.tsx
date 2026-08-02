import { ChevronLeft, ChevronRight } from "lucide-react";
import { ERP } from "./tokens";
import { ErpButton } from "./ErpButton";

export interface ErpPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  lang?: "bn" | "en";
  className?: string;
}

/** Compact pagination — page / total with prev-next. */
export function ErpPagination({
  page,
  pageSize,
  total,
  onPageChange,
  lang = "bn",
  className,
}: ErpPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  const summary =
    lang === "bn"
      ? `${from}–${to} / মোট ${total}`
      : `${from}–${to} of ${total}`;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}
      style={{ color: ERP.navy }}
    >
      <div className="text-xs" style={{ color: ERP.muted }}>
        {summary}
      </div>
      <div className="flex items-center gap-1.5">
        <ErpButton
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label={lang === "bn" ? "পূর্ববর্তী" : "Previous"}
          icon={<ChevronLeft size={14} />}
        >
          {lang === "bn" ? "আগে" : "Prev"}
        </ErpButton>
        <span className="text-xs font-semibold px-2 tabular-nums" style={{ color: ERP.navy }}>
          {safePage} / {pages}
        </span>
        <ErpButton
          variant="outline"
          size="sm"
          disabled={safePage >= pages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label={lang === "bn" ? "পরবর্তী" : "Next"}
          icon={<ChevronRight size={14} />}
        >
          {lang === "bn" ? "পরে" : "Next"}
        </ErpButton>
      </div>
    </div>
  );
}
