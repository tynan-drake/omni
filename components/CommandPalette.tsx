"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { canvas } from "@/lib/canvas-controller";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import { FitIcon, PlaylistIcon, SearchIcon, SparkleIcon } from "./Icons";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  picture?: string;
  run: () => void;
}

export default function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  return <AnimatePresence>{open && <Palette key="palette" />}</AnimatePresence>;
}

function Palette() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useGraph((s) => s.nodes);
  const order = useGraph((s) => s.order);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = () => useUi.getState().setPaletteOpen(false);

  const commands = useMemo<Command[]>(() => {
    const artistCommands: Command[] = order
      .filter((id) => nodes[id])
      .map((id) => ({
        id: `artist-${id}`,
        label: nodes[id].name,
        hint: "fly to",
        picture: nodes[id].picture,
        run: () => {
          useGraph.getState().select(id);
          canvas.flyTo(id);
        },
      }));

    const actionCommands: Command[] = [
      {
        id: "fit",
        label: "Fit view",
        hint: "F",
        icon: <FitIcon />,
        run: () => canvas.fitAll(),
      },
      {
        id: "playlist",
        label: "Create playlist from universe",
        hint: "P",
        icon: <PlaylistIcon />,
        run: () => useUi.getState().setPlaylistOpen(true),
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        hint: "?",
        icon: <SparkleIcon />,
        run: () => useUi.getState().setShortcutsOpen(true),
      },
      {
        id: "clear-filters",
        label: "Clear filters",
        icon: <SparkleIcon />,
        run: () => useUi.getState().clearFilters(),
      },
      {
        id: "reset",
        label: "Reset canvas (start over)",
        icon: <SparkleIcon />,
        run: () => {
          useGraph.getState().reset();
          useUi.getState().closeAll();
        },
      },
    ];

    return [...artistCommands, ...actionCommands];
  }, [nodes, order]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0));

  const run = (c: Command) => {
    close();
    c.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(matches.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % Math.max(matches.length, 1));
    } else if (e.key === "Enter" && matches[activeIndex]) {
      e.preventDefault();
      run(matches[activeIndex]);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <motion.div
      className="palette-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={close}
    >
      <motion.div
        className="palette glass"
        initial={{ scale: 0.96, y: -8, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.97, y: -6, opacity: 0 }}
        transition={{ type: "spring", stiffness: 460, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-field">
          <SearchIcon size={15} className="search-glyph" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Jump to an artist on the canvas, or run an action…"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list scrollbar-slim">
          {matches.length === 0 && (
            <div className="palette-empty">Nothing matches “{query}”.</div>
          )}
          {matches.map((c, i) => (
            <button
              key={c.id}
              className={`palette-item ${i === activeIndex ? "is-active" : ""}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => run(c)}
            >
              {c.picture ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={c.picture} alt="" />
              ) : (
                <span className="palette-icon">{c.icon}</span>
              )}
              <span className="palette-label">{c.label}</span>
              {c.hint && <span className="palette-hint">{c.hint}</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
