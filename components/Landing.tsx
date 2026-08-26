"use client";

import { motion } from "motion/react";
import { useGraph } from "@/store/graph";
import ArtistSearch from "./ArtistSearch";

const EXAMPLES = ["Kendrick Lamar", "Radiohead", "Miles Davis", "Björk", "Daft Punk"];

export default function Landing() {
  const hasNodes = useGraph((s) => s.order.length > 0);
  const hydrated = useGraph((s) => s.hydrated);
  if (!hydrated || hasNodes) return null;

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="landing-inner"
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
