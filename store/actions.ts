"use client";

import { create } from "zustand";
import { hasFreshGenres } from "@/lib/artist-details-cache";
import type {
  ArtistDetails,
  ArtistRef,
  BridgeMode,
  BridgeResult,
  Direction,
  LineageResult,
} from "@/lib/types";
import { canvas } from "@/lib/canvas-controller";
import { preloadMitosisImages } from "@/lib/mitosis-assets";
import { playSplitAudio } from "@/lib/split-audio";
import { useGraph } from "./graph";
import { useHistory } from "./history";
import { useUi, type BridgeRequestState } from "./ui";
import { getOrbEls } from "@/lib/registry";
import { stageSearchPosition } from "@/lib/simulation";

interface ArtistCacheState {
  details: Record<number, ArtistDetails>;
  put: (d: ArtistDetails) => void;
}

export const useArtistCache = create<ArtistCacheState>((set) => ({
  details: {},
  put: (d) => set((s) => ({ details: { ...s.details, [d.id]: d } })),
}));

const inFlight = new Map<number, Promise<ArtistDetails | null>>();

/** Fetch full artist details (tracks, biography, accent, startYear) with client caching. */
export async function fetchDetails(id: number): Promise<ArtistDetails | null> {
  const cached = useArtistCache.getState().details[id];
  if (cached && hasFreshGenres(cached)) return cached;
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

/** Search is navigation: reveal the artist in place, adding an unseen orb if needed. */
export async function navigateToArtist(ref: ArtistRef): Promise<void> {
  useUi.getState().setNavPanel(null);
  useHistory.getState().visit(ref);
  void fetchDetails(ref.id);
  await canvas.revealArtist(ref);
}

/** Seed the canvas from a search result (accent fetched alongside details). */
export async function seedFromSearch(ref: ArtistRef): Promise<void> {
  const details = await fetchDetails(ref.id);
  useGraph.getState().addSeed({
    ...ref,
    accent: details?.accent ?? "#a3a3a3",
  });
  useHistory.getState().visit(ref);
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
    const childIds = result.entries
      .filter((entry) => !useGraph.getState().nodes[entry.id])
      .map((entry) => entry.id);
    if (childIds.length) {
      await preloadMitosisImages([
        node.picture,
        ...result.entries
          .filter((entry) => childIds.includes(entry.id))
          .map((entry) => entry.picture),
      ]);
    }
    useGraph.getState().applyLineage(nodeId, result);
    if (childIds.length) {
      ui.beginSplitFormation(nodeId, direction, childIds);
      playSplitAudio(childIds.length, direction);
    }
  } catch (err) {
    console.error("expand failed", err);
    ui.showToast("Couldn't load lineage — try again");
  } finally {
    useUi.getState().setExpanding(nodeId, direction, false);
  }
}

/** Resolve a second endpoint, request a bridge, and merge it into the universe. */
export async function connectArtists(
  fromId: number,
  target: ArtistRef,
  mode: BridgeMode = "influence",
  destination?: { x: number; y: number }
): Promise<void> {
  const graph = useGraph.getState();
  const from = graph.nodes[fromId];
  if (!from || fromId === target.id) {
    useUi.getState().showToast("Choose a different artist to build a bridge");
    return;
  }

  const duplicate = graph.bridgeOrder
    .map((id) => graph.bridges[id])
    .find(
      (bridge) =>
        bridge.mode === mode &&
        bridge.endpointIds.includes(fromId) &&
        bridge.endpointIds.includes(target.id)
    );
  if (duplicate) {
    // A saved route can be reopened from either artist. Keep its signal aligned
    // with this connection gesture, including any routes revealed later.
    useGraph.setState((state) => ({
      bridges: {
        ...state.bridges,
        [duplicate.id]: {
          ...duplicate,
          endpointIds: [fromId, target.id],
          routeOptions: duplicate.routeOptions
            ? { ...duplicate.routeOptions, endpoints: [fromId, target.id] }
            : undefined,
        },
      },
    }));
    graph.setActiveBridge(duplicate.id);
    useUi.getState().cancelConnecting();
    setTimeout(() => canvas.fitNodes(duplicate.nodeIds), 80);
    return;
  }

  const ui = useUi.getState();
  if (ui.connectingFrom !== fromId) ui.startConnecting(fromId);
  const request: BridgeRequestState = {
    fromId, target, mode, status: "loading",
    message: mode === "influence" ? "Tracing influence paths…" : "Mapping broader musical ties…",
  };
  ui.setBridgeRequest(request);
  // Cancel, change artist, or a newer request invalidates this response.
  const isCurrent = () => useUi.getState().bridgeRequest === request &&
    useUi.getState().connectingFrom === fromId && Boolean(useGraph.getState().nodes[fromId]);

  try {
    const response = await fetch("/api/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        a: { id: from.id, name: from.name },
        b: { id: target.id, name: target.name },
        mode,
      }),
    });
    if (!response.ok) throw new Error(`bridge HTTP ${response.status}`);
    const result = (await response.json()) as BridgeResult;
    if (!isCurrent()) return;
    if (result.status === "no_path") {
      useUi.getState().setBridgeRequest({
        fromId,
        target,
        mode: result.mode,
        status: "no_path",
        message:
          result.message ??
          `No credible influence bridge was found between ${from.name} and ${target.name}.`,
      });
      return;
    }
    if (!result.paths.length) throw new Error("empty bridge result");
    if (!useGraph.getState().nodes[target.id]) {
      if (destination) stageSearchPosition(target.id, destination);
      useGraph.getState().addSeed({ ...target, accent: "#a3a3a3" });
      useHistory.getState().visit(target);
    }
    // API/cache results use canonical ID order; the pulse follows the user's
    // source → destination order without changing historical influence edges.
    const bridgeId = useGraph.getState().applyBridge({ ...result, endpoints: [fromId, target.id] });
    if (!bridgeId) throw new Error("empty bridge result");
    const bridge = useGraph.getState().bridges[bridgeId];
    useUi.getState().cancelConnecting();
    requestAnimationFrame(() => getOrbEls().get(fromId)?.focus({ preventScroll: true }));
    useUi
      .getState()
      .showToast(result.degraded ? "Built a similarity bridge" : "Bridge added to the canvas");
    setTimeout(() => canvas.fitNodes(bridge.nodeIds), 650);
  } catch (error) {
    if (!isCurrent()) return;
    console.error("connect failed", error);
    useUi.getState().setBridgeRequest({
      fromId,
      target,
      mode,
      status: "error",
      message: "Unable to build this bridge. Check your connection and try again.",
    });
  }
}

export function connectCanvasArtists(fromId: number, toId: number): Promise<void> {
  const node = useGraph.getState().nodes[toId];
  if (!node) return Promise.resolve();
  return connectArtists(fromId, {
    id: node.id,
    name: node.name,
    picture: node.picture,
    pictureBig: node.pictureBig,
  });
}

/** Remove artists plus any exclusively owned lineage descendants. */
export function removeArtists(ids: number[]): number {
  const graph = useGraph.getState();
  const count = graph.removeNodes(ids);
  if (!count) return 0;

  const ui = useUi.getState();
  if (ui.menuFor !== null && !useGraph.getState().nodes[ui.menuFor]) ui.openMenu(null);
  if (ui.detailFor !== null && !useGraph.getState().nodes[ui.detailFor]) ui.openDetail(null);
  ui.openCanvasContextMenu(null);
  ui.showToast(`Removed ${count} artist${count === 1 ? "" : "s"} from the canvas`);
  return count;
}
