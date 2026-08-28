"use client";

import { memo } from "react";
import { mixHex } from "@/lib/color-utils";
import { registerEdge } from "@/lib/registry";
import { useGraph } from "@/store/graph";
import { nodeMatchesFilter, useUi } from "@/store/ui";

/**
 * SVG edge elements. Line endpoints are written imperatively each simulation
 * tick (see Canvas); React only handles add/remove and styling.
 */
function EdgeLayerImpl() {
  const nodes = useGraph((s) => s.nodes);
  const edges = useGraph((s) => s.edges);
  const filter = useUi((s) => s.filter);
  const activeBridge = useGraph((s) =>
    s.activeBridgeId ? s.bridges[s.activeBridgeId] : null
  );
  const activeEdgeIds = new Set(activeBridge?.edgeIds ?? []);

  return (
    <>
      {edges.map((edge) => {
        const from = nodes[edge.from];
        const to = nodes[edge.to];
        if (!from || !to) return null;
        const lineageRole =
          edge.kind === "back"
            ? "root"
            : edge.kind === "forward"
              ? "branch"
              : null;
        const bridgeOwned = edge.origins?.some((origin) => origin.startsWith("bridge:"));
        const color =
          bridgeOwned
            ? "var(--bridge-edge-color)"
            : lineageRole === "root"
              ? "var(--lineage-root-color)"
              : lineageRole === "branch"
                ? "var(--lineage-branch-color)"
                : mixHex(from.accent, to.accent);
        const inBridge = Boolean(activeBridge && activeEdgeIds.has(edge.id));
        const dimmed =
          !nodeMatchesFilter(filter, from) ||
          !nodeMatchesFilter(filter, to) ||
          Boolean(activeBridge && !inBridge);
        return (
          <g
            key={edge.id}
            ref={(el) => registerEdge(edge.id, el)}
            className={[
              "edge",
              edge.kind === "peer" ? "edge-peer" : "edge-directional",
              lineageRole ? `edge-${lineageRole}` : "",
              bridgeOwned ? "edge-bridge" : "",
              dimmed ? "is-dimmed" : "",
              inBridge ? "is-bridge-edge" : "",
              edge.kind === "similarity" || edge.kind === "scene"
                ? "edge-adjacent"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-lineage-role={lineageRole ?? undefined}
            style={{ color }}
          >
            {bridgeOwned ? (
              <title>{`Bridge connection: ${from.name} to ${to.name}`}</title>
            ) : lineageRole ? (
              <title>{`${lineageRole === "root" ? "Root" : "Branch"} connection: ${from.name} to ${to.name}`}</title>
            ) : null}
            <line className="edge-base" />
            {edge.kind !== "peer" && <line className="edge-flow" />}
          </g>
        );
      })}
    </>
  );
}

export const EdgeLayer = memo(EdgeLayerImpl);
