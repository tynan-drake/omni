import { afterEach, expect, it, vi } from "vitest";
import { searchArtists } from "../lib/deezer";
afterEach(() => vi.unstubAllGlobals());
it("puts exact and partial name matches ahead of popular unrelated artists, retaining artists without photos", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
    { id: 1, name: "Popular unrelated artist", nb_fan: 100000, picture_medium: "photo" },
    { id: 2, name: "Björk", nb_fan: 1, picture_medium: "" },
    { id: 3, name: "Björk Tribute", nb_fan: 100, picture_medium: "photo" },
    { id: 2, name: "Björk", nb_fan: 1, picture_medium: "" },
  ] }) }));
  const artists = await searchArtists("bjork");
  expect(artists.map((a) => a.id)).toEqual([2, 3, 1]);
});
