"use client";

import { memo, useMemo, useRef } from "react";
import { motion } from "motion/react";
import type { GraphNode } from "@/lib/types";
import { registerOrb } from "@/lib/registry";
import { dragNode, endDrag, setHovered } from "@/lib/simulation";
import { canvas } from "@/lib/canvas-controller";
import { useGraph, orbSize } from "@/store/graph";
import { useOrbDials } from "@/store/orb-dials";
import { useUi } from "@/store/ui";

/** Smallest → largest orb, for the size-linked parallax dial. */
const MIN_ORB = 64;
const MAX_ORB = 132;

interface OrbProps {
  node: GraphNode;
  dimmed: boolean;
  selected: boolean;
  expanding: boolean;
}

function OrbImpl({ node, dimmed, selected, expanding }: OrbProps) {
  const sizeScale = useOrbDials((s) => s.sizeScale);
  const entrance = useOrbDials((s) => s.entrance);
  const base = orbSize(node);
  const size = base * sizeScale;
  /** Stable per-orb 0–1 used to desync the drift and breathe animations. */
  const phase = useMemo(
    () => ((node.id * 2654435761) >>> 0) % 1000 / 1000,
    [node.id]
  );
  const sizeNorm = (base - MIN_ORB) / (MAX_ORB - MIN_ORB);
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

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    if (d.moved) {
      endDrag(node.id);
      return;
    }
    const ui = useUi.getState();
    const graph = useGraph.getState();
    if (ui.menuFor === node.id) {
      ui.openMenu(null);
    } else {
      graph.select(node.id);
      ui.openMenu(node.id);
    }
  };

  return (
    <div
      ref={(el) => registerOrb(node.id, el)}
      role="button"
      aria-label={node.name}
      className={[
        "orb",
        selected ? "is-selected" : "",
        dimmed ? "is-dimmed" : "",
        node.kind === "seed" ? "is-seed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          width: size,
          height: size,
          "--accent": node.accent,
          "--orb-phase": phase,
          "--orb-size-norm": sizeNorm,
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
    >
      <motion.div
        className="orb-inner"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={entrance}
      >
        <div className="orb-float">
          <div className="orb-atmosphere" />
          <div className="orb-sphere">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={node.picture} alt={node.name} draggable={false} />
            <div className="orb-shine" />
            <div className="orb-limb" />
            <div className="orb-rim" />
          </div>
          {expanding && <div className="orb-loading" />}
        </div>
        <div className="orb-label">
          <span className="orb-name">{node.name}</span>
          {node.era && <span className="orb-era">{node.era}</span>}
        </div>
      </motion.div>
    </div>
  );
}

export const Orb = memo(OrbImpl);
