import { afterEach, expect, it, vi } from "vitest";
import { connectionSpaceOffsets, type SpaceNode } from "../lib/connection-space";
import { footprintOverlap } from "../lib/orb-layout";
import { getPositions, onSimTick, reserveConnectionSpace, resetSimulation, restorePositions, serializePositions, syncGraph } from "../lib/simulation";

const node = (x: number, y: number): SpaceNode => ({ x, y, r: 40, labelWidth: 80, labelHeight: 15, labelOffset: 10 });

it("creates space for the placeholder and neighboring labels without moving the source or distant artists", () => {
  const nodes = new Map([[1, node(0, 0)], [2, node(200, 0)], [3, node(290, 70)], [4, node(1000, 1000)]]);
  const original = JSON.stringify([...nodes]);
  const offsets = connectionSpaceOffsets(nodes, { sourceId: 1, x: 200, y: 0, radius: 56 });
  expect(offsets.has(1)).toBe(false);
  expect(offsets.has(4)).toBe(false);
  expect(JSON.stringify([...nodes])).toBe(original);
  const moved = [...nodes].map(([id, n]) => ({ ...n, x: n.x + (offsets.get(id)?.x ?? 0), y: n.y + (offsets.get(id)?.y ?? 0) }));
  for (const n of moved.slice(1)) expect(Math.hypot(n.x - 200, n.y)).toBeGreaterThanOrEqual(56 + 40 + 18);
  for (let i = 0; i < moved.length; i++) for (let j = i + 1; j < moved.length; j++) {
    const a = moved[i], b = moved[j];
    const overlap = footprintOverlap(a, a.x, a.y, b, b.x, b.y);
    expect(overlap ? Math.min(overlap.x, overlap.y) : 0).toBeLessThan(.02);
  }
});

it("leaves a clear canvas alone and tolerates a removed source", () => {
  const nodes = new Map([[1, node(0, 0)], [2, node(-200, 0)]]);
  expect(connectionSpaceOffsets(nodes, { sourceId: 1, x: 200, y: 0, radius: 56 }).size).toBe(0);
  expect(connectionSpaceOffsets(nodes, { sourceId: 3, x: 200, y: 0, radius: 56 }).size).toBe(0);
});

afterEach(() => { resetSimulation(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("eases apart and returns exactly, without persisting temporary offsets", async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0, now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
  const advance = (ms: number) => { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(now)); };
  restorePositions({ 1: { x: 0, y: 0 }, 2: { x: 200, y: 0 } });
  await new Promise<void>(resolve => {
    const off = onSimTick(() => { off(); resolve(); });
    syncGraph([1, 2].map(id => ({ id, r: 40, name: "Artist", hasEra: false })), [], new Map());
  });
  const saved = serializePositions();
  const release = reserveConnectionSpace(1, { x: 200, y: 0, size: 112 });
  advance(16);
  const first = { ...getPositions().get(2)! };
  expect(first.x).not.toBe(saved[2].x);
  advance(1000);
  expect(Math.hypot(first.x - saved[2].x, first.y - saved[2].y)).toBeLessThan(Math.hypot(getPositions().get(2)!.x - saved[2].x, getPositions().get(2)!.y - saved[2].y));
  expect(serializePositions()).toEqual(saved);
  release();
  advance(16);
  expect(getPositions().get(2)!.x).not.toBe(saved[2].x);
  advance(2000);
  expect(getPositions().get(2)).toMatchObject(saved[2]);
  expect(frames.size).toBe(0);
  const staleRelease = reserveConnectionSpace(1, { x: 200, y: 0, size: 112 }, true);
  const currentRelease = reserveConnectionSpace(1, { x: 200, y: 0, size: 112 }, true);
  staleRelease();
  expect(getPositions().get(2)!.x).not.toBe(saved[2].x);
  currentRelease();
  expect(getPositions().get(2)).toMatchObject(saved[2]);
});
