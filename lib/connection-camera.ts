import type { ViewportTransform } from "./canvas-controller";

/** Frame both real canvas positions, including the destination's search below. */
export function connectionCamera(
  source: { x: number; y: number; radius: number },
  destination: { x: number; y: number; radius: number },
  viewport: { width: number; height: number },
  currentScale: number,
): ViewportTransform {
  const padding = 20;
  const top = 84, bottom = 110;
  const searchWidth = Math.min(270, viewport.width - 24);
  const searchHeight = Math.min(250, viewport.height * .32);
  let k = Math.min(1.25, Math.max(currentScale, 50 / destination.radius));
  const bounds = (scale: number) => ({
    left: Math.min((source.x - source.radius) * scale, destination.x * scale - Math.max(destination.radius * scale, searchWidth / 2)),
    right: Math.max((source.x + source.radius) * scale, destination.x * scale + Math.max(destination.radius * scale, searchWidth / 2)),
    top: Math.min((source.y - source.radius) * scale, (destination.y - destination.radius) * scale),
    bottom: Math.max((source.y + source.radius) * scale + 30, (destination.y + destination.radius) * scale + searchHeight),
  });
  for (let i = 0; i < 80; i++) {
    const b = bounds(k);
    if (b.right - b.left <= viewport.width - padding * 2 && b.bottom - b.top <= viewport.height - top - bottom) break;
    k = Math.max(.15, k * .95);
  }
  const b = bounds(k);
  return { x: viewport.width / 2 - (b.left + b.right) / 2, y: top + (viewport.height - top - bottom) / 2 - (b.top + b.bottom) / 2, k };
}
