"use client";

import type { PlaylistTrack } from "../types";

/**
 * Spotify playlist export via Authorization Code + PKCE, entirely in-browser.
 * No client secret, no server storage; the token lives in sessionStorage for
 * the session only. OAuth runs in a popup so the canvas is never unloaded.
 */

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";
const SCOPES = "playlist-modify-private playlist-modify-public";
const TOKEN_KEY = "omni-spotify-token";

export const spotifyClientId = () =>
  process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || null;

export const spotifyConfigured = () => Boolean(spotifyClientId());

const redirectUri = () => `${window.location.origin}/callback/spotify`;

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return b64url(new Uint8Array(digest));
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

function storedToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    return t.expiresAt > Date.now() + 30_000 ? t.accessToken : null;
  } catch {
    return null;
  }
}

/** Open the Spotify consent popup and resolve with the authorization code. */
function authorizeInPopup(clientId: string, challenge: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri(),
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    const popup = window.open(
      `${AUTH_URL}?${params}`,
      "omni-spotify-auth",
      "width=480,height=720"
    );
    if (!popup) {
      reject(new Error("Popup blocked — allow popups for this site"));
      return;
    }

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(closedPoll);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; code?: string; error?: string };
      if (data?.type !== "omni-spotify-auth") return;
      cleanup();
      popup.close();
      if (data.code) resolve(data.code);
      else reject(new Error(data.error || "Spotify authorization was declined"));
    };
    const closedPoll = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Spotify authorization window was closed"));
      }
    }, 600);
    window.addEventListener("message", onMessage);
  });
}

async function getAccessToken(): Promise<string> {
  const existing = storedToken();
  if (existing) return existing;

  const clientId = spotifyClientId();
  if (!clientId) throw new Error("Spotify client id not configured");

  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = await pkceChallenge(verifier);
  const code = await authorizeInPopup(clientId, challenge);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };

  sessionStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    } satisfies StoredToken)
  );
  return json.access_token;
}

async function api<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw new Error(`Spotify API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

const cleanTitle = (t: string) =>
  t
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/(feat|ft)\..*/i, "")
    .trim();

async function findTrackUri(
  token: string,
  track: PlaylistTrack
): Promise<string | null> {
  const q = `track:${cleanTitle(track.title)} artist:${track.artistName}`;
  try {
    const json = await api<{ tracks: { items: Array<{ uri: string }> } }>(
      token,
      `/search?q=${encodeURIComponent(q)}&type=track&limit=1`
    );
    return json.tracks.items[0]?.uri ?? null;
  } catch {
    return null;
  }
}

export interface ExportProgress {
  phase: "auth" | "matching" | "creating" | "done";
  matched: number;
  total: number;
}

export interface ExportResult {
  url: string;
  matched: number;
  total: number;
}

export async function exportToSpotify(
  name: string,
  description: string,
  tracks: PlaylistTrack[],
  onProgress: (p: ExportProgress) => void
): Promise<ExportResult> {
  onProgress({ phase: "auth", matched: 0, total: tracks.length });
  const token = await getAccessToken();

  onProgress({ phase: "matching", matched: 0, total: tracks.length });
  const uris: string[] = [];
  let done = 0;
  // Small concurrency pool to stay well inside rate limits.
  const queue = [...tracks];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const track = queue.shift();
      if (!track) break;
      const uri = await findTrackUri(token, track);
      if (uri && !uris.includes(uri)) uris.push(uri);
      done++;
      onProgress({ phase: "matching", matched: done, total: tracks.length });
    }
  });
  await Promise.all(workers);

  onProgress({ phase: "creating", matched: uris.length, total: tracks.length });
  const me = await api<{ id: string }>(token, "/me");
  const playlist = await api<{ id: string; external_urls: { spotify: string } }>(
    token,
    `/users/${encodeURIComponent(me.id)}/playlists`,
    {
      method: "POST",
      body: JSON.stringify({ name, description, public: false }),
    }
  );

  for (let i = 0; i < uris.length; i += 100) {
    await api(token, `/playlists/${playlist.id}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }

  onProgress({ phase: "done", matched: uris.length, total: tracks.length });
  return {
    url: playlist.external_urls.spotify,
    matched: uris.length,
    total: tracks.length,
  };
}
