export interface WheelGestureInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export type WheelGesture =
  | { kind: "zoom" }
  | { kind: "pan"; deltaX: number; deltaY: number };

const LINE_HEIGHT = 16;
const ZOOM_SENSITIVITY = 0.004;
const MAX_ZOOM_DELTA = 0.32;

function wheelUnit(deltaMode: number, pageSize: number) {
  return deltaMode === 1 ? LINE_HEIGHT : deltaMode === 2 ? pageSize : 1;
}

/**
 * Convert wheel movement to D3's logarithmic zoom delta. D3's default curve
 * multiplies Ctrl-wheel input by ten, which makes a physical mouse wheel jump
 * several zoom levels at once. Keeping the curve linear and capped preserves
 * fine trackpad deltas while limiting every mouse notch to about a 25% step.
 */
export function resolveZoomWheelDelta(
  event: Pick<WheelGestureInput, "deltaY" | "deltaMode">,
  pageSize: number
) {
  const pixels = event.deltaY * wheelUnit(event.deltaMode, pageSize);
  return Math.max(
    -MAX_ZOOM_DELTA,
    Math.min(MAX_ZOOM_DELTA, -pixels * ZOOM_SENSITIVITY)
  );
}

/** Resolve browser wheel data into the Figma-style canvas interaction model. */
export function resolveWheelGesture(
  event: WheelGestureInput,
  pageSize: number
): WheelGesture {
  if (event.ctrlKey || event.metaKey) return { kind: "zoom" };

  const unit = wheelUnit(event.deltaMode, pageSize);
  if (event.shiftKey) {
    return {
      kind: "pan",
      deltaX: (event.deltaX || event.deltaY) * unit,
      deltaY: 0,
    };
  }
  return {
    kind: "pan",
    deltaX: event.deltaX * unit,
    deltaY: event.deltaY * unit,
  };
}
