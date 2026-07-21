"use client";

/**
 * Imperative bridge to the mounted Canvas viewport, so shortcuts, the command
 * palette, and popups can drive zoom/pan without prop-drilling. The Canvas
 * registers real implementations on mount; everything is a no-op before that.
 */

export interface ViewportTransform {
  x: number;
  y: number;
  k: number;
}

interface CanvasController {
  fitAll: () => void;
  flyTo: (nodeId: number) => void;
  zoomBy: (factor: number) => void;
  getTransform: () => ViewportTransform;
}

let impl: CanvasController = {
  fitAll: () => {},
  flyTo: () => {},
  zoomBy: () => {},
  getTransform: () => ({ x: 0, y: 0, k: 1 }),
};

export function registerCanvasController(c: CanvasController): void {
  impl = c;
}

export const canvas = {
  fitAll: () => impl.fitAll(),
  flyTo: (id: number) => impl.flyTo(id),
  zoomBy: (f: number) => impl.zoomBy(f),
  getTransform: () => impl.getTransform(),
};

/** World coordinates → screen (CSS pixel) coordinates. */
export function worldToScreen(x: number, y: number): { x: number; y: number } {
  const t = impl.getTransform();
  return { x: x * t.k + t.x, y: y * t.k + t.y };
}
