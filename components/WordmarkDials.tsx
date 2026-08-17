"use client";

import { useEffect } from "react";
import { useDialKit, type DialConfig, type ResolvedValues } from "dialkit";

/* ─────────────────────────────────────────────────────────────────────────
 * WORDMARK CONTROL PANEL
 *
 * The landing wordmark is filled with a gradient that never sits still: the
 * gradient sweeps across the letters (flow) while the whole fill rotates hue
 * and pulses its glow (shimmer). Every knob here writes a CSS custom property
 * on :root; the animation itself lives in app/globals.css (.landing-wordmark).
 *
 * Rides the same DialRoot as the Orbs panel — see components/OrbDials.tsx.
 * ───────────────────────────────────────────────────────────────────────── */

const CONFIG = {
  colors: {
    /** The three stops the fill cycles through, left to right and back. */
    start: { type: "color", default: "#cfd4ff" },
    middle: { type: "color", default: "#8b7cf6" },
    end: { type: "color", default: "#4f9cf0" },
  },

  flow: {
    /** Gradient direction across the letterforms. 90° is left-to-right. */
    angle: [135, 0, 360],
    /** How much wider than the text the gradient is. Big = lazy, wide bands. */
    spread: [300, 100, 800, 10],
    seconds: [7, 0.5, 30, 0.1],
  },

  shimmer: {
    /** Degrees of hue the whole fill drifts through, and back again. */
    hueDrift: [26, 0, 180],
    saturation: [1.1, 0, 3, 0.05],
    seconds: [11, 0.5, 40, 0.1],
  },

  glow: {
    radius: [34, 0, 90],
    opacity: [0.35, 0, 1, 0.01],
    /** Peak of the glow's breath, as a multiple of the radius. */
    pulse: [1.35, 0.5, 3, 0.05],
  },
} satisfies DialConfig;

type WordmarkValues = ResolvedValues<typeof CONFIG>;

function applyWordmark(p: WordmarkValues): void {
  const root = document.documentElement;
  const vars: Record<string, string> = {
    "--wordmark-c1": p.colors.start,
    "--wordmark-c2": p.colors.middle,
    "--wordmark-c3": p.colors.end,

    "--wordmark-angle": `${p.flow.angle}deg`,
    "--wordmark-spread": `${p.flow.spread}%`,
    "--wordmark-flow-dur": `${p.flow.seconds}s`,

    "--wordmark-hue-drift": `${p.shimmer.hueDrift}deg`,
    "--wordmark-saturation": `${p.shimmer.saturation}`,
    "--wordmark-shimmer-dur": `${p.shimmer.seconds}s`,

    "--wordmark-glow": `${p.glow.radius}px`,
    "--wordmark-glow-pulse": `${p.glow.pulse}`,
    "--wordmark-glow-color": `color-mix(in srgb, ${p.colors.middle} ${
      p.glow.opacity * 100
    }%, transparent)`,
  };

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

export default function WordmarkDials() {
  const params = useDialKit("Wordmark", CONFIG, {
    id: "wordmark",
    persist: true,
  });

  useEffect(() => {
    applyWordmark(params);
  }, [params]);

  return null;
}
