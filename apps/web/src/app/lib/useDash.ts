/**
 * Shared dashboard fetch helper (UI-03).
 * Auth-guarded GET — no demo numbers on failure for signed-in users.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { api, isLoggedIn } from "./api";

export interface DashState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

export function useDash<T>(path: string): DashState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(path) && isLoggedIn());
  const [error, setError] = useState(false);
  const reqRef = useRef(0);

  const refetch = useCallback(() => {
    if (!path || !isLoggedIn()) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }
    const id = ++reqRef.current;
    setLoading(true);
    setError(false);
    api
      .get<T>(path)
      .then((d) => {
        if (id === reqRef.current) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (id === reqRef.current) {
          setData(null);
          setError(true);
          setLoading(false);
        }
      });
  }, [path]);

  useEffect(() => {
    refetch();
    return () => {
      reqRef.current++;
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
