"use client";

import { create } from "zustand";
import type {
  ArtistBridge,
  ArtistRef,
  BridgeResult,
  Direction,
  EdgeKind,
  GraphEdge,
  GraphNode,
  LineageResult,
  LineageSource,
  RelationshipKind,
} from "@/lib/types";

export interface GraphSnapshot {
  nodes: Record<number, GraphNode>;
  order: number[];
  edges: GraphEdge[];
  spawnFrom: Record<number, number>;
  expanded: Record<number, Partial<Record<Direction, boolean>>>;
  selectedId: number | null;
  lastSource: LineageSource | null;
  bridges: Record<string, ArtistBridge>;
  bridgeOrder: string[];
  activeBridgeId: string | null;
}

interface GraphState extends GraphSnapshot {
  hydrated: boolean;
  /** Ephemeral multi-selection; only selectedId is persisted for compatibility. */
  selectedIds: number[];
  addSeed: (artist: ArtistRef & { accent: string }) => void;
  applyLineage: (parentId: number, result: LineageResult) => void;
  applyBridge: (result: BridgeResult, existingId?: string, pathCount?: number) => string | null;
  revealBridgePath: (id: string) => void;
  renameBridge: (id: string, name: string) => void;
  deleteBridge: (id: string) => void;
  setActiveBridge: (id: string | null) => void;
  removeNode: (id: number) => number;
  removeNodes: (ids: number[]) => number;
  select: (id: number | null) => void;
  setSelection: (ids: number[]) => void;
  toggleSelection: (id: number) => void;
  hydrate: (snapshot: GraphSnapshot | null) => void;
  snapshot: () => GraphSnapshot;
  reset: () => void;
}

const emptyGraph = (): GraphSnapshot => ({
  nodes: {},
  order: [],
  edges: [],
  spawnFrom: {},
  expanded: {},
  selectedId: null,
  lastSource: null,
  bridges: {},
  bridgeOrder: [],
  activeBridgeId: null,
});

const edgeKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const withOrigin = (origins: string[] | undefined, origin: string) =>
  origins?.includes(origin) ? origins : [...(origins ?? []), origin];
const relationshipOf = (kind: EdgeKind): RelationshipKind =>
  kind === "back" || kind === "forward" ? "influence" : kind;

function hasEdge(edges: GraphEdge[], a: number, b: number): boolean {
  const key = edgeKey(a, b);
  return edges.some((edge) => edgeKey(edge.from, edge.to) === key);
}

function lineageParent(origin: string): number | null {
  const match = /^lineage:(\d+):(back|forward)$/.exec(origin);
  return match ? Number(match[1]) : null;
}

function lineageDirection(origin: string): Direction | null {
  const match = /^lineage:\d+:(back|forward)$/.exec(origin);
  return (match?.[1] as Direction | undefined) ?? null;
}

function bridgeOriginId(origin: string): string | null {
  return origin.startsWith("bridge:") ? origin.slice("bridge:".length) : null;
}

/**
 * Find descendants owned exclusively by the nodes already being removed.
 * Independently seeded artists and artists with a surviving lineage/bridge
 * owner are retained, and retained nodes stop the cascade below them.
 */
function collectOwnedRemoval(data: GraphSnapshot, requestedIds: number[]): Set<number> {
  const removed = new Set(requestedIds.filter((id) => Boolean(data.nodes[id])));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [rawChild, parentId] of Object.entries(data.spawnFrom)) {
      const childId = Number(rawChild);
      if (!removed.has(parentId) || removed.has(childId)) continue;
      const child = data.nodes[childId];
      if (!child || child.origins.includes("seed")) continue;

      const hasSurvivingOwner = child.origins.some((origin) => {
        const lineage = lineageParent(origin);
        if (lineage !== null) return !removed.has(lineage) && Boolean(data.nodes[lineage]);

        const bridgeId = bridgeOriginId(origin);
        if (bridgeId === null) return false;
        const bridge = data.bridges[bridgeId];
        return Boolean(
          bridge && bridge.endpointIds.every((endpointId) => !removed.has(endpointId))
        );
      });
      if (hasSurvivingOwner) continue;

      removed.add(childId);
      changed = true;
    }
  }
  return removed;
}

function removeNodesFromData(
  source: GraphSnapshot,
  requestedIds: number[]
): { data: GraphSnapshot; removedIds: Set<number> } {
  const beforeIds = new Set(source.order.filter((id) => Boolean(source.nodes[id])));
  const cascade = collectOwnedRemoval(source, requestedIds);
  let data = source;

  // A bridge cannot survive without both endpoints. Its existing cleanup also
  // preserves connector artists owned by another bridge or explored lineage.
  for (const bridgeId of source.bridgeOrder) {
    const bridge = data.bridges[bridgeId];
    if (bridge?.endpointIds.some((id) => cascade.has(id))) {
      data = deleteBridgeFromData(data, bridgeId);
    }
  }

  const nodes = { ...data.nodes };
  for (const id of cascade) delete nodes[id];
  const survivingIds = new Set(Object.keys(nodes).map(Number));
  const removedIds = new Set([...beforeIds].filter((id) => !survivingIds.has(id)));

  // Strip ownership records tied to deleted parents/bridges from survivors.
  for (const [rawId, node] of Object.entries(nodes)) {
    const origins = node.origins.filter((origin) => {
      const lineage = lineageParent(origin);
      if (lineage !== null) return !removedIds.has(lineage);
      const bridgeId = bridgeOriginId(origin);
      return bridgeId === null || Boolean(data.bridges[bridgeId]);
    });
    nodes[Number(rawId)] = { ...node, origins };
  }

  const edges = data.edges
    .filter((edge) => survivingIds.has(edge.from) && survivingIds.has(edge.to))
    .map((edge) => ({
      ...edge,
      origins: edge.origins.filter((origin) => {
        const lineage = lineageParent(origin);
        if (lineage !== null) return !removedIds.has(lineage);
        const bridgeId = bridgeOriginId(origin);
        return bridgeId === null || Boolean(data.bridges[bridgeId]);
      }),
    }))
    .filter((edge) => edge.origins.length > 0);

  const spawnFrom: Record<number, number> = {};
  for (const id of survivingIds) {
    const currentParent = data.spawnFrom[id];
    if (currentParent !== undefined && survivingIds.has(currentParent)) {
      spawnFrom[id] = currentParent;
      continue;
    }
    const replacement = nodes[id].origins
      .map(lineageParent)
      .find((parent): parent is number => parent !== null && survivingIds.has(parent));
    if (replacement !== undefined) spawnFrom[id] = replacement;
  }

  const expanded = Object.fromEntries(
    Object.entries(data.expanded)
      .filter(([id]) => survivingIds.has(Number(id)))
      .map(([id, directions]) => [id, { ...directions }])
  ) as GraphSnapshot["expanded"];
  for (const removedId of removedIds) {
    for (const origin of source.nodes[removedId]?.origins ?? []) {
      const parentId = lineageParent(origin);
      const direction = lineageDirection(origin);
      if (parentId === null || direction === null || !expanded[parentId]) continue;
      delete expanded[parentId][direction];
      if (!Object.keys(expanded[parentId]).length) delete expanded[parentId];
    }
  }
  const selectedId =
    data.selectedId !== null && survivingIds.has(data.selectedId) ? data.selectedId : null;

  return {
    data: {
      ...data,
      nodes,
      order: data.order.filter((id) => survivingIds.has(id)),
      edges,
      spawnFrom,
      expanded,
      selectedId,
    },
    removedIds,
  };
}

function deleteBridgeFromData(data: GraphSnapshot, bridgeId: string): GraphSnapshot {
  if (!data.bridges[bridgeId]) return data;
  const origin = `bridge:${bridgeId}`;
  const edges = data.edges
    .map((edge) => ({
      ...edge,
      origins: (edge.origins ?? []).filter((item) => item !== origin),
    }))
    .filter((edge) => edge.origins.length > 0);
  const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const nodes: Record<number, GraphNode> = {};
  for (const [rawId, node] of Object.entries(data.nodes)) {
    const id = Number(rawId);
    const origins = (node.origins ?? []).filter((item) => item !== origin);
    if (origins.length || connected.has(id)) nodes[id] = { ...node, origins };
  }
  const bridges = { ...data.bridges };
  delete bridges[bridgeId];
  const order = data.order.filter((id) => Boolean(nodes[id]));
  const expanded = Object.fromEntries(
    Object.entries(data.expanded).filter(([id]) => Boolean(nodes[Number(id)]))
  ) as GraphSnapshot["expanded"];
  const spawnFrom = Object.fromEntries(
    Object.entries(data.spawnFrom).filter(
      ([child, parent]) => Boolean(nodes[Number(child)]) && Boolean(nodes[parent])
    )
  ) as GraphSnapshot["spawnFrom"];
  return {
    ...data,
    nodes,
    order,
    edges,
    expanded,
    spawnFrom,
    bridges,
    bridgeOrder: data.bridgeOrder.filter((id) => id !== bridgeId),
    activeBridgeId: data.activeBridgeId === bridgeId ? null : data.activeBridgeId,
    selectedId: data.selectedId !== null && nodes[data.selectedId] ? data.selectedId : null,
  };
}

function makeBridgeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useGraph = create<GraphState>((set, get) => ({
  ...emptyGraph(),
  hydrated: false,
  selectedIds: [],

  addSeed: (artist) =>
    set((state) => {
      const existing = state.nodes[artist.id];
      if (existing) {
        return {
          nodes: {
            ...state.nodes,
            [artist.id]: {
              ...existing,
              kind: "seed" as const,
              origins: withOrigin(existing.origins, "seed"),
            },
          },
          selectedId: artist.id,
          selectedIds: [artist.id],
        };
      }
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
        origins: ["seed"],
      };
      return {
        nodes: { ...state.nodes, [artist.id]: node },
        order: [...state.order, artist.id],
        selectedId: artist.id,
        selectedIds: [artist.id],
      };
    }),

  applyLineage: (parentId, result) =>
    set((state) => {
      const parent = state.nodes[parentId];
      if (!parent) return {};
      const nodes = {
        ...state.nodes,
        [parentId]: { ...parent, origins: withOrigin(parent.origins, "explored") },
      };
      const order = [...state.order];
      const edges = state.edges.map((edge) => ({ ...edge }));
      const spawnFrom = { ...state.spawnFrom };
      const kind = result.direction === "back" ? "root" : "branch";
      const origin = `lineage:${parentId}:${result.direction}`;

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
            origins: [origin],
          };
          order.push(entry.id);
          spawnFrom[entry.id] = parentId;
        } else {
          nodes[entry.id] = {
            ...nodes[entry.id],
            origins: withOrigin(nodes[entry.id].origins, origin),
          };
        }
        const [from, to] =
          result.direction === "back" ? [entry.id, parentId] : [parentId, entry.id];
        const existing = edges.find(
          (edge) =>
            edge.from === from &&
            edge.to === to &&
            relationshipOf(edge.kind) === "influence"
        );
        if (existing) {
          existing.origins = withOrigin(existing.origins, origin);
          if (!existing.reason) existing.reason = entry.reason;
        } else {
          edges.push({
            id: `${from}-${to}-${result.direction}`,
            from,
            to,
            kind: result.direction,
            reason: entry.reason,
            sources: [],
            origins: [origin],
          });
        }
      }

      for (const entry of result.entries) {
        for (const other of entry.linkedTo) {
          if (!nodes[other] || entry.id === other || hasEdge(edges, entry.id, other)) continue;
          edges.push({
            id: `${entry.id}-${other}-peer`,
            from: entry.id,
            to: other,
            kind: "peer",
            reason: "Strong musical ties within this lineage.",
            sources: [],
            origins: [origin],
          });
        }
      }
      return {
        nodes,
        order,
        edges,
        spawnFrom,
        lastSource: result.source,
        expanded: {
          ...state.expanded,
          [parentId]: { ...state.expanded[parentId], [result.direction]: true },
        },
      };
    }),

  applyBridge: (result, existingId, pathCount = 1) => {
    if (result.status !== "found" || !result.paths.length) return null;
    const bridgeId = existingId ?? makeBridgeId();
    const rankedPaths = [...result.paths].sort((a, b) => a.edgeIds.length - b.edgeIds.length);
    const selectedPaths = rankedPaths.slice(0, Math.max(1, pathCount));
    const selectedNodes = new Set(selectedPaths.flatMap(path => path.nodeIds));
    const selectedEdges = new Set(selectedPaths.flatMap(path => path.edgeIds));
    const origin = `bridge:${bridgeId}`;
    set((state) => {
      const nodes = { ...state.nodes };
      const order = [...state.order];
      const edges = state.edges.map((edge) => ({ ...edge }));
      const spawnFrom = { ...state.spawnFrom };
      for (const entry of result.entries.filter(entry => selectedNodes.has(entry.id))) {
        const existing = nodes[entry.id];
        if (existing) {
          nodes[entry.id] = {
            ...existing,
            era: existing.era ?? entry.era,
            decade: existing.decade ?? entry.decade,
            origins: withOrigin(existing.origins, origin),
          };
        } else {
          nodes[entry.id] = {
            ...entry,
            kind: "connector",
            reason: null,
            generation: 1,
            origins: [origin],
          };
          order.push(entry.id);
          spawnFrom[entry.id] = result.endpoints[0];
        }
      }

      const edgeIdMap = new Map<string, string>();
      for (const relationship of result.edges.filter(edge => selectedEdges.has(edge.id))) {
        const existing = edges.find(
          (edge) =>
            edge.from === relationship.from &&
            edge.to === relationship.to &&
            relationshipOf(edge.kind) === relationship.kind
        );
        if (existing) {
          existing.origins = withOrigin(existing.origins, origin);
          existing.reason ||= relationship.reason;
          existing.sources = existing.sources?.length ? existing.sources : relationship.sources;
          edgeIdMap.set(relationship.id, existing.id);
        } else {
          let id = relationship.id;
          let suffix = 2;
          while (edges.some((edge) => edge.id === id)) id = `${relationship.id}-${suffix++}`;
          edges.push({ ...relationship, id, origins: [origin] });
          edgeIdMap.set(relationship.id, id);
        }
      }
      const paths = selectedPaths.map((path) => ({
        ...path,
        edgeIds: path.edgeIds
          .map((id) => edgeIdMap.get(id))
          .filter((id): id is string => Boolean(id)),
      }));
      const nodeIds = [...new Set(paths.flatMap((path) => path.nodeIds))];
      const edgeIds = [...new Set(paths.flatMap((path) => path.edgeIds))];
      const a = nodes[result.endpoints[0]]?.name ?? "Artist A";
      const b = nodes[result.endpoints[1]]?.name ?? "Artist B";
      const now = Date.now();
      const bridge: ArtistBridge = {
        id: bridgeId,
        name: state.bridges[bridgeId]?.name ?? `${a} ↔ ${b}`,
        routeOptions: { ...result, paths: rankedPaths },
        endpointIds: result.endpoints,
        mode: result.mode,
        generationSource: result.generationSource,
        degraded: result.degraded,
        paths,
        nodeIds,
        edgeIds,
        createdAt: state.bridges[bridgeId]?.createdAt ?? now,
        updatedAt: now,
      };
      return {
        nodes,
        order,
        edges,
        spawnFrom,
        bridges: { ...state.bridges, [bridgeId]: bridge },
        bridgeOrder: state.bridgeOrder.includes(bridgeId) ? state.bridgeOrder : [...state.bridgeOrder, bridgeId],
        activeBridgeId: bridgeId,
        lastSource: result.generationSource,
      };
    });
    return bridgeId;
  },

  revealBridgePath: (id) => {
    const bridge = get().bridges[id];
    if (!bridge?.routeOptions || bridge.paths.length >= bridge.routeOptions.paths.length) return;
    get().applyBridge(bridge.routeOptions, id, bridge.paths.length + 1);
  },

  renameBridge: (id, rawName) =>
    set((state) => {
      const bridge = state.bridges[id];
      const name = rawName.trim();
      if (!bridge || !name) return {};
      return {
        bridges: {
          ...state.bridges,
          [id]: { ...bridge, name, updatedAt: Date.now() },
        },
      };
    }),

  deleteBridge: (id) =>
    set((state) => {
      const data = deleteBridgeFromData(state, id);
      const selectedIds = state.selectedIds.filter((nodeId) => data.nodes[nodeId]);
      return {
        ...data,
        selectedIds,
        selectedId:
          data.selectedId !== null && selectedIds.includes(data.selectedId)
            ? data.selectedId
            : (selectedIds.at(-1) ?? null),
      };
    }),
  setActiveBridge: (activeBridgeId) => set({ activeBridgeId }),

  removeNode: (id) => get().removeNodes([id]),
  removeNodes: (ids) => {
    let count = 0;
    set((state) => {
      const { data, removedIds } = removeNodesFromData(state, ids);
      count = removedIds.size;
      if (!count) return {};
      const selectedIds = state.selectedIds.filter((id) => data.nodes[id]);
      return {
        ...data,
        selectedIds,
        selectedId:
          data.selectedId !== null && selectedIds.includes(data.selectedId)
            ? data.selectedId
            : (selectedIds.at(-1) ?? null),
      };
    });
    return count;
  },

  select: (id) => set({ selectedId: id, selectedIds: id === null ? [] : [id] }),
  setSelection: (ids) =>
    set((state) => {
      const selectedIds = [...new Set(ids)].filter((id) => Boolean(state.nodes[id]));
      return { selectedIds, selectedId: selectedIds.at(-1) ?? null };
    }),
  toggleSelection: (id) =>
    set((state) => {
      if (!state.nodes[id]) return {};
      const selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedIds, id];
      return { selectedIds, selectedId: selectedIds.at(-1) ?? null };
    }),
  hydrate: (snapshot) => {
    let graph = snapshot ?? emptyGraph();
    const upgrades = Object.values(graph.bridges).filter(bridge => !bridge.routeOptions && bridge.paths.length > 1).map(bridge => ({
      bridge,
      result: {
        status: "found" as const, mode: bridge.mode, generationSource: bridge.generationSource,
        degraded: bridge.degraded, endpoints: bridge.endpointIds,
        entries: bridge.nodeIds.flatMap(id => graph.nodes[id] ? [graph.nodes[id]] : []),
        edges: graph.edges.filter(edge => bridge.edgeIds.includes(edge.id)).map(edge => ({ ...edge, kind: relationshipOf(edge.kind) as Exclude<RelationshipKind, "peer">, reason: edge.reason ?? "", sources: edge.sources ?? [] })),
        paths: bridge.paths,
      },
    }));
    for (const { bridge } of upgrades) graph = deleteBridgeFromData(graph, bridge.id);
    set({
      ...graph,
      selectedIds: graph.selectedId === null ? [] : [graph.selectedId],
      hydrated: true,
    });
    for (const { bridge, result } of upgrades) {
      get().applyBridge(result, bridge.id);
      set(state => ({ bridges: { ...state.bridges, [bridge.id]: { ...state.bridges[bridge.id], name: bridge.name, createdAt: bridge.createdAt } } }));
    }
    if (upgrades.length) set({ activeBridgeId: snapshot?.activeBridgeId ?? null, bridgeOrder: snapshot?.bridgeOrder ?? [] });
  },
  snapshot: () => {
    const state = get();
    return {
      nodes: state.nodes,
      order: state.order,
      edges: state.edges,
      spawnFrom: state.spawnFrom,
      expanded: state.expanded,
      selectedId: state.selectedId,
      lastSource: state.lastSource,
      bridges: state.bridges,
      bridgeOrder: state.bridgeOrder,
      activeBridgeId: state.activeBridgeId,
    };
  },
  reset: () => set({ ...emptyGraph(), selectedIds: [] }),
}));

export function orbSize(node: Pick<GraphNode, "kind" | "generation">): number {
  if (node.kind === "seed") return 132;
  if (node.kind === "connector") return node.generation <= 1 ? 88 : 72;
  if (node.generation <= 1) return 92;
  if (node.generation === 2) return 76;
  return 64;
}
