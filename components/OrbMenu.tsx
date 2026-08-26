"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { canvas } from "@/lib/canvas-controller";
import { getPositions } from "@/lib/simulation";
import { streamingLinks } from "@/lib/links";
import { primeSplitAudio } from "@/lib/split-audio";
import type { Direction } from "@/lib/types";
import { expand, fetchDetails, removeArtists } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { useAudio } from "@/store/audio";
import { useUi } from "@/store/ui";
import {
  BranchesIcon,
  CheckIcon,
  CloseIcon,
  ExternalIcon,
  LinkIcon,
  PauseIcon,
  PlayIcon,
  RootsIcon,
  TracksIcon,
} from "./Icons";
import DetailPanel from "./DetailPanel";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * Read top-to-bottom. Each value is ms after the mode changes.
 *
 *   0ms   shell springs 250×384 → 720×440 without scaling content
 *   0ms   outgoing module begins a soft opacity/blur exit
 *  55ms   incoming module fades in at its final text scale
 * ~300ms  shell settles beside the selected orb
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  shellOpacity: 120, // shell fades on mount and unmount
  contentExit: 90,   // outgoing module clears quickly
  contentDelay: 55,  // incoming module waits for the handoff
  contentEnter: 180, // incoming module resolves gently
};

const MENU_SHELL = {
  actionWidth: 250,
  actionHeight: 384,
  detailWidth: 720,
  detailHeight: 440,
  initialScale: 0.86,
  exitScale: 0.96,
  spring: {
    type: "spring" as const,
    stiffness: 420,
    damping: 38,
    mass: 0.8,
  },
};

const MENU_CONTENT = {
  offsetX: 8,
  blur: "blur(4px)",
  clear: "blur(0px)",
  ease: "easeOut" as const,
};

const seconds = (milliseconds: number) => milliseconds / 1000;

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
  const detailFor = useUi((s) => s.detailFor);
  const prefersReducedMotion = useReducedMotion();
  const audio = useAudio();
  const ref = useRef<HTMLDivElement>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [startYear, setStartYear] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchDetails(nodeId).then((details) => {
      if (alive) setStartYear(details?.startYear ?? null);
    });
    return () => {
      alive = false;
    };
  }, [nodeId]);

  // Follow the orb while the simulation drifts.
  useLayoutEffect(() => {
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
        el.classList.replace("invisible", "visible");
      }
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [nodeId]);

  if (!node) return null;

  const isPlayingThis = audio.artistId === nodeId && audio.playing;
  const showingDetails = detailFor === nodeId;
  const shellTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        width: MENU_SHELL.spring,
        height: MENU_SHELL.spring,
        scale: MENU_SHELL.spring,
        opacity: { duration: seconds(TIMING.shellOpacity) },
      };
  const visibleContent = {
    opacity: 1,
    x: 0,
    filter: MENU_CONTENT.clear,
  };
  const hiddenContent = (direction: number) =>
    prefersReducedMotion
      ? { opacity: 0, x: 0, filter: MENU_CONTENT.clear }
      : {
          opacity: 0,
          x: MENU_CONTENT.offsetX * direction,
          filter: MENU_CONTENT.blur,
        };

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
    primeSplitAudio();
    void expand(nodeId, direction);
    useUi.getState().openMenu(null);
  };

  const remove = () => {
    useUi.getState().openMenu(null);
    removeArtists([nodeId]);
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
      className="fixed left-0 top-0 z-[55] invisible will-change-transform"
    >
      <motion.div
        className="orb-menu glass relative !p-0 overflow-hidden backdrop-blur-3xl"
        style={{ "--accent": node.accent } as React.CSSProperties}
        initial={{
          opacity: 0,
          scale: prefersReducedMotion ? 1 : MENU_SHELL.initialScale,
          width: MENU_SHELL.actionWidth,
          height: MENU_SHELL.actionHeight,
        }}
        animate={{
          opacity: 1,
          scale: 1,
          width: showingDetails ? MENU_SHELL.detailWidth : MENU_SHELL.actionWidth,
          height: showingDetails ? MENU_SHELL.detailHeight : MENU_SHELL.actionHeight,
        }}
        exit={{
          opacity: 0,
          scale: prefersReducedMotion ? 1 : MENU_SHELL.exitScale,
        }}
        transition={shellTransition}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="sync" initial={false}>
          {showingDetails ? (
            <motion.div
              key="details"
              className="absolute inset-y-0 left-0 w-180"
              initial={hiddenContent(1)}
              animate={visibleContent}
              exit={hiddenContent(1)}
              transition={{
                duration: prefersReducedMotion ? 0 : seconds(TIMING.contentEnter),
                delay: prefersReducedMotion ? 0 : seconds(TIMING.contentDelay),
                ease: MENU_CONTENT.ease,
              }}
            >
              <DetailPanel nodeId={nodeId} />
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              className="absolute inset-y-0 left-0 w-62.5 p-2"
              initial={hiddenContent(-1)}
              animate={visibleContent}
              exit={hiddenContent(-1)}
              transition={{
                duration: prefersReducedMotion ? 0 : seconds(TIMING.contentExit),
                ease: MENU_CONTENT.ease,
              }}
            >
              <div className="menu-header">
                <span className="menu-title">{node.name}</span>
                <span className="menu-reason">
                  {startYear
                    ? `Years active · Est. ${startYear}`
                    : node.era
                      ? `Years active · ${node.era}`
                      : "Years active"}
                </span>
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
              {item(<LinkIcon />, "Connect to…", () =>
                useUi.getState().startConnecting(nodeId)
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
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
