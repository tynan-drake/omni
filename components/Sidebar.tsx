"use client";

import { useEffect, useRef, useState } from "react";
import { navigateToArtist } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { hydrateHistory, useHistory } from "@/store/history";
import { useUi } from "@/store/ui";
import ArtistSearch from "./ArtistSearch";
import BridgePanel from "./BridgePanel";
import { CloseIcon, PlaylistIcon } from "./Icons";

/** Stable Home anchor and the two primary exploration actions. */
export default function Sidebar() {
  const hasNodes = useGraph((s) => s.order.length > 0);
  const navPanel = useUi((s) => s.navPanel);
  const playlistOpen = useUi((s) => s.playlistOpen);
  const activeBridge = useGraph((s) => s.activeBridgeId ? s.bridges[s.activeBridgeId] : null);
  const connectingFrom = useUi((s) => s.connectingFrom);
  const search = useRef<HTMLDivElement>(null);

  useEffect(hydrateHistory, []);
  useEffect(() => {
    if (navPanel === "search") {
      search.current?.querySelector<HTMLInputElement>("input")?.focus();
      useUi.getState().setNavPanel(null);
    }
  }, [navPanel]);

  if (!hasNodes) return null;
  const closePanel = () => {
    useUi.getState().setNavPanel(null);
    if (navPanel === "bridges") useUi.getState().cancelConnecting();
    search.current?.querySelector<HTMLInputElement>("input")?.focus();
  };

  return (
    <>
      <button type="button" className="exploration-home glass" data-exploration-home onClick={() => {
        useUi.getState().showDiscovery();
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".resume-exploration")?.focus());
      }}>
        <span className="home-wordmark" aria-hidden="true">O</span> Home
      </button>

      <button type="button" className={`exploration-playlist dock-action glass ${playlistOpen ? "is-active" : ""}`}
        aria-expanded={playlistOpen} aria-controls={playlistOpen ? "playlist-builder" : undefined}
        title="Create playlist (P)" onClick={() => useUi.getState().setPlaylistOpen(!playlistOpen)}>
        <PlaylistIcon size={18} /> Create playlist
      </button>

      <div ref={search} className="canvas-search" onFocus={() => {
        if (useUi.getState().playlistOpen) useUi.getState().setPlaylistOpen(false);
      }}>
        <ArtistSearch variant="discovery" label="Find an artist" placeholder="Find an artist…" idleContent={<RecentArtists />} />
      </div>

      {activeBridge && connectingFrom === null && (
        <aside className="bridge-spotlight glass" aria-label="Bridge spotlight">
          <div className="bridge-spotlight-info">
            <span>Bridge spotlight</span>
            <strong title={activeBridge.name}>{activeBridge.name}</strong>
          </div>
          <button type="button" className="dock-action" onClick={() => {
            useGraph.getState().setActiveBridge(null);
            search.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
          }}>
            <CloseIcon size={16} /> Back to exploration
          </button>
        </aside>
      )}

      {navPanel === "bridges" && <div id="artist-connections" className="nav-flyout glass is-bridges"
        role="region" aria-label="Artist connections" onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closePanel(); }
        }}>
        <header className="nav-flyout-head">
          <h2>Connections</h2>
          <button type="button" className="nav-close" aria-label="Close panel" onClick={closePanel}><CloseIcon size={16} /></button>
        </header>
        <BridgePanel />
      </div>}

    </>
  );
}

function RecentArtists() {
  const entries = useHistory((s) => s.entries);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState("");

  return <div className="nav-flyout-body scrollbar-slim">
    <section className="search-recents" aria-labelledby="recent-artists-heading">
      <div className="recent-artists-header">
        <h3 id="recent-artists-heading">Recent artists</h3>
        {entries.length > 0 && <button type="button" className="nav-flyout-clear" onClick={() => useHistory.getState().clear()}>Clear</button>}
      </div>
      {entries.length === 0 ? <p className="nav-flyout-note">Artists you explore will appear here.</p> : entries.map((entry) =>
        <button type="button" key={entry.id} className="nav-recent-row" disabled={pending !== null} onClick={async () => {
          setPending(entry.id);
          setError("");
          try { await navigateToArtist(entry); }
          catch { setError(`Couldn't open ${entry.name}. Please try again.`); }
          finally { setPending(null); }
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.picture} alt="" />
          <span className="nav-recent-name">{entry.name}</span>
          <span className="nav-recent-hint" aria-hidden="true">↗</span>
        </button>
      )}
    </section>
    <p role="status" className="nav-flyout-note">{error}</p>
  </div>;
}
