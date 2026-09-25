"use client";

import { create } from "zustand";
import type { ArtistRef, BridgeMode, Direction, NodeKind } from "@/lib/types";

export interface FilterState {
  /** node kinds to show; empty set = show all */
  kinds: Set<NodeKind>;
  /** decades to show (e.g. 1990); empty set = show all */
  decades: Set<number>;
}

/** Navigation panels; only one is open at a time. */
export type NavPanel = "search" | "bridges";
export type CanvasTool = "pan" | "select";

export interface CanvasContextMenuState {
  x: number;
  y: number;
  nodeIds: number[];
  target: "artists" | "canvas";
}

export interface BridgeRequestState {
  fromId: number;
  target: ArtistRef;
  mode: BridgeMode;
  status: "loading" | "no_path" | "error";
  message: string;
}

export interface SplitFormationState {
  id: number;
  startedAt: number;
  parentId: number;
  direction: Direction;
  childIds: number[];
  stage: number;
}

interface UiState {
  discoveryOpen: boolean;
  showDiscovery: () => void;
  resumeExploration: () => void;
  /** node id whose action menu is open */
  menuFor: number | null;
  /** which navigation panel is open, if any */
  navPanel: NavPanel | null;
  /** node id whose detail panel is open */
  detailFor: number | null;
  paletteOpen: boolean;
  playlistOpen: boolean;
  /** null means the whole canvas; otherwise a frozen selected-artist scope. */
  playlistArtistIds: number[] | null;
  shortcutsOpen: boolean;
  canvasTool: CanvasTool;
  canvasContextMenu: CanvasContextMenuState | null;
  /** node id + direction currently loading a lineage expansion */
  expanding: Record<string, boolean>;
  filter: FilterState;
  toast: string | null;
  connectingFrom: number | null;
  bridgeRequest: BridgeRequestState | null;
  /** Ephemeral hero animation that joins a lineage parent to its new children. */
  splitFormation: SplitFormationState | null;

  openMenu: (id: number | null) => void;
  setNavPanel: (panel: NavPanel | null) => void;
  toggleNavPanel: (panel: NavPanel) => void;
  openDetail: (id: number | null) => void;
  setPaletteOpen: (open: boolean) => void;
  setPlaylistOpen: (open: boolean) => void;
  openPlaylistFor: (ids: number[]) => void;
  setShortcutsOpen: (open: boolean) => void;
  setCanvasTool: (tool: CanvasTool) => void;
  openCanvasContextMenu: (menu: CanvasContextMenuState | null) => void;
  setExpanding: (id: number, direction: Direction, loading: boolean) => void;
  toggleKindFilter: (kind: NodeKind) => void;
  toggleDecadeFilter: (decade: number) => void;
  clearFilters: () => void;
  showToast: (message: string) => void;
  closeAll: () => void;
  startConnecting: (id: number) => void;
  cancelConnecting: () => void;
  setBridgeRequest: (request: BridgeRequestState | null) => void;
  beginSplitFormation: (
    parentId: number,
    direction: Direction,
    childIds: number[]
  ) => number;
  setSplitFormationStage: (id: number, stage: number) => void;
  finishSplitFormation: (id: number) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let splitId = 0;

export const useUi = create<UiState>((set, get) => ({
  discoveryOpen: false,
  showDiscovery: () => {
    get().closeAll();
    set({ discoveryOpen: true, canvasTool: "pan" });
  },
  resumeExploration: () => set({ discoveryOpen: false }),
  menuFor: null,
  navPanel: null,
  detailFor: null,
  paletteOpen: false,
  playlistOpen: false,
  playlistArtistIds: null,
  shortcutsOpen: false,
  canvasTool: "pan",
  canvasContextMenu: null,
  expanding: {},
  filter: { kinds: new Set(), decades: new Set() },
  toast: null,
  connectingFrom: null,
  bridgeRequest: null,
  splitFormation: null,

  openMenu: (id) =>
    set({
      menuFor: id,
      detailFor: null,
      ...(id !== null && { canvasContextMenu: null }),
    }),
  setNavPanel: (panel) => set({ navPanel: panel, ...(panel && { playlistOpen: false }) }),
  toggleNavPanel: (panel) =>
    set((s) => ({ navPanel: s.navPanel === panel ? null : panel, playlistOpen: false })),
  openDetail: (id) =>
    set({
      detailFor: id,
      ...(id !== null && {
        menuFor: id,
        playlistOpen: false,
        playlistArtistIds: null,
      }),
    }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setPlaylistOpen: (open) =>
    set({
      playlistOpen: open,
      playlistArtistIds: null,
      ...(open && { navPanel: null, detailFor: null, canvasContextMenu: null }),
    }),
  openPlaylistFor: (ids) =>
    set({
      playlistOpen: true,
      playlistArtistIds: [...new Set(ids)],
      navPanel: null,
      detailFor: null,
      canvasContextMenu: null,
    }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setCanvasTool: (canvasTool) => set({ canvasTool, canvasContextMenu: null }),
  openCanvasContextMenu: (canvasContextMenu) =>
    set({ canvasContextMenu, ...(canvasContextMenu && { menuFor: null }) }),

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
      playlistArtistIds: null,
      shortcutsOpen: false,
      canvasContextMenu: null,
      connectingFrom: null,
      bridgeRequest: null,
    }),

  startConnecting: (id) =>
    set({
      connectingFrom: id,
      playlistOpen: false,
      navPanel: null,
      menuFor: null,
      detailFor: null,
      canvasContextMenu: null,
      bridgeRequest: null,
    }),
  cancelConnecting: () => set({ connectingFrom: null, bridgeRequest: null }),
  setBridgeRequest: (bridgeRequest) => set({ bridgeRequest }),
  beginSplitFormation: (parentId, direction, childIds) => {
    const id = ++splitId;
    set({
      splitFormation: {
        id,
        startedAt: performance.now(),
        parentId,
        direction,
        childIds: [...childIds],
        stage: 1,
      },
    });
    return id;
  },
  setSplitFormationStage: (id, stage) =>
    set((state) =>
      state.splitFormation?.id === id
        ? { splitFormation: { ...state.splitFormation, stage } }
        : {}
    ),
  finishSplitFormation: (id) =>
    set((state) =>
      state.splitFormation?.id === id ? { splitFormation: null } : {}
    ),
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
