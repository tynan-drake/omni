// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { exportToSpotify } from "../lib/export/spotify";
import type { PlaylistTrack } from "../lib/types";

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it("creates a private playlist and adds matched tracks using current Spotify endpoints", async () => {
  sessionStorage.setItem("omni-spotify-token", JSON.stringify({ accessToken: "test-token", expiresAt: Date.now() + 3600000 }));
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/search?")) return new Response(JSON.stringify({ tracks: { items: [{ uri: "spotify:track:matched" }] } }));
    if (url.endsWith("/me/playlists")) {
      expect(JSON.parse(init!.body as string)).toEqual({ name: "Test playlist", description: "Test description", public: false });
      return new Response(JSON.stringify({ id: "new-playlist", external_urls: { spotify: "https://open.spotify.com/playlist/new-playlist" } }));
    }
    if (url.endsWith("/playlists/new-playlist/items")) {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init!.body as string)).toEqual({ uris: ["spotify:track:matched"] });
      return new Response(JSON.stringify({ snapshot_id: "snapshot" }));
    }
    throw new Error(`Unexpected Spotify request: ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  const track = { title: "Test track", artistName: "Test artist" } as PlaylistTrack;
  const result = await exportToSpotify("Test playlist", "Test description", [track], vi.fn());
  expect(result).toEqual({ url: "https://open.spotify.com/playlist/new-playlist", matched: 1, total: 1 });
  expect(fetch).toHaveBeenCalledTimes(3);
});
