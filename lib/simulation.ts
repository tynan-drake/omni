"use client";

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";

export interface SimNode extends SimulationNodeDatum {
  id: number;
  r: number;
}

interface SimLink {
  source: number | SimNode;
  target: number | SimNode;
  peer: boolean;
}

export type Positions = Map<number, { x: number; y: number; r: number }>;

type TickHandler = (positions: Positions) => void;

let sim: Simulation<SimNode, SimLink> | null = null;
let simNodes: SimNode[] = [];
let hoveredId: number | null = null;
const tickHandlers = new Set<TickHandler>();
const positions: Positions = new Map();

const collide = forceCollide<SimNode>()
  .radius((d) => d.r + (d.id === hoveredId ? 36 : 14))
  .strength(0.85);

function ensureSim(): Simulation<SimNode, SimLink> {
  if (sim) return sim;
  sim = forceSimulation<SimNode>([])
    .force("charge", forceManyBody<SimNode>().strength(-240).distanceMax(900))
    .force("collide", collide)
    .force("x", forceX<SimNode>(0).strength(0.028))
    .force("y", forceY<SimNode>(0).strength(0.028))
    .velocityDecay(0.32)
    .alphaDecay(0.03)
    .on("tick", () => {
      positions.clear();
      for (const n of simNodes) {
        positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0, r: n.r });
      }
      for (const h of tickHandlers) h(positions);
    });
  return sim;
}

export function onSimTick(handler: TickHandler): () => void {
  tickHandlers.add(handler);
  return () => tickHandlers.delete(handler);
}

export function getPositions(): Positions {
  return positions;
}

/**
 * Reconcile the simulation with the current graph. Existing nodes keep their
 * position/velocity; new nodes spawn near their parent (or given point) with a
 * small random offset so they spring outward organically.
 */
export function syncGraph(
  nodes: Array<{ id: number; r: number }>,
  edges: Array<{ from: number; to: number; peer: boolean }>,
  spawnAt: Map<number, { x: number; y: number }>
): void {
  const s = ensureSim();
  const existing = new Map(simNodes.map((n) => [n.id, n]));
  const nextIds = new Set(nodes.map((n) => n.id));

  simNodes = nodes.map((n) => {
    const prev = existing.get(n.id);
    if (prev) {
      prev.r = n.r;
      return prev;
    }
    const origin = spawnAt.get(n.id);
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 60;
    return {
      id: n.id,
      r: n.r,
      x: (origin?.x ?? 0) + Math.cos(angle) * dist,
      y: (origin?.y ?? 0) + Math.sin(angle) * dist,
    };
  });

  // Drop positions of removed nodes so stale entries don't linger.
  for (const id of existing.keys()) {
    if (!nextIds.has(id)) positions.delete(id);
  }

  const links: SimLink[] = edges
    .filter((e) => nextIds.has(e.from) && nextIds.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, peer: e.peer }));

  s.nodes(simNodes);
  s.force(
    "link",
    forceLink<SimNode, SimLink>(links)
      .id((d) => d.id)
      .distance((l) => (l.peer ? 130 : 185))
      .strength((l) => (l.peer ? 0.12 : 0.3))
  );
  s.alpha(0.9).restart();
}

/** Hover push/pull: swell the hovered orb's collision field and re-heat. */
export function setHovered(id: number | null): void {
  if (hoveredId === id) return;
  hoveredId = id;
  const s = ensureSim();
  // Re-set the radius accessor so d3 re-reads radii for all nodes.
  collide.radius((d) => d.r + (d.id === hoveredId ? 36 : 14));
  s.alphaTarget(id === null ? 0 : 0.12).restart();
  if (id === null) s.alpha(Math.max(s.alpha(), 0.12));
}

export function dragNode(id: number, x: number, y: number): void {
  const n = simNodes.find((n) => n.id === id);
  if (!n) return;
  n.fx = x;
  n.fy = y;
  ensureSim().alphaTarget(0.18).restart();
}

export function endDrag(id: number): void {
  const n = simNodes.find((n) => n.id === id);
  if (n) {
    n.fx = null;
    n.fy = null;
  }
  ensureSim().alphaTarget(0);
}

export function kick(alpha = 0.5): void {
  ensureSim().alpha(alpha).restart();
}

export function resetSimulation(): void {
  simNodes = [];
  positions.clear();
  hoveredId = null;
  sim?.nodes([]);
  sim?.force("link", null);
}
