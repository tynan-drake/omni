import { describe, expect, it } from "vitest";
import {
  createOrbLayout,
  DEFAULT_LABEL_LAYOUT,
  footprintOverlap,
} from "../lib/orb-layout";

describe("orb label layout", () => {
  it("reserves more width for longer artist names", () => {
    const shortName = createOrbLayout(50, "Drake", true, DEFAULT_LABEL_LAYOUT);
    const longName = createOrbLayout(
      50,
      "Kendrick Lamar",
      true,
      DEFAULT_LABEL_LAYOUT
    );

    expect(longName.labelWidth).toBeGreaterThan(shortName.labelWidth);
    expect(longName.labelHeight).toBeGreaterThan(0);
  });

  it("detects collisions between a label and a nearby artist", () => {
    const a = createOrbLayout(50, "Kendrick Lamar", true, DEFAULT_LABEL_LAYOUT);
    const b = createOrbLayout(50, "Baby Keem", true, DEFAULT_LABEL_LAYOUT);

    expect(footprintOverlap(a, 0, 0, b, 105, 0)).not.toBeNull();
    expect(footprintOverlap(a, 0, 0, b, 280, 0)).toBeNull();
  });

  it("detects vertical collisions with labels beneath an orb", () => {
    const a = createOrbLayout(50, "Artist A", true, DEFAULT_LABEL_LAYOUT);
    const b = createOrbLayout(50, "Artist B", true, DEFAULT_LABEL_LAYOUT);

    expect(footprintOverlap(a, 0, 0, b, 0, 120)).not.toBeNull();
    expect(footprintOverlap(a, 0, 0, b, 0, 220)).toBeNull();
  });
});
