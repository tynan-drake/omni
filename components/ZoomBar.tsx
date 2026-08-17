"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  canvas,
  getScale,
  subscribeScale,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@/lib/canvas-controller";
import { ChevronDownIcon, FitIcon, MinusIcon, PlusIcon } from "./Icons";

const STEP = 1.35;

/** Live viewport scale. d3 owns the transform, so we read it off the bridge. */
function useScale(): number {
  return useSyncExternalStore(subscribeScale, getScale, () => 1);
}

export default function ZoomBar() {
  const scale = useScale();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the zoom menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const items = [
    { label: "Zoom in", hint: "+", run: () => canvas.zoomBy(STEP) },
    { label: "Zoom out", hint: "−", run: () => canvas.zoomBy(1 / STEP) },
    { label: "Zoom to 100%", hint: "0", run: () => canvas.zoomTo(1) },
    { label: "Zoom to fit", hint: "F", run: () => canvas.fitAll() },
  ];

  return (
    <motion.div
      ref={rootRef}
      className="zoombar"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="zoombar-inner glass">
        <button
          className="zoom-btn"
          title="Zoom out (−)"
          aria-label="Zoom out"
          disabled={scale <= ZOOM_MIN + 0.001}
          onClick={() => canvas.zoomBy(1 / STEP)}
        >
          <MinusIcon size={16} />
        </button>
        <button
          className="zoom-btn"
          title="Zoom in (+)"
          aria-label="Zoom in"
          disabled={scale >= ZOOM_MAX - 0.001}
          onClick={() => canvas.zoomBy(STEP)}
        >
          <PlusIcon size={16} />
        </button>

        <span className="zoombar-divider" />

        <button
          className="zoom-btn is-wide"
          title="Fit view (F)"
          aria-label="Zoom to fit"
          onClick={() => canvas.fitAll()}
        >
          <FitIcon size={15} />
        </button>

        <span className="zoombar-divider" />

        <button
          className={`zoom-level ${menuOpen ? "is-open" : ""}`}
          aria-label={`Zoom level ${Math.round(scale * 100)}% — open zoom menu`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="zoom-level-value">{Math.round(scale * 100)}%</span>
          <ChevronDownIcon size={12} />
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="zoom-menu glass"
            role="menu"
            initial={{ y: 6, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 4, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                className="zoom-menu-item"
                role="menuitem"
                onClick={run(item.run)}
              >
                <span>{item.label}</span>
                <span className="kbd">{item.hint}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
