import type { Direction } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────
 * CELL DIVISION STORYBOARD
 *
 * Read top-to-bottom. Each value is ms after the lineage response arrives.
 *
 *    0ms   source image flexes; the family shares one glass sampling surface
 *   90ms   source-image lobes swell around the past/future-facing shoulder
 *  330ms   membranes stretch; source imagery flows through every liquid neck
 *  650ms   necks break as each lobe resolves into its destination artist
 *  900ms   released droplets recoil into independent circular glass orbs
 * 1120ms   the shared surface dissolves and d3 takes over completely
 * ───────────────────────────────────────────────────────────────────────── */

export const SPLIT_TIMING = {
  gatherTension:    0,    // parent compresses before the buds become legible
  budsEmerge:       90,   // all source-image lobes swell simultaneously
  necksStretch:     330,  // imagery flows through a continuous shared membrane
  membranesRelease: 650,  // necks snap as destination textures become dominant
  dropletsSettle:   900,  // overshoot recoils into circular resting shapes
  physicsHandoff:   1120, // shared shader surface dissolves into the DOM orbs
} as const;

export const SPLIT_STAGE = {
  tension: 1,
  budding: 2,
  stretching: 3,
  released: 4,
  settled: 5,
} as const;

export interface SplitBudPlan {
  id: number;
  index: number;
  angle: number;
  angleDeg: number;
  distance: number;
  x: number;
  y: number;
}

const FORMATION = {
  minimumFanArc: 1.42,// radians covered by a small family of buds
  fanArcPerBud: 0.11, // extra arc for larger result sets
  maximumFanArc: 2.16,// cap keeps outer children moving mostly left or right
  baseDistance: 174, // px from parent centre to the released child centre
  distancePerBud: 8, // extra release room when many membranes share a shoulder
  distanceLift: 24,  // px variation that keeps the fan from reading as a grid
  angleWobble: 0.055,// radians of deterministic organic irregularity
} as const;

/**
 * A deterministic formation keeps visual placement and d3's pinned positions
 * in lockstep. Roots centre on PI (left); branches centre on zero (right).
 */
export function makeSplitBudPlans(
  childIds: number[],
  direction: Direction
): SplitBudPlan[] {
  const count = childIds.length;
  const centreAngle = direction === "back" ? Math.PI : 0;
  const fanArc = Math.min(
    FORMATION.maximumFanArc,
    FORMATION.minimumFanArc + Math.max(0, count - 3) * FORMATION.fanArcPerBud
  );
  const familyDistance = FORMATION.baseDistance + Math.max(0, count - 3) * FORMATION.distancePerBud;

  return childIds.map((id, index) => {
    const normalized = count <= 1 ? 0 : index / (count - 1) - 0.5;
    const hash = ((id * 2654435761) >>> 0) / 0xffffffff;
    const wobble = (hash - 0.5) * FORMATION.angleWobble * 2;
    const angle = centreAngle + normalized * fanArc + wobble;
    const centreBias = 1 - Math.abs(normalized) * 1.4;
    const distance =
      familyDistance +
      centreBias * FORMATION.distanceLift +
      (hash - 0.5) * 10;

    return {
      id,
      index,
      angle,
      angleDeg: (angle * 180) / Math.PI,
      distance,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });
}

export function splitTravelProgress(elapsedMs: number): number {
  const t = Math.max(0, Math.min(elapsedMs, SPLIT_TIMING.physicsHandoff));
  const easeInOut = (value: number) =>
    value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
  const easeOut = (value: number) => 1 - Math.pow(1 - value, 3);

  if (t < SPLIT_TIMING.budsEmerge) return 0.015;
  if (t < SPLIT_TIMING.necksStretch) {
    const local =
      (t - SPLIT_TIMING.budsEmerge) /
      (SPLIT_TIMING.necksStretch - SPLIT_TIMING.budsEmerge);
    return 0.015 + easeInOut(local) * 0.305;
  }
  if (t < SPLIT_TIMING.membranesRelease) {
    const local =
      (t - SPLIT_TIMING.necksStretch) /
      (SPLIT_TIMING.membranesRelease - SPLIT_TIMING.necksStretch);
    return 0.32 + easeInOut(local) * 0.26;
  }
  if (t < SPLIT_TIMING.dropletsSettle) {
    const local =
      (t - SPLIT_TIMING.membranesRelease) /
      (SPLIT_TIMING.dropletsSettle - SPLIT_TIMING.membranesRelease);
    return 0.58 + easeOut(local) * 0.465;
  }

  const local =
    (t - SPLIT_TIMING.dropletsSettle) /
    (SPLIT_TIMING.physicsHandoff - SPLIT_TIMING.dropletsSettle);
  return 1.045 + (1 - Math.cos(local * Math.PI)) * -0.0225;
}
