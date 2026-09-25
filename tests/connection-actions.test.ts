import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { connectArtists } from "../store/actions";
import { useUi } from "../store/ui";
import { useGraph } from "../store/graph";

vi.mock("@/lib/simulation", () => ({ stageSearchPosition: vi.fn() }));
vi.mock("@/lib/canvas-controller", () => ({ canvas: { fitNodes: vi.fn() } }));
vi.mock("@/store/history", () => ({ useHistory: { getState: () => ({ visit: vi.fn() }) } }));
const a = { id: 1, name: "Source", picture: "", pictureBig: "", accent: "#aaa" };
const b = { id: 2, name: "Target", picture: "", pictureBig: "" };
const found = { status: "found", mode: "influence", generationSource: "curated", degraded: false, endpoints: [1, 2], entries: [a, { ...b, accent: "#aaa" }], edges: [{ id: "edge", from: 1, to: 2, kind: "influence", reason: "Influenced", sources: [] }], paths: [{ id: "path", shape: "chain", nodeIds: [1, 2], edgeIds: ["edge"] }] };
beforeEach(() => { useGraph.getState().reset(); useGraph.getState().addSeed(a); useUi.setState(useUi.getInitialState()); vi.useFakeTimers(); vi.stubGlobal("requestAnimationFrame", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers(); });

it("starts on the canvas without opening a navigation panel", () => {
  useUi.getState().startConnecting(1);
  expect(useUi.getState().connectingFrom).toBe(1);
  expect(useUi.getState().navPanel).toBeNull();
});
it("keeps no-path targets out of the graph and exposes recovery state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "no_path", mode: "influence", message: "No path" }) }));
  await connectArtists(1, b);
  expect(useGraph.getState().order).toEqual([1]);
  expect(useUi.getState().bridgeRequest?.status).toBe("no_path");
});
it("ignores a successful response after cancellation", async () => {
  let resolve!: (response: unknown) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(r => { resolve = r; })));
  const pending = connectArtists(1, b);
  expect(useUi.getState().bridgeRequest?.status).toBe("loading");
  useUi.getState().cancelConnecting();
  resolve({ ok: true, json: async () => found });
  await pending;
  expect(useGraph.getState().order).toEqual([1]);
  expect(useGraph.getState().bridgeOrder).toHaveLength(0);
  expect(useUi.getState().bridgeRequest).toBeNull();
});
it("adds a successful connection and returns to the canvas without a flyout", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => found }));
  await connectArtists(1, b, "influence", { x: 100, y: 100 });
  expect(useGraph.getState().nodes[2]).toBeTruthy();
  expect(useGraph.getState().bridgeOrder).toHaveLength(1);
  expect(useUi.getState().connectingFrom).toBeNull();
  expect(useUi.getState().navPanel).toBeNull();
});
it("a superseded request cannot replace the newer request's result", async () => {
  let resolve!: (response: unknown) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce({ ok: true, json: async () => ({ status: "no_path", mode: "influence", message: "Newer result" }) }));
  const old = connectArtists(1, b);
  await connectArtists(1, { ...b, id: 3 });
  resolve({ ok: true, json: async () => found });
  await old;
  expect(useUi.getState().bridgeRequest?.target.id).toBe(3);
  expect(useGraph.getState().bridgeOrder).toHaveLength(0);
});

it("keeps the chosen pulse direction when the API returns canonical endpoint order", async () => {
  useGraph.getState().addSeed({ ...b, accent: "#aaa" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => found }));
  await connectArtists(2, a);
  const graph = useGraph.getState();
  const bridge = graph.bridges[graph.bridgeOrder[0]];
  expect(bridge.endpointIds).toEqual([2, 1]);
  expect(bridge.routeOptions?.endpoints).toEqual([2, 1]);
  expect(graph.edges[0]).toMatchObject({ from: 1, to: 2 });

  await connectArtists(1, b);
  const reopened = useGraph.getState().bridges[bridge.id];
  expect(reopened.endpointIds).toEqual([1, 2]);
  expect(reopened.routeOptions?.endpoints).toEqual([1, 2]);
  expect(useGraph.getState().bridgeOrder).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(1);
});
