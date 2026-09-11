"use client";

import { useEffect, useRef } from "react";
import { useDialKit, type DialConfig, type ResolvedValues } from "dialkit";
import { INTRO_DEFAULTS as D, type IntroParams } from "@/lib/discovery-intro";
import { useDiscoveryIntro } from "@/store/discovery-intro";

/* ─────────────────────────────────────────────────────────────────────────
 * INTRO CONTROL PANEL
 *
 * Tunes the landing field's entrance — the center orb touching down and the
 * wave that lands every other orb after it. The sequence itself is described
 * at the top of lib/discovery-intro.ts; this panel only feeds it numbers.
 *
 * Values are snapshotted when a run starts, so press Replay (or turn on
 * auto-replay) to see a change. Rides the same DialRoot as the Orbs panel.
 * ───────────────────────────────────────────────────────────────────────── */

const CONFIG = {
  replay: { type: "action", label: "Replay intro" },
  /** Replays by itself a moment after you stop moving a dial. */
  autoReplay: true,
  /** 1 is real time; 3 plays it at a third of the speed. */
  slowMo: [D.slowMo, 0.25, 5, 0.05],

  wave: {
    startDelay: [D.wave.startDelay, 0, 1500, 10],
    /** Beat between the center orb landing and the wave leaving it. */
    centerLead: [D.wave.centerLead, 0, 1200, 10],
    /** ms for the wave to reach the corners of the screen. */
    spread: [D.wave.spread, 200, 4000, 10],
    /** Above 1: bursts out, then slows. Below 1: gathers speed. */
    curve: [D.wave.curve, 0.4, 2.5, 0.05],
    jitter: [D.wave.jitter, 0, 600, 5],
    /** How far out orbs still animate, in half-screens. */
    reach: [D.wave.reach, 1, 3, 0.05],
    originX: [D.wave.originX, 0, 100],
    originY: [D.wave.originY, 0, 100],
  },

  drop: {
    /** Above 1 falls toward you; below 1 rises up out of the canvas. */
    fromScale: [D.drop.fromScale, 0.2, 3, 0.01],
    fromY: [D.drop.fromY, -120, 120],
    blur: [D.drop.blur, 0, 40, 0.5],
    fadeMs: [D.drop.fadeMs, 50, 1500, 10],
    spring: D.drop.spring,
  },

  splash: {
    enabled: D.splash.enabled,
    rings: [D.splash.rings, 1, 4, 1],
    ringGap: [D.splash.ringGap, 0, 600, 10],
    /** Point in the drop where the ring fires — the moment of impact. */
    at: [D.splash.at, 0, 1, 0.01],
    scale: [D.splash.scale, 1, 4, 0.05],
    opacity: [D.splash.opacity, 0, 1, 0.01],
    width: [D.splash.width, 0.5, 8, 0.1],
    durationMs: [D.splash.durationMs, 100, 3000, 10],
    centerBoost: [D.splash.centerBoost, 1, 3, 0.05],
  },

  ripple: {
    enabled: D.ripple.enabled,
    opacity: [D.ripple.opacity, 0, 0.5, 0.005],
    band: [D.ripple.band, 2, 60],
  },

  label: {
    delayMs: [D.label.delayMs, 0, 1500, 10],
    durationMs: [D.label.durationMs, 50, 2000, 10],
    rise: [D.label.rise, 0, 30],
  },

  images: {
    wait: D.images.wait,
    maxWaitMs: [D.images.maxWaitMs, 0, 4000, 50],
  },
} satisfies DialConfig;

type IntroDialValues = ResolvedValues<typeof CONFIG>;

const AUTO_REPLAY_MS = 450;
/** Persisted values land a render or two after mount — don't replay on those. */
const SETTLE_MS = 800;

function toParams(p: IntroDialValues): IntroParams {
  return {
    slowMo: p.slowMo,
    wave: p.wave,
    drop: { ...p.drop, spring: p.drop.spring as IntroParams["drop"]["spring"] },
    splash: p.splash,
    ripple: p.ripple,
    label: p.label,
    images: p.images,
  };
}

export default function DiscoveryIntroDials() {
  const params = useDialKit("Intro", CONFIG, {
    id: "discovery-intro",
    persist: true,
    onAction: (action) => {
      if (action === "replay") useDiscoveryIntro.getState().replay();
    },
  });
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    useDiscoveryIntro.getState().setParams(toParams(params));
    mountedAt.current ??= performance.now();
    if (!params.autoReplay || performance.now() - mountedAt.current < SETTLE_MS) return;
    const timer = setTimeout(() => useDiscoveryIntro.getState().replay(), AUTO_REPLAY_MS);
    return () => clearTimeout(timer);
  }, [params]);

  return null;
}
