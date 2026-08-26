import { describe, expect, it } from "vitest";
import {
  resolveWheelGesture,
  resolveZoomWheelDelta,
} from "../lib/canvas-gestures";

const wheel = (overrides: Partial<Parameters<typeof resolveWheelGesture>[0]> = {}) => ({
  deltaX: 0,
  deltaY: 100,
  deltaMode: 0,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  ...overrides,
});

describe("Figma-style canvas wheel gestures", () => {
  it("maps an unmodified wheel to vertical pan", () => {
    expect(resolveWheelGesture(wheel(), 800)).toEqual({
      kind: "pan",
      deltaX: 0,
      deltaY: 100,
    });
  });

  it("keeps physical mouse-wheel zoom steps modest", () => {
    expect(resolveZoomWheelDelta({ deltaY: 100, deltaMode: 0 }, 800)).toBe(-0.32);
    expect(resolveZoomWheelDelta({ deltaY: -100, deltaMode: 0 }, 800)).toBe(0.32);
  });

  it("preserves fine-grained trackpad zoom input", () => {
    expect(resolveZoomWheelDelta({ deltaY: 2, deltaMode: 0 }, 800)).toBeCloseTo(
      -0.008
    );
  });

  it("normalizes and caps non-pixel zoom deltas", () => {
    expect(resolveZoomWheelDelta({ deltaY: 2, deltaMode: 1 }, 800)).toBeCloseTo(
      -0.128
    );
    expect(resolveZoomWheelDelta({ deltaY: 1, deltaMode: 2 }, 800)).toBe(-0.32);
  });

  it("maps shift-wheel to horizontal pan", () => {
    expect(resolveWheelGesture(wheel({ shiftKey: true }), 800)).toEqual({
      kind: "pan",
      deltaX: 100,
      deltaY: 0,
    });
    expect(
      resolveWheelGesture(wheel({ shiftKey: true, deltaX: 70, deltaY: 0 }), 800)
    ).toEqual({ kind: "pan", deltaX: 70, deltaY: 0 });
  });

  it("reserves control or command wheel for zoom", () => {
    expect(resolveWheelGesture(wheel({ ctrlKey: true }), 800)).toEqual({ kind: "zoom" });
    expect(resolveWheelGesture(wheel({ metaKey: true }), 800)).toEqual({ kind: "zoom" });
  });

  it("normalizes line and page wheel deltas", () => {
    expect(resolveWheelGesture(wheel({ deltaMode: 1, deltaY: 2 }), 800)).toEqual({
      kind: "pan",
      deltaX: 0,
      deltaY: 32,
    });
    expect(resolveWheelGesture(wheel({ deltaMode: 2, deltaY: 1 }), 720)).toEqual({
      kind: "pan",
      deltaX: 0,
      deltaY: 720,
    });
  });
});
