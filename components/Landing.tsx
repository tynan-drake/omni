"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { canvas } from "@/lib/canvas-controller";
import type { ArtistRef } from "@/lib/types";
import { seedFromSearch } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import { SearchIcon } from "./Icons";

const STARTERS = ["Kendrick Lamar", "Björk", "Radiohead", "Miles Davis", "Daft Punk"];
const POSITIONS = [
  { x: 49, y: 48, size: 132, color: "#b5a1e8" },
  { x: 23, y: 20, size: 100, color: "#8cb9c4" },
  { x: 78, y: 20, size: 112, color: "#a8b6e4" },
  { x: 19, y: 80, size: 112, color: "#d1aa79" },
  { x: 79, y: 80, size: 100, color: "#83a7d8" },
];

async function search(query: string, signal: AbortSignal): Promise<ArtistRef[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error("Search unavailable");
  const data = await response.json();
  return data.artists ?? [];
}

export default function Landing() {
  const hasNodes = useGraph((s) => s.order.length > 0);
  const hydrated = useGraph((s) => s.hydrated);
  // Remount a fresh entrance when Home clears the graph.
  return hydrated && !hasNodes ? <Constellation /> : null;
}

function Constellation() {
  const reducedMotion = useReducedMotion();
  const [featured, setFeatured] = useState<ArtistRef[]>([]);
  const [results, setResults] = useState<ArtistRef[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const entering = useRef(false);
  const mounted = useRef(true);
  const q = query.trim();
  const searching = q.length >= 2;
  const artists = searching ? results : featured;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (searching) {
          const found = await search(q, controller.signal);
          if (!controller.signal.aborted) setResults(found.slice(0, 5));
        } else if (!featured.length) {
          const found = await Promise.allSettled(STARTERS.map(async (name) => {
            const matches = await search(name, controller.signal);
            return matches.find((artist) => artist.name.toLowerCase() === name.toLowerCase());
          }));
          const picks = found.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
          if (!controller.signal.aborted) {
            if (!picks.length) throw new Error("Artists unavailable");
            setFeatured(picks);
          }
        }
      } catch {
        if (!controller.signal.aborted) setError("Couldn't reach the artists. Try again in a moment.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, searching ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, searching, featured.length, retry]);

  const pick = async (artist: ArtistRef) => {
    if (entering.current) return;
    entering.current = true;
    setSelected(artist.id);
    // Let the chosen portrait gather at the center before handing it to Canvas.
    await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : 650));
    if (!mounted.current) return;
    try {
      await seedFromSearch(artist);
      requestAnimationFrame(() => {
        canvas.fitAll();
        useUi.getState().openMenu(artist.id);
      });
    } catch {
      if (!mounted.current) return;
      entering.current = false;
      setSelected(null);
      setError("Couldn't open this artist. Please try again.");
    }
  };

  return (
    <main className={`landing constellation-landing ${selected !== null ? "is-entering" : ""}`}>
      <div className="constellation-shell">
        <header className="constellation-header">
          <h1 className="landing-wordmark">OMNI</h1>
          <p className="constellation-intro">Choose an artist. Follow the connections.</p>
        </header>

        <div className="constellation-stage" aria-label={searching ? "Artist search results" : "Artists to start exploring"} aria-busy={loading}>
          <div className="constellation-orbit orbit-one" aria-hidden="true" />
          <div className="constellation-orbit orbit-two" aria-hidden="true" />
          <div className="constellation-stars" aria-hidden="true" />
          {!loading && !error && artists.map((artist, index) => {
            const position = POSITIONS[index];
            const chosen = selected === artist.id;
            return (
              <motion.div
                key={artist.id}
                className="constellation-node"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: selected !== null && !chosen ? 0 : 1,
                  left: `${chosen && !reducedMotion ? 50 : position.x}%`,
                  top: `${chosen && !reducedMotion ? 50 : position.y}%`,
                }}
                transition={{ duration: reducedMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ "--seed-size": `${position.size}px`, "--seed-color": position.color, "--seed-delay": `${index * -1.7}s` } as CSSProperties}
              >
                <button
                  className={`constellation-artist ${selected !== null ? "is-still" : ""}`}
                  onClick={() => void pick(artist)}
                  disabled={selected !== null}
                  aria-label={`Explore ${artist.name}`}
                >
                  <span className="constellation-portrait">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={artist.pictureBig || artist.picture} alt="" onError={(event) => { event.currentTarget.style.opacity = "0"; }} />
                    <span className="constellation-initial" aria-hidden="true">{artist.name.charAt(0)}</span>
                  </span>
                  <span className="constellation-name">{artist.name}</span>
                  <span className="constellation-invitation" aria-hidden="true">{chosen ? "Opening…" : "Explore this artist ↗"}</span>
                </button>
              </motion.div>
            );
          })}
          {loading && POSITIONS.map((position, index) => (
            <div key={index} className="constellation-placeholder" aria-hidden="true" style={{ left: `${position.x}%`, top: `${position.y}%`, width: position.size, height: position.size }} />
          ))}
          {!loading && (error || (searching && !artists.length)) && <div className="constellation-empty"><span aria-hidden="true">✧</span><p>{error ? "A quiet patch in the universe." : "A different name, a new beginning."}</p></div>}
        </div>

        <footer className="constellation-footer">
          {error && <button className="constellation-text-button" onClick={() => setRetry((value) => value + 1)}>Try again</button>}
          <form className="constellation-search" role="search" onSubmit={(event) => { event.preventDefault(); if (!loading && !error && searching && artists[0]) void pick(artists[0]); }}>
            <SearchIcon size={16} />
            <label className="sr-only" htmlFor="constellation-search">Find an artist</label>
            <input id="constellation-search" data-omni-search type="search" autoComplete="off" placeholder="Find an artist…" value={query} disabled={selected !== null} onChange={(event) => { setQuery(event.target.value); setResults([]); setLoading(true); }} onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setQuery("");
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                document.querySelector<HTMLButtonElement>(".constellation-artist")?.focus();
              }
            }} />
            {query && <button type="button" className="constellation-clear" disabled={selected !== null} onClick={() => { setQuery(""); document.getElementById("constellation-search")?.focus(); }} aria-label="Clear artist search">×</button>}
          </form>
        </footer>
      </div>
    </main>
  );
}
