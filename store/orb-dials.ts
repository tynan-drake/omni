"use client";

import { create } from "zustand";

/**
 * The slice of the orb control panel that CSS custom properties can't carry.
 * Everything else the panel tunes is written straight to `:root` as a variable
 * (see components/OrbDials.tsx); these three need to reach React and d3.
 */

export interface OrbSpring {
  type: "spring";
  stiffness?: number;
  damping?: number;
  mass?: number;
  visualDuration?: number;
  bounce?: number;
}

interface OrbDialState {
  /** Multiplier on every orb's pixel size — and on its collision radius. */
  sizeScale: number;
  /** Spring an orb pops in with. */
  entrance: OrbSpring;
  /** Bumped by the panel's "replay" action; remounts orbs so entrances replay. */
  epoch: number;

  setSizeScale: (scale: number) => void;
  setEntrance: (spring: OrbSpring) => void;
  replay: () => void;
}

export const useOrbDials = create<OrbDialState>((set) => ({
  sizeScale: 1.18,
  entrance: { type: "spring", visualDuration: 0.45, bounce: 0.35 },
  epoch: 0,

  setSizeScale: (sizeScale) => set({ sizeScale }),
  setEntrance: (entrance) => set({ entrance }),
  replay: () => set((s) => ({ epoch: s.epoch + 1 })),
}));
