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
let sourceRequest = 0;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let spectrumData: Uint8Array<ArrayBuffer> | null = null;

function ensureAnalyser(el: HTMLAudioElement): void {
  if (analyser) {
    if (audioContext?.state === "suspended") void audioContext.resume();
    return;
  }

  try {
    audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(el);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -18;
    analyser.smoothingTimeConstant = 0.55;
    spectrumData = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch {
    audioContext = null;
    analyser = null;
    spectrumData = null;
  }
}

/** Return normalized live frequency energy grouped into visualizer bands. */
export function readAudioSpectrum(bandCount: number): number[] {
  if (!analyser || !spectrumData || bandCount <= 0) {
    return Array.from({ length: Math.max(0, bandCount) }, () => 0);
  }

  analyser.getByteFrequencyData(spectrumData);
  const usableBins = Math.min(spectrumData.length, 96);
  return Array.from({ length: bandCount }, (_, band) => {
    const start = Math.floor(Math.pow(band / bandCount, 1.8) * usableBins);
    const end = Math.max(
      start + 1,
      Math.floor(Math.pow((band + 1) / bandCount, 1.8) * usableBins)
    );
    let energySquared = 0;
    let peak = 0;
    for (let index = start; index < Math.min(end, usableBins); index += 1) {
      const value = spectrumData?.[index] ?? 0;
      energySquared += value * value;
      peak = Math.max(peak, value);
    }
    const binCount = Math.max(1, Math.min(end, usableBins) - start);
    const rms = Math.sqrt(energySquared / binCount);
    const energy = (rms * 0.72 + peak * 0.28) / 255;
    return Math.min(1, Math.max(0, (Math.pow(energy, 0.72) - 0.08) * 1.32));
  });
}

function ensureAudio(
  set: (partial: Partial<AudioState>) => void
): HTMLAudioElement {
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.crossOrigin = "anonymous";
  audioEl.preload = "none";
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
    ensureAnalyser(el);
    const current = get().track;
    if (current?.id === track.id && get().playing) {
      el.pause();
      set({ playing: false });
      return;
    }
    if (current?.id !== track.id) {
      set({ track, artistId, artistName, progress: 0 });
    }

    const request = ++sourceRequest;
    void fetch(`/api/preview/${track.id}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`preview HTTP ${response.status}`);
        const result = (await response.json()) as { preview?: string };
        if (!result.preview) throw new Error("preview unavailable");
        if (request !== sourceRequest) return;
        el.src = result.preview;
        if (audioContext?.state === "suspended") await audioContext.resume();
        await el.play();
        if (request === sourceRequest) set({ playing: true });
      })
      .catch(() => {
        if (request === sourceRequest) set({ playing: false });
      });
  },

  toggle: () => {
    const el = ensureAudio(set);
    ensureAnalyser(el);
    if (!get().track) return;
    if (get().playing) {
      el.pause();
      set({ playing: false });
    } else {
      void audioContext?.resume().then(() => el.play()).then(
        () => set({ playing: true }),
        () => set({ playing: false })
      );
    }
  },

  stop: () => {
    sourceRequest += 1;
    audioEl?.pause();
    if (audioEl) audioEl.currentTime = 0;
    set({
      track: null,
      artistId: null,
      artistName: null,
      playing: false,
      progress: 0,
    });
  },
}));
