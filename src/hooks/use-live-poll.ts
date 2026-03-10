"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-polls a callback at a given interval, but only when `active` is true.
 * FPL-style: refresh data every 30s while matches are live, stop when idle.
 */
export function useLivePoll(
  callback: () => void,
  active: boolean,
  intervalMs = 30_000
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return;

    const id = setInterval(() => {
      savedCallback.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [active, intervalMs]);
}
