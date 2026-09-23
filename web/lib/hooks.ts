"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ReadState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Fetch on mount and whenever key changes; poll if intervalMs > 0, but not
 * while the tab is hidden. A null key skips the read. */
export function useRead<T>(key: string | null, fn: () => Promise<T>, intervalMs = 0): ReadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(key !== null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (key === null) {
      setLoading(false);
      return;
    }
    let alive = true;
    const run = async () => {
      try {
        const out = await fnRef.current();
        if (!alive) return;
        setData(out);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError((e as Error)?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    };
    setLoading(true);
    run();
    const poll = () => {
      if (typeof document === "undefined" || !document.hidden) run();
    };
    const t = intervalMs > 0 ? setInterval(poll, intervalMs) : null;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [key, intervalMs, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

/** Wall clock in seconds, ticking every second, for countdowns. Starts at 0
 * so server and client render the same first frame. */
export function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
