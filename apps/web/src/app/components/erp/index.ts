/**
 * UI-04 — ERP reusable component kit.
 * Import from `@/app/components/erp` (or relative `../components/erp`).
 * Do not duplicate these patterns inside business pages.
 */

export { ERP, STATUS_META, SEARCH_PLACEHOLDER_BN, SEARCH_PLACEHOLDER_EN } from "./tokens";
export type { ErpStatusKind } from "./tokens";

export { ErpButton } from "./ErpButton";
export type { ErpButtonProps, ErpButtonVariant, ErpButtonSize } from "./ErpButton";

export { ErpBadge, ErpStatusChip } from "./ErpBadge";
export type { ErpBadgeProps, ErpStatusChipProps } from "./ErpBadge";

export { ErpCard, ErpSectionHeader } from "./ErpCard";
export type { ErpCardProps, ErpSectionHeaderProps } from "./ErpCard";

export { ErpPageHeader, ErpQuickActions } from "./ErpPageHeader";
export type { ErpPageHeaderProps, ErpQuickActionsProps } from "./ErpPageHeader";

export { ErpPageTemplate } from "./ErpPageTemplate";
export type { ErpPageTemplateProps } from "./ErpPageTemplate";

export { ErpSearchBar } from "./ErpSearchBar";
export type { ErpSearchBarProps } from "./ErpSearchBar";

export { ErpFilterPanel } from "./ErpFilterPanel";
export type { ErpFilterPanelProps } from "./ErpFilterPanel";

export { ErpDataTable } from "./ErpDataTable";
export type { ErpDataTableProps, ErpColumn, ErpSortDir } from "./ErpDataTable";

export { ErpPagination } from "./ErpPagination";
export type { ErpPaginationProps } from "./ErpPagination";

export { ErpDrawer, ErpDrawerFooterActions } from "./ErpDrawer";
export type { ErpDrawerProps } from "./ErpDrawer";

export { ErpForm, ErpFormRow, ErpField, ErpInput, ErpTextarea, ErpSelect } from "./ErpForm";
export type { ErpFormProps, ErpFieldProps } from "./ErpForm";

export { ErpConfirmDialog, ErpDeleteDialog } from "./ErpConfirmDialog";
export type { ErpConfirmDialogProps } from "./ErpConfirmDialog";

export { erpToast } from "./ErpToast";

/** Re-export canonical states for one import path */
export { EmptyState, LoadingSkeleton, ErrorState, SampleDataBanner } from "../States";
