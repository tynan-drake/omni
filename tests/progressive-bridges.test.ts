import { beforeEach, expect, it } from "vitest";
import { useGraph } from "../store/graph";
import type { BridgeResult } from "../lib/types";

const result: BridgeResult = {
  status: "found", mode: "adjacent", generationSource: "similarity", degraded: true, endpoints: [1, 4],
  entries: [1, 2, 3, 4].map(id => ({ id, name: `Artist ${id}`, picture: "", pictureBig: "", accent: "#aaa", era: null, decade: null })),
  edges: [[1, 2], [2, 3], [3, 4], [1, 4], [2, 4]].map(([from, to]) => ({ id: `${from}-${to}`, from, to, kind: "similarity", reason: "Related", sources: [] })),
  paths: [
    { id: "long", shape: "chain", nodeIds: [1, 2, 3, 4], edgeIds: ["1-2", "2-3", "3-4"] },
    { id: "short", shape: "chain", nodeIds: [1, 4], edgeIds: ["1-4"] },
    { id: "middle", shape: "chain", nodeIds: [1, 2, 4], edgeIds: ["1-2", "2-4"] },
  ],
};
beforeEach(() => useGraph.getState().reset());
it("adds only the shortest route, then one alternative at a time without duplicating shared nodes or bridges", () => {
  const id = useGraph.getState().applyBridge(result)!;
  expect(useGraph.getState().bridges[id].paths.map(p => p.id)).toEqual(["short"]);
  expect(useGraph.getState().order).toEqual([1, 4]);
  expect(useGraph.getState().edges.map(e => e.id)).toEqual(["1-4"]);
  useGraph.getState().revealBridgePath(id);
  expect(useGraph.getState().bridges[id].paths.map(p => p.id)).toEqual(["short", "middle"]);
  expect(useGraph.getState().nodes[3]).toBeUndefined();
  useGraph.getState().revealBridgePath(id);
  useGraph.getState().revealBridgePath(id);
  expect(useGraph.getState().bridges[id].paths).toHaveLength(3);
  expect(useGraph.getState().bridgeOrder).toEqual([id]);
  expect(useGraph.getState().order).toHaveLength(4);
  expect(useGraph.getState().edges).toHaveLength(5);
});
it("persists revealed routes and remaining options across hydration", () => {
  const id = useGraph.getState().applyBridge(result)!;
  useGraph.getState().revealBridgePath(id);
  const snapshot = useGraph.getState().snapshot();
  useGraph.getState().reset();
  useGraph.getState().hydrate(snapshot);
  expect(useGraph.getState().bridges[id].paths).toHaveLength(2);
  useGraph.getState().revealBridgePath(id);
  expect(useGraph.getState().bridges[id].paths).toHaveLength(3);
});
it("upgrades existing multi-path bridges while preserving separately explored artists", () => {
  useGraph.getState().addSeed(result.entries[2]);
  const id = useGraph.getState().applyBridge(result, undefined, 3)!;
  const snapshot = useGraph.getState().snapshot();
  snapshot.bridges = { ...snapshot.bridges, [id]: { ...snapshot.bridges[id], routeOptions: undefined } };
  useGraph.getState().hydrate(snapshot);
  expect(useGraph.getState().bridges[id].paths.map(p => p.id)).toEqual(["short"]);
  expect(useGraph.getState().nodes[3]).toBeDefined();
  expect(useGraph.getState().nodes[2]).toBeUndefined();
  useGraph.getState().revealBridgePath(id);
  expect(useGraph.getState().bridges[id].paths).toHaveLength(2);
});
