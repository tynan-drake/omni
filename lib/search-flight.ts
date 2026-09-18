import type { ViewportTransform } from "./canvas-controller";

/** A random ray beyond the padded viewport, with a variable travel distance. */
export function offscreenFlightOffset(
  viewport: { width: number; height: number },
  padding: number,
  random: () => number = Math.random,
): { x: number; y: number } {
  const angle = random() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const edge = Math.min(
    (viewport.width / 2 + padding) / Math.abs(dx),
    (viewport.height / 2 + padding) / Math.abs(dy),
  );
  const distance = edge + Math.max(240, Math.min(viewport.width, viewport.height)) * (0.35 + random());
  return { x: dx * distance, y: dy * distance };
}

/** Stage an unseen orb along a random direction, clear of existing artists. */
export function searchArrivalPoint(
  transform: ViewportTransform,
  viewport: { width: number; height: number },
  positions: Iterable<{ x: number; y: number; r: number }>,
  radius: number,
  random: () => number = Math.random,
): { x: number; y: number } {
  const existing = [...positions];
  const offset = offscreenFlightOffset(viewport, radius * transform.k + 120, random);
  const length = Math.hypot(offset.x, offset.y);
  const step = radius * 2 + 100;
  let x = (viewport.width / 2 + offset.x - transform.x) / transform.k;
  let y = (viewport.height / 2 + offset.y - transform.y) / transform.k;
  while (existing.some((p) => Math.hypot(p.x - x, p.y - y) < radius + p.r + 100)) {
    x += offset.x / length * step;
    y += offset.y / length * step;
  }
  return { x, y };
}
