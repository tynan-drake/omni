"use client";

import { create } from "zustand";
import { INTRO_DEFAULTS, type IntroParams } from "@/lib/discovery-intro";

/**
 * The landing intro's tuning, fed by the "Intro" dial panel
 * (components/DiscoveryIntroDials.tsx) and read once per run by the landing
 * field — so dragging a dial mid-wave never tears the animation in half.
 */
interface DiscoveryIntroState {
  params: IntroParams;
  /** Bumped by the panel's replay action; the landing field restarts on it. */
  epoch: number;
  setParams: (params: IntroParams) => void;
  replay: () => void;
}

export const useDiscoveryIntro = create<DiscoveryIntroState>((set) => ({
  params: INTRO_DEFAULTS,
  epoch: 0,
  setParams: (params) => set({ params }),
  replay: () => set((s) => ({ epoch: s.epoch + 1 })),
}));
