import { spring } from "motion";

/* ─────────────────────────────────────────────────────────────────────────
 * DISCOVERY INTRO STORYBOARD
 *
 * The landing field doesn't appear — it lands. One orb touches down at the
 * wave's origin, then a ripple carries every other orb down onto the canvas,
 * ring by ring, outward to the edges.
 *
 *     0ms   field hidden while the first screen of portraits decodes
 *   start   center orb falls in: scale 1.5 → 1, blurred → sharp, fades up
 *  + lead   the wave leaves the center; each orb lands when it arrives
 *           (delay grows with distance, bent by `curve`, plus jitter)
 *  +label   names fade up beneath their portraits
 *
 * Splash rings on impact and a light wavefront are built in but off by
 * default — switch them on from the panel.
 *
 * Every number here is a default for the "Intro" dial panel
 * (components/DiscoveryIntroDials.tsx); the panel can replay the sequence.
 * ───────────────────────────────────────────────────────────────────────── */

export type IntroTransition =
  | {
      type: "spring";
      stiffness?: number;
      damping?: number;
      mass?: number;
      visualDuration?: number;
      bounce?: number;
    }
  | { type: "easing"; duration: number; ease: [number, number, number, number] };

export interface IntroParams {
  /** Multiplies every duration and delay. 3 = watch it at a third speed. */
  slowMo: number;
  wave: {
    /** ms after the field is ready before the center orb starts to land. */
    startDelay: number;
    /** ms between the center orb landing and the wave leaving it. */
    centerLead: number;
    /** ms for the wave to travel from the origin to the viewport's corner. */
    spread: number;
    /** Above 1 the wave bursts out then slows; below 1 it gathers speed. */
    curve: number;
    /** Random per-orb lateness, ms. Breaks up the perfect rings. */
    jitter: number;
    /** How far out (in viewport half-diagonals) orbs still animate. */
    reach: number;
    /** Wave origin as a % of the viewport. */
    originX: number;
    originY: number;
  };
  drop: {
    /** Scale an orb falls from. Above 1 drops toward you; below 1 rises. */
    fromScale: number;
    /** Vertical offset an orb falls from, px. */
    fromY: number;
    /** Blur an orb starts with — out of focus until it lands. px. */
    blur: number;
    /** ms for opacity and blur to resolve. */
    fadeMs: number;
    /** The touchdown itself. Bounce is the squash as it lands. */
    spring: IntroTransition;
  };
  splash: {
    enabled: boolean;
    /** Concentric rings per landing, like a stone in water. */
    rings: number;
    /** ms between each ring. */
    ringGap: number;
    /** Point in the drop (0–1) where the ring fires — the moment of impact. */
    at: number;
    /** How far the ring grows, as a multiple of the orb. */
    scale: number;
    opacity: number;
    /** Ring stroke, px. */
    width: number;
    durationMs: number;
    /** Extra size and brightness for the center orb's splash. */
    centerBoost: number;
  };
  ripple: {
    /** A faint wavefront of light that sweeps outward with the landings. */
    enabled: boolean;
    opacity: number;
    /** Thickness of the wavefront, % of its radius. */
    band: number;
  };
  label: {
    /** ms after an orb starts landing that its name begins to appear. */
    delayMs: number;
    durationMs: number;
    /** px the name rises as it fades in. */
    rise: number;
  };
  images: {
    /** Hold the field back until the first screen of portraits decodes. */
    wait: boolean;
    /** …but never for longer than this, ms. */
    maxWaitMs: number;
  };
}

export const INTRO_DEFAULTS: IntroParams = {
  slowMo: 1.05,
  wave: {
    startDelay: 0,
    centerLead: 0,
    spread: 780,
    curve: 1.3,
    jitter: 115,
    reach: 1.25,
    originX: 50,
    originY: 50,
  },
  drop: {
    fromScale: 1.5,
    fromY: 0,
    blur: 5.5,
    fadeMs: 980,
    spring: { type: "spring", visualDuration: 0.6, bounce: 0.2 },
  },
  splash: {
    enabled: false,
    rings: 1,
    ringGap: 150,
    at: 0.38,
    scale: 1.85,
    opacity: 0.4,
    width: 1.5,
    durationMs: 1100,
    centerBoost: 1.5,
  },
  ripple: {
    enabled: false,
    opacity: 0.04,
    band: 31,
  },
  label: {
    delayMs: 300,
    durationMs: 600,
    rise: 6,
  },
  images: {
    wait: true,
    maxWaitMs: 1200,
  },
};

/** Soft deceleration for fades, splashes and labels. */
export const INTRO_EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Used when the browser can't take a `linear()` spring curve. */
const SPRING_FALLBACK = "cubic-bezier(0.34, 1.4, 0.64, 1)";

export interface WaapiTiming {
  duration: number;
  easing: string;
}

/**
 * Bakes a spring (or an easing) into a WAAPI duration + easing. Springs are
 * sampled into a CSS `linear()` curve, so they run on the compositor like
 * any other keyframe animation instead of ticking on the main thread.
 */
export function transitionTiming(
  transition: IntroTransition,
  slowMo = 1,
  supportsLinear = true
): WaapiTiming {
  if (transition.type === "easing") {
    return {
      duration: transition.duration * 1000 * slowMo,
      easing: `cubic-bezier(${transition.ease.join(", ")})`,
    };
  }
  const generator = spring({ keyframes: [0, 1], ...transition });
  const step = 12;
  const samples: number[] = [];
  let t = 0;
  for (; t < 8000; t += step) {
    const state = generator.next(t);
    samples.push(state.value);
    if (state.done) break;
  }
  samples[samples.length - 1] = 1;
  const duration = Math.max(t, step) * slowMo;
  if (!supportsLinear) return { duration, easing: SPRING_FALLBACK };
  return {
    duration,
    easing: `linear(${samples.map((v) => +v.toFixed(4)).join(", ")})`,
  };
}

/** Stable 0–1 per cell key, so jitter doesn't reshuffle between replays. */
export function cellJitter(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/**
 * ms from the start of the run until an orb begins to land, or null if it
 * sits beyond the wave's reach and should simply be there.
 *
 * `distance` is in viewport half-diagonals: 0 at the origin, ~1 in a corner.
 */
export function landingDelay(
  distance: number,
  jitter: number,
  isCenter: boolean,
  p: IntroParams
): number | null {
  const { wave } = p;
  if (isCenter) return wave.startDelay * p.slowMo;
  if (distance > wave.reach) return null;
  const travel = wave.spread * Math.pow(distance, wave.curve);
  return (wave.startDelay + wave.centerLead + travel + jitter * wave.jitter) * p.slowMo;
}

/** One playthrough of the intro. Everything an orb needs to schedule itself. */
export interface IntroRun {
  id: number;
  /** document.timeline time every animation in the run is pinned to. */
  startTime: number;
  /** Wave origin, in discovery-world coordinates. */
  origin: { x: number; y: number };
  /** Viewport half-diagonal, px — the unit distances are measured in. */
  radius: number;
  /** The orb nearest the origin, which lands alone before the wave. */
  centerKey: string | null;
  params: IntroParams;
  /** The drop spring, baked once per run. */
  landing: WaapiTiming;
}

export function createIntroRun(
  id: number,
  startTime: number,
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  cells: { key: string; x: number; y: number }[],
  params: IntroParams,
  supportsLinear: boolean
): IntroRun {
  // The world is translated by camera + half the viewport, so a screen point
  // maps back into world space by undoing both.
  const origin = {
    x: (viewport.width * params.wave.originX) / 100 - viewport.width / 2 - camera.x,
    y: (viewport.height * params.wave.originY) / 100 - viewport.height / 2 - camera.y,
  };
  let centerKey: string | null = null;
  let nearest = Infinity;
  for (const cell of cells) {
    const d = Math.hypot(cell.x - origin.x, cell.y - origin.y);
    if (d < nearest) {
      nearest = d;
      centerKey = cell.key;
    }
  }
  return {
    id,
    startTime,
    origin,
    radius: Math.max(Math.hypot(viewport.width / 2, viewport.height / 2), 1),
    centerKey,
    params,
    landing: transitionTiming(params.drop.spring, params.slowMo, supportsLinear),
  };
}

/**
 * Lands one orb. Its animations are pinned to the run's start time rather
 * than to the moment it mounted, so an orb panned into view mid-wave joins
 * the wave exactly where it would have been — and one whose moment has
 * passed simply appears. Returns a cancel function.
 */
export function playLanding(
  node: HTMLElement,
  cell: { key: string; x: number; y: number },
  run: IntroRun
): () => void {
  const p = run.params;
  const s = p.slowMo;
  const distance = Math.hypot(cell.x - run.origin.x, cell.y - run.origin.y) / run.radius;
  const isCenter = cell.key === run.centerKey;
  const delay = landingDelay(distance, cellJitter(cell.key), isCenter, p);
  if (delay === null) return () => {};

  const impact = delay + run.landing.duration * p.splash.at;
  const end = Math.max(
    delay + run.landing.duration,
    delay + p.drop.fadeMs * s,
    delay + (p.label.delayMs + p.label.durationMs) * s,
    p.splash.enabled
      ? impact + ((p.splash.rings - 1) * p.splash.ringGap + p.splash.durationMs) * s
      : 0
  );
  const now = Number(document.timeline.currentTime ?? 0);
  if (now - run.startTime > end) return () => {};

  const animations: Animation[] = [];
  const play = (el: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions) => {
    // `backwards` holds the first frame through the delay; once finished the
    // element falls back to its stylesheet, so hover and focus work as usual.
    const animation = el.animate(keyframes, { fill: "backwards", ...timing });
    animation.startTime = run.startTime;
    animations.push(animation);
  };

  const portrait = node.querySelector(".discovery-portrait");
  if (portrait) {
    play(
      portrait,
      [
        { transform: `translateY(${p.drop.fromY}px) scale(${p.drop.fromScale})` },
        { transform: "translateY(0px) scale(1)" },
      ],
      { delay, duration: run.landing.duration, easing: run.landing.easing }
    );
    play(
      portrait,
      [
        { opacity: 0, filter: `blur(${p.drop.blur}px)` },
        { opacity: 1, filter: "blur(0px)" },
      ],
      { delay, duration: p.drop.fadeMs * s, easing: INTRO_EASE_OUT }
    );
  }

  const name = node.querySelector(".discovery-name");
  if (name) {
    play(
      name,
      [
        { opacity: 0, transform: `translateY(${p.label.rise}px)` },
        { opacity: 1, transform: "translateY(0px)" },
      ],
      {
        delay: delay + p.label.delayMs * s,
        duration: p.label.durationMs * s,
        easing: INTRO_EASE_OUT,
      }
    );
  }

  if (p.splash.enabled) {
    const boost = isCenter ? p.splash.centerBoost : 1;
    const rings = node.querySelectorAll(".discovery-splash");
    rings.forEach((ring, i) => {
      // Each echo is a little fainter than the ring before it.
      const peak = Math.min(p.splash.opacity * boost * (1 - i / (rings.length + 1)), 1);
      play(
        ring,
        [
          { opacity: 0, transform: "scale(0.94)", offset: 0 },
          { opacity: peak, offset: 0.06 },
          { opacity: 0, transform: `scale(${1 + (p.splash.scale - 1) * boost})`, offset: 1 },
        ],
        {
          delay: impact + i * p.splash.ringGap * s,
          duration: p.splash.durationMs * s,
          easing: INTRO_EASE_OUT,
        }
      );
    });
  }

  return () => animations.forEach((animation) => animation.cancel());
}

/** Radius of the wavefront element before it's scaled, px. Small = cheap. */
export const WAVEFRONT_BASE_RADIUS = 256;

/** Sweeps the faint wavefront out from the origin. Returns a cancel function. */
export function playWavefront(el: HTMLElement, run: IntroRun): () => void {
  const { keyframes, delay, duration } = wavefrontKeyframes(
    run.radius,
    WAVEFRONT_BASE_RADIUS,
    run.landing.duration * run.params.splash.at,
    run.params
  );
  const animation = el.animate(keyframes, { delay, duration, easing: "linear", fill: "backwards" });
  animation.startTime = run.startTime;
  return () => animation.cancel();
}

/**
 * The wavefront's radius over time, as WAAPI keyframes for an element of
 * `baseRadius` px, synced so the front passes each orb as it touches down.
 */
export function wavefrontKeyframes(
  radius: number,
  baseRadius: number,
  impactOffset: number,
  p: IntroParams
): { keyframes: Keyframe[]; delay: number; duration: number } {
  const { wave } = p;
  const travel = wave.spread * Math.pow(wave.reach, wave.curve);
  const delay = (wave.startDelay + wave.centerLead) * p.slowMo + impactOffset;
  const duration = Math.max(travel * p.slowMo, 1);
  const frames = 32;
  const keyframes: Keyframe[] = [];
  for (let i = 0; i <= frames; i++) {
    const progress = i / frames;
    // Invert landingDelay: how far has the front travelled at this moment?
    const reached = wave.reach * Math.pow(progress, 1 / wave.curve);
    const scale = Math.max((reached * radius) / baseRadius, 0.001);
    const fade = progress < 0.08 ? progress / 0.08 : 1 - Math.pow((progress - 0.08) / 0.92, 1.6);
    keyframes.push({
      offset: progress,
      transform: `translate(-50%, -50%) scale(${scale.toFixed(4)})`,
      opacity: +(Math.max(fade, 0) * p.ripple.opacity).toFixed(4),
    });
  }
  return { keyframes, delay, duration };
}
