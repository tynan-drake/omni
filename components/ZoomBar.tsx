"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { canvas, getScale, subscribeScale, ZOOM_MAX, ZOOM_MIN } from "@/lib/canvas-controller";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import { ChevronDownIcon, FitIcon, SelectIcon } from "./Icons";

export default function ZoomBar() {
  const scale = useSyncExternalStore(subscribeScale, getScale, () => 1);
  const canvasTool = useUi((state) => state.canvasTool);
  const selectedIds = useGraph((state) => state.selectedIds);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
    trigger.current?.focus();
  };

  return <div ref={root} className="zoombar" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
    }
  }}>
    {canvasTool === "select" && <div className="selection-status glass">
      <span role="status"><SelectIcon size={15} /> {selectedIds.length ? `${selectedIds.length} selected` : "Select artists"}</span>
      {selectedIds.length > 0 && <button type="button" onClick={() => useUi.getState().openPlaylistFor(selectedIds)}>Create playlist</button>}
      <button type="button" className="selection-done" onClick={() => { useUi.getState().setCanvasTool("pan"); trigger.current?.focus(); }}>Done</button>
    </div>}
    <div className="zoombar-inner glass">
      <button type="button" className="view-fit" title="Fit view (F)" onClick={() => canvas.fitAll()}><FitIcon size={16} /><span>Fit view</span></button>
      <button type="button" ref={trigger} className={`zoom-level ${open ? "is-open" : ""}`}
        aria-label={`View options, zoom ${Math.round(scale * 100)}%`} aria-expanded={open}
        aria-controls={open ? "view-options" : undefined} onClick={() => setOpen(!open)}>
        <span className="zoom-level-value">{Math.round(scale * 100)}%</span><ChevronDownIcon size={12} />
      </button>
    </div>
    {open && <div id="view-options" className="zoom-menu glass" role="group" aria-label="View options">
      <button type="button" className="zoom-menu-item" disabled={scale >= ZOOM_MAX} onClick={() => canvas.zoomBy(1.35)}>Zoom in <span className="kbd">+</span></button>
      <button type="button" className="zoom-menu-item" disabled={scale <= ZOOM_MIN} onClick={() => canvas.zoomBy(1 / 1.35)}>Zoom out <span className="kbd">−</span></button>
      <button type="button" className="zoom-menu-item" onClick={() => run(() => canvas.zoomTo(1))}>Actual size <span className="kbd">0</span></button>
      <button type="button" className="zoom-menu-item" aria-pressed={canvasTool === "select"}
        onClick={() => run(() => useUi.getState().setCanvasTool(canvasTool === "select" ? "pan" : "select"))}>
        {canvasTool === "select" ? "Finish selecting" : "Select artists"}<SelectIcon size={15} />
      </button>
      <button type="button" className="zoom-menu-item" onClick={() => run(() => useUi.getState().setNavPanel("bridges"))}>Artist connections</button>
      <button type="button" className="zoom-menu-item" onClick={() => run(() => useUi.getState().setShortcutsOpen(true))}>Help & shortcuts <span className="kbd">?</span></button>
    </div>}
  </div>;
}
