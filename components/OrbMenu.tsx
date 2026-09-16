"use client";

import { useLayoutEffect, useState } from "react";
import { getOrbEls } from "@/lib/registry";
import { primeSplitAudio } from "@/lib/split-audio";
import { expand } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import ArtistOrbMenu, { type OrbAction, type OrbMenuOrigin } from "./ArtistOrbMenu";

export default function OrbMenu() {
  const menuFor = useUi((s) => s.menuFor);
  const node = useGraph((s) => menuFor !== null ? s.nodes[menuFor] : null);
  return node ? <FocusedArtistMenu key={node.id} nodeId={node.id} /> : null;
}

function readOrigin(nodeId: number): OrbMenuOrigin | null {
  const rect = getOrbEls().get(nodeId)?.getBoundingClientRect();
  if (!rect || !rect.width) return null;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, size: rect.width };
}

function FocusedArtistMenu({ nodeId }: { nodeId: number }) {
  const node = useGraph((s) => s.nodes[nodeId]);
  const expanded = useGraph((s) => s.expanded[nodeId]);
  const expanding = useUi((s) => s.expanding);
  const detailFor = useUi((s) => s.detailFor);
  const [origin, setOrigin] = useState<OrbMenuOrigin | null>(() => readOrigin(nodeId));

  // Keep the shared menu attached as physics, zoom, or viewport size changes.
  useLayoutEffect(() => {
    let frame = 0;
    const follow = () => {
      const next = readOrigin(nodeId);
      if (next) setOrigin((current) => current && Math.abs(current.x - next.x) < 0.1 && Math.abs(current.y - next.y) < 0.1 && Math.abs(current.size - next.size) < 0.1 ? current : next);
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [nodeId]);

  if (!node || !origin) return null;

  const dismiss = () => {
    useUi.getState().openMenu(null);
    requestAnimationFrame(() => getOrbEls().get(nodeId)?.focus({ preventScroll: true }));
  };
  const act = (action: OrbAction) => {
    if (action === "connect") {
      useUi.getState().startConnecting(nodeId);
      return;
    }
    if (expanded?.[action] || expanding[`${nodeId}:${action}`]) return;
    primeSplitAudio();
    dismiss();
    void expand(nodeId, action);
  };

  return <ArtistOrbMenu
    selection={{ artist: node, ...origin }}
    onDismiss={dismiss}
    onAction={act}
    detailsOpen={detailFor === nodeId}
    onDetailsChange={(open) => useUi.getState().openDetail(open ? nodeId : null)}
    expanded={expanded}
    expanding={{ back: Boolean(expanding[`${nodeId}:back`]), forward: Boolean(expanding[`${nodeId}:forward`]) }}
  />;
}
