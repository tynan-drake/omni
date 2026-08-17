"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { canvas } from "@/lib/canvas-controller";
import { seedFromSearch } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { hydrateHistory, useHistory } from "@/store/history";
import { useUi, type NavPanel } from "@/store/ui";
import ArtistSearch from "./ArtistSearch";
import { AudioIcon, HelpIcon, HistoryIcon, NavSearchIcon } from "./Icons";

/** Persistent left nav rail: brand/home, workflow tools, help pinned to the foot. */
export default function Sidebar() {
  const navPanel = useUi((s) => s.navPanel);
  const playlistOpen = useUi((s) => s.playlistOpen);
  const toggleNavPanel = useUi((s) => s.toggleNavPanel);

  useEffect(hydrateHistory, []);

  const goHome = () => {
    useGraph.getState().reset();
    useUi.getState().closeAll();
  };

  return (
    <>
      <nav className="nav-rail" aria-label="Main">
        <button
          className="nav-logo"
          title="Home — back to the start"
          aria-label="Home"
          onClick={goHome}
        >
          O
        </button>

        <div className="nav-tools">
          <NavButton
            panel="search"
            active={navPanel === "search"}
            label="Search artists  ( / )"
            onClick={() => toggleNavPanel("search")}
          >
            <NavSearchIcon />
          </NavButton>
          <NavButton
            panel="recent"
            active={navPanel === "recent"}
            label="Recent artists"
            onClick={() => toggleNavPanel("recent")}
          >
            <HistoryIcon />
          </NavButton>
          <NavButton
            active={playlistOpen}
            label="Playlist from this universe  ( P )"
            onClick={() => {
              useUi.getState().setNavPanel(null);
              useUi.getState().setPlaylistOpen(!playlistOpen);
            }}
          >
            <AudioIcon />
          </NavButton>
        </div>

        <div className="nav-foot">
          <NavButton
            label="Help & keyboard shortcuts  ( ? )"
            onClick={() => useUi.getState().setShortcutsOpen(true)}
          >
            <HelpIcon />
          </NavButton>
        </div>
      </nav>

      <AnimatePresence>
        {navPanel && <NavFlyout key={navPanel} panel={navPanel} />}
      </AnimatePresence>
    </>
  );
}

interface NavButtonProps {
  panel?: NavPanel;
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

function NavButton({ panel, active, label, onClick, children }: NavButtonProps) {
  return (
    <button
      className={`nav-btn ${active ? "is-active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-expanded={panel ? active : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NavFlyout({ panel }: { panel: NavPanel }) {
  return (
    <motion.div
      className="nav-flyout glass"
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -12, opacity: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 36 }}
    >
      {panel === "search" ? <SearchPanel /> : <RecentPanel />}
    </motion.div>
  );
}

function SearchPanel() {
  return (
    <>
      <header className="nav-flyout-head">
        <h2>Search</h2>
      </header>
      <div className="nav-flyout-body">
        <ArtistSearch variant="panel" placeholder="Search any artist…" autoFocus />
        <p className="nav-flyout-note">
          Pick an artist to drop them on the canvas, then expand backward to their
          roots or forward to who they shaped.
        </p>
      </div>
    </>
  );
}

function RecentPanel() {
  const entries = useHistory((s) => s.entries);
  const nodes = useGraph((s) => s.nodes);

  return (
    <>
      <header className="nav-flyout-head">
        <h2>Recent</h2>
        {entries.length > 0 && (
          <button className="nav-flyout-clear" onClick={() => useHistory.getState().clear()}>
            Clear
          </button>
        )}
      </header>
      <div className="nav-flyout-body scrollbar-slim">
        {entries.length === 0 ? (
          <p className="nav-flyout-note">
            Artists you search for show up here, so you can pick a thread back up
            later.
          </p>
        ) : (
          entries.map((entry) => {
            const onCanvas = Boolean(nodes[entry.id]);
            return (
              <button
                key={entry.id}
                className="nav-recent-row"
                onClick={() => {
                  if (onCanvas) {
                    useGraph.getState().select(entry.id);
                    canvas.flyTo(entry.id);
                  } else {
                    void seedFromSearch(entry).then(() =>
                      setTimeout(() => canvas.fitAll(), 450)
                    );
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.picture} alt="" />
                <span className="nav-recent-name">{entry.name}</span>
                <span className="nav-recent-hint">
                  {onCanvas ? "fly to" : "add"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
