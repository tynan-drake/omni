"use client";

import { onSimTick, restorePositions, serializePositions } from "@/lib/simulation";
import type { GraphEdge, GraphNode } from "@/lib/types";
import { useGraph, type GraphSnapshot } from "./graph";

const KEY = "omni:canvas:v1";
const VERSION = 1;

interface PersistedCanvas {
  version: 1;
  graph: GraphSnapshot;
  positions: Record<number, { x: number; y: number }>;
}

function validSnapshot(value: unknown): value is PersistedCanvas {
  if (!value || typeof value !== "object") return false;
  const saved = value as Partial<PersistedCanvas>;
  const graph = saved.graph as Partial<GraphSnapshot> | undefined;
  return (
    saved.version === VERSION &&
    Boolean(graph) &&
    typeof graph?.nodes === "object" &&
    Array.isArray(graph?.order) &&
    Array.isArray(graph?.edges) &&
    typeof graph?.bridges === "object" &&
    Array.isArray(graph?.bridgeOrder) &&
    typeof saved.positions === "object"
  );
}

function normalizeGraph(graph: GraphSnapshot): GraphSnapshot {
  const nodes = Object.fromEntries(
    Object.entries(graph.nodes).map(([id, node]) => [
      id,
      { ...node, origins: Array.isArray((node as GraphNode).origins) ? node.origins : ["seed"] },
    ])
  ) as Record<number, GraphNode>;
  const edges = graph.edges.map((edge) => ({
    ...edge,
    reason: edge.reason ?? null,
    sources: Array.isArray(edge.sources) ? edge.sources : [],
    origins: Array.isArray((edge as GraphEdge).origins) ? edge.origins : ["explored"],
  }));
  return { ...graph, nodes, edges };
}

export function hydrateCanvas(): void {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      useGraph.getState().hydrate(null);
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!validSnapshot(parsed)) {
      window.localStorage.removeItem(KEY);
      useGraph.getState().hydrate(null);
      return;
    }
    restorePositions(parsed.positions);
    useGraph.getState().hydrate(normalizeGraph(parsed.graph));
  } catch {
    useGraph.getState().hydrate(null);
  }
}

export function startCanvasPersistence(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    try {
      const payload: PersistedCanvas = {
        version: VERSION,
        graph: useGraph.getState().snapshot(),
        positions: serializePositions(),
      };
      window.localStorage.setItem(KEY, JSON.stringify(payload));
    } catch {
      // Storage is optional in private mode or under quota pressure.
    }
  };
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(save, 600);
  };
  const unsubscribeGraph = useGraph.subscribe(schedule);
  const unsubscribeTicks = onSimTick(schedule);
  return () => {
    unsubscribeGraph();
    unsubscribeTicks();
    if (timer) clearTimeout(timer);
    save();
  };
}
