import { describe, expect, it } from "vitest";
import {
  INTRO_DEFAULTS,
  cellJitter,
  createIntroRun,
  landingDelay,
  transitionTiming,
  wavefrontKeyframes,
} from "@/lib/discovery-intro";

// Real-time baseline, so the maths below doesn't drift with the tuned defaults.
const BASE = { ...INTRO_DEFAULTS, slowMo: 1, wave: { ...INTRO_DEFAULTS.wave, reach: 1.6 } };

describe("landingDelay", () => {
  it("lands the center orb first, before the wave leaves it", () => {
    const center = landingDelay(0, 0, true, BASE)!;
    const neighbour = landingDelay(0.05, 0, false, BASE)!;
    expect(center).toBe(BASE.wave.startDelay);
    expect(neighbour - center).toBeGreaterThanOrEqual(BASE.wave.centerLead);
  });

  it("delays orbs further out for longer", () => {
    const delays = [0.2, 0.5, 0.9, 1.4].map((d) => landingDelay(d, 0, false, BASE)!);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
  });

  it("reaches the viewport corner at startDelay + lead + spread", () => {
    const { startDelay, centerLead, spread } = BASE.wave;
    expect(landingDelay(1, 0, false, BASE)).toBeCloseTo(startDelay + centerLead + spread);
  });

  it("leaves orbs beyond the reach alone", () => {
    expect(landingDelay(BASE.wave.reach + 0.01, 0, false, BASE)).toBeNull();
  });

  it("stretches everything under slow motion", () => {
    const slow = { ...BASE, slowMo: 3 };
    expect(landingDelay(0.5, 0.4, false, slow)).toBeCloseTo(
      landingDelay(0.5, 0.4, false, BASE)! * 3
    );
  });
});

describe("cellJitter", () => {
  it("is stable per key and stays within 0–1", () => {
    expect(cellJitter("3:-2")).toBe(cellJitter("3:-2"));
    for (const key of ["0:0", "1:0", "-4:7", "12:-9"]) {
      expect(cellJitter(key)).toBeGreaterThanOrEqual(0);
      expect(cellJitter(key)).toBeLessThan(1);
    }
  });
});

describe("transitionTiming", () => {
  it("bakes a spring into a linear() curve that settles on 1", () => {
    const { duration, easing } = transitionTiming({ type: "spring", visualDuration: 0.6, bounce: 0.3 });
    expect(duration).toBeGreaterThan(600);
    expect(easing.startsWith("linear(0,")).toBe(true);
    expect(easing.endsWith(", 1)")).toBe(true);
  });

  it("falls back to a cubic-bezier without linear() support", () => {
    const { easing } = transitionTiming(INTRO_DEFAULTS.drop.spring, 1, false);
    expect(easing.startsWith("cubic-bezier(")).toBe(true);
  });

  it("passes easing transitions straight through", () => {
    expect(transitionTiming({ type: "easing", duration: 0.4, ease: [0.2, 0, 0, 1] }, 2)).toEqual({
      duration: 800,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    });
  });
});

describe("createIntroRun", () => {
  it("picks the cell nearest the origin as the center orb", () => {
    const cells = [
      { key: "a", x: -250, y: 0 },
      { key: "b", x: 12, y: -8 },
      { key: "c", x: 250, y: 245 },
    ];
    const run = createIntroRun(1, 0, { x: 0, y: 0 }, { width: 1200, height: 800 }, cells, INTRO_DEFAULTS, true);
    expect(run.centerKey).toBe("b");
    expect(run.origin).toEqual({ x: 0, y: 0 });
    expect(run.radius).toBeCloseTo(Math.hypot(600, 400));
  });

  it("maps the origin dial back into world space through the camera", () => {
    const params = { ...INTRO_DEFAULTS, wave: { ...INTRO_DEFAULTS.wave, originX: 0, originY: 100 } };
    const run = createIntroRun(1, 0, { x: 50, y: -20 }, { width: 1000, height: 600 }, [], params, true);
    expect(run.origin).toEqual({ x: -550, y: 320 });
  });
});

describe("wavefrontKeyframes", () => {
  it("grows from nothing to the reach and fades out", () => {
    const { keyframes } = wavefrontKeyframes(800, 256, 200, INTRO_DEFAULTS);
    const first = keyframes[0];
    const last = keyframes[keyframes.length - 1];
    expect(first.opacity).toBe(0);
    expect(last.opacity).toBe(0);
    expect(String(last.transform)).toContain(`scale(${((INTRO_DEFAULTS.wave.reach * 800) / 256).toFixed(4)})`);
  });
});
