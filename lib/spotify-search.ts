/** Server-only Spotify catalogue access. Never import into a client component. */
import type { SpotifySearchResult, ArtistRef } from "./types";

interface SpotifyArtist { id: string; name: string; images?: { url: string; width?: number }[] }
interface SpotifyTrack { artists: { id: string }[]; external_ids?: { isrc?: string } }
let token: { value: string; expires: number; client: string } | null = null;
let pendingToken: Promise<string> | null = null;
let cooldown = 0;

export function spotifySearchConfigured(): boolean {
  return Boolean((process.env.SPOTIFY_CLIENT_ID || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID) && process.env.SPOTIFY_CLIENT_SECRET);
}

async function accessToken(): Promise<string> {
  const client = process.env.SPOTIFY_CLIENT_ID || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!client || !secret) throw new Error("Spotify search is not configured");
  if (token?.client === client && token.expires > Date.now() + 30_000) return token.value;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(3000),
      headers: { Authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) throw new Error("Spotify authorization unavailable");
    const data = await response.json();
    if (!data.access_token || !Number.isFinite(data.expires_in)) throw new Error("Invalid Spotify token");
    token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000, client };
    return token.value;
  })();
  try { return await pendingToken; } finally { pendingToken = null; }
}

async function spotify<T>(path: string): Promise<T> {
  if (Date.now() < cooldown) throw new Error("Spotify is temporarily busy");
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (response.status === 401 && attempt === 0) { token = null; continue; }
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));
      cooldown = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 30) * 1000;
    }
    if (!response.ok) throw new Error("Spotify catalogue unavailable");
    return response.json();
  }
  throw new Error("Spotify authorization unavailable");
}

const market = () => process.env.SPOTIFY_MARKET || "US";

export async function searchSpotifyArtists(query: string): Promise<SpotifySearchResult[]> {
  const params = new URLSearchParams({ q: query, type: "artist", limit: "8", market: market() });
  const data = await spotify<{ artists: { items: SpotifyArtist[] } }>(`/search?${params}`);
  if (!Array.isArray(data.artists?.items)) throw new Error("Invalid Spotify results");
  return data.artists.items.map((artist) => ({
    id: artist.id, source: "spotify", name: artist.name,
    picture: artist.images?.at(-1)?.url ?? "", pictureBig: artist.images?.[0]?.url ?? "",
    spotifyUrl: `https://open.spotify.com/artist/${artist.id}`,
  }));
}

const normalize = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const matches = new Map<string, { artist: ArtistRef; expires: number }>();

/** Match recordings by ISRC, then confirm the primary artist, never name alone. */
export async function resolveSpotifyArtist(id: string): Promise<ArtistRef | null> {
  const cached = matches.get(id);
  if (cached && cached.expires > Date.now()) return cached.artist;
  const artist = await spotify<SpotifyArtist>(`/artists/${id}`);
  const params = new URLSearchParams({ q: `artist:"${artist.name.replace(/"/g, "")}"`, type: "track", limit: "10", market: market() });
  const tracks = await spotify<{ tracks: { items: SpotifyTrack[] } }>(`/search?${params}`);
  const isrcs = [...new Set(tracks.tracks.items.filter((track) => track.artists[0]?.id === id).map((track) => track.external_ids?.isrc).filter((isrc): isrc is string => !!isrc && /^[a-z0-9]{12}$/i.test(isrc)))].slice(0, 3);
  const candidates = await Promise.all(isrcs.map(async (isrc) => {
    try {
      const response = await fetch(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(2000) });
      if (!response.ok) return null;
      const data = await response.json();
      const match = data.artist;
      if (data.error || normalize(data.isrc ?? "") !== normalize(isrc) || !Number.isSafeInteger(match?.id) || normalize(match.name) !== normalize(artist.name)) return null;
      return { id: match.id, name: match.name, picture: match.picture_medium ?? "", pictureBig: match.picture_xl ?? match.picture_medium ?? "" } satisfies ArtistRef;
    } catch { return null; }
  }));
  const unique = new Map(candidates.filter((value): value is ArtistRef => value !== null).map((value) => [value.id, value]));
  if (unique.size !== 1) return null;
  const match = [...unique.values()][0];
  if (matches.size >= 200) matches.delete(matches.keys().next().value!);
  matches.set(id, { artist: match, expires: Date.now() + 3600_000 });
  return match;
}
