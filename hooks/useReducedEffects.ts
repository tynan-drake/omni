"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce), (forced-colors: active)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getSnapshot = () => window.matchMedia(query).matches;
const getServerSnapshot = () => true;

/** Keep decorative effects off until hydration and follow live OS changes. */
export function useReducedEffects() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
