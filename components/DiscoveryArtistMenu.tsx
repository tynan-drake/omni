"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ArtistRef } from "@/lib/types";
import { fetchDetails } from "@/store/actions";
import { useAudio } from "@/store/audio";
import { useUi } from "@/store/ui";
import { BranchesIcon, CloseIcon, InfoIcon, LinkIcon, PauseIcon, PlayIcon, RootsIcon } from "./Icons";

export type DiscoveryAction = "back" | "forward" | "connect" | "details";

const actionClass = "grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-neutral-950/95 text-neutral-200 shadow-xl backdrop-blur-xl transition-colors hover:border-white/35 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";
const tooltipClass = "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-neutral-200 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none";

/* ANIMATION STORYBOARD — runs once when the menu mounts.
 *   0ms  Connect fades in, scale 0.9 → 1, rises 2px (200ms).
 *  40ms  Roots follows.
 *  80ms  Branches follows.
 * 120ms  Artist name and controls follow; all settled by 320ms.
 * Reduced motion: everything appears immediately.
 */
const TIMING = {
  connect: "delay-0",       // First orbit action.
  roots: "delay-[40ms]",    // Second orbit action.
  branches: "delay-[80ms]", // Third orbit action.
  artist: "delay-[120ms]",  // Name, preview, and details.
};
const MENU_ENTRANCE = "motion-safe:transition-[opacity,scale,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:opacity-0 motion-safe:starting:scale-90 motion-safe:starting:translate-y-0.5";

function OrbitAction({ label, className, onClick, children, entranceDelay, tooltipSide = "bottom" }: { label: string; className: string; onClick: () => void; children: ReactNode; entranceDelay: string; tooltipSide?: "top" | "bottom" }) {
  return (
    <div className={`pointer-events-auto absolute ${className}`}>
      <div className={`${MENU_ENTRANCE} ${entranceDelay}`}>
        <button type="button" aria-label={label} className={`${actionClass} group relative`} onClick={onClick}>
          <span aria-hidden="true">{children}</span>
          <span aria-hidden="true" className={`${tooltipClass} ${tooltipSide === "top" ? "bottom-full mb-2" : "top-full mt-2"}`}>{label}</span>
        </button>
      </div>
    </div>
  );
}

export default function DiscoveryArtistMenu({ selection, onDismiss, onAction }: {
  selection: { artist: ArtistRef; x: number; y: number; size: number };
  onDismiss: () => void;
  onAction: (action: DiscoveryAction) => void;
}) {
  const { artist, x, y, size } = selection;
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const audio = useAudio();
  const [busy, setBusy] = useState(false);
  const [viewport, setViewport] = useState({ width: 1512, height: 857 });
  const playing = audio.artistId === artist.id && audio.playing;

  useLayoutEffect(() => {
    mounted.current = true;
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    ref.current?.querySelector<HTMLButtonElement>("[data-avatar]")?.focus();
    window.addEventListener("resize", measure);
    return () => { mounted.current = false; window.removeEventListener("resize", measure); };
  }, []);

  // SVG coordinates anchor the HTML controls to the canvas without inline CSS.
  // Near an edge, bring the entire orbit into view while keeping its arrangement.
  const diameter = Math.min(size, Math.max(64, viewport.width - 224));
  const radius = diameter / 2;
  const cx = Math.max(radius + 112, Math.min(x, viewport.width - radius - 112));
  const cy = Math.max(radius + 104, Math.min(y, viewport.height - radius - 100));

  const preview = async () => {
    if (busy) return;
    if (playing) { audio.toggle(); return; }
    setBusy(true);
    try {
      const details = await fetchDetails(artist.id);
      if (!mounted.current) return;
      const track = details?.tracks[0];
      if (track) audio.play(track, artist.id, artist.name);
      else useUi.getState().showToast(`No preview available for ${artist.name}`);
    } catch {
      if (mounted.current) useUi.getState().showToast(`Couldn't load a preview for ${artist.name}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Explore ${artist.name}`}
      className="fixed inset-0 z-50 bg-black/70 text-neutral-100"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onDismiss(); }}
      onWheel={onDismiss}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); onDismiss(); }
        if (event.key !== "Tab") return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
    >
      <button type="button" className={`${actionClass} absolute right-4 top-4 size-11 p-0`} aria-label="Close artist options" onClick={onDismiss}><CloseIcon size={16} /></button>
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <foreignObject x={cx - radius} y={cy - radius} width={diameter} height={diameter} className="overflow-visible">
          <div className="relative size-full" onWheel={(event) => event.stopPropagation()}>
            <OrbitAction label="Connect to…" entranceDelay={TIMING.connect} tooltipSide="top" className="bottom-full left-1/2 mb-4 -translate-x-1/2" onClick={() => onAction("connect")}><LinkIcon size={18} /></OrbitAction>
            <OrbitAction label="Roots" entranceDelay={TIMING.roots} className="right-full top-1/2 mr-3 -translate-y-1/2" onClick={() => onAction("back")}><RootsIcon size={18} /></OrbitAction>
            <OrbitAction label="Branches" entranceDelay={TIMING.branches} className="left-full top-1/2 ml-3 -translate-y-1/2" onClick={() => onAction("forward")}><BranchesIcon size={18} /></OrbitAction>
            <button type="button" data-avatar aria-label={`Open tracks and details for ${artist.name}`} title="Open tracks & details" className="pointer-events-auto relative block size-full overflow-hidden rounded-full bg-neutral-800 shadow-2xl ring-1 ring-white/30 transition-shadow hover:ring-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" onClick={() => onAction("details")}>
              <span className="absolute inset-0 grid place-items-center text-3xl" aria-hidden="true">{artist.name.charAt(0)}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artist.picture} alt="" className="relative size-full rounded-full object-cover" onError={(event) => { event.currentTarget.hidden = true; }} />
            </button>
            <div className="pointer-events-auto absolute left-1/2 top-full mt-3 flex w-56 -translate-x-1/2 flex-col items-center gap-2">
              <div className={`${MENU_ENTRANCE} ${TIMING.artist} flex max-w-full items-center gap-1 rounded-full bg-neutral-950/95 p-1 shadow-lg`}>
                <button type="button" data-preview aria-label={busy ? "Loading preview" : playing ? "Pause preview" : "Play preview"} aria-busy={busy} aria-disabled={busy} className="group relative grid size-8 shrink-0 place-items-center rounded-full text-neutral-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white aria-disabled:opacity-50" onClick={() => void preview()}>{playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}<span aria-hidden="true" className={`${tooltipClass} top-full mt-2`}>{busy ? "Loading preview" : playing ? "Pause preview" : "Play preview"}</span></button>
                <span className="truncate text-sm font-medium">{artist.name}</span>
                <button type="button" aria-label={`Artist details for ${artist.name}`} className="group relative grid size-8 shrink-0 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white" onClick={() => onAction("details")}><InfoIcon size={16} /><span aria-hidden="true" className={`${tooltipClass} top-full mt-2`}>Artist details</span></button>
              </div>
            </div>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}
