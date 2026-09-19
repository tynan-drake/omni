import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const providers = vi.hoisted(() => ({ configured: vi.fn(), spotify: vi.fn(), deezer: vi.fn() }));
vi.mock("../lib/spotify-search", () => ({ spotifySearchConfigured: providers.configured, searchSpotifyArtists: providers.spotify }));
vi.mock("../lib/deezer", () => ({ searchArtists: providers.deezer }));
import { GET } from "../app/api/search/route";
beforeEach(() => {
  vi.clearAllMocks();
  providers.configured.mockReturnValue(true);
  providers.spotify.mockResolvedValue([{ id: "spotify-id", source: "spotify", name: "Artist" }]);
  providers.deezer.mockResolvedValue([{ id: 42, name: "Artist" }]);
});
it("serves Spotify results without invoking Deezer search", async () => {
  const data = await (await GET(new NextRequest("http://localhost/api/search?q=artist"))).json();
  expect(data.source).toBe("spotify");
  expect(providers.deezer).not.toHaveBeenCalled();
});
it("falls back when Spotify is unavailable", async () => {
  providers.spotify.mockRejectedValue(new Error("rate limited"));
  const data = await (await GET(new NextRequest("http://localhost/api/search?q=artist"))).json();
  expect(data.source).toBe("deezer");
  expect(data.artists[0].id).toBe(42);
});
it("works without Spotify credentials", async () => {
  providers.configured.mockReturnValue(false);
  const data = await (await GET(new NextRequest("http://localhost/api/search?q=artist"))).json();
  expect(data.source).toBe("deezer");
  expect(providers.spotify).not.toHaveBeenCalled();
});
it("allows direct Deezer lookup after an uncertain match", async () => {
  const data = await (await GET(new NextRequest("http://localhost/api/search?q=artist&source=deezer"))).json();
  expect(data.source).toBe("deezer");
  expect(providers.spotify).not.toHaveBeenCalled();
});
