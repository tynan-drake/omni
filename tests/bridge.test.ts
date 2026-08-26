import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtistRef, BridgeResult } from "../lib/types";

const relatedMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/deezer", () => ({ getRelatedArtists: relatedMock }));

import { similarityBridgePaths } from "../lib/bridge/similarity";
import { useGraph } from "../store/graph";

const artist = (id: number, name: string): ArtistRef => ({
  id,
  name,
  picture: `https://images.test/${id}.jpg`,
  pictureBig: `https://images.test/${id}-big.jpg`,
});

const bridgeResult = (
  a: ArtistRef,
  b: ArtistRef,
  connector: ArtistRef,
  shape: "chain" | "shared-root" = "chain"
): BridgeResult => ({
  status: "found",
  mode: "influence",
  generationSource: "curated",
  degraded: false,
  endpoints: [a.id, b.id],
  entries: [a, b, connector].map((entry, index) => ({
    ...entry,
    accent: "#8b7cf6",
    era: `${1970 + index * 10}s`,
    decade: 1970 + index * 10,
  })),
  edges: [
    {
      id: `${connector.id}-${a.id}-influence`,
      from: connector.id,
      to: a.id,
      kind: "influence",
      reason: `${connector.name} influenced ${a.name}.`,
      sources: [],
    },
    {
      id: `${connector.id}-${b.id}-influence`,
      from: connector.id,
      to: b.id,
      kind: "influence",
      reason: `${connector.name} influenced ${b.name}.`,
      sources: [],
    },
  ],
  paths: [
    {
      id: "path-1",
      shape,
      nodeIds: [a.id, connector.id, b.id],
      edgeIds: [
        `${connector.id}-${a.id}-influence`,
        `${connector.id}-${b.id}-influence`,
      ],
      ...(shape === "shared-root" && { commonRootId: connector.id }),
    },
  ],
});

describe("artist bridge graph state", () => {
  beforeEach(() => {
    useGraph.getState().reset();
  });

  it("adds a shared-root bridge and removes its exclusive connector", () => {
    const a = artist(1, "Artist A");
    const b = artist(2, "Artist B");
    const root = artist(3, "Common Root");
    useGraph.getState().addSeed({ ...a, accent: "#111111" });
    useGraph.getState().addSeed({ ...b, accent: "#222222" });

    const id = useGraph.getState().applyBridge(bridgeResult(a, b, root, "shared-root"));
    expect(id).toBeTruthy();
    expect(useGraph.getState().nodes[root.id].kind).toBe("connector");
    expect(useGraph.getState().bridges[id!].paths[0].commonRootId).toBe(root.id);

    useGraph.getState().deleteBridge(id!);
    expect(useGraph.getState().nodes[root.id]).toBeUndefined();
    expect(useGraph.getState().nodes[a.id]).toBeTruthy();
    expect(useGraph.getState().edges).toHaveLength(0);
  });

  it("keeps connector artists that belong to another bridge", () => {
    const a = artist(10, "Artist A");
    const b = artist(11, "Artist B");
    const c = artist(12, "Artist C");
    const connector = artist(13, "Connector");
    for (const endpoint of [a, b, c]) {
      useGraph.getState().addSeed({ ...endpoint, accent: "#8b7cf6" });
    }
    const first = useGraph.getState().applyBridge(bridgeResult(a, b, connector));
    const second = useGraph.getState().applyBridge(bridgeResult(a, c, connector));

    useGraph.getState().deleteBridge(first!);
    expect(useGraph.getState().nodes[connector.id]).toBeTruthy();
    expect(useGraph.getState().bridges[second!]).toBeTruthy();
    expect(useGraph.getState().nodes[connector.id].origins).toContain(`bridge:${second}`);
  });

  it("preserves a connector after the user expands it", () => {
    const a = artist(20, "Artist A");
    const b = artist(21, "Artist B");
    const connector = artist(22, "Connector");
    useGraph.getState().addSeed({ ...a, accent: "#8b7cf6" });
    useGraph.getState().addSeed({ ...b, accent: "#8b7cf6" });
    const id = useGraph.getState().applyBridge(bridgeResult(a, b, connector));
    useGraph.getState().applyLineage(connector.id, {
      source: "curated",
      direction: "forward",
      seedId: connector.id,
      entries: [],
    });

    useGraph.getState().deleteBridge(id!);
    expect(useGraph.getState().nodes[connector.id]).toBeTruthy();
    expect(useGraph.getState().nodes[connector.id].origins).toContain("explored");
  });

  it("round-trips bridge names and the active spotlight through a snapshot", () => {
    const a = artist(24, "Artist A");
    const b = artist(25, "Artist B");
    const connector = artist(26, "Connector");
    useGraph.getState().addSeed({ ...a, accent: "#8b7cf6" });
    useGraph.getState().addSeed({ ...b, accent: "#8b7cf6" });
    const id = useGraph.getState().applyBridge(bridgeResult(a, b, connector));
    useGraph.getState().renameBridge(id!, "My bridge");
    const snapshot = useGraph.getState().snapshot();

    useGraph.getState().reset();
    useGraph.getState().hydrate(snapshot);
    expect(useGraph.getState().bridges[id!].name).toBe("My bridge");
    expect(useGraph.getState().activeBridgeId).toBe(id);
  });

  it("invalidates a bridge and removes its exclusive connector when an endpoint is removed", () => {
    const a = artist(27, "Artist A");
    const b = artist(28, "Artist B");
    const connector = artist(29, "Connector");
    useGraph.getState().addSeed({ ...a, accent: "#111111" });
    useGraph.getState().addSeed({ ...b, accent: "#222222" });
    const id = useGraph.getState().applyBridge(bridgeResult(a, b, connector));

    expect(useGraph.getState().removeNodes([a.id])).toBe(2);
    expect(useGraph.getState().bridges[id!]).toBeUndefined();
    expect(useGraph.getState().nodes[a.id]).toBeUndefined();
    expect(useGraph.getState().nodes[connector.id]).toBeUndefined();
    expect(useGraph.getState().nodes[b.id]).toBeTruthy();
  });
});

describe("similarity bridge search", () => {
  it("finds a bounded bridge through a common related artist", async () => {
    const a = artist(31, "Artist A");
    const b = artist(32, "Artist B");
    const common = artist(33, "Common Artist");
    relatedMock.mockImplementation(async (id: number) => {
      if (id === a.id || id === b.id) return [common];
      return [];
    });

    const paths = await similarityBridgePaths(a, b);
    expect(paths[0].nodeIds).toEqual([a.id, common.id, b.id]);
    expect(paths[0].artists.get(common.id)?.name).toBe(common.name);
  });
});
