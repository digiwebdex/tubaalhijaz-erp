import { memo, useMemo, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { ERP, erpAlpha } from "./tokens";
import { EmptyState, LoadingSkeleton } from "../States";

export type ErpSortDir = "asc" | "desc";

export interface ErpColumn<T> {
  id: string;
  header: string;
  /** Cell renderer */
  cell: (row: T) => ReactNode;
  /** Optional sort key — when set, header is clickable */
  sortable?: boolean;
  width?: string | number;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface ErpDataTableProps<T> {
  columns: ErpColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Bangla-first empty copy */
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  lang?: "bn" | "en";
  sortBy?: string;
  sortDir?: ErpSortDir;
  onSortChange?: (id: string, dir: ErpSortDir) => void;
  /** Bulk selection */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectedKeysChange?: (keys: Set<string>) => void;
  /** Row click / actions */
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  stickyHeader?: boolean;
  /** Stick first data column while table scrolls horizontally (UI-11). */
  stickyFirstColumn?: boolean;
  /** Remove the outer border/radius/surface — for embedding inside an ErpCard. */
  flush?: boolean;
  className?: string;
}

/**
 * Standard ERP data table — sticky header, compact rows, large targets,
 * sorting, bulk selection, row actions. Column resize is not enabled
 * (not supported in current product tables — see UI_04_TABLE_STANDARD).
 *
 * ESP-03 — memoized to skip re-renders when parent chrome updates with
 * identical rows/columns props.
 */
export const ErpDataTable = memo(function ErpDataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle,
  emptyHint,
  emptyAction,
  lang = "bn",
  sortBy,
  sortDir = "asc",
  onSortChange,
  selectable,
  selectedKeys,
  onSelectedKeysChange,
  onRowClick,
  rowActions,
  stickyHeader = true,
  stickyFirstColumn = true,
  flush = false,
  className,
}: ErpDataTableProps<T>) {
  const allKeys = useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const allSelected =
    selectable && allKeys.length > 0 && allKeys.every((k) => selectedKeys?.has(k));
  const someSelected =
    selectable && allKeys.some((k) => selectedKeys?.has(k)) && !allSelected;

  const toggleAll = () => {
    if (!onSelectedKeysChange) return;
    if (allSelected) onSelectedKeysChange(new Set());
    else onSelectedKeysChange(new Set(allKeys));
  };

  const toggleOne = (key: string) => {
    if (!onSelectedKeysChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedKeysChange(next);
  };

  const onHeaderSort = (col: ErpColumn<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (sortBy === col.id) {
      onSortChange(col.id, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(col.id, "asc");
    }
  };

  const firstColSticky = (isFirst: boolean): CSSProperties =>
    stickyFirstColumn && isFirst
      ? {
          position: "sticky",
          left: selectable ? 40 : 0,
          zIndex: stickyHeader ? 11 : 2,
          backgroundColor: ERP.surfaceSoft,
          boxShadow: `2px 0 0 ${ERP.border}`,
        }
      : {};

  const firstCellSticky = (isFirst: boolean, selected?: boolean): CSSProperties =>
    stickyFirstColumn && isFirst
      ? {
          position: "sticky",
          left: selectable ? 40 : 0,
          zIndex: 1,
          backgroundColor: selected ? erpAlpha(ERP.gold, 6) : ERP.surface,
          boxShadow: `2px 0 0 ${ERP.border}`,
        }
      : {};

  return (
    <div
      className={`overflow-hidden min-w-0 ${flush ? "" : "rounded-xl"} ${className ?? ""}`}
      style={flush ? undefined : { backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}
    >
      <div className="overflow-x-auto" style={{ maxHeight: "min(70vh, 720px)", WebkitOverflowScrolling: "touch" }}>
        <table className="w-full border-collapse text-left" style={{ minWidth: 560 }}>
          <thead
            style={
              stickyHeader
                ? { position: "sticky", top: 0, zIndex: 10, backgroundColor: ERP.surfaceSoft }
                : { backgroundColor: ERP.surfaceSoft }
            }
          >
            <tr style={{ borderBottom: `1px solid ${ERP.border}` }}>
              {selectable && (
                <th
                  className="px-3 py-3 w-10"
                  style={
                    stickyFirstColumn
                      ? { position: "sticky", left: 0, zIndex: 12, backgroundColor: ERP.surfaceSoft }
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !!someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label={lang === "bn" ? "সব নির্বাচন" : "Select all"}
                    className="w-4 h-4"
                    style={{ width: 18, height: 18 }}
                  />
                </th>
              )}
              {columns.map((col, colIdx) => (
                <th
                  key={col.id}
                  className={`px-3 py-3 text-[11px] font-bold uppercase tracking-wide ${col.className ?? ""}`}
                  style={{
                    color: ERP.muted,
                    width: col.width,
                    textAlign: col.align ?? "left",
                    cursor: col.sortable ? "pointer" : "default",
                    userSelect: "none",
                    ...firstColSticky(colIdx === 0),
                  }}
                  onClick={() => onHeaderSort(col)}
                  aria-sort={
                    sortBy === col.id ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                  }
                >
                  {col.header}
                  {col.sortable && sortBy === col.id && (
                    <span className="ml-1" aria-hidden>
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
              {rowActions && (
                <th
                  className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-right"
                  style={{ color: ERP.muted }}
                >
                  {lang === "bn" ? "কার্যক্রম" : "Actions"}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="px-3 py-4"
                >
                  <LoadingSkeleton tone="light" rows={5} variant="table" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="px-3"
                >
                  <EmptyState
                    tone="light"
                    title={emptyTitle ?? (lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No data found")}
                    hint={emptyHint}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const selected = selectedKeys?.has(key);
                return (
                  <tr
                    key={key}
                    className="transition-colors hover:bg-[var(--erp-surface-soft)]"
                    style={{
                      borderBottom: `1px solid ${ERP.border}`,
                      backgroundColor: selected ? erpAlpha(ERP.gold, 6) : undefined,
                      cursor: onRowClick ? "pointer" : "default",
                    }}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td
                        className="px-3 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                        style={
                          stickyFirstColumn
                            ? {
                                position: "sticky",
                                left: 0,
                                zIndex: 2,
                                backgroundColor: selected ? erpAlpha(ERP.gold, 6) : ERP.surface,
                              }
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => toggleOne(key)}
                          aria-label={lang === "bn" ? "নির্বাচন" : "Select row"}
                          className="w-4 h-4"
                          style={{ width: 18, height: 18 }}
                        />
                      </td>
                    )}
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.id}
                        className={`px-3 py-2.5 text-xs ${col.className ?? ""}`}
                        style={{
                          color: ERP.navy,
                          textAlign: col.align ?? "left",
                          minHeight: ERP.touchMin,
                          ...firstCellSticky(colIdx === 0, selected),
                        }}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                    {rowActions && (
                      <td
                        className="px-3 py-2.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1 min-h-[44px]">
                          {rowActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}) as <T>(props: ErpDataTableProps<T>) => ReactElement;
