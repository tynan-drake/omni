"use client";

import { neutralizePurple } from "@/lib/color-utils";

import { memo, useMemo, useRef } from "react";
import { motion } from "motion/react";
import type { GraphNode } from "@/lib/types";
import type { Direction } from "@/lib/types";
import type { SplitBudPlan } from "@/lib/split-formation";
import { registerOrb } from "@/lib/registry";
import { dragNode, endDrag, setHovered } from "@/lib/simulation";
import { canvas } from "@/lib/canvas-controller";
import { useGraph, orbSize } from "@/store/graph";
import { GLASS_VARIANTS, useOrbDials } from "@/store/orb-dials";
import { useUi } from "@/store/ui";
import { connectCanvasArtists } from "@/store/actions";

/** Smallest → largest orb, for the size-linked parallax dial. */
const MIN_ORB = 64;
const MAX_ORB = 132;

interface OrbProps {
  node: GraphNode;
  dimmed: boolean;
  selected: boolean;
  expanding: boolean;
  inBridge: boolean;
  bridgeEndpoint: boolean;
  splitRole: "parent" | "child" | null;
  splitStage: number;
  splitDirection: Direction | null;
  splitPlan: SplitBudPlan | null;
  splitParentAccent: string | null;
}

const SPLIT_CHILD = {
  scaleByStage: [0, 0.055, 0.46, 0.72, 1.075, 1],
  opacityByStage: [0, 0.08, 0.76, 0.96, 1, 1],
  springByStage: [
    { type: "spring" as const, visualDuration: 0.2, bounce: 0 },
    { type: "spring" as const, visualDuration: 0.2, bounce: 0 },
    { type: "spring" as const, visualDuration: 0.44, bounce: 0.12 },
    { type: "spring" as const, visualDuration: 0.44, bounce: 0.08 },
    { type: "spring" as const, visualDuration: 0.42, bounce: 0.48 },
    { type: "spring" as const, visualDuration: 0.34, bounce: 0.18 },
  ],
} as const;

function OrbImpl({
  node,
  dimmed,
  selected,
  expanding,
  inBridge,
  bridgeEndpoint,
  splitRole,
  splitStage,
  splitDirection,
  splitPlan,
  splitParentAccent,
}: OrbProps) {
  const sizeScale = useOrbDials((s) => s.sizeScale);
  const entrance = useOrbDials((s) => s.entrance);
  const connectingFrom = useUi((s) => s.connectingFrom);
  const base = orbSize(node);
  const size = base * sizeScale;
  /** Stable per-orb 0–1 used to desync the drift and breathe animations. */
  const phase = useMemo(
    () => ((node.id * 2654435761) >>> 0) % 1000 / 1000,
    [node.id]
  );
  const sizeNorm = (base - MIN_ORB) / (MAX_ORB - MIN_ORB);
  /** Which seeded liquid filter this orb refracts through. */
  const variant = Math.floor(phase * GLASS_VARIANTS) % GLASS_VARIANTS;
  const safeSplitStage = Math.max(0, Math.min(splitStage, 5));
  const isSplitChild = splitRole === "child" && splitPlan;
  const drag = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved) {
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (dist < 5) return;
      d.moved = true;
      useUi.getState().openMenu(null);
    }
    const t = canvas.getTransform();
    dragNode(node.id, (e.clientX - t.x) / t.k, (e.clientY - t.y) / t.k);
  };

  const activate = (additive = false) => {
    const ui = useUi.getState();
    const graph = useGraph.getState();
    if (ui.connectingFrom !== null) {
      if (ui.connectingFrom === node.id) {
        ui.showToast("Choose a different artist to build a bridge");
      } else {
        void connectCanvasArtists(ui.connectingFrom, node.id);
      }
      return;
    }
    if (additive) {
      graph.toggleSelection(node.id);
      ui.openMenu(null);
      return;
    }
    if (ui.menuFor === node.id) ui.openMenu(null);
    else {
      graph.select(node.id);
      ui.openMenu(node.id);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    if (d.moved) {
      endDrag(node.id);
      return;
    }
    activate(e.shiftKey);
  };

  const openSelectionMenu = (clientX?: number, clientY?: number) => {
    const graph = useGraph.getState();
    if (!graph.selectedIds.includes(node.id)) graph.select(node.id);
    const rect = getOrbElement()?.getBoundingClientRect();
    const x = clientX || (rect ? rect.left + rect.width / 2 : 0);
    const y = clientY || (rect ? rect.top + rect.height / 2 : 0);
    useUi.getState().openCanvasContextMenu({
      x,
      y,
      nodeIds: useGraph.getState().selectedIds,
      target: "artists",
    });
  };

  const getOrbElement = () => document.querySelector<HTMLElement>(`[data-orb-id="${node.id}"]`);

  return (
    <div
      ref={(el) => registerOrb(node.id, el)}
      data-orb-id={node.id}
      role="button"
      tabIndex={dimmed ? -1 : 0}
      aria-label={
        connectingFrom !== null && connectingFrom !== node.id
          ? `Connect to ${node.name}`
          : node.name
      }
      aria-pressed={selected}
      className={[
        "orb",
        selected ? "is-selected" : "",
        dimmed ? "is-dimmed" : "",
        node.kind === "seed" ? "is-seed" : "",
        inBridge ? "is-bridge-node" : "",
        bridgeEndpoint ? "is-bridge-endpoint" : "",
        connectingFrom !== null ? "is-connect-target" : "",
        splitRole === "parent" ? "is-split-parent" : "",
        isSplitChild ? "is-split-child" : "",
        splitDirection ? `split-${splitDirection}` : "",
        splitRole ? `split-stage-${safeSplitStage}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          width: size,
          height: size,
          "--accent": neutralizePurple(node.accent),
          "--orb-phase": phase,
          "--orb-size-norm": sizeNorm,
          "--orb-img": `url("${node.picture}")`,
          "--glass-filter": `url(#orb-liquid-${variant})`,
          ...(splitPlan && {
            "--split-angle": `${splitPlan.angleDeg}deg`,
            "--split-angle-inverse": `${-splitPlan.angleDeg}deg`,
            "--split-distance": `${splitPlan.distance}px`,
          }),
          ...(splitParentAccent && { "--split-parent-accent": splitParentAccent }),
        } as React.CSSProperties
      }
      onPointerEnter={() => !dimmed && setHovered(node.id)}
      onPointerLeave={() => setHovered(null)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        if (drag.current?.moved) endDrag(node.id);
        drag.current = null;
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openSelectionMenu(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          openSelectionMenu();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(event.shiftKey);
        }
      }}
    >
      {isSplitChild && (
        <div className="orb-tether" aria-hidden="true">
          <span className="orb-tether-core" />
        </div>
      )}
      <motion.div
        className="orb-inner"
        initial={
          isSplitChild
            ? {
                scale: SPLIT_CHILD.scaleByStage[1],
                opacity: SPLIT_CHILD.opacityByStage[1],
              }
            : { scale: 0, opacity: 0 }
        }
        animate={
          isSplitChild
            ? {
                scale: SPLIT_CHILD.scaleByStage[safeSplitStage],
                opacity: SPLIT_CHILD.opacityByStage[safeSplitStage],
              }
            : { scale: 1, opacity: 1 }
        }
        transition={
          isSplitChild ? SPLIT_CHILD.springByStage[safeSplitStage] : entrance
        }
      >
        <div className="orb-float">
          <div className="orb-atmosphere" />
          <div className="orb-sphere">
            {/* Everything inside .orb-glass is refracted by the liquid filter. */}
            <div className="orb-glass">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="orb-photo"
                src={node.picture}
                alt={node.name}
                draggable={false}
              />
              <div className="orb-edge" />
            </div>
            <div className="orb-iris" />
            <div className="orb-limb" />
            <div className="orb-shine" />
            <div className="orb-fringe" />
            <div className="orb-rim" />
          </div>
          {expanding && <div className="orb-loading" />}
        </div>
        <div className="orb-label">
          <span className="orb-name">{node.name}</span>
          {node.era && <span className="orb-era">{node.era}</span>}
        </div>
      </motion.div>
      {splitRole === "parent" && (
        <div className="orb-division-wave" aria-hidden="true" />
      )}
    </div>
  );
}

export const Orb = memo(OrbImpl);
