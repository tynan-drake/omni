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

  return (
    <>
      {edges.map((edge) => {
        const from = nodes[edge.from];
        const to = nodes[edge.to];
        if (!from || !to) return null;
        const color = mixHex(from.accent, to.accent);
        const dimmed =
          !nodeMatchesFilter(filter, from) || !nodeMatchesFilter(filter, to);
        return (
          <g
            key={edge.id}
            ref={(el) => registerEdge(edge.id, el)}
            className={[
              "edge",
              edge.kind === "peer" ? "edge-peer" : "edge-directional",
              dimmed ? "is-dimmed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ color }}
          >
            <line className="edge-base" />
            {edge.kind !== "peer" && <line className="edge-flow" />}
          </g>
        );
      })}
    </>
  );
}

export const EdgeLayer = memo(EdgeLayerImpl);
