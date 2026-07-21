"use client";

import { useEffect } from "react";
import { canvas } from "@/lib/canvas-controller";
import { expand } from "@/store/actions";
import { useAudio } from "@/store/audio";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable
  );
};

/** Headless global keyboard shortcut handler. */
export default function Shortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ui = useUi.getState();

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }

      if (e.key === "Escape") {
        ui.closeAll();
        useGraph.getState().select(null);
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }

      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "/": {
          e.preventDefault();
          document
            .querySelector<HTMLInputElement>("[data-omni-search]")
            ?.focus();
          break;
        }
        case "f":
        case "F":
          canvas.fitAll();
          break;
        case "+":
        case "=":
          canvas.zoomBy(1.35);
          break;
        case "-":
        case "_":
          canvas.zoomBy(1 / 1.35);
          break;
        case " ": {
          if (useAudio.getState().track) {
            e.preventDefault();
            useAudio.getState().toggle();
          }
          break;
        }
        case "r":
        case "R": {
          const id = useGraph.getState().selectedId;
          if (id !== null) void expand(id, "back");
          break;
        }
        case "b":
        case "B": {
          const id = useGraph.getState().selectedId;
          if (id !== null) void expand(id, "forward");
          break;
        }
        case "p":
        case "P":
          ui.setPlaylistOpen(!ui.playlistOpen);
          break;
        case "?":
          ui.setShortcutsOpen(!ui.shortcutsOpen);
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
