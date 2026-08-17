"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArtistRef } from "@/lib/types";
import { seedFromSearch } from "@/store/actions";
import { canvas } from "@/lib/canvas-controller";
import { SearchIcon } from "./Icons";

interface ArtistSearchProps {
  variant: "hero" | "bar" | "panel";
  placeholder?: string;
  autoFocus?: boolean;
}

export default function ArtistSearch({
  variant,
  placeholder = "Search an artist…",
  autoFocus,
}: ArtistSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistRef[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { artists?: ArtistRef[] };
        if (seq !== requestSeq.current) return;
        setResults(json.artists ?? []);
        setOpen(true);
        setActive(0);
      } catch {
        /* network hiccup — keep prior results */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  const pick = useCallback(async (artist: ArtistRef) => {
    setOpen(false);
    setQuery("");
    setSeeding(true);
    inputRef.current?.blur();
    await seedFromSearch(artist);
    setSeeding(false);
    setTimeout(() => canvas.fitAll(), 450);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !results.length) {
      if (e.key === "Escape") inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={boxRef} className={`artist-search is-${variant}`}>
      <div className="search-field glass">
        <SearchIcon size={variant === "hero" ? 18 : 14} className="search-glyph" />
        <input
          ref={inputRef}
          data-omni-search
          value={query}
          placeholder={placeholder}
          spellCheck={false}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
        />
        {seeding && <span className="search-spinner" />}
      </div>

      {open && results.length > 0 && (
        <div className="search-results glass scrollbar-slim">
          {results.map((artist, i) => (
            <button
              key={artist.id}
              className={`search-result ${i === active ? "is-active" : ""}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => void pick(artist)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artist.picture} alt="" />
              <span>{artist.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
