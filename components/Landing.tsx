"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { canvas } from "@/lib/canvas-controller";
import { resolveWheelGesture } from "@/lib/canvas-gestures";
import { discoveryCells, type DiscoveryCell } from "@/lib/discovery-field";
import { createIntroRun, playLanding, playWavefront, WAVEFRONT_BASE_RADIUS, type IntroRun } from "@/lib/discovery-intro";
import catalogue from "@/lib/discovery-artists.json";
import type { ArtistRef } from "@/lib/types";
import { expand, fetchDetails } from "@/store/actions";
import { useDiscoveryIntro } from "@/store/discovery-intro";
import { useGraph } from "@/store/graph";
import { useHistory } from "@/store/history";
import { useUi } from "@/store/ui";
import { primeSplitAudio } from "@/lib/split-audio";
import ArtistOrbMenu, { type OrbAction, type OrbMenuOrigin } from "./ArtistOrbMenu";
import { SearchIcon } from "./Icons";
import { useArtistSearch } from "@/hooks/useArtistSearch";

/* Canvas handoff: surrounding portraits shrink/fade for 400ms, with a
 * 0/30/60ms stagger. The selected portrait holds still; exploration starts
 * after 460ms. Reduced motion skips the departure entirely. */
const DEPARTURE_MS = 460;
const DEPARTURE_STAGGER = ["delay-0!", "delay-[30ms]!", "delay-[60ms]!"];

export default function Landing() {
  const hasNodes = useGraph((s) => s.order.length > 0);
  const hydrated = useGraph((s) => s.hydrated);
  return hydrated && !hasNodes ? <Discovery /> : null;
}

function Discovery() {
  const reducedMotion = useReducedMotion();
  const surface = useRef<HTMLDivElement>(null);
  const cameraRef = useRef({ x: 0, y: 0 });
  const frame = useRef(0);
  const headerIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const didDrag = useRef(false);
  const alive = useRef(true);
  const entering = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [canvasMoving, setCanvasMoving] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const { results, loading, error: searchError, retry } = useArtistSearch(query);
  const resultsRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<{ artist: ArtistRef; x: number; y: number; size: number } | null>(null);
  const q = query.trim();
  const searching = q.length >= 2;
  const cells = discoveryCells(camera, viewport, catalogue.length);
  const viewportRef = useRef(viewport);
  const measured = viewport.width > 0;
  const epoch = useDiscoveryIntro((s) => s.epoch);
  const [intro, setIntro] = useState<IntroRun | null>(null);
  const introStarted = useRef(false);
  // Hold the field back until the first run starts, so nothing flashes in
  // before it has had the chance to land.
  const introPending = !reducedMotion && intro === null;

  useEffect(() => {
    if (!measured || reducedMotion) return;
    let cancelled = false;
    const { params } = useDiscoveryIntro.getState();
    const visible = () => discoveryCells(cameraRef.current, viewportRef.current, catalogue.length);
    // Only the first run waits on portraits; replays already have them cached.
    const wait = !introStarted.current && params.images.wait ? params.images.maxWaitMs : 0;
    void preloadPortraits(visible().map((cell) => catalogue[cell.index].picture), wait).then(() => {
      if (cancelled) return;
      introStarted.current = true;
      const supportsLinear = CSS.supports("animation-timing-function", "linear(0, 1)");
      const now = Number(document.timeline.currentTime ?? performance.now());
      const run = createIntroRun(epoch, now, cameraRef.current, viewportRef.current, visible(), params, supportsLinear);
      setIntro(run);
    });
    return () => { cancelled = true; };
  }, [measured, reducedMotion, epoch]);

  const pan = (x: number, y: number) => {
    if (x === 0 && y === 0) return;
    setCanvasMoving(true);
    if (headerIdleTimer.current !== null) clearTimeout(headerIdleTimer.current);
    headerIdleTimer.current = setTimeout(() => {
      headerIdleTimer.current = null;
      setCanvasMoving(false);
    }, 850);
    cameraRef.current = { x: cameraRef.current.x + x, y: cameraRef.current.y + y };
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setCamera(cameraRef.current);
    });
  };

  useEffect(() => {
    alive.current = true;
    const element = surface.current!;
    const observer = new ResizeObserver(([entry]) => {
      viewportRef.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      setViewport(viewportRef.current);
    });
    observer.observe(element);
    const onWheel = (event: WheelEvent) => {
      if (entering.current) return;
      const gesture = resolveWheelGesture(event, element.clientHeight);
      // Preserve browser pinch/zoom. Ordinary wheel and trackpad input pans.
      if (gesture.kind !== "pan") return;
      event.preventDefault();
      pan(-gesture.deltaX, -gesture.deltaY);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      alive.current = false;
      observer.disconnect();
      element.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(frame.current);
      if (headerIdleTimer.current !== null) clearTimeout(headerIdleTimer.current);
      frame.current = 0;
    };
  }, []);

  const changeQuery = (value: string) => {
    setQuery(value);
    setError("");
  };

  const pick = async (artist: ArtistRef, element: HTMLElement) => {
    if (entering.current) return;
    trigger.current = element;
    const rect = element.querySelector(".discovery-portrait")?.getBoundingClientRect() ?? element.getBoundingClientRect();
    setSelected({ artist, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, size: rect.width });
    void fetchDetails(artist.id);
  };

  const dismiss = () => {
    setSelected(null);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };

  const enter = async (action: OrbAction, origin: OrbMenuOrigin) => {
    if (!selected || entering.current) return;
    const { artist } = selected;
    entering.current = true;
    setSelected({ artist, ...origin });
    setTransitioning(true);
    if (action === "back" || action === "forward") primeSplitAudio();
    try {
      const [details] = await Promise.all([
        fetchDetails(artist.id),
        new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : DEPARTURE_MS)),
      ]);
      if (!alive.current) return;
      canvas.adoptDiscovery(artist.id, origin.x, origin.y, origin.size);
      useGraph.getState().addSeed({ ...artist, accent: details?.accent ?? "#a3a3a3" });
      useHistory.getState().visit(artist);
      requestAnimationFrame(() => {
        if (!useGraph.getState().nodes[artist.id]) return;
        if (action === "back" || action === "forward") {
          document.querySelector<HTMLElement>(`[data-orb-id="${artist.id}"]`)?.focus({ preventScroll: true });
          void expand(artist.id, action);
        }
        else useUi.getState().startConnecting(artist.id);
      });
    } catch {
      if (!alive.current) return;
      entering.current = false;
      setTransitioning(false);
      setError("Couldn't open this artist. Please try again.");
    }
  };

  const clearSearch = () => {
    changeQuery("");
    document.getElementById("discovery-search")?.focus();
  };

  return (
    <main className="discovery left-0!" aria-busy={transitioning}>
      <div
        ref={surface}
        className={`discovery-surface ${dragging ? "is-dragging" : ""}`}
        role="region"
        aria-label="Artist discovery canvas"
        tabIndex={0}
        inert={searching || selected !== null}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current || entering.current) return;
          didDrag.current = false;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          if (!didDrag.current && Math.hypot(event.clientX - start.startX, event.clientY - start.startY) < 6) return;
          if (!didDrag.current) {
            didDrag.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }
          pan(event.clientX - start.x, event.clientY - start.y);
          start.x = event.clientX;
          start.y = event.clientY;
        }}
        onPointerUp={(event) => {
          if (drag.current?.id !== event.pointerId) return;
          drag.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); didDrag.current = true; }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
        onClickCapture={(event) => { if (didDrag.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); } }}
        onKeyDown={(event) => {
          const directions: Record<string, [number, number]> = { ArrowLeft: [180, 0], ArrowRight: [-180, 0], ArrowUp: [0, 180], ArrowDown: [0, -180] };
          const delta = directions[event.key];
          if (delta) {
            event.preventDefault();
            event.stopPropagation();
            surface.current?.focus({ preventScroll: true });
            pan(...delta);
          }
        }}
      >
        <div className={`discovery-dust transition-opacity duration-400 motion-reduce:transition-none ${transitioning ? "opacity-0" : "opacity-100"}`} aria-hidden="true" style={{ backgroundPosition: `${camera.x % 173}px ${camera.y % 173}px` }} />
        <div className="discovery-world" data-intro={introPending ? "pending" : undefined} style={{ transform: `translate3d(${camera.x + viewport.width / 2}px, ${camera.y + viewport.height / 2}px, 0)` }}>
          {intro?.params.ripple.enabled && <Wavefront run={intro} />}
          {cells.map((cell, index) => {
            const artist = catalogue[cell.index];
            const sx = cell.x + camera.x + viewport.width / 2;
            const sy = cell.y + camera.y + viewport.height / 2;
            const reachable = sx > cell.size / 2 && sx < viewport.width - cell.size / 2 && sy > 170 && sy < viewport.height - 130;
            return (
              <LandingNode key={cell.key} cell={cell} run={intro} style={{ left: cell.x, top: cell.y, pointerEvents: sy < 145 || sy > viewport.height - 110 ? "none" : undefined, "--artist-size": `${cell.size}px` } as CSSProperties}>
                <ArtistButton artist={artist} tabIndex={reachable ? 0 : -1} onPick={pick} departing={transitioning} departureDelay={DEPARTURE_STAGGER[index % DEPARTURE_STAGGER.length]} />
              </LandingNode>
            );
          })}
        </div>
      </div>

      <header className={`discovery-header bg-radial! from-black/95 from-15% via-black/75 via-40% to-transparent to-75% max-sm:bg-linear-to-b! transition-opacity! ease-out motion-reduce:transition-none! ${transitioning || canvasMoving ? "opacity-0! duration-200!" : selected ? "opacity-20! duration-700!" : "opacity-100! duration-700!"}`}>
        <h1 className="landing-wordmark">OMNI</h1>
        <p>Choose an artist. Follow the connections.</p>
      </header>

      {searching && (
        <section ref={resultsRef} className={`discovery-results transition-opacity duration-400 motion-reduce:transition-none ${transitioning ? "opacity-0" : "opacity-100"}`} aria-label="Artist search results" aria-busy={loading} inert={selected !== null}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); clearSearch(); return; }
            const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (!direction) return;
            const buttons = Array.from(resultsRef.current?.querySelectorAll<HTMLButtonElement>(".discovery-artist:not(:disabled)") ?? []);
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (index < 0 || !buttons.length) return;
            event.preventDefault(); event.stopPropagation();
            buttons[(index + direction + buttons.length) % buttons.length]?.focus();
          }}>
          <div className="discovery-results-heading"><span>Find your next starting point</span><span>{loading ? "Searching…" : `${results.length} ${results.length === 1 ? "artist" : "artists"}`}</span></div>
          <div className={`discovery-result-grid ${loading ? "is-updating" : ""}`}>
            {results.map((artist) => <ArtistButton key={artist.id} artist={artist} onPick={pick} departing={transitioning} disabled={loading || !!searchError} />)}
            {loading && !results.length && [0, 1, 2, 3].map((n) => <div className="discovery-result-skeleton" key={n} aria-hidden="true"><span /><i /></div>)}
          </div>
          {!loading && !searchError && !results.length && <div className="discovery-search-message"><SearchIcon size={24} /><p>No artists found for “{q}”</p><span>Try a different spelling or a shorter name.</span></div>}
          {searchError && <div className="discovery-search-message"><p>{searchError}</p><button className="discovery-action" onClick={retry}>Try again</button></div>}
        </section>
      )}

      <footer className={`discovery-footer bg-none! bg-transparent! transition-opacity duration-400 motion-reduce:transition-none ${transitioning ? "opacity-0" : "opacity-100"}`}>
        <p className="discovery-status" role="status">{transitioning && selected ? `Opening ${selected.artist.name}…` : error || searchError || (searching ? (loading ? "Finding your artist…" : `${results.length} artists found`) : query ? "Type at least 2 characters" : "")}</p>
        <form className="discovery-search bg-neutral-900/95! shadow-none! ring-1 ring-white/20 text-neutral-400! focus-within:ring-2 focus-within:ring-neutral-300 [&_input]:text-neutral-100! [&_input]:placeholder:text-neutral-400! [&_button]:focus-visible:outline-neutral-300!" role="search" onSubmit={(event) => {
          event.preventDefault();
          if (!loading && !error && !searchError && searching) resultsRef.current?.querySelector<HTMLButtonElement>(".discovery-artist:not(:disabled)")?.click();
        }}>
          <SearchIcon size={16} />
          <label className="sr-only" htmlFor="discovery-search">Find an artist</label>
          <input id="discovery-search" data-omni-search type="search" autoComplete="off" placeholder="Find an artist…" value={query} disabled={selected !== null} onChange={(event) => changeQuery(event.target.value)} onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) { if (event.key === "Enter") event.preventDefault(); return; }
            if (event.key === "Escape") { event.stopPropagation(); clearSearch(); }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(searching ? ".discovery-results .discovery-artist:not(:disabled)" : '.discovery-surface .discovery-artist[tabindex="0"]'));
              buttons[event.key === "ArrowDown" ? 0 : buttons.length - 1]?.focus();
            }
          }} />
          {loading && <span className="search-spinner" aria-hidden="true" />}
          {query && <button type="button" onClick={clearSearch} disabled={selected !== null} aria-label="Clear artist search">×</button>}
        </form>
        <p className="discovery-guidance">{searching ? "↑ ↓ Browse artists · Enter to explore · Esc to clear" : "Press / to search for an artist"}</p>
      </footer>

      {selected && !transitioning && <ArtistOrbMenu key={selected.artist.id} selection={selected} onDismiss={dismiss} onAction={enter} />}

      {selected && transitioning && <svg className="pointer-events-none fixed inset-0 z-50 size-full bg-black/70" aria-hidden="true">
        <foreignObject x={selected.x - selected.size / 2} y={selected.y - selected.size / 2} width={selected.size} height={selected.size} className="overflow-visible">
          <div className="relative size-full rounded-full bg-neutral-800 ring-1 ring-white/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.artist.picture} alt="" className="size-full rounded-full object-cover" />
            <span className="absolute left-1/2 top-full mt-3 w-48 -translate-x-1/2 text-center text-sm text-neutral-200">{selected.artist.name}</span>
          </div>
        </foreignObject>
      </svg>}

    </main>
  );
}

/** Hold on to the field until its first screen of portraits has decoded. */
function preloadPortraits(urls: string[], maxWait: number): Promise<void> {
  if (maxWait <= 0 || !urls.length) return Promise.resolve();
  const decoded = Promise.all(urls.map((src) => {
    const img = new Image();
    img.src = src;
    return img.decode().catch(() => undefined);
  }));
  return Promise.race([decoded.then(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, maxWait))]);
}

/** A cell in the field that lands on the intro's wave — see lib/discovery-intro.ts. */
function LandingNode({ cell, run, style, children }: { cell: DiscoveryCell; run: IntroRun | null; style: CSSProperties; children: ReactNode }) {
  const node = useRef<HTMLDivElement>(null);
  const { key, x, y } = cell;
  // Layout effect: the first frame has to be in place before the browser paints.
  useLayoutEffect(() => {
    if (!run || !node.current) return;
    return playLanding(node.current, { key, x, y }, run);
  }, [run, key, x, y]);
  const rings = run?.params.splash.enabled ? run.params.splash.rings : 0;
  return (
    <div ref={node} className="discovery-node" style={style}>
      {children}
      {Array.from({ length: rings }, (_, i) => <span key={i} className="discovery-splash" aria-hidden="true" style={{ "--splash-width": `${run!.params.splash.width}px` } as CSSProperties} />)}
    </div>
  );
}

/** The faint ring of light the landings ride outward on. */
function Wavefront({ run }: { run: IntroRun }) {
  const ring = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ring.current) return;
    return playWavefront(ring.current, run);
  }, [run]);
  return <div ref={ring} className="discovery-wavefront" aria-hidden="true" style={{ left: run.origin.x, top: run.origin.y, width: WAVEFRONT_BASE_RADIUS * 2, height: WAVEFRONT_BASE_RADIUS * 2, "--ripple-band": `${run.params.ripple.band}%` } as CSSProperties} />;
}

function ArtistButton({ artist, onPick, tabIndex, disabled, departing = false, departureDelay = "delay-0!" }: { artist: ArtistRef; onPick: (artist: ArtistRef, element: HTMLElement) => Promise<void>; tabIndex?: number; disabled?: boolean; departing?: boolean; departureDelay?: string }) {
  return (
    <button className={`discovery-artist transition-[scale,opacity]! duration-400! ease-out! motion-reduce:transition-none! ${departing ? `scale-50 opacity-0 ${departureDelay}` : "scale-100 opacity-100"}`} disabled={disabled} tabIndex={tabIndex} aria-label={`Explore ${artist.name}`} onClick={(event) => void onPick(artist, event.currentTarget)}>
      <span className="discovery-portrait">
        <span className="discovery-initial" aria-hidden="true">{artist.name.charAt(0)}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artist.picture} alt="" draggable={false} loading="lazy" onError={(event) => { event.currentTarget.style.opacity = "0"; }} />
      </span>
      <span className="discovery-name">{artist.name}</span>
    </button>
  );
}
