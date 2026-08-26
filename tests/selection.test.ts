import { describe, expect, it } from "vitest";
import { mergeSelection, rectsIntersect, selectionRect } from "../lib/selection";

describe("marquee selection geometry", () => {
  it("normalizes a rectangle dragged in any direction", () => {
    expect(selectionRect({ x: 80, y: 50 }, { x: 20, y: 10 })).toEqual({
      left: 20,
      top: 10,
      right: 80,
      bottom: 50,
      width: 60,
      height: 40,
    });
  });

  it("includes overlapping and edge-touching orb bounds", () => {
    const marquee = selectionRect({ x: 10, y: 10 }, { x: 50, y: 50 });
    expect(rectsIntersect(marquee, selectionRect({ x: 40, y: 40 }, { x: 60, y: 60 }))).toBe(
      true
    );
    expect(rectsIntersect(marquee, selectionRect({ x: 50, y: 20 }, { x: 70, y: 40 }))).toBe(
      true
    );
    expect(rectsIntersect(marquee, selectionRect({ x: 51, y: 20 }, { x: 70, y: 40 }))).toBe(
      false
    );
  });

  it("replaces or additively merges selection without duplicates", () => {
    expect(mergeSelection([1, 2], [2, 3], false)).toEqual([2, 3]);
    expect(mergeSelection([1, 2], [2, 3], true)).toEqual([1, 2, 3]);
  });
});
