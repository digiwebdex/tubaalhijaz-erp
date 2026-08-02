/**
 * UI-02 — optional `?tab=` deep-link for in-module screens (navigation only).
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

/** Read/write `?tab=` while keeping local screen state in sync. */
export function useShellTab<T extends string>(
  allowed: readonly T[],
  fallback: T,
): [T, (id: T) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("tab");
  const initial = (allowed.includes(fromUrl as T) ? fromUrl : fallback) as T;
  const [screen, setScreen] = useState<T>(initial);

  useEffect(() => {
    const t = params.get("tab");
    if (t && allowed.includes(t as T) && t !== screen) {
      setScreen(t as T);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const setTab = useCallback(
    (id: T) => {
      setScreen(id);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", id);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [screen, setTab];
}
