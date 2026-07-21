"use client";

import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { registerCanvasController } from "@/lib/canvas-controller";
import { getEdgeEls, getOrbEls } from "@/lib/registry";
import { getPositions, onSimTick, syncGraph } from "@/lib/simulation";
import { orbSize, useGraph } from "@/store/graph";
import { nodeMatchesFilter, useUi } from "@/store/ui";
import { Orb } from "./Orb";
import { EdgeLayer } from "./EdgeLayer";

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);

  const nodes = useGraph((s) => s.nodes);
  const order = useGraph((s) => s.order);
  const edges = useGraph((s) => s.edges);
  const spawnFrom = useGraph((s) => s.spawnFrom);
  const selectedId = useGraph((s) => s.selectedId);
  const filter = useUi((s) => s.filter);
  const expanding = useUi((s) => s.expanding);

  // --- zoom / pan ---------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applyTransform = (t: ZoomTransform) => {
      transformRef.current = t;
      if (worldRef.current) {
        worldRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
      }
      gRef.current?.setAttribute(
        "transform",
        `translate(${t.x},${t.y}) scale(${t.k})`
      );
    };

    const behavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.15, 2.5])
      .filter((event: Event) => {
        if (event.type === "dblclick") return false;
        if (event.type === "wheel") return true;
        const target = event.target as Element | null;
        return !target?.closest?.(".orb");
      })
      .on("zoom", (event) => applyTransform(event.transform));

    zoomRef.current = behavior;
    const sel = select(container);
    sel.call(behavior);

    // Start with the world origin at screen center. The stylesheet may not be
    // applied yet on first mount (rect is 0×0 in dev), so retry until sized.
    let initRaf = 0;
    const applyInitialCenter = () => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        initRaf = requestAnimationFrame(applyInitialCenter);
        return;
      }
      sel.call(
        behavior.transform,
        zoomIdentity.translate(rect.width / 2, rect.height / 2)
      );
    };
    applyInitialCenter();

    const fitAll = () => {
      const positions = getPositions();
      if (!positions.size) return;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of positions.values()) {
        minX = Math.min(minX, p.x - p.r);
        minY = Math.min(minY, p.y - p.r - 8);
        maxX = Math.max(maxX, p.x + p.r);
        maxY = Math.max(maxY, p.y + p.r + 40); // room for labels
      }
      const { width, height } = container.getBoundingClientRect();
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      const k = Math.min(Math.max(Math.min(width / bw, height / bh) * 0.82, 0.15), 1.4);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const t = zoomIdentity
        .translate(width / 2 - k * cx, height / 2 - k * cy)
        .scale(k);
      sel.transition().duration(650).call(behavior.transform, t);
    };

    const flyTo = (nodeId: number) => {
      const p = getPositions().get(nodeId);
      if (!p) return;
      const { width, height } = container.getBoundingClientRect();
      const k = Math.max(transformRef.current.k, 1);
      const t = zoomIdentity
        .translate(width / 2 - k * p.x, height / 2 - k * p.y)
        .scale(k);
      sel.transition().duration(650).call(behavior.transform, t);
    };

    const zoomBy = (factor: number) => {
      sel.transition().duration(220).call(behavior.scaleBy, factor);
    };

    registerCanvasController({
      fitAll,
      flyTo,
      zoomBy,
      getTransform: () => {
        const t = transformRef.current;
        return { x: t.x, y: t.y, k: t.k };
      },
    });

    return () => {
      cancelAnimationFrame(initRaf);
      sel.on(".zoom", null);
    };
  }, []);

  // --- graph → simulation -------------------------------------------------
  useEffect(() => {
    const positions = getPositions();
    const spawnPositions = new Map<number, { x: number; y: number }>();
    for (const [childId, parentId] of Object.entries(spawnFrom)) {
      const p = positions.get(parentId);
      if (p) spawnPositions.set(Number(childId), { x: p.x, y: p.y });
    }
    syncGraph(
      order
        .filter((id) => nodes[id])
        .map((id) => ({ id, r: orbSize(nodes[id]) / 2 })),
      edges.map((e) => ({ from: e.from, to: e.to, peer: e.kind === "peer" })),
      spawnPositions
    );
  }, [nodes, order, edges, spawnFrom]);

  // --- simulation tick → DOM ---------------------------------------------
  useEffect(() => {
    return onSimTick((positions) => {
      const orbEls = getOrbEls();
      for (const [id, p] of positions) {
        const el = orbEls.get(id);
        if (el) {
          el.style.transform = `translate3d(${p.x - p.r}px, ${p.y - p.r}px, 0)`;
        }
      }
      const { edges } = useGraph.getState();
      const edgeEls = getEdgeEls();
      for (const edge of edges) {
        const g = edgeEls.get(edge.id);
        if (!g) continue;
        const a = positions.get(edge.from);
        const b = positions.get(edge.to);
        if (!a || !b) continue;
        for (const line of g.querySelectorAll("line")) {
          line.setAttribute("x1", String(a.x));
          line.setAttribute("y1", String(a.y));
          line.setAttribute("x2", String(b.x));
          line.setAttribute("y2", String(b.y));
        }
      }
    });
  }, []);

  // --- background click: close menus, deselect ---------------------------
  const onBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as Element;
    if (target.closest(".orb")) return;
    useUi.getState().openMenu(null);
    useGraph.getState().select(null);
  };

  return (
    <div ref={containerRef} className="canvas-root" onClick={onBackgroundClick}>
      <svg className="edge-svg">
        <g ref={gRef}>
          <EdgeLayer />
        </g>
      </svg>
      <div ref={worldRef} className="world">
        {order.map((id) => {
          const node = nodes[id];
          if (!node) return null;
          return (
            <Orb
              key={id}
              node={node}
              dimmed={!nodeMatchesFilter(filter, node)}
              selected={selectedId === id}
              expanding={
                Boolean(expanding[`${id}:back`]) || Boolean(expanding[`${id}:forward`])
              }
            />
          );
        })}
      </div>
    </div>
  );
}
