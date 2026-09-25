"use client";

import { ThinkingOrb } from "thinking-orbs";
import { useDelayedBusy } from "@/hooks/useDelayedBusy";

export default function BusyOrb({ active, state, requestKey }: {
  active: boolean;
  state: "searching" | "working";
  requestKey?: unknown;
}) {
  const visible = useDelayedBusy(active, 2000, requestKey);
  return visible ? <ThinkingOrb state={state} size={20} theme="dark" aria-hidden="true" style={{ flexShrink: 0 }} /> : null;
}
