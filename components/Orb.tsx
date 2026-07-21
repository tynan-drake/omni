"use client";

import { memo, useMemo, useRef } from "react";
import { motion } from "motion/react";
import type { GraphNode } from "@/lib/types";
import { registerOrb } from "@/lib/registry";
import { dragNode, endDrag, setHovered } from "@/lib/simulation";
import { canvas } from "@/lib/canvas-controller";
import { useGraph, orbSize } from "@/store/graph";
import { useUi } from "@/store/ui";

interface OrbProps {
  node: GraphNode;
  dimmed: boolean;
  selected: boolean;
  expanding: boolean;
}

function OrbImpl({ node, dimmed, selected, expanding }: OrbProps) {
  const size = orbSize(node);
  const driftDelay = useMemo(() => `${-(node.id % 7000) / 1000}s`, [node.id]);
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
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <div className="orb-float" style={{ animationDelay: driftDelay }}>
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
