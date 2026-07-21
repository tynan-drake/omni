import { NextRequest, NextResponse } from "next/server";
import { getAlbums, getAlbumTracks, getArtist, getTopTracks } from "@/lib/deezer";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { PlaylistMode, PlaylistTrack } from "@/lib/types";

interface TrackPool {
  artistId: number;
  artistName: string;
  tracks: PlaylistTrack[];
}

const normTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/(feat|ft)\..*/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

/**
 * Build a pool of up to ~15 tracks for one artist in a given mode.
 * popular = top tracks; deep = album tracks that aren't top tracks; mixed = both.
 */
async function buildPool(id: number, mode: PlaylistMode): Promise<TrackPool> {
  const [artist, top] = await Promise.all([getArtist(id), getTopTracks(id, 10)]);
  const topTitles = new Set(top.map((t) => normTitle(t.title)));

  let deep: PlaylistTrack[] = [];
  if (mode !== "popular") {
    const albums = (await getAlbums(id))
      .filter((a) => a.record_type === "album")
      .slice(0, 4);
    const albumTracks = await Promise.all(
      albums.map(async (a) => {
        try {
          const tracks = await getAlbumTracks(a.id);
          return tracks.map((t) => ({ ...t, albumTitle: a.title, cover: a.cover_medium }));
        } catch {
          return [];
        }
      })
    );
    const seen = new Set<string>();
    deep = albumTracks
      .flat()
      .filter((t) => {
        const key = normTitle(t.title);
        if (!key || topTitles.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((t) => ({ ...t, artistId: id, artistName: artist.name }));
    // Shuffle deep cuts so repeated playlists differ.
    for (let i = deep.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deep[i], deep[j]] = [deep[j], deep[i]];
    }
  }

  const popular: PlaylistTrack[] = top.map((t) => ({
    ...t,
    artistId: id,
    artistName: artist.name,
  }));

  let tracks: PlaylistTrack[];
  if (mode === "popular") tracks = popular.slice(0, 15);
  else if (mode === "deep") tracks = deep.slice(0, 15);
  else {
    tracks = [];
    for (let i = 0; i < 8; i++) {
      if (popular[i]) tracks.push(popular[i]);
      if (deep[i]) tracks.push(deep[i]);
    }
  }

  return { artistId: id, artistName: artist.name, tracks };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const id = parseInt(params.get("id") ?? "", 10);
  const mode = (params.get("mode") ?? "mixed") as PlaylistMode;
  if (!Number.isFinite(id) || !["popular", "deep", "mixed"].includes(mode)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }

  // Deep pools are shuffled per-build, so only cache the popular mode.
  const cacheKey = `tracks-${id}-${mode}`;
  if (mode === "popular") {
    const cached = await cacheGet<TrackPool>(cacheKey);
    if (cached) return NextResponse.json(cached);
  }

  try {
    const pool = await buildPool(id, mode);
    if (mode === "popular") await cacheSet(cacheKey, pool);
    return NextResponse.json(pool);
  } catch (err) {
    console.error(`[/api/tracks ${id}]`, err);
    return NextResponse.json({ error: "track pool failed" }, { status: 502 });
  }
}
