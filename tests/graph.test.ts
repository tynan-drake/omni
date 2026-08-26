import { beforeEach, describe, expect, it } from "vitest";
import type { ArtistRef, Direction, LineageResult } from "../lib/types";
import { useGraph } from "../store/graph";

const artist = (id: number, name = `Artist ${id}`): ArtistRef => ({
  id,
  name,
  picture: `https://images.test/${id}.jpg`,
  pictureBig: `https://images.test/${id}-big.jpg`,
});

const lineage = (
  parentId: number,
  ids: number[],
  direction: Direction = "forward"
): LineageResult => ({
  source: "curated",
  direction,
  seedId: parentId,
  entries: ids.map((id) => ({
    ...artist(id),
    accent: "#8b7cf6",
    reason: `Relationship from ${parentId}`,
    era: null,
    decade: null,
    linkedTo: [],
  })),
});

describe("owned lineage deletion", () => {
  beforeEach(() => useGraph.getState().reset());

  it("recursively removes an exclusive lineage subtree", () => {
    useGraph.getState().addSeed({ ...artist(1), accent: "#111111" });
    useGraph.getState().applyLineage(1, lineage(1, [2, 3]));
    useGraph.getState().applyLineage(2, lineage(2, [4], "back"));

    expect(useGraph.getState().removeNodes([1])).toBe(4);
    expect(useGraph.getState().order).toEqual([]);
    expect(useGraph.getState().edges).toEqual([]);
    expect(useGraph.getState().spawnFrom).toEqual({});
    expect(useGraph.getState().expanded).toEqual({});
  });

  it("removes an intermediate subtree while preserving its siblings", () => {
    useGraph.getState().addSeed({ ...artist(10), accent: "#111111" });
    useGraph.getState().applyLineage(10, lineage(10, [11, 12]));
    useGraph.getState().applyLineage(11, lineage(11, [13]));
    useGraph.getState().setSelection([11, 12]);

    expect(useGraph.getState().removeNodes([11])).toBe(2);
    expect(useGraph.getState().order).toEqual([10, 12]);
    expect(useGraph.getState().edges.map((edge) => [edge.from, edge.to])).toEqual([
      [10, 12],
    ]);
    expect(useGraph.getState().selectedIds).toEqual([12]);
    expect(useGraph.getState().selectedId).toBe(12);
    expect(useGraph.getState().expanded[10]).toBeUndefined();
  });

  it("preserves a descendant that was independently seeded", () => {
    useGraph.getState().addSeed({ ...artist(20), accent: "#111111" });
    useGraph.getState().applyLineage(20, lineage(20, [21]));
    useGraph.getState().addSeed({ ...artist(21), accent: "#222222" });

    expect(useGraph.getState().removeNodes([20])).toBe(1);
    expect(useGraph.getState().nodes[21]).toBeTruthy();
    expect(useGraph.getState().nodes[21].origins).toEqual(["seed"]);
    expect(useGraph.getState().spawnFrom[21]).toBeUndefined();
  });

  it("reparents a shared descendant to its surviving lineage owner", () => {
    useGraph.getState().addSeed({ ...artist(30), accent: "#111111" });
    useGraph.getState().addSeed({ ...artist(31), accent: "#222222" });
    useGraph.getState().applyLineage(30, lineage(30, [32]));
    useGraph.getState().applyLineage(31, lineage(31, [32], "back"));

    expect(useGraph.getState().removeNodes([30])).toBe(1);
    expect(useGraph.getState().nodes[32].origins).toEqual(["lineage:31:back"]);
    expect(useGraph.getState().spawnFrom[32]).toBe(31);
  });

  it("unions cascades for a bulk deletion", () => {
    useGraph.getState().addSeed({ ...artist(40), accent: "#111111" });
    useGraph.getState().addSeed({ ...artist(50), accent: "#222222" });
    useGraph.getState().applyLineage(40, lineage(40, [41]));
    useGraph.getState().applyLineage(50, lineage(50, [51]));

    expect(useGraph.getState().removeNodes([40, 50])).toBe(4);
    expect(useGraph.getState().order).toEqual([]);
  });
});
