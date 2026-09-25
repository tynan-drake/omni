import { footprintOverlap, type OrbLayout } from "./orb-layout";

export type SpaceNode = OrbLayout & { x: number; y: number };
export interface ConnectionSpace { sourceId: number; x: number; y: number; radius: number }

/** A disposable layout: never mutate the physical graph or its saved positions. */
export function connectionSpaceOffsets(nodes: ReadonlyMap<number, SpaceNode>, space: ConnectionSpace): Map<number, { x: number; y: number }> {
  const source = nodes.get(space.sourceId);
  if (!source) return new Map();
  const cx = source.x + space.x, cy = source.y + space.y;
  const laidOut = [...nodes].map(([id, node]) => ({ ...node, id, moved: false }));
  const gap = 18;
  for (let pass = 0; pass < 60; pass++) {
    let changed = false;
    for (const node of laidOut) {
      if (node.id === space.sourceId) continue;
      const dx = node.x - cx, dy = node.y - cy;
      const distance = Math.hypot(dx, dy);
      // Include the label footprint, not just the artwork.
      const radius = Math.max(node.r, node.labelWidth / 2) + (node.labelOffset + node.labelHeight) / 2;
      const minimum = space.radius + radius + gap;
      if (distance >= minimum - .01) continue;
      const angle = distance > .001 ? Math.atan2(dy, dx) : (node.id % 17) / 17 * Math.PI * 2;
      node.x = cx + Math.cos(angle) * minimum;
      node.y = cy + Math.sin(angle) * minimum;
      node.moved = true;
      changed = true;
    }
    // Let nearby neighbors make room too, without disturbing unrelated clusters.
    for (let i = 0; i < laidOut.length; i++) {
      for (let j = i + 1; j < laidOut.length; j++) {
        const a = laidOut[i], b = laidOut[j];
        if (!a.moved && !b.moved) continue;
        const overlap = footprintOverlap(a, a.x, a.y, b, b.x, b.y);
        if (!overlap || Math.min(overlap.x, overlap.y) < .01) continue;
        const axis = overlap.x < overlap.y ? "x" : "y";
        const sign = b[axis] >= a[axis] ? 1 : -1;
        const amount = overlap[axis] + .1;
        const aShare = a.id === space.sourceId ? 0 : b.id === space.sourceId ? 1 : .5;
        a[axis] -= sign * amount * aShare;
        b[axis] += sign * amount * (1 - aShare);
        if (aShare) a.moved = true;
        if (aShare < 1) b.moved = true;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return new Map(laidOut.filter(n => n.moved).map(n => {
    const original = nodes.get(n.id)!;
    return [n.id, { x: n.x - original.x, y: n.y - original.y }];
  }));
}
