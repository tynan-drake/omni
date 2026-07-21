"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  exportToSpotify,
  spotifyConfigured,
  type ExportProgress,
  type ExportResult,
} from "@/lib/export/spotify";
import type { PlaylistMode, PlaylistTrack } from "@/lib/types";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import { CloseIcon, PlaylistIcon } from "./Icons";

interface TrackPool {
  artistId: number;
  artistName: string;
  tracks: PlaylistTrack[];
}

const LENGTHS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
];

const MODES: Array<{ label: string; mode: PlaylistMode }> = [
  { label: "Popular", mode: "popular" },
  { label: "Deep cuts", mode: "deep" },
  { label: "Mixed", mode: "mixed" },
];

const fmtDuration = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function PlaylistBuilder() {
  const open = useUi((s) => s.playlistOpen);
  return (
    <AnimatePresence>{open && <Builder key="playlist" />}</AnimatePresence>
  );
}

function Builder() {
  const nodes = useGraph((s) => s.nodes);
  const order = useGraph((s) => s.order);
  const [minutes, setMinutes] = useState(60);
  const [mode, setMode] = useState<PlaylistMode>("mixed");
  const [tracks, setTracks] = useState<PlaylistTrack[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const artists = order.filter((id) => nodes[id]);
  const seedName =
    order.map((id) => nodes[id]).find((n) => n?.kind === "seed")?.name ??
    (artists.length ? nodes[artists[0]]?.name : "canvas");
  const playlistName = `Omni — ${seedName} universe`;

  const generate = async () => {
    setGenerating(true);
    setTracks(null);
    setResult(null);
    setProgress(null);
    try {
      const pools = (
        await Promise.all(
          artists.map(async (id) => {
            try {
              const res = await fetch(`/api/tracks?id=${id}&mode=${mode}`);
              return res.ok ? ((await res.json()) as TrackPool) : null;
            } catch {
              return null;
            }
          })
        )
      ).filter((p): p is TrackPool => Boolean(p?.tracks.length));

      const targetSec = minutes * 60;
      const picked: PlaylistTrack[] = [];
      const cursors = pools.map(() => 0);
      let totalSec = 0;
      let poolIdx = 0;
      let exhausted = 0;
      while (totalSec < targetSec && exhausted < pools.length) {
        const i = poolIdx % pools.length;
        poolIdx++;
        const pool = pools[i];
        const cursor = cursors[i];
        if (cursor >= pool.tracks.length) {
          if (cursor === pool.tracks.length) {
            exhausted++;
            cursors[i]++;
          }
          continue;
        }
        cursors[i]++;
        const track = pool.tracks[cursor];
        picked.push(track);
        totalSec += track.duration;
      }
      setTracks(picked);
    } finally {
      setGenerating(false);
    }
  };

  const copyList = async () => {
    if (!tracks) return;
    const text = tracks.map((t) => `${t.artistName} — ${t.title}`).join("\n");
    await navigator.clipboard.writeText(text);
    useUi.getState().showToast("Track list copied to clipboard");
  };

  const doExport = async () => {
    if (!tracks?.length) return;
    setResult(null);
    try {
      const res = await exportToSpotify(
        playlistName,
        `An influence universe traced on Omni — ${artists.length} artists.`,
        tracks,
        setProgress
      );
      setResult(res);
      setProgress(null);
    } catch (err) {
      setProgress(null);
      useUi
        .getState()
        .showToast(err instanceof Error ? err.message : "Spotify export failed");
    }
  };

  const totalSec = tracks?.reduce((s, t) => s + t.duration, 0) ?? 0;

  return (
    <motion.aside
      className="playlist-panel glass"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    >
      <div className="playlist-header">
        <h2>
          <PlaylistIcon /> Playlist from this universe
        </h2>
        <button
          aria-label="Close playlist builder"
          onClick={() => useUi.getState().setPlaylistOpen(false)}
        >
          <CloseIcon />
        </button>
      </div>

      <p className="playlist-sub">
        {artists.length} artist{artists.length === 1 ? "" : "s"} on the canvas ·{" "}
        {playlistName}
      </p>

      <div className="playlist-params">
        <div className="segmented">
          {LENGTHS.map((l) => (
            <button
              key={l.minutes}
              className={minutes === l.minutes ? "is-active" : ""}
              onClick={() => setMinutes(l.minutes)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          {MODES.map((m) => (
            <button
              key={m.mode}
              className={mode === m.mode ? "is-active" : ""}
              onClick={() => setMode(m.mode)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="playlist-generate"
        disabled={generating || artists.length === 0}
        onClick={() => void generate()}
      >
        {generating
          ? "Curating…"
          : tracks
            ? "Regenerate"
            : "Generate playlist"}
      </button>

      {tracks && (
        <>
          <div className="playlist-total">
            {tracks.length} tracks · {Math.round(totalSec / 60)} min
          </div>
          <div className="playlist-list scrollbar-slim">
            {tracks.map((t, i) => (
              <div key={`${t.id}-${i}`} className="playlist-row">
                {t.cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={t.cover} alt="" />
                ) : (
                  <span className="playlist-cover-fallback" />
                )}
                <span className="track-text">
                  <span className="track-title">{t.title}</span>
                  <span className="track-album">{t.artistName}</span>
                </span>
                <span className="track-duration">{fmtDuration(t.duration)}</span>
              </div>
            ))}
          </div>

          <div className="playlist-actions">
            {spotifyConfigured() && (
              <button
                className="playlist-export"
                disabled={Boolean(progress)}
                onClick={() => void doExport()}
              >
                {progress
                  ? progress.phase === "matching"
                    ? `Matching ${progress.matched}/${progress.total}…`
                    : progress.phase === "creating"
                      ? "Creating playlist…"
                      : "Connecting…"
                  : "Export to Spotify"}
              </button>
            )}
            <button className="playlist-copy" onClick={() => void copyList()}>
              Copy list
            </button>
          </div>
          {!spotifyConfigured() && (
            <p className="playlist-note">
              Add <code>NEXT_PUBLIC_SPOTIFY_CLIENT_ID</code> to .env.local to
              export straight to Spotify.
            </p>
          )}
          {result && (
            <a
              className="playlist-result"
              href={result.url}
              target="_blank"
              rel="noreferrer"
            >
              Playlist created — {result.matched}/{result.total} tracks matched.
              Open in Spotify ↗
            </a>
          )}
        </>
      )}
    </motion.aside>
  );
}
