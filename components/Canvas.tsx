"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import {
  publishScale,
  registerCanvasController,
  VIEWPORT_INSET,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@/lib/canvas-controller";
import {
  resolveWheelGesture,
  resolveZoomWheelDelta,
} from "@/lib/canvas-gestures";
import { getEdgeEls, getOrbEls } from "@/lib/registry";
import { mergeSelection, rectsIntersect, selectionRect } from "@/lib/selection";
import {
  animateSplitFormation,
  getPositions,
  onSimTick,
  setTimelineTargets,
  syncGraph,
} from "@/lib/simulation";
import {
  makeSplitBudPlans,
  SPLIT_STAGE,
  SPLIT_TIMING,
} from "@/lib/split-formation";
import { orbSize, useGraph } from "@/store/graph";
import { useOrbDials } from "@/store/orb-dials";
import { nodeMatchesFilter, useUi } from "@/store/ui";
import { Orb } from "./Orb";
import { EdgeLayer } from "./EdgeLayer";
import MitosisSurface from "./MitosisSurface";

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const marqueeRef = useRef<{
    start: { x: number; y: number };
    current: { x: number; y: number };
    initialSelection: number[];
    additive: boolean;
    pointerId: number;
    moved: boolean;
  } | null>(null);
  const ignoreBackgroundClickRef = useRef(false);
  const [marquee, setMarquee] = useState<ReturnType<typeof selectionRect> | null>(null);
  const [middlePanning, setMiddlePanning] = useState(false);

  const nodes = useGraph((s) => s.nodes);
  const order = useGraph((s) => s.order);
  const edges = useGraph((s) => s.edges);
  const spawnFrom = useGraph((s) => s.spawnFrom);
  const selectedIds = useGraph((s) => s.selectedIds);
  const activeBridgeId = useGraph((s) => s.activeBridgeId);
  const activeBridge = useGraph((s) =>
    s.activeBridgeId ? s.bridges[s.activeBridgeId] : null
  );
  const filter = useUi((s) => s.filter);
  const canvasTool = useUi((s) => s.canvasTool);
  const expanding = useUi((s) => s.expanding);
  const splitFormation = useUi((s) => s.splitFormation);
  const sizeScale = useOrbDials((s) => s.sizeScale);
  const epoch = useOrbDials((s) => s.epoch);
  const activeNodeIds = useMemo(
    () => new Set(activeBridge?.nodeIds ?? []),
    [activeBridge]
  );
  const endpointIds = useMemo(
    () => new Set(activeBridge?.endpointIds ?? []),
    [activeBridge]
  );
  const lineageRoles = useMemo(
    () => ({
      root: edges.some((edge) => edge.kind === "back"),
      branch: edges.some((edge) => edge.kind === "forward"),
    }),
    [edges]
  );
  const splitPlans = useMemo(
    () =>
      splitFormation
        ? makeSplitBudPlans(splitFormation.childIds, splitFormation.direction)
        : [],
    [splitFormation]
  );
  const splitPlansById = useMemo(
    () => new Map(splitPlans.map((plan) => [plan.id, plan])),
    [splitPlans]
  );
  const mitosisChildren = useMemo(
    () =>
      (splitFormation?.childIds ?? [])
        .map((id) => nodes[id])
        .filter((node): node is NonNullable<typeof node> => Boolean(node)),
    [nodes, splitFormation?.childIds]
  );

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
      publishScale(t.k);
    };

    /** Centre of the area left over once the nav rail and bars are excluded. */
    const viewCentre = () => {
      const { width, height } = container.getBoundingClientRect();
      return {
        x: VIEWPORT_INSET.left + (width - VIEWPORT_INSET.left - VIEWPORT_INSET.right) / 2,
        y: VIEWPORT_INSET.top + (height - VIEWPORT_INSET.top - VIEWPORT_INSET.bottom) / 2,
      };
    };

    const behavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      .wheelDelta((event: WheelEvent) =>
        resolveZoomWheelDelta(event, container.clientHeight)
      )
      .filter((event: Event) => {
        if (event.type === "dblclick") return false;
        if (event.type === "wheel") {
          const wheelEvent = event as WheelEvent;
          return wheelEvent.ctrlKey || wheelEvent.metaKey;
        }
        if (event.type === "mousedown" && (event as MouseEvent).button === 1) {
          event.preventDefault();
          return true;
        }
        const target = event.target as Element | null;
        if (target?.closest?.(".orb")) return false;
        return useUi.getState().canvasTool === "pan";
      })
      .on("zoom", (event) => applyTransform(event.transform));

    zoomRef.current = behavior;
    const sel = select(container);
    sel.call(behavior);

    const onWheelPan = (event: WheelEvent) => {
      const gesture = resolveWheelGesture(event, container.clientHeight);
      if (gesture.kind === "zoom") return;
      event.preventDefault();
      if (!gesture.deltaX && !gesture.deltaY) return;
      const { k } = transformRef.current;
      sel.call(
        behavior.translateBy,
        -gesture.deltaX / k,
        -gesture.deltaY / k
      );
    };
    container.addEventListener("wheel", onWheelPan, { passive: false });

    // Start with the world origin at screen center. The stylesheet may not be
    // applied yet on first mount (rect is 0×0 in dev), so retry until sized.
    let initRaf = 0;
    const applyInitialCenter = () => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        initRaf = requestAnimationFrame(applyInitialCenter);
        return;
      }
      const c = viewCentre();
      sel.call(behavior.transform, zoomIdentity.translate(c.x, c.y));
    };
    applyInitialCenter();

    const fit = (onlyIds?: number[]) => {
      const positions = getPositions();
      if (!positions.size) return;
      const allowed = onlyIds ? new Set(onlyIds) : null;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [id, p] of positions) {
        if (allowed && !allowed.has(id)) continue;
        const halfWidth = Math.max(p.r, p.labelWidth / 2);
        minX = Math.min(minX, p.x - halfWidth);
        minY = Math.min(minY, p.y - p.r - 8);
        maxX = Math.max(maxX, p.x + halfWidth);
        maxY = Math.max(maxY, p.y + p.r + p.labelOffset + p.labelHeight + 8);
      }
      if (!Number.isFinite(minX)) return;
      const { width, height } = container.getBoundingClientRect();
      const availW = width - VIEWPORT_INSET.left - VIEWPORT_INSET.right;
      const availH = height - VIEWPORT_INSET.top - VIEWPORT_INSET.bottom;
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      const k = Math.min(
        Math.max(Math.min(availW / bw, availH / bh) * 0.9, ZOOM_MIN),
        1.4
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const c = viewCentre();
      const t = zoomIdentity.translate(c.x - k * cx, c.y - k * cy).scale(k);
      sel.transition().duration(650).call(behavior.transform, t);
    };
    const fitAll = () => fit();
    const fitNodes = (ids: number[]) => fit(ids);

    const flyTo = (nodeId: number) => {
      const p = getPositions().get(nodeId);
      if (!p) return;
      const k = Math.max(transformRef.current.k, 1);
      const c = viewCentre();
      const t = zoomIdentity.translate(c.x - k * p.x, c.y - k * p.y).scale(k);
      sel.transition().duration(650).call(behavior.transform, t);
    };

    const zoomBy = (factor: number) => {
      sel.transition().duration(220).call(behavior.scaleBy, factor);
    };

    // Absolute scale, pivoting on the visible centre so the artwork under the
    // middle of the canvas stays put.
    const zoomTo = (k: number) => {
      const c = viewCentre();
      sel
        .transition()
        .duration(280)
        .call(behavior.scaleTo, Math.min(Math.max(k, ZOOM_MIN), ZOOM_MAX), [c.x, c.y]);
    };

    registerCanvasController({
      fitAll,
      fitNodes,
      flyTo,
      zoomBy,
      zoomTo,
      getTransform: () => {
        const t = transformRef.current;
        return { x: t.x, y: t.y, k: t.k };
      },
    });

    return () => {
      cancelAnimationFrame(initRaf);
      container.removeEventListener("wheel", onWheelPan);
      sel.on(".zoom", null);
    };
  }, []);

  // --- graph → simulation -------------------------------------------------
  useEffect(() => {
    const positions = getPositions();
    const activeSplitChildren = new Set(splitFormation?.childIds ?? []);
    const spawnPositions = new Map<
      number,
      { x: number; y: number; exact?: boolean }
    >();
    for (const [childId, parentId] of Object.entries(spawnFrom)) {
      const p = positions.get(parentId);
      if (p) {
        const id = Number(childId);
        spawnPositions.set(id, {
          x: p.x,
          y: p.y,
          exact: activeSplitChildren.has(id),
        });
      }
    }
    syncGraph(
      order
        .filter((id) => nodes[id])
        .map((id) => ({
          id,
          r: (orbSize(nodes[id]) * sizeScale) / 2,
          name: nodes[id].name,
          hasEra: Boolean(nodes[id].era),
        })),
      edges.map((edge) => {
        const peer = ["peer", "similarity", "scene", "collaboration"].includes(
          edge.kind
        );
        return {
          from: edge.from,
          to: edge.to,
          peer,
          temporal: !peer,
        };
      }),
      spawnPositions
    );
  }, [
    nodes,
    order,
    edges,
    spawnFrom,
    sizeScale,
    splitFormation?.id,
    splitFormation?.childIds,
  ]);

  // --- lineage split choreography ---------------------------------------
  useEffect(() => {
    const formation = useUi.getState().splitFormation;
    if (!formation) return;
    const ui = useUi.getState();
    const plans = makeSplitBudPlans(formation.childIds, formation.direction);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (reducedMotion) {
      ui.setSplitFormationStage(formation.id, SPLIT_STAGE.settled);
    } else {
      timers.push(
        setTimeout(
          () => ui.setSplitFormationStage(formation.id, SPLIT_STAGE.budding),
          SPLIT_TIMING.budsEmerge
        ),
        setTimeout(
          () => ui.setSplitFormationStage(formation.id, SPLIT_STAGE.stretching),
          SPLIT_TIMING.necksStretch
        ),
        setTimeout(
          () => ui.setSplitFormationStage(formation.id, SPLIT_STAGE.released),
          SPLIT_TIMING.membranesRelease
        ),
        setTimeout(
          () => ui.setSplitFormationStage(formation.id, SPLIT_STAGE.settled),
          SPLIT_TIMING.dropletsSettle
        )
      );
    }

    const cancelMotion = animateSplitFormation({
      parentId: formation.parentId,
      plans,
      reducedMotion,
      onComplete: () => ui.finishSplitFormation(formation.id),
    });

    return () => {
      timers.forEach(clearTimeout);
      cancelMotion();
    };
  }, [splitFormation?.id]);

  // Active bridges keep the constellation aesthetic while gently reading as time.
  useEffect(() => {
    if (!activeBridge) {
      setTimelineTargets(new Map());
      return;
    }
    const ids = activeBridge.nodeIds;
    const dated = ids
      .map((id) => nodes[id])
      .filter((node): node is NonNullable<typeof node> => Boolean(node?.decade));
    const decades = dated.map((node) => node.decade as number);
    const min = decades.length ? Math.min(...decades) : 0;
    const max = decades.length ? Math.max(...decades) : 0;
    const range = Math.max(max - min, 10);
    const targets = new Map<number, number>();
    ids.forEach((id, index) => {
      const decade = nodes[id]?.decade;
      const x =
        decade === null || decade === undefined
          ? (index / Math.max(ids.length - 1, 1) - 0.5) * 660
          : ((decade - min) / range - 0.5) * 660;
      targets.set(id, x);
    });
    setTimelineTargets(targets);
  }, [activeBridge, nodes]);

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
    if (ignoreBackgroundClickRef.current) {
      ignoreBackgroundClickRef.current = false;
      return;
    }
    const target = e.target as Element;
    if (target.closest(".orb")) return;
    useUi.getState().openMenu(null);
    useUi.getState().openCanvasContextMenu(null);
    useGraph.getState().select(null);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setMiddlePanning(true);
      return;
    }
    if (canvasTool !== "select" || event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest(".orb")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    marqueeRef.current = {
      start: { x: event.clientX, y: event.clientY },
      current: { x: event.clientX, y: event.clientY },
      initialSelection: useGraph.getState().selectedIds,
      additive: event.shiftKey,
      pointerId: event.pointerId,
      moved: false,
    };
    useUi.getState().openMenu(null);
    useUi.getState().openCanvasContextMenu(null);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = marqueeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    active.current = { x: event.clientX, y: event.clientY };
    if (!active.moved) {
      if (Math.hypot(event.clientX - active.start.x, event.clientY - active.start.y) < 4) {
        return;
      }
      active.moved = true;
    }
    setMarquee(selectionRect(active.start, active.current));
  };

  const finishMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (middlePanning) setMiddlePanning(false);
    const active = marqueeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    marqueeRef.current = null;
    setMarquee(null);
    if (!active.moved) return;

    const box = selectionRect(active.start, active.current);
    const matches: number[] = [];
    for (const [id, element] of getOrbEls()) {
      if (element.classList.contains("is-dimmed")) continue;
      const bounds = element.getBoundingClientRect();
      if (
        rectsIntersect(box, {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height,
        })
      ) {
        matches.push(id);
      }
    }
    useGraph
      .getState()
      .setSelection(mergeSelection(active.initialSelection, matches, active.additive));
    ignoreBackgroundClickRef.current = true;
    requestAnimationFrame(() => {
      ignoreBackgroundClickRef.current = false;
    });
  };

  const cancelMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    setMiddlePanning(false);
    if (marqueeRef.current?.pointerId !== event.pointerId) return;
    marqueeRef.current = null;
    setMarquee(null);
  };

  const onCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.target as Element;
    if (target.closest(".orb")) return;
    const graph = useGraph.getState();
    const ui = useUi.getState();
    ui.openMenu(null);
    ui.openCanvasContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeIds: graph.selectedIds,
      target: "canvas",
    });
  };

  return (
    <div
      ref={containerRef}
      className={`canvas-root is-${canvasTool}-tool ${middlePanning ? "is-middle-panning" : ""}`}
      onClick={onBackgroundClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishMarquee}
      onPointerCancel={cancelMarquee}
      onAuxClick={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onContextMenu={onCanvasContextMenu}
    >
      <svg className="edge-svg">
        <g ref={gRef}>
          <EdgeLayer />
        </g>
      </svg>
      {(lineageRoles.root || lineageRoles.branch) && (
        <aside className="edge-legend glass" aria-label="Connection line legend">
          {lineageRoles.root && (
            <span className="edge-legend-item">
              <svg viewBox="0 0 28 8" aria-hidden="true">
                <line className="edge-legend-root-base" x1="1" y1="4" x2="27" y2="4" />
                <line className="edge-legend-root-core" x1="1" y1="4" x2="27" y2="4" />
              </svg>
              Roots
            </span>
          )}
          {lineageRoles.branch && (
            <span className="edge-legend-item">
              <svg viewBox="0 0 28 8" aria-hidden="true">
                <line className="edge-legend-branch-guide" x1="1" y1="4" x2="27" y2="4" />
                <line className="edge-legend-branch-buds" x1="1" y1="4" x2="27" y2="4" />
              </svg>
              Branches
            </span>
          )}
        </aside>
      )}
      <div ref={worldRef} className="world">
        {order.map((id) => {
          const node = nodes[id];
          if (!node) return null;
          return (
            // The epoch changes when the dial panel asks to replay entrances,
            // remounting every orb so its spring animation runs again.
            <Orb
              key={`${id}:${epoch}`}
              node={node}
              dimmed={
                !nodeMatchesFilter(filter, node) ||
                Boolean(activeBridgeId && !activeNodeIds.has(id))
              }
              selected={selectedIds.includes(id)}
              inBridge={Boolean(activeBridgeId && activeNodeIds.has(id))}
              bridgeEndpoint={Boolean(activeBridgeId && endpointIds.has(id))}
              expanding={
                Boolean(expanding[`${id}:back`]) || Boolean(expanding[`${id}:forward`])
              }
              splitRole={
                splitFormation?.parentId === id
                  ? "parent"
                  : splitPlansById.has(id)
                    ? "child"
                    : null
              }
              splitStage={splitFormation?.stage ?? 0}
              splitDirection={splitFormation?.direction ?? null}
              splitPlan={splitPlansById.get(id) ?? null}
              splitParentAccent={
                splitFormation ? nodes[splitFormation.parentId]?.accent ?? null : null
              }
            />
          );
        })}
      </div>
      {splitFormation && nodes[splitFormation.parentId] && (
        <MitosisSurface
          key={splitFormation.id}
          formation={splitFormation}
          parent={nodes[splitFormation.parentId]}
          buds={mitosisChildren}
        />
      )}
      {marquee && (
        <div
          className="selection-marquee"
          aria-hidden="true"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      )}
    </div>
  );
}
