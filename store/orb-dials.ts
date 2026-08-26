"use client";

import { create } from "zustand";

/**
 * The slice of the orb control panel that CSS custom properties can't carry.
 * Everything else the panel tunes is written straight to `:root` as a variable
 * (see components/OrbDials.tsx); these need to reach React, d3 and SVG.
 */

export interface OrbSpring {
  type: "spring";
  stiffness?: number;
  damping?: number;
  mass?: number;
  visualDuration?: number;
  bounce?: number;
}

/** How many differently-seeded liquid filters exist. Orbs pick one by id. */
export const GLASS_VARIANTS = 6;

/**
 * Inputs to the SVG displacement filters in components/OrbFilters.tsx. These
 * are filter *attributes*, not CSS, so they have to travel through React.
 */
export interface GlassWarp {
  /** Displacement distance in px — how far the glass drags the photo. */
  warp: number;
  /** Turbulence base frequency. Low = broad lazy blobs, high = ripples. */
  frequency: number;
  /** Noise octaves. 1 is smooth, 3 adds fine chop on top of the swell. */
  detail: number;
  /** Blur on the noise field before it displaces — the "liquid" softener. */
  smooth: number;
}

interface OrbDialState {
  /** Multiplier on every orb's pixel size — and on its collision radius. */
  sizeScale: number;
  /** Spring an orb pops in with. */
  entrance: OrbSpring;
  /** Bumped by the panel's "replay" action; remounts orbs so entrances replay. */
  epoch: number;
  /** Shape of the refraction inside the glass. */
  glass: GlassWarp;

  setSizeScale: (scale: number) => void;
  setEntrance: (spring: OrbSpring) => void;
  setGlass: (glass: GlassWarp) => void;
  replay: () => void;
}

const sameGlass = (a: GlassWarp, b: GlassWarp) =>
  a.warp === b.warp &&
  a.frequency === b.frequency &&
  a.detail === b.detail &&
  a.smooth === b.smooth;

export const useOrbDials = create<OrbDialState>((set) => ({
  sizeScale: 1.18,
  entrance: { type: "spring", visualDuration: 0.45, bounce: 0.35 },
  epoch: 0,
  glass: { warp: 13, frequency: 0.013, detail: 2, smooth: 1.1 },

  setSizeScale: (sizeScale) => set({ sizeScale }),
  setEntrance: (entrance) => set({ entrance }),
  // Re-rasterising six turbulence fields is the expensive part of the panel,
  // so only publish a genuinely new set of values.
  setGlass: (glass) => set((s) => (sameGlass(s.glass, glass) ? s : { glass })),
  replay: () => set((s) => ({ epoch: s.epoch + 1 })),
}));
