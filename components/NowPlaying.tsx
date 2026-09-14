"use client";

import { neutralizePurple } from "@/lib/color-utils";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image, { type ImageLoaderProps } from "next/image";
import { readAudioSpectrum, useAudio } from "@/store/audio";
import { useGraph } from "@/store/graph";
import { CloseIcon, PauseIcon, PlayIcon } from "./Icons";

const WAVE_HEIGHTS = [
  "h-1",
  "h-2",
  "h-3",
  "h-4",
  "h-5",
  "h-6",
  "h-7",
  "h-8",
  "h-9",
  "h-10",
  "h-12",
] as const;
const WAVE_BARS = Array.from({ length: 40 }, (_, index) => index);
const RESTING_SPECTRUM = WAVE_BARS.map(() => 0);
const deezerCoverLoader = ({ src }: ImageLoaderProps) => src;

export default function NowPlaying() {
  const audio = useAudio();
  const [spectrum, setSpectrum] = useState(RESTING_SPECTRUM);
  const accent = useGraph((s) =>
    audio.artistId !== null ? s.nodes[audio.artistId]?.accent : undefined
  );

  useEffect(() => {
    if (!audio.playing) return;

    let frame = 0;
    let lastSample = 0;
    const sampleAudio = (time: number) => {
      if (time - lastSample >= 33) {
        setSpectrum(readAudioSpectrum(WAVE_BARS.length));
        lastSample = time;
      }
      frame = requestAnimationFrame(sampleAudio);
    };
    frame = requestAnimationFrame(sampleAudio);
    return () => cancelAnimationFrame(frame);
  }, [audio.playing, audio.track?.id]);

  const waveHeight = (index: number) => {
    if (!audio.playing) return "h-1";
    const heightIndex = Math.min(
      WAVE_HEIGHTS.length - 1,
      Math.round((spectrum[index] ?? 0) * (WAVE_HEIGHTS.length - 1))
    );
    return WAVE_HEIGHTS[heightIndex];
  };

  return (
    <AnimatePresence>
      {audio.track && (
        <motion.div
          key="now-playing"
          className="now-playing glass"
          style={{ "--accent": accent ? neutralizePurple(accent) : "var(--brand)" } as React.CSSProperties}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center gap-px overflow-hidden px-2 opacity-10"
          >
            {WAVE_BARS.map((index) => (
              <span
                key={index}
                className={`w-1 rounded-full bg-white transition-[height] duration-75 ease-out ${waveHeight(index)}`}
              />
            ))}
          </div>
          {audio.track.cover && (
            <div className="group/record relative z-10 h-11 w-11 shrink-0">
              <div
                className={`relative h-full w-full animate-[spin_6s_linear_infinite] rounded-full bg-black p-1 shadow-lg ring-1 ring-white/10 motion-reduce:animate-none ${audio.playing ? "[animation-play-state:running]" : "[animation-play-state:paused]"}`}
              >
                <Image
                  loader={deezerCoverLoader}
                  src={audio.track.cover}
                  alt={`${audio.track.albumTitle ?? audio.track.title} cover`}
                  width={36}
                  height={36}
                  className="h-full w-full rounded-full object-cover"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-1 rounded-full bg-gradient-to-br from-white/20 via-transparent to-white/10"
                />
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-1 ring-white/30"
                />
              </div>
              <button
                type="button"
                className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-150 group-hover/record:opacity-100 group-focus-within/record:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.96] motion-reduce:transition-none"
                aria-label={audio.playing ? "Pause" : "Play"}
                onClick={() => audio.toggle()}
              >
                {audio.playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
              </button>
            </div>
          )}
          {!audio.track.cover && (
            <button
              type="button"
              className="np-toggle relative z-10"
              aria-label={audio.playing ? "Pause" : "Play"}
              onClick={() => audio.toggle()}
            >
              {audio.playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
            </button>
          )}
          <div className="np-text relative z-10">
            <span className="np-title">{audio.track.title}</span>
            <span className="np-artist">{audio.artistName}</span>
          </div>
          <button
            type="button"
            className="np-close relative z-20 -m-2 items-center justify-center rounded-full p-2 hover:bg-white/10 hover:text-white"
            aria-label="Stop preview"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              audio.stop();
            }}
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
