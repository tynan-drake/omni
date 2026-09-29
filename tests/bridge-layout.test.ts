import { afterEach, expect, it } from "vitest";
import { bridgeLayoutTargets } from "../lib/bridge-layout";
import { getPositions, resetSimulation, setBridgeLayouts, syncGraph } from "../lib/simulation";
import type { ArtistBridge } from "../lib/types";

const bridge: ArtistBridge = {
  id: "test-bridge", name: "Source to destination", mode: "influence",
  generationSource: "curated", degraded: false, createdAt: 1, updatedAt: 1,
  nodeIds: [4, 3, 2, 1], edgeIds: [],
  endpointIds: [4, 1],
  paths: [{ id: "primary", nodeIds: [1, 2, 3, 4], edgeIds: [], shape: "chain" }],
};
const nodes = new Map([1, 2, 3, 4, 5].map(id => [id, {
  x: id * 20, y: id * 50, r: 70, labelWidth: 160, labelOffset: 10, labelHeight: 20,
}]));
afterEach(resetSimulation);

it("lays reversed API paths out from the chosen source to destination with label clearance", () => {
  const targets = bridgeLayoutTargets(bridge, nodes);
  const route = [4, 3, 2, 1].map(id => targets.get(id)!);
  for (let i = 1; i < route.length; i++) {
    expect(route[i].x - route[i - 1].x).toBeGreaterThanOrEqual(192);
    expect(Math.abs(route[i].y - route[0].y)).toBeLessThan(400);
  }
  expect(targets.has(5)).toBe(false);
  expect((route[0].x + route[3].x) / 2).toBe(50);
});

it("gives alternate connectors their own lane around the primary route", () => {
  const targets = bridgeLayoutTargets({ ...bridge, paths: [...bridge.paths,
    { id: "alternate", nodeIds: [4, 5, 1], edgeIds: [], shape: "chain" },
  ] }, nodes);
  expect(targets.get(5)!.y).toBeGreaterThan(targets.get(3)!.y + 200);
  expect(targets.get(5)!.x).toBeGreaterThan(targets.get(4)!.x);
  expect(targets.get(5)!.x).toBeLessThan(targets.get(1)!.x);
});

it("ignores incomplete routes", () => {
  const incomplete = new Map(nodes);
  incomplete.delete(3);
  expect(bridgeLayoutTargets(bridge, incomplete).size).toBe(0);
});

it("settles into route order even when historical edges point the other way", async () => {
  syncGraph([1, 2, 3, 4].map(id => ({ id, r: 70, name: `Artist ${id}`, hasEra: false })),
    [1, 2, 3].map(id => ({ from: id, to: id + 1, peer: false, temporal: true })), new Map());
  setBridgeLayouts([bridge]);
  await new Promise(resolve => setTimeout(resolve, 1600));
  const route = [4, 3, 2, 1].map(id => getPositions().get(id)!);
  for (let i = 1; i < route.length; i++) {
    expect(route[i].x - route[i - 1].x).toBeGreaterThan(170);
    expect(Math.abs(route[i].y - route[0].y)).toBeLessThan(400);
  }
});

it("varies bridge silhouettes while keeping each saved layout stable", () => {
  const first = bridgeLayoutTargets(bridge, nodes);
  expect(bridgeLayoutTargets(bridge, nodes)).toEqual(first);
  expect(bridgeLayoutTargets({ ...bridge, id: "another-bridge" }, nodes)).not.toEqual(first);
  expect(new Set([...first.values()].map(point => point.y)).size).toBeGreaterThan(2);
  const anchored = new Map([...nodes].map(([id, node]) => [id, { ...node, ...first.get(id) }]));
  expect(bridgeLayoutTargets(bridge, anchored)).toEqual(first);
});

it("preserves order and label clearance across varied bridge silhouettes", () => {
  for (let seed = 0; seed < 100; seed++) {
    const targets = bridgeLayoutTargets({ ...bridge, id: `bridge-${seed}` }, nodes);
    const route = [4, 3, 2, 1].map(id => targets.get(id)!);
    for (let index = 1; index < route.length; index++) {
      expect(route[index].x - route[index - 1].x).toBeGreaterThanOrEqual(192);
    }
  }
});
