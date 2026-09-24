import { describe, expect, it } from "vitest";
import catalogue from "../lib/discovery-artists.json";
import { featuredDiscoveryCatalogue, INTRO_ARTISTS } from "../lib/discovery-featured";

describe("featured discovery artist", () => {
  it("can feature every curated artist while preserving the complete catalogue", () => {
    expect(INTRO_ARTISTS).toHaveLength(100);
    expect(new Set(INTRO_ARTISTS).size).toBe(100);
    const original = catalogue.map((artist) => artist.id);
    const featured = new Set<string>();
    for (let index = 0; index < INTRO_ARTISTS.length; index++) {
      const result = featuredDiscoveryCatalogue(catalogue, () => (index + 0.5) / INTRO_ARTISTS.length);
      featured.add(result[0].name);
      expect(result.map((artist) => artist.id).sort((a, b) => a - b)).toEqual([...original].sort((a, b) => a - b));
    }
    expect(featured).toEqual(new Set(INTRO_ARTISTS));
    expect(catalogue.map((artist) => artist.id)).toEqual(original);
  });

  it("preserves a catalogue with no eligible featured artists", () => {
    expect(featuredDiscoveryCatalogue([])).toEqual([]);
    const artists = [{ id: 1, name: "Unlisted artist", picture: "", pictureBig: "" }];
    expect(featuredDiscoveryCatalogue(artists)).toEqual(artists);
  });
});
