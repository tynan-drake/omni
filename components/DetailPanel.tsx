"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { streamingLinks } from "@/lib/links";
import { withAlpha } from "@/lib/color-utils";
import type { ArtistDetails } from "@/lib/types";
import { fetchDetails } from "@/store/actions";
import { useAudio } from "@/store/audio";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import { CloseIcon, ExternalIcon, PauseIcon, PlayIcon } from "./Icons";

const fmtDuration = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function DetailPanel() {
  const detailFor = useUi((s) => s.detailFor);
  const node = useGraph((s) => (detailFor !== null ? s.nodes[detailFor] : null));

  return (
    <AnimatePresence>
      {node && <Panel key={node.id} nodeId={node.id} />}
    </AnimatePresence>
  );
}

function Panel({ nodeId }: { nodeId: number }) {
  const node = useGraph((s) => s.nodes[nodeId]);
  const [details, setDetails] = useState<ArtistDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const audio = useAudio();

  useEffect(() => {
    let alive = true;
    void fetchDetails(nodeId).then((d) => {
      if (!alive) return;
      if (d) setDetails(d);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [nodeId]);

  if (!node) return null;
  const accent = node.accent;

  return (
    <motion.aside
      className="detail-panel glass scrollbar-slim"
      style={{ "--accent": accent } as React.CSSProperties}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    >
      <div
        className="detail-hero"
        style={{
          backgroundImage: `linear-gradient(to top, ${withAlpha("#0f1322", 0.96)} 0%, ${withAlpha("#0f1322", 0.25)} 55%, transparent 100%), url(${node.pictureBig})`,
        }}
      >
        <button
          className="detail-close"
          aria-label="Close details"
          onClick={() => useUi.getState().openDetail(null)}
        >
          <CloseIcon />
        </button>
        <div className="detail-title">
          <h2>{node.name}</h2>
          <div className="detail-meta">
            {node.era && <span className="detail-era">{node.era}</span>}
            {details && (
              <span>{Intl.NumberFormat("en", { notation: "compact" }).format(details.fans)} fans</span>
            )}
            {details?.startYear && <span>since {details.startYear}</span>}
          </div>
        </div>
      </div>

      {node.reason && <p className="detail-reason">{node.reason}</p>}

      <div className="detail-section">
        <h3>Top tracks</h3>
        {!details && !failed && <div className="detail-loading" />}
        {failed && <p className="detail-empty">Couldn&apos;t load tracks.</p>}
        {details && !details.tracks.length && (
          <p className="detail-empty">No previews available.</p>
        )}
        {details?.tracks.map((track, i) => {
          const isCurrent = audio.track?.id === track.id;
          const playing = isCurrent && audio.playing;
          return (
            <button
              key={track.id}
              className={`track-row ${isCurrent ? "is-current" : ""}`}
              onClick={() => audio.play(track, nodeId, node.name)}
            >
              <span className="track-index">
                {playing ? (
                  <span
                    className="track-progress"
                    style={{
                      background: `conic-gradient(${accent} ${audio.progress * 360}deg, rgba(255,255,255,0.12) 0deg)`,
                    }}
                  >
                    <PauseIcon size={9} />
                  </span>
                ) : isCurrent ? (
                  <PlayIcon size={11} />
                ) : (
                  <>
                    <span className="track-num">{i + 1}</span>
                    <PlayIcon size={11} className="track-play" />
                  </>
                )}
              </span>
              <span className="track-text">
                <span className="track-title">{track.title}</span>
                {track.albumTitle && (
                  <span className="track-album">{track.albumTitle}</span>
                )}
              </span>
              <span className="track-duration">{fmtDuration(track.duration)}</span>
            </button>
          );
        })}
      </div>

      <div className="detail-section">
        <h3>
          <ExternalIcon size={12} /> Open in
        </h3>
        <div className="detail-links">
          {streamingLinks(node.name, node.id).map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noreferrer">
              {l.name}
            </a>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
