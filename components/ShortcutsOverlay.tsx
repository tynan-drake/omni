"use client";

import { AnimatePresence, motion } from "motion/react";
import { useUi } from "@/store/ui";
import { CloseIcon } from "./Icons";

const GROUPS: Array<{ title: string; rows: Array<[string[], string]> }> = [
  {
    title: "Navigate",
    rows: [
      [["⌘", "K"], "Search the canvas / run actions"],
      [["F"], "Fit the whole universe in view"],
      [["+", "−"], "Zoom in / out"],
      [["drag"], "Pan the canvas · drag orbs to rearrange"],
    ],
  },
  {
    title: "Explore",
    rows: [
      [["/"], "Add an artist to the canvas"],
      [["R"], "Expand roots of the selected artist"],
      [["B"], "Expand branches of the selected artist"],
      [["esc"], "Close menus & deselect"],
    ],
  },
  {
    title: "Listen",
    rows: [
      [["space"], "Play / pause the current preview"],
      [["P"], "Build a playlist from this universe"],
    ],
  },
];

export default function ShortcutsOverlay() {
  const open = useUi((s) => s.shortcutsOpen);
  const close = () => useUi.getState().setShortcutsOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="shortcuts"
          className="palette-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={close}
        >
          <motion.div
            className="shortcuts glass"
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shortcuts-header">
              <h2>Keyboard shortcuts</h2>
              <button aria-label="Close" onClick={close}>
                <CloseIcon />
              </button>
            </div>
            <div className="shortcuts-grid">
              {GROUPS.map((g) => (
                <div key={g.title} className="shortcuts-group">
                  <h3>{g.title}</h3>
                  {g.rows.map(([keys, label]) => (
                    <div key={label} className="shortcuts-row">
                      <span className="shortcuts-keys">
                        {keys.map((k) => (
                          <span key={k} className="kbd">
                            {k}
                          </span>
                        ))}
                      </span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
