"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { canvas, getScale, subscribeScale, ZOOM_MAX, ZOOM_MIN } from "@/lib/canvas-controller";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import { ChevronDownIcon, FitIcon, SelectIcon, TrashIcon } from "./Icons";

export default function ZoomBar() {
  const scale = useSyncExternalStore(subscribeScale, getScale, () => 1);
  const canvasTool = useUi((state) => state.canvasTool);
  const selectedIds = useGraph((state) => state.selectedIds);
  const [open, setOpen] = useState(false);
  const [sizingOpen, setSizingOpen] = useState(false);
  const sizingRoot = useRef<HTMLDivElement>(null);
  const sizingTrigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open && !sizingOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
      if (!sizingRoot.current?.contains(event.target as Node)) setSizingOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open, sizingOpen]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
    trigger.current?.focus();
  };

  return <div ref={root} className="zoombar top-4! bottom-auto!" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
      setSizingOpen(false);
    }
  }} onKeyDown={(event) => {
    if (event.key === "Escape" && (open || sizingOpen)) {
      event.preventDefault(); event.stopPropagation();
      if (sizingOpen) { setSizingOpen(false); sizingTrigger.current?.focus(); }
      else { setOpen(false); trigger.current?.focus(); }
    }
  }}>
    <div className="fixed right-4 bottom-5 flex flex-col items-end gap-2">
    {canvasTool === "select" && <div className="selection-status glass">
      <span role="status"><SelectIcon size={15} /> {selectedIds.length ? `${selectedIds.length} selected` : "Select artists"}</span>
      {selectedIds.length > 0 && <button type="button" onClick={() => useUi.getState().openPlaylistFor(selectedIds)}>Create playlist</button>}
      <button type="button" className="selection-done" onClick={() => { useUi.getState().setCanvasTool("pan"); sizingTrigger.current?.focus(); }}>Done</button>
    </div>}
    <div ref={sizingRoot} className="zoombar-inner glass relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSizingOpen(false);
    }}>
      <button type="button" className="view-fit" title="Fit view (F)" onClick={() => canvas.fitAll()}><FitIcon size={16} /><span>Fit view</span></button>
      <button type="button" ref={sizingTrigger} className={`zoom-level ${sizingOpen ? "is-open" : ""}`}
        aria-label={`Sizing options, zoom ${Math.round(scale * 100)}%`} aria-expanded={sizingOpen}
        aria-controls={sizingOpen ? "sizing-options" : undefined}
        onClick={() => { setOpen(false); setSizingOpen(!sizingOpen); }}>
        <span className="zoom-level-value">{Math.round(scale * 100)}%</span><ChevronDownIcon size={12} className="rotate-180" />
      </button>
      {sizingOpen && <div id="sizing-options" className="zoom-menu glass" role="group" aria-label="Sizing options">
        <button type="button" className="zoom-menu-item" disabled={scale >= ZOOM_MAX} onClick={() => canvas.zoomBy(1.35)}>Zoom in <span className="kbd">+</span></button>
        <button type="button" className="zoom-menu-item" disabled={scale <= ZOOM_MIN} onClick={() => canvas.zoomBy(1 / 1.35)}>Zoom out <span className="kbd">−</span></button>
        <button type="button" className="zoom-menu-item" onClick={() => {
          canvas.zoomTo(1); setSizingOpen(false); sizingTrigger.current?.focus();
        }}>Actual size <span className="kbd">0</span></button>
      </div>}

    </div>
    </div>
    <button type="button" ref={trigger}
      className="glass flex size-11 cursor-pointer items-center justify-center rounded-xl hover:bg-white/10! aria-expanded:bg-white/10! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      aria-label="More options" title="More options" aria-expanded={open}
      aria-controls={open ? "view-options" : undefined} onClick={() => { setSizingOpen(false); setOpen(!open); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
      </svg>
    </button>
    {open && <div id="view-options" className="zoom-menu glass top-full! bottom-auto! mt-2 origin-top-right!" role="group" aria-label="More options">
      <button type="button" className="zoom-menu-item" onClick={() => run(() => {
        const ui = useUi.getState();
        ui.closeAll();
        ui.setCanvasTool("pan");
        ui.clearFilters();
        useUi.setState({ splitFormation: null, expanding: {} });
        useGraph.getState().reset();
        ui.showToast("Canvas cleared");
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus());
      })}>Clear canvas <TrashIcon size={15} /></button>
      <button type="button" className="zoom-menu-item" onClick={() => run(() => useUi.getState().setNavPanel("bridges"))}>Artist connections</button>
      <button type="button" className="zoom-menu-item" onClick={() => run(() => useUi.getState().setShortcutsOpen(true))}>Help & shortcuts <span className="kbd">?</span></button>
    </div>}
  </div>;
}
