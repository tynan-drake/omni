"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { getPositions, onSimTick } from "@/lib/simulation";
import { useGraph } from "@/store/graph";
import { nodeMatchesFilter, useUi } from "@/store/ui";

/* BRIDGE SIGNAL STORYBOARD
 * Start → a soft packet travels through the entire A → B route.
 * Each hop adds 1500ms of travel; the final 20% of each loop rests.
 * Repeat continuously, independent of spotlight. Reduced motion: static rails.
 */
const SIGNAL = { hopMs: 1500, travelFraction: .8, minimumTravelMs: 3000 };

export default function BridgeSignals() {
  const bridges = useGraph(s => s.bridges);
  const nodes = useGraph(s => s.nodes);
  const filter = useUi(s => s.filter);
  const paths = Object.values(bridges).flatMap(bridge => bridge.paths.map(path => ({
    key: `${bridge.id}:${path.id}`,
    // Route order describes traversal, even when an influence edge points back.
    ids: path.nodeIds[0] === bridge.endpointIds[0] ? path.nodeIds : [...path.nodeIds].reverse(),
  })));
  const elements = useRef(new Map<string, SVGGElement>());

  useLayoutEffect(() => {
    const update = (positions: ReturnType<typeof getPositions>) => {
      for (const bridge of Object.values(bridges)) for (const path of bridge.paths) {
        const el = elements.current.get(`${bridge.id}:${path.id}`);
        if (!el) continue;
        const ids = path.nodeIds[0] === bridge.endpointIds[0] ? path.nodeIds : [...path.nodeIds].reverse();
        const points = ids.map(id => positions.get(id));
        const ready = points.length > 1 && points.every(Boolean);
        el.style.visibility = ready ? "visible" : "hidden";
        if (ready) for (const line of el.querySelectorAll("polyline")) {
          line.setAttribute("points", points.map(p => `${p!.x},${p!.y}`).join(" "));
        }
      }
    };
    update(getPositions());
    return onSimTick(update);
  }, [bridges]);

  return <g className="bridge-signals" aria-hidden="true">
    {paths.map(path => {
      const travel = Math.max(SIGNAL.minimumTravelMs, (path.ids.length - 1) * SIGNAL.hopMs);
      const duration = travel / SIGNAL.travelFraction;
      const dimmed = path.ids.some(id => !nodes[id] || !nodeMatchesFilter(filter, nodes[id]));
      return <g key={path.key} ref={el => { if (el) elements.current.set(path.key, el); else elements.current.delete(path.key); }}
        className={`bridge-signal${dimmed ? " is-filtered" : ""}`}
        style={{ "--signal-duration": `${duration}ms` } as CSSProperties}>
        <polyline className="bridge-signal-halo" pathLength="100" />
        <polyline className="bridge-signal-core" pathLength="100" />
      </g>;
    })}
  </g>;
}
