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
  /** Zoom to an absolute scale, keeping the viewport centre fixed. */
  zoomTo: (k: number) => void;
  getTransform: () => ViewportTransform;
}

let impl: CanvasController = {
  fitAll: () => {},
  flyTo: () => {},
  zoomBy: () => {},
  zoomTo: () => {},
  getTransform: () => ({ x: 0, y: 0, k: 1 }),
};

export function registerCanvasController(c: CanvasController): void {
  impl = c;
}

export const canvas = {
  fitAll: () => impl.fitAll(),
  flyTo: (id: number) => impl.flyTo(id),
  zoomBy: (f: number) => impl.zoomBy(f),
  zoomTo: (k: number) => impl.zoomTo(k),
  getTransform: () => impl.getTransform(),
};

/** Chrome the canvas should keep clear when fitting content: the left nav rail. */
export const VIEWPORT_INSET = { left: 62, top: 76, right: 20, bottom: 84 };

/** Hard limits, shared by the d3 zoom behaviour and the zoom bar readout. */
export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 2.5;

// --- zoom level subscription ----------------------------------------------
// The zoom bar needs a live scale readout, but the transform lives outside
// React (d3 writes it straight to the DOM every frame). Canvas publishes each
// new scale here and subscribers re-render only when the rounded value moves.

let currentScale = 1;
const scaleListeners = new Set<(k: number) => void>();

export function publishScale(k: number): void {
  if (k === currentScale) return;
  currentScale = k;
  for (const fn of scaleListeners) fn(k);
}

export function getScale(): number {
  return currentScale;
}

export function subscribeScale(fn: (k: number) => void): () => void {
  scaleListeners.add(fn);
  return () => scaleListeners.delete(fn);
}

/** World coordinates → screen (CSS pixel) coordinates. */
export function worldToScreen(x: number, y: number): { x: number; y: number } {
  const t = impl.getTransform();
  return { x: x * t.k + t.x, y: y * t.k + t.y };
}
