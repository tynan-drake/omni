import { describe, expect, it } from "vitest";
import { discoveryCells, discoverySearchTarget } from "../lib/discovery-field";
import { offscreenFlightOffset, searchArrivalPoint } from "../lib/search-flight";

describe("search destinations", () => {
  const viewport = { width: 1280, height: 800 };
  it("finds the same real cell as the discovery field, including far from origin", () => {
    for (const camera of [{ x: 0, y: 0 }, { x: -9800, y: 14300 }]) {
      const target = discoverySearchTarget(camera, viewport, 120, 68);
      const arrived = discoveryCells({ x: -target.x, y: -target.y }, viewport, 120).find((cell) => cell.key === target.key);
      expect(arrived).toEqual(target);
      expect(target.index).toBe(68);
    }
  });
  it("chooses the closest existing occurrence", () => {
    const camera = { x: -310, y: 200 };
    const target = discoverySearchTarget(camera, viewport, 120, 34);
    const candidates = discoveryCells(camera, { width: 10000, height: 10000 }, 120).filter((cell) => cell.index === 34);
    expect(Math.hypot(target.x + camera.x, target.y + camera.y)).toBe(Math.min(...candidates.map((cell) => Math.hypot(cell.x + camera.x, cell.y + camera.y))));
  });
  it("stages missing artists fully offscreen without replacing a previous search slot", () => {
    const camera = { x: 70, y: -400 };
    for (const width of [390, 1280]) {
      const size = { ...viewport, width };
      const first = discoverySearchTarget(camera, size, 120, -1);
      expect(Math.abs(first.x + camera.x) > width / 2 + first.size / 2 || Math.abs(first.y + camera.y) > size.height / 2 + first.size / 2).toBe(true);
      const next = discoverySearchTarget(camera, size, 120, -1, new Set([first.key]));
      expect(next.key).not.toBe(first.key);
      expect(discoverySearchTarget({ x: -1000, y: 800 }, size, 120, -1, new Set([first.key]), first.key)).toEqual(first);
    }
  });
  it("does not return a catalogue cell replaced by an injected artist", () => {
    const target = discoverySearchTarget({ x: 0, y: 0 }, viewport, 120, 5);
    const next = discoverySearchTarget({ x: 0, y: 0 }, viewport, 120, 5, new Set([target.key]));
    expect(next.key).not.toBe(target.key);
    expect(next.index).toBe(5);
  });
  it("places graph arrivals outside the transformed viewport and clear of nearby orbs", () => {
    for (const k of [0.15, 1, 2.5]) {
      const transform = { x: -900, y: 250, k };
      const first = searchArrivalPoint(transform, viewport, [], 80, () => 0.5);
      const next = searchArrivalPoint(transform, viewport, [{ ...first, r: 100 }], 80, () => 0.5);
      const sx = next.x * k + transform.x - viewport.width / 2;
      const sy = next.y * k + transform.y - viewport.height / 2;
      expect(Math.abs(sx) > viewport.width / 2 + 80 * k || Math.abs(sy) > viewport.height / 2 + 80 * k).toBe(true);
      expect(Math.hypot(next.x - first.x, next.y - first.y)).toBeGreaterThanOrEqual(280);
    }
  });
});

const randomSequence = (angle: number, distance: number) => {
  let calls = 0;
  return () => calls++ === 0 ? angle : distance;
};

it("varies flight direction and distance across the full circle", () => {
  const viewport = { width: 1280, height: 800 };
  for (let angle = 0; angle < 1; angle += 0.125) {
    const near = offscreenFlightOffset(viewport, 150, randomSequence(angle, 0));
    const far = offscreenFlightOffset(viewport, 150, randomSequence(angle, 0.99));
    expect(Math.hypot(far.x, far.y) - Math.hypot(near.x, near.y)).toBeCloseTo(792);
    expect(Math.abs(near.x) > viewport.width / 2 + 150 || Math.abs(near.y) > viewport.height / 2 + 150).toBe(true);
    expect(near.x / Math.hypot(near.x, near.y)).toBeCloseTo(Math.cos(angle * Math.PI * 2));
    expect(near.y / Math.hypot(near.x, near.y)).toBeCloseTo(Math.sin(angle * Math.PI * 2));
  }
});

it("keeps randomized discovery slots offscreen after grid snapping, and reuses saved slots", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    for (let angle = 0; angle < 1; angle += 0.0625) {
      const camera = { x: -7831, y: 2294 };
      const target = discoverySearchTarget(camera, viewport, 120, -1, new Set(), undefined, randomSequence(angle, 0));
      expect(Math.abs(target.x + camera.x) > viewport.width / 2 + target.size / 2 || Math.abs(target.y + camera.y) > viewport.height / 2 + target.size / 2).toBe(true);
      const again = discoverySearchTarget(camera, viewport, 120, -1, new Set([target.key]), target.key, () => { throw new Error("Saved slots must not randomize"); });
      expect(again).toEqual(target);
      const other = discoverySearchTarget(camera, viewport, 120, -1, new Set([target.key]), undefined, randomSequence(angle, 0));
      expect(other.key).not.toBe(target.key);
    }
  }
});
