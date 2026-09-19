"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ArtistRef, ArtistSearchResult } from "@/lib/types";
import { navigateToArtist } from "@/store/actions";
import { useArtistSearch } from "@/hooks/useArtistSearch";
import { SearchIcon, SpotifyIcon } from "./Icons";

interface ArtistSearchProps {
  variant: "hero" | "bar" | "panel" | "context" | "discovery";
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
  excludeId?: number;
  onPick?: (artist: ArtistRef) => void | Promise<void>;
}

export default function ArtistSearch({ variant, placeholder = "Search an artist…", autoFocus,
  label = "Search artists", excludeId, onPick }: ArtistSearchProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [selected, setSelected] = useState<ArtistSearchResult | null>(null);
  const [pickError, setPickError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const picking = useRef(false);
  const [source, setSource] = useState<"auto" | "deezer">("auto");
  const { results, loading, error, retry } = useArtistSearch(query, excludeId, source);
  const searching = query.trim().length >= 2;
  const expanded = open && searching && !selected;
  const canPick = !loading && !error && !selected;
  const activeArtist = canPick ? results[active] : undefined;
  const sourceArtist = activeArtist ?? results[0];
  const status = selected ? `Flying to ${selected.name}…` : pickError || error ||
    (searching ? loading ? "Finding artists…" : results.length ? `${results.length} artists found` : `No artists found for “${query.trim()}”. Try another name.` : query ? "Type at least 2 characters" : "");

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  useEffect(() => {
    if (expanded && activeArtist) document.getElementById(`${id}-option-${activeArtist.id}`)?.scrollIntoView({ block: "nearest" });
  }, [activeArtist, expanded, id]);

  const pick = async (artist: ArtistSearchResult) => {
    if (picking.current || !canPick) return;
    picking.current = true;
    setSelected(artist);
    setPickError("");
    try {
      let resolved: ArtistRef;
      if (artist.source === "spotify") {
        const response = await fetch("/api/search/resolve", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spotifyId: artist.id }), signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("Unable to match this artist");
        resolved = (await response.json()).artist;
        if (!Number.isSafeInteger(resolved?.id)) throw new Error("Invalid artist match");
        if (resolved.id === excludeId) throw new Error("Same artist");
      } else resolved = artist;
      if (onPick) await onPick(resolved);
      else {
        await navigateToArtist(resolved);
      }
      setQuery("");
      setOpen(false);
      setActive(-1);
    } catch {
      setPickError(artist.source === "spotify" ? `Couldn’t confidently match ${artist.name}. Try finding them directly.` : `Couldn't open ${artist.name}. Please try again.`);
      setOpen(true);
    } finally {
      picking.current = false;
      setSelected(null);
    }
  };

  return (
    <div ref={boxRef} className={`artist-search is-${variant}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div className="search-field glass">
        <SearchIcon size={variant === "hero" ? 18 : 14} className="search-glyph" />
        <input ref={inputRef} id={id} data-omni-search role="combobox" aria-autocomplete="list"
          aria-expanded={expanded} aria-controls={expanded ? `${id}-results` : undefined}
          aria-activedescendant={expanded && activeArtist ? `${id}-option-${activeArtist.id}` : undefined}
          aria-describedby={`${id}-status`} autoComplete="off" value={query} placeholder={placeholder}
          spellCheck={false} autoFocus={autoFocus} readOnly={!!selected}
          onChange={(e) => { setQuery(e.target.value); setActive(-1); setOpen(true); setPickError(""); setSource("auto"); }}
          onFocus={() => setOpen(true)} onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Escape" && (open || query)) {
              e.preventDefault(); e.stopPropagation();
              if (open && searching) setOpen(false);
              else { setQuery(""); setOpen(false); }
              return;
            }
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && canPick && results.length) {
              e.preventDefault(); setOpen(true);
              setActive((a) => !expanded || a < 0 ? (e.key === "ArrowDown" ? 0 : results.length - 1) : (a + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
            } else if (e.key === "Enter" && expanded) {
              e.preventDefault();
              if (canPick && results.length) void pick(activeArtist ?? results[0]);
            }
          }} />
        {(loading || selected) && <span className="search-spinner" aria-hidden="true" />}
        {query && !selected && <button type="button" className="search-clear" aria-label="Clear artist search" onClick={() => {
          setQuery(""); setActive(-1); setPickError(""); inputRef.current?.focus();
        }}>×</button>}
      </div>
      <span id={`${id}-status`} className="sr-only" role="status">{status}</span>
      {pickError && <div className="search-pick-error"><p>{pickError}</p>{source !== "deezer" && <button type="button" className="search-retry" onClick={() => { setSource("deezer"); setPickError(""); setActive(-1); setOpen(true); inputRef.current?.focus(); }}>Search directly</button>}</div>}
      {expanded && <div className="search-results glass scrollbar-slim">
        <div id={`${id}-results`} role="listbox" aria-label="Artists" aria-busy={loading} className={loading ? "search-updating" : undefined}>
          {results.map((artist, i) => <div key={artist.id} id={`${id}-option-${artist.id}`} role="option"
            aria-selected={activeArtist?.id === artist.id} aria-disabled={!canPick}
            className={`search-result ${artist.source === "spotify" ? "is-spotify" : ""} ${activeArtist?.id === artist.id ? "is-active" : ""}`}
            onPointerEnter={() => { if (canPick) setActive(i); }}
            onPointerDown={(e) => e.preventDefault()} onClick={() => void pick(artist)}>
            <span className="search-portrait" aria-hidden="true"><span>{artist.name.charAt(0)}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artist.picture} alt="" onError={(e) => { e.currentTarget.style.opacity = "0"; }} />
            </span>
            <span className="search-result-name">{artist.name}
              <small>{artist.source === "spotify" ? "Spotify artist" : artist.fans !== undefined ? `${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(artist.fans)} Deezer fans` : "Artist"}</small>
            </span>
            <span className="search-result-enter" aria-hidden="true">↵</span>
          </div>)}
        </div>
        {sourceArtist?.source === "spotify" && <div className="search-source-links">
          <a href={sourceArtist.spotifyUrl} target="_blank" rel="noopener noreferrer"><SpotifyIcon size={16} />Open {sourceArtist.name} on Spotify ↗</a>
        </div>}
        {loading && !results.length && <div className="search-skeletons" aria-hidden="true">{[0, 1, 2].map((n) => <div key={n} className="search-skeleton"><i /><span /></div>)}</div>}
        {error && <button type="button" className="search-retry" onClick={retry}>Try again</button>}
        {!loading && !error && results.length > 0 && <p className="search-key-hint" aria-hidden="true">↑ ↓ to browse <span>↵ to explore</span></p>}
      </div>}
    </div>
  );
}
