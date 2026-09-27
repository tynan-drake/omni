import { expect, it } from "vitest";
import { canvasLegendMembers } from "../lib/canvas-legend";
import type { GraphEdge, GraphNode } from "../lib/types";

it("includes shared artists and every bridge regardless of the artist's original kind", () => {
  const nodes = Object.fromEntries([
    { id: 1, kind: "seed", origins: ["bridge:a"] },
    { id: 2, kind: "root", origins: [] },
    { id: 3, kind: "seed", origins: [] },
    { id: 4, kind: "connector", origins: ["bridge:b"] },
    { id: 5, kind: "seed", origins: [] },
  ].map((node) => [node.id, node as GraphNode]));
  const edges = [
    { from: 2, to: 1, kind: "back", origins: [] },
    { from: 1, to: 3, kind: "forward", origins: ["bridge:a"] },
    { from: 4, to: 3, kind: "similarity", origins: ["bridge:b"] },
  ] as GraphEdge[];
  const members = canvasLegendMembers(nodes, edges);
  expect([...members.root].sort()).toEqual([1, 2]);
  expect([...members.branch].sort()).toEqual([1, 3]);
  expect([...members.bridge].sort()).toEqual([1, 3, 4]);
  expect(members.bridge.has(5)).toBe(false);
});

it("ignores missing endpoints after graph edits", () => {
  expect(canvasLegendMembers({}, [{ from: 1, to: 2, kind: "forward", origins: [] } as unknown as GraphEdge]).branch.size).toBe(0);
});
