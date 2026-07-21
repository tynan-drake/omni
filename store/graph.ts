"use client";

import { create } from "zustand";
import type {
  ArtistRef,
  Direction,
  GraphEdge,
  GraphNode,
  LineageResult,
  LineageSource,
} from "@/lib/types";

export interface SpawnHint {
  x: number;
  y: number;
}

interface GraphState {
  nodes: Record<number, GraphNode>;
  order: number[];
  edges: GraphEdge[];
  /** parent node each new node should spawn near (consumed by Canvas). */
  spawnFrom: Record<number, number>;
  expanded: Record<number, Partial<Record<Direction, boolean>>>;
  selectedId: number | null;
  lastSource: LineageSource | null;

  addSeed: (artist: ArtistRef & { accent: string }) => void;
  applyLineage: (parentId: number, result: LineageResult) => void;
  removeNode: (id: number) => void;
  select: (id: number | null) => void;
  reset: () => void;
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function hasEdge(edges: GraphEdge[], a: number, b: number): boolean {
  const key = edgeKey(a, b);
  return edges.some((e) => edgeKey(e.from, e.to) === key);
}

export const useGraph = create<GraphState>((set) => ({
  nodes: {},
  order: [],
  edges: [],
  spawnFrom: {},
  expanded: {},
  selectedId: null,
  lastSource: null,

  addSeed: (artist) =>
    set((s) => {
      if (s.nodes[artist.id]) return { selectedId: artist.id };
      const node: GraphNode = {
        id: artist.id,
        name: artist.name,
        picture: artist.picture,
        pictureBig: artist.pictureBig,
        accent: artist.accent,
        kind: "seed",
        reason: null,
        era: null,
        decade: null,
        generation: 0,
      };
      return {
        nodes: { ...s.nodes, [artist.id]: node },
        order: [...s.order, artist.id],
        selectedId: artist.id,
      };
    }),

  applyLineage: (parentId, result) =>
    set((s) => {
      const parent = s.nodes[parentId];
      if (!parent) return {};

      const nodes = { ...s.nodes };
      const order = [...s.order];
      const edges = [...s.edges];
      const spawnFrom = { ...s.spawnFrom };
      const kind = result.direction === "back" ? "root" : "branch";

      for (const entry of result.entries) {
        if (!nodes[entry.id]) {
          nodes[entry.id] = {
            id: entry.id,
            name: entry.name,
            picture: entry.picture,
            pictureBig: entry.pictureBig,
            accent: entry.accent,
            kind,
            reason: entry.reason,
            era: entry.era,
            decade: entry.decade,
            generation: parent.generation + 1,
          };
          order.push(entry.id);
          spawnFrom[entry.id] = parentId;
        }
        // Influence flows from the earlier artist to the later one.
        const [from, to] =
          result.direction === "back" ? [entry.id, parentId] : [parentId, entry.id];
        if (!hasEdge(edges, from, to)) {
          edges.push({ id: `${from}-${to}`, from, to, kind: result.direction });
        }
      }

      // Peer cross-links within the batch (undirected).
      for (const entry of result.entries) {
        for (const other of entry.linkedTo) {
          if (!nodes[other] || entry.id === other) continue;
          if (!hasEdge(edges, entry.id, other)) {
            edges.push({
              id: `${entry.id}-${other}-peer`,
              from: entry.id,
              to: other,
              kind: "peer",
            });
          }
        }
      }

      return {
        nodes,
        order,
        edges,
        spawnFrom,
        lastSource: result.source,
        expanded: {
          ...s.expanded,
          [parentId]: { ...s.expanded[parentId], [result.direction]: true },
        },
      };
    }),

  removeNode: (id) =>
    set((s) => {
      if (!s.nodes[id]) return {};
      const nodes = { ...s.nodes };
      delete nodes[id];
      const spawnFrom = { ...s.spawnFrom };
      delete spawnFrom[id];
      return {
        nodes,
        order: s.order.filter((n) => n !== id),
        edges: s.edges.filter((e) => e.from !== id && e.to !== id),
        spawnFrom,
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  select: (id) => set({ selectedId: id }),

  reset: () =>
    set({
      nodes: {},
      order: [],
      edges: [],
      spawnFrom: {},
      expanded: {},
      selectedId: null,
      lastSource: null,
    }),
}));

/** Orb pixel size by node role — seeds anchor the universe visually. */
export function orbSize(node: GraphNode): number {
  if (node.kind === "seed") return 132;
  if (node.generation <= 1) return 92;
  if (node.generation === 2) return 76;
  return 64;
}
