// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BridgeSignals from "../components/BridgeSignals";
import { useGraph } from "../store/graph";
import type { ArtistBridge } from "../lib/types";

const sim = vi.hoisted(() => ({ positions: new Map([[1, { x: 0, y: 0 }], [2, { x: 100, y: 100 }], [3, { x: 200, y: 0 }]]), tick: () => {} }));
vi.mock("@/lib/simulation", () => ({ getPositions: () => sim.positions, onSimTick: (cb: (p: typeof sim.positions) => void) => { sim.tick = () => cb(sim.positions); return () => {}; } }));
beforeEach(() => { sim.positions.clear(); sim.positions.set(1, { x: 0, y: 0 }); sim.positions.set(2, { x: 100, y: 100 }); sim.positions.set(3, { x: 200, y: 0 }); });
afterEach(cleanup);
const bridge = { id: "bridge", endpointIds: [1, 3], paths: [{ id: "path", shape: "shared-root", nodeIds: [1, 2, 3], edgeIds: ["backward", "forward"] }] } as ArtistBridge;

it("follows the entire ordered route, updates with physics, and stays mounted outside spotlight", () => {
  useGraph.setState({ bridges: { bridge }, activeBridgeId: "bridge" });
  const { container } = render(<svg><BridgeSignals /></svg>);
  const line = container.querySelector("polyline")!;
  expect(line.getAttribute("points")).toBe("0,0 100,100 200,0");
  act(() => useGraph.setState({ activeBridgeId: null }));
  expect(container.querySelector("polyline")).toBe(line);
  sim.positions.set(2, { x: 120, y: 80 });
  act(() => sim.tick());
  expect(line.getAttribute("points")).toBe("0,0 120,80 200,0");
});
it("orients reversed paths from the source and hides incomplete routes", () => {
  useGraph.setState({ bridges: { bridge: { ...bridge, paths: [{ ...bridge.paths[0], nodeIds: [3, 2, 1] }] } } });
  const { container } = render(<svg><BridgeSignals /></svg>);
  expect(container.querySelector("polyline")!.getAttribute("points")).toBe("0,0 100,100 200,0");
  sim.positions.delete(2);
  act(() => sim.tick());
  expect((container.querySelector(".bridge-signal") as SVGElement).style.visibility).toBe("hidden");
});
