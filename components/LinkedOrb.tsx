"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { canvas } from "@/lib/canvas-controller";
import { getOrbEls } from "@/lib/registry";
import { reserveConnectionSpace } from "@/lib/simulation";
import type { ArtistRef, BridgeMode } from "@/lib/types";
import { connectArtists } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import ArtistSearch from "./ArtistSearch";
import { CloseIcon } from "./Icons";

/* ANIMATION STORYBOARD — once each time Connect opens.
 *   0ms  Anchor to the real source; camera eases to frame the pair over 900ms.
 *  60ms  Reveal the tether left → right; dashes travel toward the destination.
 * 180ms  The destination orb grows and settles into its final position.
 * 300ms  Reveal the destination label and search; focus the input.
 * Reduced motion: show every stage immediately, with stationary dashes.
 */
const TIMING = { tether: 60, orb: 180, search: 300 };
const TETHER = {
  hidden: "inset(0 100% 0 0)", visible: "inset(0 0% 0 0)",
  reveal: { duration: .42, ease: [0.22, 1, 0.36, 1] as const },
  travel: { duration: 1.8, ease: "easeOut" as const },
  distance: "40px",
};
const ORB = {
  hidden: { opacity: 0, scale: .82 },
  visible: { opacity: 1, scale: 1 },
  spring: { type: "spring" as const, visualDuration: .48, bounce: 0 },
};
const SEARCH = {
  hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 },
  spring: { type: "spring" as const, visualDuration: .32, bounce: 0 },
};
const INSTANT = { duration: 0 };

function Portrait({ artist }: { artist: ArtistRef }) {
  return <div className="linked-orb-portrait"><span aria-hidden="true">{artist.name.charAt(0)}</span>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={artist.pictureBig || artist.picture} alt="" onError={e => { e.currentTarget.style.opacity = "0"; }} />
  </div>;
}

export default function LinkedOrb() {
  const fromId = useUi(s => s.connectingFrom);
  const source = useGraph(s => fromId === null ? null : s.nodes[fromId]);
  return source ? <ConnectionComposer key={source.id} source={source} /> : null;
}

function ConnectionComposer({ source }: { source: ArtistRef }) {
  const request = useUi(s => s.bridgeRequest);
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState(0);
  const visibleStage = reducedMotion ? 3 : stage;
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), TIMING.tether),
      setTimeout(() => setStage(2), TIMING.orb),
      setTimeout(() => setStage(3), TIMING.search),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  const root = useRef<HTMLDivElement>(null);
  const destinationOrb = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [position, setPosition] = useState<{ x: number; y: number; size: number; searchX: number; startX: number; startY: number; length: number; angle: number; above: boolean } | null>(null);
  const loading = request?.status === "loading";
  const close = () => {
    useUi.getState().cancelConnecting();
    requestAnimationFrame(() => getOrbEls().get(source.id)?.focus({ preventScroll: true }));
  };

  useLayoutEffect(() => {
    mounted.current = true;
    let frame = 0;
    let stopCamera: (() => void) | undefined;
    let releaseSpace: (() => void) | undefined;
    let offset: { x: number; y: number; size: number; above: boolean } | null = null;
    const follow = () => {
      const rect = getOrbEls().get(source.id)?.getBoundingClientRect();
      if (rect?.width) {
        const { k } = canvas.getTransform();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        if (!offset) {
          const size = Math.min(112, Math.max(72, rect.width));
          const distance = rect.width / 2 + size / 2 + 90;
          // A stable layout lets the camera frame the pair instead of moving orbs.
          const stacked = window.innerWidth < 600;
          offset = { x: stacked ? 0 : distance / k, y: stacked ? distance / k : 0, size: size / k, above: false };
          releaseSpace = reserveConnectionSpace(source.id, offset, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
          stopCamera = canvas.frameConnection(source.id, offset);
        }
        const dx = offset.x * k, dy = offset.y * k;
        const angle = Math.atan2(dy, dx), size = offset.size * k;
        const next = { x: x + dx, y: y + dy, size, searchX: Math.max(Math.min(135, (window.innerWidth - 24) / 2) + 12, Math.min(x + dx, window.innerWidth - Math.min(135, (window.innerWidth - 24) / 2) - 12)), startX: x + Math.cos(angle) * rect.width / 2, startY: y + Math.sin(angle) * rect.width / 2, length: Math.max(0, Math.hypot(dx, dy) - rect.width / 2 - size / 2), angle, above: offset.above };
        setPosition(old => old && Object.keys(next).every(key => old[key as keyof typeof next] === next[key as keyof typeof next]) ? old : next);
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => { mounted.current = false; cancelAnimationFrame(frame); stopCamera?.(); releaseSpace?.(); };
  }, [source.id]);

  useEffect(() => {
    if (visibleStage >= 3 && !request) root.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [visibleStage, request]);

  const connect = (target: ArtistRef, mode: BridgeMode = "influence") => {
    // A Spotify match can resolve after the composer has been dismissed.
    if (!mounted.current || useUi.getState().connectingFrom !== source.id) return;
    const rect = destinationOrb.current?.getBoundingClientRect();
    const transform = canvas.getTransform();
    const destination = rect ? { x: (rect.x + rect.width / 2 - transform.x) / transform.k, y: (rect.y + rect.height / 2 - transform.y) / transform.k } : undefined;
    void connectArtists(source.id, target, mode, destination);
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[aria-label="Cancel connection"]')?.focus({ preventScroll: true }));
  };

  if (!position) return null;
  return <div ref={root} className="linked-orb-layer" role="region" aria-label={`Connect ${source.name}`} onKeyDown={e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  }}>
    <div className="linked-orb-tether" aria-hidden="true" style={{ left: position.startX, top: position.startY, width: position.length, transform: `rotate(${position.angle}rad)` }}>
      <motion.div className="linked-orb-tether-track" initial={reducedMotion ? false : { clipPath: TETHER.hidden }} animate={{ clipPath: visibleStage >= 1 ? TETHER.visible : TETHER.hidden }} transition={reducedMotion ? INSTANT : TETHER.reveal}>
        <motion.i initial={false} animate={{ backgroundPositionX: visibleStage >= 1 && !reducedMotion ? TETHER.distance : "0px" }} transition={reducedMotion ? INSTANT : TETHER.travel} />
      </motion.div>
    </div>
    <div ref={destinationOrb} className={`linked-orb-target ${loading ? "is-loading" : ""}`} style={{ left: position.x, top: position.y, width: position.size, height: position.size }}>
      <motion.div initial={reducedMotion ? false : ORB.hidden} animate={visibleStage >= 2 ? ORB.visible : ORB.hidden} transition={reducedMotion ? INSTANT : ORB.spring}>
        {request ? <Portrait artist={request.target} /> : <div className="linked-orb-placeholder" aria-hidden="true">+</div>}
      </motion.div>
    </div>
    <section className="linked-orb-composer" style={{ left: position.searchX, top: position.y + (position.above ? -1 : 1) * (position.size / 2 + 14), transform: position.above ? "translate(-50%, -100%)" : "translateX(-50%)" }}>
      {visibleStage >= 3 && <motion.div className="linked-orb-search" initial={reducedMotion ? false : SEARCH.hidden} animate={SEARCH.visible} transition={reducedMotion ? INSTANT : SEARCH.spring}>
        <div className="linked-orb-heading">
          <div className="min-w-0 flex-1">
            <strong>{request?.target.name ?? `Connect ${source.name}`}</strong>
            {!request && <p className="mt-0 text-xs leading-snug text-neutral-400">Find an artist to connect with {source.name}.</p>}
          </div>
          <button type="button" className="shrink-0 self-start" aria-label="Cancel connection" onClick={close}><CloseIcon size={14} /></button>
        </div>
        {!request && <div className="pt-2">
          <ArtistSearch variant="panel" label={`Artist to connect with ${source.name}`} placeholder="Search for an artist…" excludeId={source.id} onPick={connect} />
        </div>}
        <div role="status" aria-live="polite" className="linked-orb-status">{request?.message}</div>
        {request && !loading && <div className="linked-orb-recovery">
          {request.status === "error" && <button type="button" className="bridge-primary" onClick={() => connect(request.target, request.mode)}>Try again</button>}
          {request.status === "no_path" && request.mode === "influence" && <button type="button" className="bridge-primary" onClick={() => connect(request.target, "adjacent")}>Try broader musical ties</button>}
          <button type="button" onClick={() => useUi.getState().setBridgeRequest(null)}>Change artist</button>
        </div>}
      </motion.div>}
    </section>
  </div>;
}
