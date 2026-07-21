"use client";

import { create } from "zustand";
import type { ArtistDetails, ArtistRef, Direction, LineageResult } from "@/lib/types";
import { useGraph } from "./graph";
import { useUi } from "./ui";

interface ArtistCacheState {
  details: Record<number, ArtistDetails>;
  put: (d: ArtistDetails) => void;
}

export const useArtistCache = create<ArtistCacheState>((set) => ({
  details: {},
  put: (d) => set((s) => ({ details: { ...s.details, [d.id]: d } })),
}));

const inFlight = new Map<number, Promise<ArtistDetails | null>>();

/** Fetch full artist details (tracks, accent, startYear) with client caching. */
export async function fetchDetails(id: number): Promise<ArtistDetails | null> {
  const cached = useArtistCache.getState().details[id];
  if (cached) return cached;
  const pending = inFlight.get(id);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const res = await fetch(`/api/artist/${id}`);
      if (!res.ok) return null;
      const details = (await res.json()) as ArtistDetails;
      useArtistCache.getState().put(details);
      return details;
    } catch {
      return null;
    } finally {
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, promise);
  return promise;
}

/** Seed the canvas from a search result (accent fetched alongside details). */
export async function seedFromSearch(ref: ArtistRef): Promise<void> {
  const details = await fetchDetails(ref.id);
  useGraph.getState().addSeed({
    ...ref,
    accent: details?.accent ?? "#8b7cf6",
  });
}

/** Expand a node's lineage in a direction, adding orbs + edges to the graph. */
export async function expand(nodeId: number, direction: Direction): Promise<void> {
  const graph = useGraph.getState();
  const ui = useUi.getState();
  const node = graph.nodes[nodeId];
  if (!node) return;
  if (graph.expanded[nodeId]?.[direction]) return;
  if (ui.expanding[`${nodeId}:${direction}`]) return;

  ui.setExpanding(nodeId, direction, true);
  try {
    const res = await fetch(
      `/api/lineage?id=${nodeId}&artist=${encodeURIComponent(node.name)}&direction=${direction}`
    );
    if (!res.ok) throw new Error(`lineage HTTP ${res.status}`);
    const result = (await res.json()) as LineageResult;
    if (!result.entries?.length) {
      ui.showToast(
        direction === "back"
          ? `No documented roots found for ${node.name}`
          : `No documented descendants found for ${node.name}`
      );
      return;
    }
    useGraph.getState().applyLineage(nodeId, result);
  } catch (err) {
    console.error("expand failed", err);
    ui.showToast("Couldn't load lineage — try again");
  } finally {
    useUi.getState().setExpanding(nodeId, direction, false);
  }
}
