import * as React from "react";

/** Aligns with Tailwind `md` / `lg` used across ERP kit. */
export const MOBILE_BREAKPOINT = 768;
export const TABLET_MAX = 1023;

export type ViewportKind = "mobile" | "tablet" | "desktop";

function readViewport(): ViewportKind {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < MOBILE_BREAKPOINT) return "mobile";
  if (w <= TABLET_MAX) return "tablet";
  return "desktop";
}

/**
 * Viewport band for shell layout:
 * - mobile (&lt;768): overlay drawer
 * - tablet (768–1023): permanent sidebar, collapsed by default
 * - desktop (≥1024): permanent sidebar, expanded by default
 */
export function useViewport(): ViewportKind {
  const [vp, setVp] = React.useState<ViewportKind>(() =>
    typeof window === "undefined" ? "desktop" : readViewport(),
  );

  React.useEffect(() => {
    const onChange = () => setVp(readViewport());
    const mqlMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const mqlTablet = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_MAX}px)`,
    );
    mqlMobile.addEventListener("change", onChange);
    mqlTablet.addEventListener("change", onChange);
    onChange();
    return () => {
      mqlMobile.removeEventListener("change", onChange);
      mqlTablet.removeEventListener("change", onChange);
    };
  }, []);

  return vp;
}

/** True below `md` (768). Kept for existing call sites. */
export function useIsMobile() {
  return useViewport() === "mobile";
}
