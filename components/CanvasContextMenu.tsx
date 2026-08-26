"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { motion } from "motion/react";
import { removeArtists, seedFromSearch } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import ArtistSearch from "./ArtistSearch";
import { PlaylistIcon, TrashIcon } from "./Icons";

const PAGE_GAP = 10;

export default function CanvasContextMenu() {
  const menu = useUi((state) => state.canvasContextMenu);
  const nodes = useGraph((state) => state.nodes);
  const order = useGraph((state) => state.order);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const triggerRef = useRef<HTMLElement | null>(null);

  const nodeIds = menu?.nodeIds.filter((id) => Boolean(nodes[id])) ?? [];
  const allNodeIds = order.filter((id) => Boolean(nodes[id]));
  const canvasTarget = menu?.target === "canvas";
  const scopeIds = canvasTarget && !nodeIds.length ? allNodeIds : nodeIds;

  const close = (restoreFocus = true) => {
    useUi.getState().openCanvasContextMenu(null);
    if (restoreFocus && triggerRef.current?.isConnected) triggerRef.current.focus();
  };

  useLayoutEffect(() => {
    if (!menu || !rootRef.current) return;
    const { width, height } = rootRef.current.getBoundingClientRect();
    rootRef.current.style.left = `${Math.min(
      Math.max(menu.x, PAGE_GAP),
      window.innerWidth - width - PAGE_GAP
    )}px`;
    rootRef.current.style.top = `${Math.min(
      Math.max(menu.y, PAGE_GAP),
      window.innerHeight - height - PAGE_GAP
    )}px`;
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    if (canvasTarget) {
      rootRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    } else {
      itemRefs.current[0]?.focus();
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onResize = () => close(false);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [canvasTarget, menu]);

  if (!menu || (!canvasTarget && !nodeIds.length)) return null;

  const addArtist = async (artist: Parameters<typeof seedFromSearch>[0]) => {
    close(false);
    await seedFromSearch(artist);
  };

  const actions = canvasTarget
    ? [
        ...(scopeIds.length
          ? [
              {
                label: "Create playlist",
                icon: <PlaylistIcon />,
                run: () => {
                  const ui = useUi.getState();
                  if (nodeIds.length) ui.openPlaylistFor(scopeIds);
                  else ui.setPlaylistOpen(true);
                },
                danger: false,
              },
            ]
          : []),
      ]
    : [
        {
          label: "Create playlist",
          icon: <PlaylistIcon />,
          run: () => useUi.getState().openPlaylistFor(scopeIds),
          danger: false,
        },
        {
          label: `Remove ${scopeIds.length === 1 ? "artist" : "artists"}`,
          icon: <TrashIcon />,
          run: () => removeArtists(scopeIds),
          danger: true,
        },
      ];

  const moveFocus = (current: number, delta: number) => {
    const items = itemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null
    );
    const next = (current + delta + items.length) % items.length;
    items[next]?.focus();
  };

  const menuLabel = canvasTarget
    ? nodeIds.length
      ? `Canvas actions for ${nodeIds.length} selected artist${nodeIds.length === 1 ? "" : "s"}`
      : `Canvas actions for all ${scopeIds.length} artist${scopeIds.length === 1 ? "" : "s"}`
    : `Actions for ${nodeIds.length} selected artist${nodeIds.length === 1 ? "" : "s"}`;

  return (
    <motion.div
      ref={rootRef}
      className="canvas-context-menu glass"
      role={canvasTarget ? "dialog" : "menu"}
      aria-label={menuLabel}
      style={{ left: menu.x, top: menu.y }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (canvasTarget || event.target instanceof HTMLInputElement) return;
        const index = itemRefs.current.indexOf(event.target as HTMLButtonElement);
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(Math.max(index, 0), 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(Math.max(index, 0), -1);
        } else if (event.key === "Home") {
          event.preventDefault();
          itemRefs.current[0]?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          itemRefs.current.at(-1)?.focus();
        }
      }}
    >
      <div className="canvas-context-label">
        {canvasTarget && !nodeIds.length
          ? `${scopeIds.length} artist${scopeIds.length === 1 ? "" : "s"} on canvas`
          : `${nodeIds.length} artist${nodeIds.length === 1 ? "" : "s"} selected`}
      </div>
      {canvasTarget && (
        <ArtistSearch
          variant="context"
          placeholder="Add artist…"
          label="Add artist"
          autoFocus
          onPick={addArtist}
        />
      )}
      {actions.map((action, index) => (
        <button
          key={action.label}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          className={`canvas-context-item ${action.danger ? "is-danger" : ""}`}
          role="menuitem"
          onClick={action.run}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </motion.div>
  );
}
