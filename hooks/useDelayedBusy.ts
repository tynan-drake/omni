"use client";

import { useEffect, useState } from "react";

/** Reset the delay when a request changes, even if loading stays true. */
export function useDelayedBusy(active: boolean, delay: number, requestKey: unknown = active) {
  const [wait, setWait] = useState({ active, requestKey, ready: false });
  const changed = wait.active !== active || wait.requestKey !== requestKey;
  if (changed) setWait({ active, requestKey, ready: false });

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setWait({ active, requestKey, ready: true }), delay);
    return () => clearTimeout(timer);
  }, [active, delay, requestKey]);

  return active && !changed && wait.ready;
}
