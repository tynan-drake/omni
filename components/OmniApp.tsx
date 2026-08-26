"use client";

import { useGraph } from "@/store/graph";
import Canvas from "./Canvas";
import CanvasContextMenu from "./CanvasContextMenu";
import CanvasPersistence from "./CanvasPersistence";
import CommandPalette from "./CommandPalette";
import Landing from "./Landing";
import NowPlaying from "./NowPlaying";
import OrbDials from "./OrbDials";
import OrbFilters from "./OrbFilters";
import OrbMenu from "./OrbMenu";
import PlaylistBuilder from "./PlaylistBuilder";
import Shortcuts from "./Shortcuts";
import ShortcutsOverlay from "./ShortcutsOverlay";
import Sidebar from "./Sidebar";
import Toast from "./Toast";
import WordmarkDials from "./WordmarkDials";
import ZoomBar from "./ZoomBar";

export default function OmniApp() {
  const hasNodes = useGraph((s) => s.order.length > 0);

  return (
    <>
      <CanvasPersistence />
      <OrbFilters />
      <Canvas />
      <CanvasContextMenu />
      <OrbMenu />
      <PlaylistBuilder />
      <CommandPalette />
      <ShortcutsOverlay />
      <NowPlaying />
      <Sidebar />
      {hasNodes && <ZoomBar />}
      <Landing />
      <Toast />
      <Shortcuts />
      <OrbDials />
      <WordmarkDials />
    </>
  );
}
