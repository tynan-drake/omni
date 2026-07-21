"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useGraph } from "@/store/graph";
import ArtistSearch from "./ArtistSearch";

const EXAMPLES = ["Kendrick Lamar", "Radiohead", "Miles Davis", "Björk", "Daft Punk"];

export default function Landing() {
  const hasNodes = useGraph((s) => s.order.length > 0);
  const [gone, setGone] = useState(false);

  // Re-show the hero if the canvas is reset back to empty.
  useEffect(() => {
    if (!hasNodes && gone) setGone(false);
  }, [hasNodes, gone]);

  if (gone) return null;

  const trySearch = (name: string) => {
    const input = document.querySelector<HTMLInputElement>("[data-omni-search]");
    if (!input) return;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, name);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <motion.div
      className="landing"
      style={{ pointerEvents: hasNodes ? "none" : undefined }}
      initial={false}
      animate={
        hasNodes ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }
      }
      transition={{ duration: 0.45 }}
      onAnimationComplete={() => {
        if (useGraph.getState().order.length > 0) setGone(true);
      }}
    >
      <motion.div
        className="landing-inner"
        style={{ pointerEvents: hasNodes ? "none" : undefined }}
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="landing-wordmark">OMNI</h1>
        <p className="landing-tagline">
          Trace the lineage of sound — search an artist, then travel backward to
          their roots or forward to the artists they shaped.
        </p>
        <ArtistSearch variant="hero" placeholder="Search any artist…" autoFocus />
        <div className="landing-examples">
          {EXAMPLES.map((name) => (
            <button key={name} className="chip" onClick={() => trySearch(name)}>
              {name}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
