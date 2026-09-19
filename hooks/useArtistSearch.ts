"use client";

import { useEffect, useState } from "react";
import type { ArtistSearchResult } from "@/lib/types";

const cache = new Map<string, { artists: ArtistSearchResult[]; expires: number }>();
const EMPTY: ArtistSearchResult[] = [];

/** Keep the last results in place while updating, but never allow stale picks. */
export function useArtistSearch(query: string, excludeId?: number, source: "auto" | "deezer" = "auto") {
  const q = query.trim();
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    artists: ArtistSearchResult[];
    error: string;
  }>({ key: "", artists: EMPTY, error: "" });
  const cacheKey = JSON.stringify([q, source]);
  const key = JSON.stringify([q, source, attempt]);
  const searching = q.length >= 2;
  const loading = searching && response.key !== key;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const cached = cache.get(cacheKey);
    const timer = setTimeout(async () => {
      try {
        let artists: ArtistSearchResult[];
        if (cached && cached.expires > Date.now()) {
          artists = cached.artists;
        } else {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&source=${source}`, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
          });
          if (!res.ok) throw new Error("Search unavailable");
          const json = await res.json();
          if (!Array.isArray(json.artists)) throw new Error("Invalid search response");
          artists = json.artists;
          if (controller.signal.aborted) return;
          if (cache.size >= 50) cache.delete(cache.keys().next().value!);
          cache.set(cacheKey, { artists, expires: Date.now() + 60_000 });
        }
        if (!controller.signal.aborted) setResponse({ key, artists, error: "" });
      } catch {
        if (!controller.signal.aborted) {
          setResponse({ key, artists: EMPTY, error: "Search is taking a break. Please try again." });
        }
      }
    }, cached && cached.expires > Date.now() ? 0 : 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [cacheKey, key, q, searching, source]);

  return {
    results: searching ? response.artists.filter((artist) => artist.id !== excludeId) : EMPTY,
    loading,
    error: searching && !loading ? response.error : "",
    retry: () => { cache.delete(cacheKey); setAttempt((value) => value + 1); },
  };
}
