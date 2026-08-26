"use client";

import type { Direction } from "@/lib/types";
import { SPLIT_TIMING } from "@/lib/split-formation";

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ?? (window as BrowserWindow).webkitAudioContext;
  if (!AudioContextClass) return null;
  context ??= new AudioContextClass();
  return context;
}

/** Called synchronously from the menu click so Safari permits later playback. */
export function primeSplitAudio(): void {
  const audio = getContext();
  if (audio?.state === "suspended") void audio.resume();
}

function makeNoiseBuffer(audio: AudioContext, seconds: number): AudioBuffer {
  const length = Math.ceil(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < length; i += 1) {
    smooth = smooth * 0.92 + (Math.random() * 2 - 1) * 0.08;
    data[i] = smooth;
  }
  return buffer;
}

/**
 * A quiet, generated "surface tension → watery release" cue. The child tones
 * land within a few milliseconds of one another so a six-way split still
 * reads as one event rather than a sequence of notification sounds.
 */
export function playSplitAudio(childCount: number, direction: Direction): void {
  const audio = getContext();
  if (!audio || audio.state !== "running") return;

  const now = audio.currentTime + 0.025;
  const releaseAt = now + SPLIT_TIMING.membranesRelease / 1000;
  const endAt = now + SPLIT_TIMING.physicsHandoff / 1000 + 0.25;
  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.13, now + 0.12);
  master.gain.setValueAtTime(0.13, releaseAt);
  master.gain.exponentialRampToValueAtTime(0.0001, endAt);
  master.connect(audio.destination);

  const tension = audio.createOscillator();
  const tensionGain = audio.createGain();
  const tensionFilter = audio.createBiquadFilter();
  tension.type = "sine";
  tension.frequency.setValueAtTime(direction === "back" ? 92 : 104, now);
  tension.frequency.exponentialRampToValueAtTime(142, releaseAt);
  tension.frequency.exponentialRampToValueAtTime(76, endAt);
  tensionGain.gain.setValueAtTime(0.055, now);
  tensionFilter.type = "lowpass";
  tensionFilter.frequency.value = 420;
  tension.connect(tensionFilter).connect(tensionGain).connect(master);
  tension.start(now);
  tension.stop(endAt);

  const wash = audio.createBufferSource();
  const washFilter = audio.createBiquadFilter();
  const washGain = audio.createGain();
  wash.buffer = makeNoiseBuffer(audio, endAt - now);
  washFilter.type = "bandpass";
  washFilter.frequency.setValueAtTime(520, now);
  washFilter.frequency.exponentialRampToValueAtTime(1380, releaseAt);
  washFilter.Q.value = 0.72;
  washGain.gain.setValueAtTime(0.0001, now);
  washGain.gain.exponentialRampToValueAtTime(0.034, releaseAt);
  washGain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  wash.connect(washFilter).connect(washGain).connect(master);
  wash.start(now);
  wash.stop(endAt);

  const audibleChildren = Math.max(1, Math.min(childCount, 6));
  for (let index = 0; index < audibleChildren; index += 1) {
    const offset = (index - (audibleChildren - 1) / 2) * 0.012;
    const plopAt = releaseAt + offset;
    const plop = audio.createOscillator();
    const plopGain = audio.createGain();
    plop.type = "sine";
    plop.frequency.setValueAtTime(238 + index * 17, plopAt);
    plop.frequency.exponentialRampToValueAtTime(112 + index * 6, plopAt + 0.22);
    plopGain.gain.setValueAtTime(0.0001, plopAt);
    plopGain.gain.exponentialRampToValueAtTime(0.036, plopAt + 0.018);
    plopGain.gain.exponentialRampToValueAtTime(0.0001, plopAt + 0.27);
    plop.connect(plopGain).connect(master);
    plop.start(plopAt);
    plop.stop(plopAt + 0.3);
  }
}
