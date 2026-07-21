"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { canvas } from "@/lib/canvas-controller";
import { getPositions } from "@/lib/simulation";
import { streamingLinks } from "@/lib/links";
import type { Direction } from "@/lib/types";
import { expand, fetchDetails } from "@/store/actions";
import { orbSize, useGraph } from "@/store/graph";
import { useAudio } from "@/store/audio";
import { useUi } from "@/store/ui";
import {
  BranchesIcon,
  CheckIcon,
  CloseIcon,
  ExternalIcon,
  PauseIcon,
  PlayIcon,
  RootsIcon,
  TracksIcon,
} from "./Icons";

export default function OrbMenu() {
  const menuFor = useUi((s) => s.menuFor);
  const node = useGraph((s) => (menuFor !== null ? s.nodes[menuFor] : null));

  return (
    <AnimatePresence>
      {node && <Menu key={node.id} nodeId={node.id} />}
    </AnimatePresence>
  );
}

function Menu({ nodeId }: { nodeId: number }) {
  const node = useGraph((s) => s.nodes[nodeId]);
  const expanded = useGraph((s) => s.expanded[nodeId]);
  const expanding = useUi((s) => s.expanding);
  const audio = useAudio();
  const ref = useRef<HTMLDivElement>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Follow the orb while the simulation drifts.
  useEffect(() => {
    let raf = 0;
    const track = () => {
      const el = ref.current;
      const p = getPositions().get(nodeId);
      if (el && p) {
        const t = canvas.getTransform();
        const r = p.r * t.k;
        const sx = p.x * t.k + t.x;
        const sy = p.y * t.k + t.y;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const gap = 16;
        let x = sx + r + gap;
        if (x + w > window.innerWidth - 12) x = sx - r - gap - w;
        const y = Math.min(
          Math.max(sy - h / 2, 12),
          window.innerHeight - h - 12
        );
        el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      }
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    return () => cancelAnimationFrame(raf);
  }, [nodeId]);

  if (!node) return null;

  const isPlayingThis = audio.artistId === nodeId && audio.playing;

  const playPreview = async () => {
    if (isPlayingThis) {
      audio.toggle();
      return;
    }
    setLoadingPreview(true);
    const details = await fetchDetails(nodeId);
    setLoadingPreview(false);
    const track = details?.tracks[0];
    if (track) audio.play(track, nodeId, node.name);
    else useUi.getState().showToast(`No preview available for ${node.name}`);
  };

  const expandDir = (direction: Direction) => {
    void expand(nodeId, direction);
    useUi.getState().openMenu(null);
  };

  const remove = () => {
    useUi.getState().openMenu(null);
    useGraph.getState().removeNode(nodeId);
  };

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    opts?: { done?: boolean; busy?: boolean; danger?: boolean }
  ) => (
    <button
      className={`menu-item ${opts?.danger ? "is-danger" : ""}`}
      onClick={onClick}
      disabled={opts?.done || opts?.busy}
    >
      <span className="menu-icon">{opts?.done ? <CheckIcon /> : icon}</span>
      <span>{label}</span>
      {opts?.busy && <span className="menu-busy" />}
    </button>
  );

  return (
    <motion.div
      ref={ref}
      className="orb-menu glass"
      style={{ "--accent": node.accent } as React.CSSProperties}
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="menu-header">
        <span className="menu-title">{node.name}</span>
        {node.reason && <span className="menu-reason">{node.reason}</span>}
      </div>

      {item(
        isPlayingThis ? <PauseIcon /> : <PlayIcon />,
        isPlayingThis ? "Pause preview" : "Play preview",
        playPreview,
        { busy: loadingPreview }
      )}
      {item(<RootsIcon />, "Roots — who shaped them", () => expandDir("back"), {
        done: Boolean(expanded?.back),
        busy: Boolean(expanding[`${nodeId}:back`]),
      })}
      {item(
        <BranchesIcon />,
        "Branches — who they shaped",
        () => expandDir("forward"),
        {
          done: Boolean(expanded?.forward),
          busy: Boolean(expanding[`${nodeId}:forward`]),
        }
      )}
      {item(<TracksIcon />, "Tracks & details", () =>
        useUi.getState().openDetail(nodeId)
      )}

      <div className="menu-links">
        <span className="menu-links-label">
          <ExternalIcon size={12} /> Open in
        </span>
        <div className="menu-links-row">
          {streamingLinks(node.name, node.id).map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noreferrer">
              {l.name}
            </a>
          ))}
        </div>
      </div>

      {item(<CloseIcon />, "Remove from canvas", remove, { danger: true })}
    </motion.div>
  );
}
