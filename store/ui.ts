"use client";

import { create } from "zustand";
import type { Direction, NodeKind } from "@/lib/types";

export interface FilterState {
  /** node kinds to show; empty set = show all */
  kinds: Set<NodeKind>;
  /** decades to show (e.g. 1990); empty set = show all */
  decades: Set<number>;
}

/** Flyout panels hung off the left nav rail; only one is open at a time. */
export type NavPanel = "search" | "recent";

interface UiState {
  /** node id whose action menu is open */
  menuFor: number | null;
  /** which nav rail flyout is open, if any */
  navPanel: NavPanel | null;
  /** node id whose detail panel is open */
  detailFor: number | null;
  paletteOpen: boolean;
  playlistOpen: boolean;
  shortcutsOpen: boolean;
  /** node id + direction currently loading a lineage expansion */
  expanding: Record<string, boolean>;
  filter: FilterState;
  toast: string | null;

  openMenu: (id: number | null) => void;
  setNavPanel: (panel: NavPanel | null) => void;
  toggleNavPanel: (panel: NavPanel) => void;
  openDetail: (id: number | null) => void;
  setPaletteOpen: (open: boolean) => void;
  setPlaylistOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setExpanding: (id: number, direction: Direction, loading: boolean) => void;
  toggleKindFilter: (kind: NodeKind) => void;
  toggleDecadeFilter: (decade: number) => void;
  clearFilters: () => void;
  showToast: (message: string) => void;
  closeAll: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUi = create<UiState>((set) => ({
  menuFor: null,
  navPanel: null,
  detailFor: null,
  paletteOpen: false,
  playlistOpen: false,
  shortcutsOpen: false,
  expanding: {},
  filter: { kinds: new Set(), decades: new Set() },
  toast: null,

  openMenu: (id) => set({ menuFor: id }),
  setNavPanel: (panel) => set({ navPanel: panel }),
  toggleNavPanel: (panel) =>
    set((s) => ({ navPanel: s.navPanel === panel ? null : panel })),
  openDetail: (id) =>
    set({ detailFor: id, menuFor: null, ...(id !== null && { playlistOpen: false }) }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setPlaylistOpen: (open) =>
    set({ playlistOpen: open, ...(open && { detailFor: null }) }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  setExpanding: (id, direction, loading) =>
    set((s) => ({
      expanding: { ...s.expanding, [`${id}:${direction}`]: loading },
    })),

  toggleKindFilter: (kind) =>
    set((s) => {
      const kinds = new Set(s.filter.kinds);
      if (kinds.has(kind)) kinds.delete(kind);
      else kinds.add(kind);
      return { filter: { ...s.filter, kinds } };
    }),

  toggleDecadeFilter: (decade) =>
    set((s) => {
      const decades = new Set(s.filter.decades);
      if (decades.has(decade)) decades.delete(decade);
      else decades.add(decade);
      return { filter: { ...s.filter, decades } };
    }),

  clearFilters: () => set({ filter: { kinds: new Set(), decades: new Set() } }),

  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 3200);
  },

  closeAll: () =>
    set({
      menuFor: null,
      navPanel: null,
      detailFor: null,
      paletteOpen: false,
      playlistOpen: false,
      shortcutsOpen: false,
    }),
}));

/** Does a node pass the active filters? */
export function nodeMatchesFilter(
  filter: FilterState,
  node: { kind: NodeKind; decade: number | null }
): boolean {
  if (filter.kinds.size && !filter.kinds.has(node.kind)) return false;
  if (filter.decades.size) {
    if (node.decade === null) return false;
    if (!filter.decades.has(node.decade)) return false;
  }
  return true;
}
