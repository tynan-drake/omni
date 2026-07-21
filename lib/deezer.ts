import type { ArtistRef, Track } from "./types";

const BASE = "https://api.deezer.com";

interface DeezerError {
  error: { type: string; message: string; code: number };
}

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
  picture_xl: string;
  nb_fan?: number;
}

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;
  album?: { id: number; title: string; cover_medium: string };
}

interface DeezerAlbum {
  id: number;
  title: string;
  release_date: string;
  record_type: string;
  cover_medium: string;
}

interface DeezerList<T> {
  data: T[];
}

/** Fetch a Deezer API path, retrying once on rate-limit (error code 4). */
async function dz<T>(path: string, revalidate = 86400): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    if (!res.ok) throw new Error(`Deezer HTTP ${res.status} for ${path}`);
    const json = (await res.json()) as T | DeezerError;
    if (typeof json === "object" && json !== null && "error" in json) {
      const err = (json as DeezerError).error;
      if (err.code === 4 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      throw new Error(`Deezer error ${err.code}: ${err.message}`);
    }
    return json as T;
  }
}

function toArtistRef(a: DeezerArtist): ArtistRef {
  return {
    id: a.id,
    name: a.name,
    picture: a.picture_medium,
    pictureBig: a.picture_xl,
  };
}

function toTrack(t: DeezerTrack): Track {
  return {
    id: t.id,
    title: t.title,
    duration: t.duration,
    preview: t.preview,
    albumTitle: t.album?.title,
    cover: t.album?.cover_medium,
  };
}

/** Deezer's md5-of-empty-string placeholder portrait. */
const PLACEHOLDER_IMG = /d41d8cd98f00b204e9800998ecf8427e|\/artist\/\//;

export async function searchArtists(q: string, limit = 8): Promise<ArtistRef[]> {
  const json = await dz<DeezerList<DeezerArtist>>(
    `/search/artist?q=${encodeURIComponent(q)}&limit=${Math.max(limit * 2, 10)}`,
    3600
  );
  return (json.data ?? [])
    .filter((a) => a.picture_medium && !PLACEHOLDER_IMG.test(a.picture_medium))
    .sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))
    .slice(0, limit)
    .map(toArtistRef);
}

export async function getArtist(id: number): Promise<ArtistRef & { fans: number }> {
  const a = await dz<DeezerArtist>(`/artist/${id}`);
  return { ...toArtistRef(a), fans: a.nb_fan ?? 0 };
}

export async function getTopTracks(id: number, limit = 5): Promise<Track[]> {
  const json = await dz<DeezerList<DeezerTrack>>(`/artist/${id}/top?limit=${limit}`);
  return (json.data ?? []).filter((t) => t.preview).map(toTrack);
}

export async function getAlbums(id: number): Promise<DeezerAlbum[]> {
  const json = await dz<DeezerList<DeezerAlbum>>(`/artist/${id}/albums?limit=100`);
  return json.data ?? [];
}

export async function getAlbumTracks(albumId: number): Promise<Track[]> {
  const json = await dz<DeezerList<DeezerTrack>>(`/album/${albumId}/tracks?limit=50`);
  return (json.data ?? []).filter((t) => t.preview).map(toTrack);
}

export async function getRelatedArtists(id: number, limit = 20): Promise<ArtistRef[]> {
  const json = await dz<DeezerList<DeezerArtist>>(`/artist/${id}/related?limit=${limit}`);
  return (json.data ?? []).filter((a) => a.picture_medium).map(toArtistRef);
}

/** Estimate an artist's career start from their earliest release year. */
export async function getCareerStartYear(id: number): Promise<number | null> {
  try {
    const albums = await getAlbums(id);
    const years = albums
      .map((a) => parseInt(a.release_date?.slice(0, 4), 10))
      .filter((y) => Number.isFinite(y) && y > 1900);
    return years.length ? Math.min(...years) : null;
  } catch {
    return null;
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Resolve a free-text artist name (e.g. from Claude) to a Deezer artist.
 * Prefers an exact normalized match, falls back to the top hit if it is a
 * close prefix match, otherwise null.
 */
export async function resolveArtistByName(name: string): Promise<ArtistRef | null> {
  try {
    const results = await searchArtists(name, 5);
    if (!results.length) return null;
    const target = norm(name);
    const exact = results.find((r) => norm(r.name) === target);
    if (exact) return exact;
    const top = results[0];
    const topNorm = norm(top.name);
    if (topNorm.startsWith(target) || target.startsWith(topNorm)) return top;
    return null;
  } catch {
    return null;
  }
}
