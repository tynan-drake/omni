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
import {
  SPLIT_TIMING,
  splitTravelProgress,
  type SplitBudPlan,
} from "@/lib/split-formation";
import {
  createOrbLayout,
  DEFAULT_LABEL_LAYOUT,
  footprintOverlap,
  type LabelLayout,
  type OrbLayout,
} from "@/lib/orb-layout";

export interface SimNode extends SimulationNodeDatum, OrbLayout {
  id: number;
  name: string;
  hasEra: boolean;
}

interface SimLink {
  source: number | SimNode;
  target: number | SimNode;
  peer: boolean;
  temporal: boolean;
}

export type Positions = Map<
  number,
  { x: number; y: number } & OrbLayout
>;

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
  /** Retained for DialKit compatibility; hover never moves the constellation. */
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
const labelLayout: LabelLayout = { ...DEFAULT_LABEL_LAYOUT };
const tickHandlers = new Set<TickHandler>();
const positions: Positions = new Map();
const restoredPositions = new Map<number, { x: number; y: number }>();
const searchOrigins = new Map<number, { x: number; y: number }>();
let timelineTargets = new Map<number, number>();
let temporalLinks: SimLink[] = [];

const collideRadius = (d: SimNode) => d.r + physics.collidePadding;

const linkDistance = (l: SimLink) =>
  l.peer ? physics.peerDistance : physics.linkDistance;
const linkStrength = (l: SimLink) =>
  l.peer ? physics.peerStrength : physics.linkStrength;

const collide = forceCollide<SimNode>().radius(collideRadius).strength(0.85);

/**
 * The standard collision force only sees round cover art. This companion
 * force reserves the complete footprint, including the name and era beneath
 * each orb, so new artists do not generate into unreadable label collisions.
 */
const labelCollision: Force<SimNode, SimLink> = (() => {
  let nodes: SimNode[] = [];
  const force = () => {
    for (let pass = 0; pass < 4; pass += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const ax = a.x ?? 0;
          const ay = a.y ?? 0;
          const bx = b.x ?? 0;
          const by = b.y ?? 0;
          const overlap = footprintOverlap(a, ax, ay, b, bx, by);
          if (!overlap) continue;

          if (overlap.x < overlap.y) {
            const direction = bx >= ax ? 1 : -1;
            const push = overlap.x / 2;
            if (a.fx === null || a.fx === undefined) a.x = ax - direction * push;
            if (b.fx === null || b.fx === undefined) b.x = bx + direction * push;
          } else {
            const direction = by >= ay ? 1 : -1;
            const push = overlap.y / 2;
            if (a.fy === null || a.fy === undefined) a.y = ay - direction * push;
            if (b.fy === null || b.fy === undefined) b.y = by + direction * push;
          }
        }
      }
    }
  };
  force.initialize = (next: SimNode[]) => {
    nodes = next;
  };
  return force;
})();

/**
 * Influence always moves left → right. This force only intervenes when a
 * relationship is about to fold backward, leaving y free for the organic fan.
 */
const temporalFlow: Force<SimNode, SimLink> = (alpha) => {
  const minimumGap = 118;
  const strength = 0.16;
  for (const link of temporalLinks) {
    if (!link.temporal) continue;
    const source =
      typeof link.source === "number"
        ? simNodes.find((node) => node.id === link.source)
        : link.source;
    const target =
      typeof link.target === "number"
        ? simNodes.find((node) => node.id === link.target)
        : link.target;
    if (!source || !target) continue;
    const gap = (target.x ?? 0) - (source.x ?? 0);
    if (gap >= minimumGap) continue;
    const push = (minimumGap - gap) * strength * alpha;
    source.vx = (source.vx ?? 0) - push;
    target.vx = (target.vx ?? 0) + push;
  }
};

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
    .force("label-collision", labelCollision)
    .force(
      "x",
      forceX<SimNode>((d) => timelineTargets.get(d.id) ?? searchOrigins.get(d.id)?.x ?? 0).strength((d) =>
        timelineTargets.has(d.id) ? 0.085 : physics.gravity
      )
    )
    .force("y", forceY<SimNode>((d) => searchOrigins.get(d.id)?.y ?? 0).strength(physics.gravity))
    .force("temporal", temporalFlow)
    .force("stir", stir)
    .velocityDecay(physics.friction)
    .alphaDecay(physics.settle)
    .on("tick", () => {
      positions.clear();
      for (const n of simNodes) {
        positions.set(n.id, {
          x: n.x ?? 0,
          y: n.y ?? 0,
          r: n.r,
          labelWidth: n.labelWidth,
          labelHeight: n.labelHeight,
          labelOffset: n.labelOffset,
        });
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

export function serializePositions(): Record<number, { x: number; y: number }> {
  return Object.fromEntries(
    [...positions].map(([id, p]) => [id, { x: p.x, y: p.y }])
  );
}

export function restorePositions(saved: Record<number, { x: number; y: number }>): void {
  restoredPositions.clear();
  for (const [id, p] of Object.entries(saved)) {
    if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) {
      restoredPositions.set(Number(id), { x: p.x, y: p.y });
    }
  }
}

/** Stage an unseen search result without disturbing restored positions. */
export function stageSearchPosition(id: number, point: { x: number; y: number }): void {
  restoredPositions.set(id, point);
  searchOrigins.set(id, point);
}

export function setTimelineTargets(targets: Map<number, number>): void {
  timelineTargets = new Map(targets);
  const s = ensureSim();
  (s.force("x") as ForceX<SimNode> | undefined)
    ?.x((d) => timelineTargets.get(d.id) ?? searchOrigins.get(d.id)?.x ?? 0)
    .strength((d) => (timelineTargets.has(d.id) ? 0.085 : physics.gravity));
  s.alpha(Math.max(s.alpha(), 0.32)).restart();
}

/**
 * Reconcile the simulation with the current graph. Existing nodes keep their
 * position/velocity; new nodes spawn near their parent (or given point) with a
 * small random offset so they spring outward organically.
 */
export function syncGraph(
  nodes: Array<{ id: number; r: number; name: string; hasEra: boolean }>,
  edges: Array<{ from: number; to: number; peer: boolean; temporal: boolean }>,
  spawnAt: Map<number, { x: number; y: number; exact?: boolean }>
): void {
  const s = ensureSim();
  const existing = new Map(simNodes.map((n) => [n.id, n]));
  const nextIds = new Set(nodes.map((n) => n.id));

  // An isolated search result rests where it was discovered. Once connected,
  // it rejoins the ordinary graph forces with its new family.
  for (const id of searchOrigins.keys()) {
    if (!nextIds.has(id) || edges.some((edge) => edge.from === id || edge.to === id)) searchOrigins.delete(id);
  }
  let usedRestore = false;
  simNodes = nodes.map((n) => {
    const prev = existing.get(n.id);
    if (prev) {
      prev.r = n.r;
      prev.name = n.name;
      prev.hasEra = n.hasEra;
      Object.assign(prev, createOrbLayout(n.r, n.name, n.hasEra, labelLayout));
      return prev;
    }
    const restored = restoredPositions.get(n.id);
    if (restored) {
      usedRestore = true;
      restoredPositions.delete(n.id);
      return {
        id: n.id,
        name: n.name,
        hasEra: n.hasEra,
        ...createOrbLayout(n.r, n.name, n.hasEra, labelLayout),
        x: restored.x,
        y: restored.y,
        vx: 0,
        vy: 0,
      };
    }
    const origin = spawnAt.get(n.id);
    const angle = Math.random() * Math.PI * 2;
    const layout = createOrbLayout(n.r, n.name, n.hasEra, labelLayout);
    const dist = origin?.exact ? 0 : Math.max(110, layout.labelWidth / 2 + 70) + Math.random() * 60;
    return {
      id: n.id,
      name: n.name,
      hasEra: n.hasEra,
      ...layout,
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
    .map((e) => ({
      source: e.from,
      target: e.to,
      peer: e.peer,
      temporal: e.temporal,
    }));
  temporalLinks = links;

  s.nodes(simNodes);
  s.force(
    "link",
    forceLink<SimNode, SimLink>(links)
      .id((d) => d.id)
      .distance(linkDistance)
      .strength(linkStrength)
  );
  s.alpha(usedRestore ? 0.06 : 0.9).restart();
}

interface SplitFormationOptions {
  parentId: number;
  plans: SplitBudPlan[];
  reducedMotion?: boolean;
  onComplete: () => void;
}

/**
 * Temporarily pin a lineage family into its mitosis formation. The DOM renders
 * the membrane deformation; this keeps the real graph nodes underneath it on
 * the same continuous path, then returns them to d3 with outward momentum.
 */
export function animateSplitFormation({
  parentId,
  plans,
  reducedMotion = false,
  onComplete,
}: SplitFormationOptions): () => void {
  const parent = simNodes.find((node) => node.id === parentId);
  const children = plans
    .map((plan) => ({ plan, node: simNodes.find((node) => node.id === plan.id) }))
    .filter(
      (item): item is { plan: SplitBudPlan; node: SimNode } => Boolean(item.node)
    );
  if (!parent || !children.length) {
    onComplete();
    return () => undefined;
  }

  const origin = { x: parent.x ?? 0, y: parent.y ?? 0 };
  const savedParentPin = { x: parent.fx, y: parent.fy };
  const directionSign = plans.reduce((sum, plan) => sum + plan.x, 0) < 0 ? -1 : 1;
  let frame = 0;
  let finished = false;

  const releasePins = (completed: boolean) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    parent.fx = savedParentPin.x;
    parent.fy = savedParentPin.y;
    for (const { node, plan } of children) {
      node.fx = null;
      node.fy = null;
      if (completed) {
        node.x = origin.x + plan.x;
        node.y = origin.y + plan.y;
        node.vx = (plan.x / plan.distance) * 1.9;
        node.vy = (plan.y / plan.distance) * 1.9;
      }
    }
    ensureSim().alpha(Math.max(ensureSim().alpha(), 0.42)).restart();
    if (completed) onComplete();
  };

  parent.fx = origin.x;
  parent.fy = origin.y;
  for (const { node, plan } of children) {
    const firstProgress = reducedMotion ? 1 : splitTravelProgress(0);
    node.x = origin.x + plan.x * firstProgress;
    node.y = origin.y + plan.y * firstProgress;
    node.fx = node.x;
    node.fy = node.y;
    node.vx = 0;
    node.vy = 0;
  }

  if (reducedMotion) {
    releasePins(true);
    return () => undefined;
  }

  const startedAt = performance.now();
  const tick = (now: number) => {
    const elapsed = now - startedAt;
    const progress = splitTravelProgress(elapsed);
    const recoilPhase = Math.min(elapsed / SPLIT_TIMING.dropletsSettle, 1);
    const recoil = Math.sin(recoilPhase * Math.PI) * -directionSign * 8;
    parent.fx = origin.x + recoil;
    parent.fy = origin.y;

    for (const { node, plan } of children) {
      node.fx = origin.x + plan.x * progress;
      node.fy = origin.y + plan.y * progress;
    }

    if (elapsed >= SPLIT_TIMING.physicsHandoff) {
      releasePins(true);
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  ensureSim().alpha(Math.max(ensureSim().alpha(), 0.5)).restart();

  return () => releasePins(false);
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
  (s.force("x") as ForceX<SimNode> | undefined)
    ?.x((d) => timelineTargets.get(d.id) ?? searchOrigins.get(d.id)?.x ?? 0)
    .strength((d) => (timelineTargets.has(d.id) ? 0.085 : physics.gravity));
  (s.force("y") as ForceY<SimNode> | undefined)?.y((d) => searchOrigins.get(d.id)?.y ?? 0).strength(physics.gravity);
  (s.force("link") as ForceLink<SimNode, SimLink> | undefined)
    ?.distance(linkDistance)
    .strength(linkStrength);
  collide.radius(collideRadius);

  s.velocityDecay(physics.friction).alphaDecay(physics.settle);
  s.alpha(Math.max(s.alpha(), 0.3));
  applyAlphaTarget(s);
}

/** Keep the simulation's reserved label footprint in sync with DialKit. */
export function setLabelLayout(next: Partial<LabelLayout>): void {
  Object.assign(labelLayout, next);
  for (const node of simNodes) {
    Object.assign(node, createOrbLayout(node.r, node.name, node.hasEra, labelLayout));
  }
  const s = ensureSim();
  s.alpha(Math.max(s.alpha(), 0.32)).restart();
}

/** Hover is visual-only: it must not disturb neighboring orb positions. */
export function setHovered(id: number | null): void {
  void id;
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
  restoredPositions.clear();
  searchOrigins.clear();
  timelineTargets.clear();
  temporalLinks = [];
  sim?.nodes([]);
  sim?.force("link", null);
}
