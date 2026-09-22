"use client";

import { useUi } from "@/store/ui";
import { useGraph } from "@/store/graph";
import Canvas from "./Canvas";
import CanvasContextMenu from "./CanvasContextMenu";
import CanvasPersistence from "./CanvasPersistence";
import CommandPalette from "./CommandPalette";
import DiscoveryIntroDials from "./DiscoveryIntroDials";
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

  const discoveryOpen = useUi((s) => s.discoveryOpen);

  return (
    <>
      <CanvasPersistence />
      <OrbFilters />
      <div className={discoveryOpen ? "exploration-is-hidden" : undefined} inert={discoveryOpen}>
        <Canvas />
        <CanvasContextMenu />
        <OrbMenu />
        <PlaylistBuilder />
        <CommandPalette />
        <ShortcutsOverlay />
        <Sidebar />
        {hasNodes && <ZoomBar />}
      </div>
      <NowPlaying />
      <Landing />
      <Toast />
      <Shortcuts />
      <OrbDials />
      <WordmarkDials />
      <DiscoveryIntroDials />
    </>
  );
}
