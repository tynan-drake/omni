// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Sidebar from "../components/Sidebar";
import Shortcuts from "../components/Shortcuts";
import ZoomBar from "../components/ZoomBar";
import { useGraph } from "../store/graph";
import { useUi } from "../store/ui";
import { useHistory } from "../store/history";

vi.mock("@/store/actions", () => ({ navigateToArtist: vi.fn(), expand: vi.fn(), removeArtists: vi.fn() }));
vi.mock("@/components/BridgePanel", () => ({ default: () => <div>Connections</div> }));
vi.mock("@/lib/canvas-controller", () => ({
  canvas: { fitAll: vi.fn(), zoomTo: vi.fn(), zoomBy: vi.fn() },
  getScale: () => 1, subscribeScale: () => () => {}, ZOOM_MAX: 2.5, ZOOM_MIN: 0.15,
}));

beforeEach(() => {
  useUi.setState(useUi.getInitialState());
  useGraph.getState().reset();
  useGraph.getState().addSeed({ id: 1, name: "Test artist", picture: "photo", pictureBig: "photo", accent: "#aaa" });
  useHistory.getState().clear();
});
afterEach(cleanup);

function spotlightBridge() {
  useUi.getState().resumeExploration();
  useGraph.setState({
    activeBridgeId: "saved-bridge",
    bridgeOrder: ["saved-bridge"],
    bridges: {
      "saved-bridge": {
        id: "saved-bridge", name: "Artist one → Artist two", endpointIds: [1, 2],
        mode: "influence", generationSource: "curated", degraded: false,
        paths: [], nodeIds: [1, 2], edgeIds: [], createdAt: 1, updatedAt: 1,
      },
    },
  });
}

it("exits the bridge spotlight without deleting its saved graph and can spotlight it again", () => {
  spotlightBridge();
  const before = useGraph.getState().snapshot();
  render(<Sidebar />);
  fireEvent.click(screen.getByRole("button", { name: "Back to exploration" }));
  expect(useGraph.getState().snapshot()).toEqual({ ...before, activeBridgeId: null });
  expect(screen.queryByRole("complementary", { name: "Bridge spotlight" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Find an artist" }));
  act(() => useGraph.getState().setActiveBridge("saved-bridge"));
  expect(screen.getByRole("button", { name: "Back to exploration" })).toBeTruthy();
});

it("Escape closes a foreground panel before dismissing the bridge spotlight", () => {
  spotlightBridge();
  useUi.getState().setPlaylistOpen(true);
  render(<Shortcuts />);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(useUi.getState().playlistOpen).toBe(false);
  expect(useGraph.getState().activeBridgeId).toBe("saved-bridge");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(useGraph.getState().activeBridgeId).toBeNull();
  expect(useGraph.getState().bridgeOrder).toEqual(["saved-bridge"]);
});

it("Home preserves the graph and selection while closing canvas panels; resume restores exploration mode", () => {
  render(<><Sidebar /><Shortcuts /></>);
  fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));
  const before = useGraph.getState().snapshot();
  fireEvent.click(screen.getByRole("button", { name: "Home" }));
  expect(useUi.getState().discoveryOpen).toBe(true);
  expect(useUi.getState().playlistOpen).toBe(false);
  fireEvent.keyDown(window, { key: "Delete" });
  fireEvent.keyDown(window, { key: "p" });
  expect(useGraph.getState().snapshot()).toEqual(before);
  expect(useUi.getState().playlistOpen).toBe(false);
  act(() => useUi.getState().resumeExploration());
  expect(useUi.getState().discoveryOpen).toBe(false);
  expect(useGraph.getState().snapshot()).toEqual(before);
});

it("Search exposes recent artists and dismisses them with Escape", () => {
  render(<Sidebar />);
  fireEvent.focus(screen.getByRole("combobox", { name: "Find an artist" }));
  expect(screen.getByRole("heading", { name: "Recent artists" })).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });
  expect(screen.queryByRole("heading", { name: "Recent artists" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear artist search" }));
  expect(screen.getByRole("heading", { name: "Recent artists" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  expect(screen.queryByRole("heading", { name: "Recent artists" })).toBeNull();
});

it("opening a playlist closes Search, and opening Search closes the playlist", () => {
  render(<Sidebar />);
  fireEvent.focus(screen.getByRole("combobox", { name: "Find an artist" }));
  fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));
  expect(useUi.getState().navPanel).toBeNull();
  expect(useUi.getState().playlistOpen).toBe(true);
  fireEvent.focus(screen.getByRole("combobox", { name: "Find an artist" }));
  expect(useUi.getState().playlistOpen).toBe(false);
});

it("selection mode stays visible, creates a scoped playlist, and has a Done exit", () => {
  render(<ZoomBar />);
  fireEvent.click(screen.getByRole("button", { name: /View options/ }));
  fireEvent.click(screen.getByRole("button", { name: "Select artists" }));
  expect(screen.getByRole("status").textContent).toContain("1 selected");
  fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));
  expect(useUi.getState().playlistArtistIds).toEqual([1]);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(useUi.getState().canvasTool).toBe("pan");
  expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
});
