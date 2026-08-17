"use client";

import { create } from "zustand";
import type { ArtistRef } from "@/lib/types";

export interface HistoryEntry extends ArtistRef {
  /** epoch ms of the most recent visit */
  at: number;
}

const KEY = "omni:recent";
const LIMIT = 24;

interface HistoryState {
  entries: HistoryEntry[];
  /** Record a visit; re-visiting an artist moves it back to the top. */
  visit: (artist: ArtistRef) => void;
  remove: (id: number) => void;
  clear: () => void;
}

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* private mode / quota — history is a nicety, not worth surfacing */
  }
}

export const useHistory = create<HistoryState>((set) => ({
  // Hydrated in an effect (see Sidebar) so server and first client render match.
  entries: [],

  visit: (artist) =>
    set((s) => {
      const entries = [
        { ...artist, at: Date.now() },
        ...s.entries.filter((e) => e.id !== artist.id),
      ].slice(0, LIMIT);
      save(entries);
      return { entries };
    }),

  remove: (id) =>
    set((s) => {
      const entries = s.entries.filter((e) => e.id !== id);
      save(entries);
      return { entries };
    }),

  clear: () => {
    save([]);
    return set({ entries: [] });
  },
}));

/** Read persisted history off localStorage — call once, client-side. */
export function hydrateHistory(): void {
  const stored = load();
  if (stored.length) useHistory.setState({ entries: stored });
}
