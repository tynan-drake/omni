import { describe, expect, it } from "vitest";
import { discoveryCells } from "../lib/discovery-field";

describe("discovery field", () => {
  const viewport = { width: 1280, height: 800 };
  it("keeps artist positions stable across viewport changes", () => {
    const before = discoveryCells({ x: 0, y: 0 }, viewport, 120);
    const after = discoveryCells({ x: 250, y: 170 }, viewport, 120);
    for (const cell of before) {
      const same = after.find((item) => item.key === cell.key);
      if (same) expect(same).toEqual(cell);
    }
  });
  it("stays populated and bounded far from the origin in every direction", () => {
    for (const x of [-1000000, 0, 1000000]) {
      for (const y of [-1000000, 0, 1000000]) {
        const cells = discoveryCells({ x, y }, viewport, 120);
        expect(cells.length).toBeGreaterThan(20);
        expect(cells.length).toBeLessThan(100);
        expect(cells.every((cell) => cell.index >= 0 && cell.index < 120)).toBe(true);
        expect(cells.some((cell) => Math.abs(cell.x + x) < 150 && Math.abs(cell.y + y) < 150)).toBe(true);
      }
    }
  });
  it("does not repeat artists within an ordinary viewport", () => {
    const visible = discoveryCells({ x: 0, y: 0 }, viewport, 120)
      .filter((cell) => Math.abs(cell.x) < viewport.width / 2 && Math.abs(cell.y) < viewport.height / 2);
    expect(new Set(visible.map((cell) => cell.index)).size).toBe(visible.length);
  });
  it("handles an empty catalogue or unsized viewport", () => {
    expect(discoveryCells({ x: 0, y: 0 }, viewport, 0)).toEqual([]);
    expect(discoveryCells({ x: 0, y: 0 }, { width: 0, height: 0 }, 120)).toEqual([]);
  });
});
