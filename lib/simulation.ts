"use client";

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Force,
  type ForceLink,
  type ForceManyBody,
  type ForceX,
  type ForceY,
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

/**
 * Live-tunable force parameters. Every field is exposed as a dial in the Orbs
 * control panel (see components/OrbDials.tsx); the defaults here are the values
 * the canvas ships with.
 */
export interface OrbPhysics {
  /** Node-to-node repulsion (positive; applied as a negative charge). */
  repulsion: number;
  /** Extra breathing room around each orb. Negative lets orbs overlap. */
  collidePadding: number;
  /** How far the hovered orb shoves its neighbours away. */
  hoverPush: number;
  /** Rest length of influence (directional) links. */
  linkDistance: number;
  /** Rest length of peer links. */
  peerDistance: number;
  linkStrength: number;
  peerStrength: number;
  /** Pull toward the origin — keeps the constellation from drifting apart. */
  gravity: number;
  /** Velocity decay. Higher = more viscous. */
  friction: number;
  /** Alpha decay. Higher = settles sooner. */
  settle: number;
  /** Per-tick random nudge. Above 0 the field never fully comes to rest. */
  chaos: number;
  /** Tangential nudge around the origin — the whole field slowly swirls. */
  orbit: number;
}

const physics: OrbPhysics = {
  repulsion: 640,
  collidePadding: 10,
  hoverPush: 30,
  linkDistance: 190,
  peerDistance: 310,
  linkStrength: 0.19,
  peerStrength: 0.39,
  gravity: 0.034,
  friction: 0.35,
  settle: 0.08,
  chaos: 0,
  orbit: 0,
};

let sim: Simulation<SimNode, SimLink> | null = null;
let simNodes: SimNode[] = [];
let hoveredId: number | null = null;
const tickHandlers = new Set<TickHandler>();
const positions: Positions = new Map();

const collideRadius = (d: SimNode) =>
  d.r + (d.id === hoveredId ? physics.hoverPush : physics.collidePadding);

const linkDistance = (l: SimLink) =>
  l.peer ? physics.peerDistance : physics.linkDistance;
const linkStrength = (l: SimLink) =>
  l.peer ? physics.peerStrength : physics.linkStrength;

const collide = forceCollide<SimNode>().radius(collideRadius).strength(0.85);

/**
 * Chaos + orbit live in one custom force. Both ignore alpha so they keep
 * stirring for as long as the simulation is running — which is why enabling
 * either one also raises the resting alpha target (see alphaFloor).
 */
const stir: Force<SimNode, SimLink> = (() => {
  let nodes: SimNode[] = [];
  const force = () => {
    if (!physics.chaos && !physics.orbit) return;
    for (const n of nodes) {
      if (physics.chaos) {
        n.vx = (n.vx ?? 0) + (Math.random() - 0.5) * physics.chaos;
        n.vy = (n.vy ?? 0) + (Math.random() - 0.5) * physics.chaos;
      }
      if (physics.orbit) {
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        const d = Math.hypot(x, y) || 1;
        n.vx = (n.vx ?? 0) + (-y / d) * physics.orbit;
        n.vy = (n.vy ?? 0) + (x / d) * physics.orbit;
      }
    }
  };
  force.initialize = (ns: SimNode[]) => {
    nodes = ns;
  };
  return force;
})();

/** Resting alpha target — nonzero whenever a never-settling force is on. */
const alphaFloor = () => (physics.chaos || physics.orbit ? 0.06 : 0);

/** Alpha target requested by a transient interaction (hover, drag). */
let interactionAlpha = 0;

function applyAlphaTarget(s: Simulation<SimNode, SimLink>): void {
  s.alphaTarget(Math.max(alphaFloor(), interactionAlpha)).restart();
}

function ensureSim(): Simulation<SimNode, SimLink> {
  if (sim) return sim;
  sim = forceSimulation<SimNode>([])
    .force(
      "charge",
      forceManyBody<SimNode>().strength(-physics.repulsion).distanceMax(900)
    )
    .force("collide", collide)
    .force("x", forceX<SimNode>(0).strength(physics.gravity))
    .force("y", forceY<SimNode>(0).strength(physics.gravity))
    .force("stir", stir)
    .velocityDecay(physics.friction)
    .alphaDecay(physics.settle)
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
      .distance(linkDistance)
      .strength(linkStrength)
  );
  s.alpha(0.9).restart();
}

/**
 * Push new force parameters into the running simulation and re-heat it so the
 * change is visible immediately. Accessors are re-set (rather than mutated in
 * place) because d3 caches per-node values when a force is (re)initialized.
 */
export function setPhysics(next: Partial<OrbPhysics>): void {
  Object.assign(physics, next);
  const s = ensureSim();

  (s.force("charge") as ForceManyBody<SimNode> | undefined)?.strength(
    -physics.repulsion
  );
  (s.force("x") as ForceX<SimNode> | undefined)?.strength(physics.gravity);
  (s.force("y") as ForceY<SimNode> | undefined)?.strength(physics.gravity);
  (s.force("link") as ForceLink<SimNode, SimLink> | undefined)
    ?.distance(linkDistance)
    .strength(linkStrength);
  collide.radius(collideRadius);

  s.velocityDecay(physics.friction).alphaDecay(physics.settle);
  s.alpha(Math.max(s.alpha(), 0.3));
  applyAlphaTarget(s);
}

/** Hover push/pull: swell the hovered orb's collision field and re-heat. */
export function setHovered(id: number | null): void {
  if (hoveredId === id) return;
  hoveredId = id;
  const s = ensureSim();
  // Re-set the radius accessor so d3 re-reads radii for all nodes.
  collide.radius(collideRadius);
  interactionAlpha = id === null ? 0 : 0.12;
  applyAlphaTarget(s);
  if (id === null) s.alpha(Math.max(s.alpha(), 0.12));
}

export function dragNode(id: number, x: number, y: number): void {
  const n = simNodes.find((n) => n.id === id);
  if (!n) return;
  n.fx = x;
  n.fy = y;
  interactionAlpha = 0.18;
  applyAlphaTarget(ensureSim());
}

export function endDrag(id: number): void {
  const n = simNodes.find((n) => n.id === id);
  if (n) {
    n.fx = null;
    n.fy = null;
  }
  interactionAlpha = 0;
  applyAlphaTarget(ensureSim());
}

/** Fling every orb to a fresh random position — a new arrangement to judge. */
export function scatter(spread = 260): void {
  for (const n of simNodes) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * spread;
    n.x = Math.cos(angle) * dist;
    n.y = Math.sin(angle) * dist;
    n.vx = 0;
    n.vy = 0;
  }
  kick(1);
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
