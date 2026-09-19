import { afterEach, beforeEach, expect, it, vi } from "vitest";

const id = "1234567890123456789012";
const response = (data: unknown, status = 200, headers?: Record<string, string>) => new Response(JSON.stringify(data), { status, headers });
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SPOTIFY_CLIENT_ID", "test-client");
  vi.stubEnv("SPOTIFY_CLIENT_SECRET", "test-secret");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("retains Spotify ranking and reuses the server token", async () => {
  const fetch = vi.fn().mockImplementation(async (url: string) => url.includes("api/token")
    ? response({ access_token: "test-token", expires_in: 3600 })
    : response({ artists: { items: [{ id, name: "Second alphabetically", images: [] }, { id: "2234567890123456789012", name: "Alphabetically first", images: [] }] } }));
  vi.stubGlobal("fetch", fetch);
  const { searchSpotifyArtists } = await import("../lib/spotify-search");
  const result = await searchSpotifyArtists("test");
  await searchSpotifyArtists("again");
  expect(result.map((artist) => artist.name)).toEqual(["Second alphabetically", "Alphabetically first"]);
  expect(result[0].source).toBe("spotify");
  expect(result[0]).not.toHaveProperty("fans");
  expect(fetch.mock.calls.filter(([url]) => url.includes("api/token"))).toHaveLength(1);
});

function mockMapping(deezerIds: number[]) {
  let calls = 0;
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("api/token")) return response({ access_token: "test-token", expires_in: 3600 });
    if (url.includes("/artists/")) return response({ id, name: "Same Name" });
    if (url.includes("/search?")) return response({ tracks: { items: [
      { artists: [{ id }], external_ids: { isrc: "USAAA1200001" } },
      { artists: [{ id }], external_ids: { isrc: "USAAA1200002" } },
    ] } });
    return response({ isrc: url.split(":").at(-1), artist: { id: deezerIds[calls++], name: "Same Name", picture_medium: "photo", picture_xl: "large" } });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

it("maps recordings to one consistent Deezer artist and caches the match", async () => {
  const fetch = mockMapping([42, 42]);
  const { resolveSpotifyArtist } = await import("../lib/spotify-search");
  expect((await resolveSpotifyArtist(id))?.id).toBe(42);
  const calls = fetch.mock.calls.length;
  expect((await resolveSpotifyArtist(id))?.id).toBe(42);
  expect(fetch).toHaveBeenCalledTimes(calls);
});

it("rejects conflicting identities even when names are identical", async () => {
  mockMapping([42, 99]);
  const { resolveSpotifyArtist } = await import("../lib/spotify-search");
  expect(await resolveSpotifyArtist(id)).toBeNull();
});

it("does not map by name when recording IDs are unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => response(url.includes("api/token") ? { access_token: "token", expires_in: 3600 } : url.includes("/artists/") ? { id, name: "Same Name" } : { tracks: { items: [] } })));
  const { resolveSpotifyArtist } = await import("../lib/spotify-search");
  expect(await resolveSpotifyArtist(id)).toBeNull();
});

it("refreshes an expired token once after a 401", async () => {
  let requests = 0;
  const fetch = vi.fn().mockImplementation(async (url: string) => url.includes("api/token") ? response({ access_token: "token", expires_in: 3600 }) : ++requests === 1 ? response({}, 401) : response({ artists: { items: [] } }));
  vi.stubGlobal("fetch", fetch);
  const { searchSpotifyArtists } = await import("../lib/spotify-search");
  expect(await searchSpotifyArtists("name")).toEqual([]);
  expect(fetch.mock.calls.filter(([url]) => url.includes("api/token"))).toHaveLength(2);
});

it("respects rate-limit cooldowns", async () => {
  const fetch = vi.fn().mockImplementation(async (url: string) => url.includes("api/token") ? response({ access_token: "token", expires_in: 3600 }) : response({}, 429, { "Retry-After": "30" }));
  vi.stubGlobal("fetch", fetch);
  const { searchSpotifyArtists } = await import("../lib/spotify-search");
  await expect(searchSpotifyArtists("name")).rejects.toThrow();
  const calls = fetch.mock.calls.length;
  await expect(searchSpotifyArtists("again")).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(calls);
});
