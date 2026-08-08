import { createContext, useContext, type ReactNode } from "react";

/**
 * ERP theme scope (2026-08-07).
 *
 * The shared Erp* component library is a SINGLE source of truth whose colours,
 * radii and typography come entirely from `--erp-*` CSS custom properties (see
 * components/erp/tokens.ts + styles/erp-theme.css). This provider selects which
 * palette is live for a subtree by applying the matching scope class:
 *
 *   • "legacy" (default) — the original light ERP look. Also the :root default,
 *     so any subtree left unwrapped stays legacy.
 *   • "ds" — the frozen dark-navy + gold Design System.
 *
 * Rollout is per-module: during Module 3 only the Agent Portal is wrapped in
 * `theme="ds"`; every other module keeps legacy until individually approved.
 * No component is forked or duplicated — the same components render both themes.
 */
export type ErpTheme = "legacy" | "ds";

const ErpThemeContext = createContext<ErpTheme>("legacy");

/** Read the active ERP theme (e.g. to pick a themed font family in a component). */
export function useErpTheme(): ErpTheme {
  return useContext(ErpThemeContext);
}

export interface ErpThemeProviderProps {
  theme?: ErpTheme;
  children: ReactNode;
  /** Optional style passthrough on the scope wrapper. */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Wrap a subtree to select its ERP palette. Uses `display: contents` so the
 * wrapper introduces no layout box — CSS custom properties still cascade to all
 * descendants, so the whole subtree's Erp* components pick up the theme.
 */
export function ErpThemeProvider({ theme = "legacy", children, style, className }: ErpThemeProviderProps) {
  const scope = theme === "ds" ? "erp-theme-ds" : "erp-theme-legacy";
  return (
    <ErpThemeContext.Provider value={theme}>
      <div className={`${scope}${className ? ` ${className}` : ""}`} style={{ display: "contents", ...style }}>
        {children}
      </div>
    </ErpThemeContext.Provider>
  );
}
