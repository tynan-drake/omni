"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAudio } from "@/store/audio";
import { useGraph } from "@/store/graph";
import { CloseIcon, PauseIcon, PlayIcon } from "./Icons";

export default function NowPlaying() {
  const audio = useAudio();
  const accent = useGraph((s) =>
    audio.artistId !== null ? s.nodes[audio.artistId]?.accent : undefined
  );

  return (
    <AnimatePresence>
      {audio.track && (
        <motion.div
          key="now-playing"
          className="now-playing glass"
          style={{ "--accent": accent ?? "var(--brand)" } as React.CSSProperties}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <button
            className="np-toggle"
            aria-label={audio.playing ? "Pause" : "Play"}
            onClick={() => audio.toggle()}
          >
            {audio.playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
          </button>
          <div className="np-text">
            <span className="np-title">{audio.track.title}</span>
            <span className="np-artist">{audio.artistName}</span>
          </div>
          <button
            className="np-close"
            aria-label="Stop preview"
            onClick={() => audio.stop()}
          >
            <CloseIcon size={12} />
          </button>
          <div className="np-bar">
            <div
              className="np-bar-fill"
              style={{ width: `${audio.progress * 100}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
