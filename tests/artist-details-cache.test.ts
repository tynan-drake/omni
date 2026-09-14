import { describe, expect, it } from "vitest";
import { hasFreshGenres } from "../lib/artist-details-cache";
import type { ArtistDetails } from "../lib/types";

const details = (fields: Partial<ArtistDetails>) => fields as ArtistDetails;

describe("artist genre cache", () => {
  it("refreshes legacy missing and empty genre entries", () => {
    expect(hasFreshGenres(details({}))).toBe(false);
    expect(hasFreshGenres(details({ genres: [] }))).toBe(false);
  });
  it("retains successful genre lookups", () => {
    expect(hasFreshGenres(details({ genres: ["soul"] }))).toBe(true);
  });
  it("retries empty lookups after five minutes without retrying every open", () => {
    const cached = details({ genres: [], genresCheckedAt: 1000 });
    expect(hasFreshGenres(cached, 2000)).toBe(true);
    expect(hasFreshGenres(cached, 301000)).toBe(false);
  });
});
