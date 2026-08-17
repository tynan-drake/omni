"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import type { NodeKind } from "@/lib/types";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import { SparkleIcon, TrashIcon } from "./Icons";

const KIND_LABELS: Array<{ kind: NodeKind; label: string }> = [
  { kind: "seed", label: "Seeds" },
  { kind: "root", label: "Roots" },
  { kind: "branch", label: "Branches" },
];

export default function TopBar() {
  const nodes = useGraph((s) => s.nodes);
  const order = useGraph((s) => s.order);
  const lastSource = useGraph((s) => s.lastSource);
  const filter = useUi((s) => s.filter);
  const toggleKind = useUi((s) => s.toggleKindFilter);
  const toggleDecade = useUi((s) => s.toggleDecadeFilter);

  const decades = useMemo(() => {
    const set = new Set<number>();
    for (const id of order) {
      const d = nodes[id]?.decade;
      if (d) set.add(d);
    }
    return [...set].sort((a, b) => a - b);
  }, [nodes, order]);

  return (
    <motion.header
      className="topbar"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="topbar-filters scrollbar-slim">
        {KIND_LABELS.map(({ kind, label }) => (
          <button
            key={kind}
            className={`chip ${filter.kinds.has(kind) ? "is-active" : ""}`}
            onClick={() => toggleKind(kind)}
          >
            {label}
          </button>
        ))}
        {decades.length > 1 && <span className="topbar-divider" />}
        {decades.length > 1 &&
          decades.map((d) => (
            <button
              key={d}
              className={`chip ${filter.decades.has(d) ? "is-active" : ""}`}
              onClick={() => toggleDecade(d)}
            >
              {d}s
            </button>
          ))}
      </div>

      <div className="topbar-actions">
        {lastSource && (
          <span
            className={`source-badge ${lastSource === "curated" ? "is-curated" : ""}`}
            title={
              lastSource === "curated"
                ? "Lineage curated by Claude"
                : "Similarity heuristic (no API key configured)"
            }
          >
            <SparkleIcon size={11} />
            {lastSource}
          </span>
        )}
        <button
          className="bar-btn"
          title="Clear canvas"
          onClick={() => {
            useGraph.getState().reset();
            useUi.getState().closeAll();
          }}
        >
          <TrashIcon />
        </button>
      </div>
    </motion.header>
  );
}
