import type { ArtistBridge } from "./types";
import type { OrbLayout } from "./orb-layout";

type Point = { x: number; y: number };
type LayoutNode = OrbLayout & Point;

/** Stable variation: each saved bridge has a character without reshuffling on updates. */
function variation(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0xffffffff * 2 - 1;
}

/** Route order, rather than release decade or influence direction, defines placement. */
export function bridgeLayoutTargets(
  bridge: Pick<ArtistBridge, "id" | "endpointIds" | "paths">,
  nodes: ReadonlyMap<number, LayoutNode>,
): Map<number, Point> {
  const [sourceId, destinationId] = bridge.endpointIds;
  const source = nodes.get(sourceId), destination = nodes.get(destinationId);
  const targets = new Map<number, Point>();
  if (!source || !destination) return targets;
  const routes = bridge.paths.map(path => path.nodeIds[0] === sourceId
    ? path.nodeIds : [...path.nodeIds].reverse()).filter(ids =>
    ids.length > 1 && ids[0] === sourceId && ids.at(-1) === destinationId && ids.every(id => nodes.has(id)));
  if (!routes.length) return targets;
  const members = [...new Set(routes.flat())].map(id => nodes.get(id)!);
  const halfWidth = Math.max(...members.map(node => Math.max(node.r, node.labelWidth / 2)));
  const step = Math.max(260, halfWidth * 2 + 120);
  const sway = step * 0.7;
  const laneHeight = Math.max(...members.map(node => node.r * 2 + node.labelOffset + node.labelHeight)) + 80 + sway * 2;
  const span = Math.max(...routes.map(ids => ids.length - 1)) * step;
  const center = { x: (source.x + destination.x) / 2, y: (source.y + destination.y) / 2 };
  const tilt = variation(`${bridge.id}:tilt`) * step * 0.45;
  targets.set(sourceId, { x: center.x - span / 2, y: center.y - tilt });
  targets.set(destinationId, { x: center.x + span / 2, y: center.y + tilt });

  routes.forEach((ids, routeIndex) => {
    // Shared artists retain their placement. Fill each new segment between its
    // existing anchors, putting alternate routes in distinct parallel lanes.
    const lane = routeIndex === 0 ? 0 : Math.ceil(routeIndex / 2) * (routeIndex % 2 ? 1 : -1) * laneHeight;
    let start = 0;
    for (let end = 1; end < ids.length; end++) {
      if (!targets.has(ids[end])) continue;
      const a = targets.get(ids[start])!, b = targets.get(ids[end])!;
      for (let index = start + 1; index < end; index++) {
        const t = (index - start) / (end - start);
        // Horizontal jitter is bounded by the hop width so artists cannot swap
        // order. Vertical sway gives the route a loose constellation silhouette.
        const hop = Math.abs(b.x - a.x) / (end - start);
        const horizontalVariation = Math.min(hop * 0.2, Math.max(0, (hop - halfWidth * 2 - 32) / 2));
        const seed = `${bridge.id}:${ids[index]}`;
        targets.set(ids[index], {
          x: a.x + (b.x - a.x) * t + variation(`${seed}:x`) * horizontalVariation,
          y: a.y + (b.y - a.y) * t + lane + variation(`${seed}:y`) * sway,
        });
      }
      start = end;
    }
  });
  return targets;
}
