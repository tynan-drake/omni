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

const mockArtists = (data: Record<string, unknown>[]) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }));

it("disambiguates identical names by audience size", async () => {
  mockArtists([{ id: 1, name: "Drake", nb_fan: 158 }, { id: 2, name: "Drake", nb_fan: 24083900 }, { id: 3, name: "Drake", nb_fan: 96 }]);
  const result = await searchArtists("Drake");
  expect(result.map((a) => a.id)).toEqual([2, 1, 3]);
  expect(result[0].fans).toBe(24083900);
});

it("surfaces established matches for broad names without promoting unrelated stars", async () => {
  mockArtists([{ id: 1, name: "John", nb_fan: 2 }, { id: 2, name: "John Legend", nb_fan: 3554970 }, { id: 3, name: "Bon Jovi", nb_fan: 5273894 }, { id: 4, name: "Elton John", nb_fan: 2996668 }]);
  expect((await searchArtists("john")).map((a) => a.id)).toEqual([2, 4, 1, 3]);
});

it("matches punctuation and accents and keeps tribute acts below the original", async () => {
  mockArtists([{ id: 1, name: "AC/DC Tribute", nb_fan: 100000 }, { id: 2, name: "AC/DC", nb_fan: 1000 }]);
  expect((await searchArtists("ac dc"))[0].id).toBe(2);
});

it("returns ranked fan counts without requesting track metadata", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 2, name: "Drake", nb_fan: 24083900 }] }) });
  vi.stubGlobal("fetch", fetch);
  const results = await searchArtists("drake");
  expect(results[0].fans).toBe(24083900);
  expect(results[0]).not.toHaveProperty("knownFor");
  expect(fetch).toHaveBeenCalledTimes(1);
});
