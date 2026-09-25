import { expect, it } from "vitest";
import { connectionCamera } from "../lib/connection-camera";

it.each([.15, .37, 1, 2.5])("frames a desktop pair and search from scale %s", scale => {
  const source = { x: -900, y: 700, radius: 60 };
  const destination = { x: -650, y: 700, radius: 56 };
  const t = connectionCamera(source, destination, { width: 1280, height: 800 }, scale);
  expect(source.x * t.k + t.x - source.radius * t.k).toBeGreaterThanOrEqual(20);
  expect(destination.x * t.k + t.x + 135).toBeLessThanOrEqual(1260);
  expect(destination.y * t.k + t.y + destination.radius * t.k + 250).toBeLessThanOrEqual(690);
});
it("fits stacked mobile orbs with a readable search width", () => {
  const t = connectionCamera({ x: 0, y: 0, radius: 60 }, { x: 0, y: 210, radius: 45 }, { width: 390, height: 844 }, 1);
  expect(t.x - 135).toBeGreaterThanOrEqual(20);
  expect(t.x + 135).toBeLessThanOrEqual(370);
  expect(t.y - 60 * t.k).toBeGreaterThanOrEqual(84);
  expect(t.y + 255 * t.k + 250).toBeLessThanOrEqual(734);
});
