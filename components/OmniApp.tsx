"use client";

import { useGraph } from "@/store/graph";
import Canvas from "./Canvas";
import CommandPalette from "./CommandPalette";
import DetailPanel from "./DetailPanel";
import Landing from "./Landing";
import NowPlaying from "./NowPlaying";
import OrbMenu from "./OrbMenu";
import PlaylistBuilder from "./PlaylistBuilder";
import Shortcuts from "./Shortcuts";
import ShortcutsOverlay from "./ShortcutsOverlay";
import Toast from "./Toast";
import TopBar from "./TopBar";

export default function OmniApp() {
  const hasNodes = useGraph((s) => s.order.length > 0);

  return (
    <>
      <Canvas />
      <OrbMenu />
      <DetailPanel />
      <PlaylistBuilder />
      <CommandPalette />
      <ShortcutsOverlay />
      <NowPlaying />
      {hasNodes && <TopBar />}
      <Landing />
      <Toast />
      <Shortcuts />
    </>
  );
}
