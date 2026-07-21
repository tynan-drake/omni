"use client";

import { create } from "zustand";
import type { Track } from "@/lib/types";

interface AudioState {
  track: Track | null;
  artistId: number | null;
  artistName: string | null;
  playing: boolean;
  /** 0..1 through the 30s preview */
  progress: number;

  play: (track: Track, artistId: number, artistName: string) => void;
  toggle: () => void;
  stop: () => void;
}

let audioEl: HTMLAudioElement | null = null;

function ensureAudio(
  set: (partial: Partial<AudioState>) => void
): HTMLAudioElement {
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.addEventListener("timeupdate", () => {
    if (!audioEl || !audioEl.duration) return;
    set({ progress: audioEl.currentTime / audioEl.duration });
  });
  audioEl.addEventListener("ended", () => set({ playing: false, progress: 0 }));
  audioEl.addEventListener("error", () => set({ playing: false }));
  return audioEl;
}

export const useAudio = create<AudioState>((set, get) => ({
  track: null,
  artistId: null,
  artistName: null,
  playing: false,
  progress: 0,

  play: (track, artistId, artistName) => {
    const el = ensureAudio(set);
    const current = get().track;
    if (current?.id === track.id && get().playing) {
      el.pause();
      set({ playing: false });
      return;
    }
    if (current?.id !== track.id) {
      el.src = track.preview;
      set({ track, artistId, artistName, progress: 0 });
    }
    void el.play().then(
      () => set({ playing: true }),
      () => set({ playing: false })
    );
  },

  toggle: () => {
    const el = ensureAudio(set);
    if (!get().track) return;
    if (get().playing) {
      el.pause();
      set({ playing: false });
    } else {
      void el.play().then(() => set({ playing: true }));
    }
  },

  stop: () => {
    audioEl?.pause();
    if (audioEl) audioEl.currentTime = 0;
    set({ playing: false, progress: 0 });
  },
}));
