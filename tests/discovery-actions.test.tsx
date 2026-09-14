// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Landing from "../components/Landing";
import { useGraph } from "../store/graph";
import { useUi } from "../store/ui";
import { canvas } from "../lib/canvas-controller";
import { expand } from "../store/actions";

const artist = { id: 123, name: "Test Artist", picture: "/photo.jpg", pictureBig: "/photo.jpg" };
vi.mock("@/lib/discovery-artists.json", () => ({ default: [{ id: 123, name: "Test Artist", picture: "/photo.jpg", pictureBig: "/photo.jpg" }] }));
vi.mock("@/lib/discovery-field", () => ({ discoveryCells: () => [{ key: "0:0", index: 0, x: 0, y: 0, size: 120 }] }));
vi.mock("@/lib/canvas-controller", () => ({ canvas: { adoptDiscovery: vi.fn(), fitAll: vi.fn() } }));
vi.mock("@/lib/split-audio", () => ({ primeSplitAudio: vi.fn() }));
vi.mock("@/store/actions", () => ({ fetchDetails: vi.fn(async () => ({ id: 123, name: "Test Artist", picture: "/photo.jpg", pictureBig: "/photo.jpg", accent: "#a3a3a3", tracks: [], fans: 10, bio: "An artist biography." })), expand: vi.fn() }));
vi.mock("motion/react", async () => ({ ...await vi.importActual("motion/react"), useReducedMotion: () => true }));

beforeEach(() => {
  vi.clearAllMocks();
  useGraph.setState({ nodes: {}, order: [], edges: [], hydrated: true, selectedIds: [], selectedId: null });
  useUi.getState().closeAll();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens artist details over the discovery field and returns to its actions without seeding the graph", async () => {
  render(<Landing />);
  fireEvent.click(screen.getByRole("button", { name: "Explore Test Artist" }));
  fireEvent.click(screen.getByRole("button", { name: "Artist details for Test Artist" }));
  await screen.findByText("An artist biography.");
  expect(document.querySelector(".discovery-surface")).not.toBeNull();
  expect(useGraph.getState().order).toEqual([]);
  expect(canvas.adoptDiscovery).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back to artist actions" }));
  expect(screen.getByRole("button", { name: "Roots" })).toBeDefined();
  expect(useGraph.getState().order).toEqual([]);
});

it.each([["Roots", "back"], ["Branches", "forward"], ["Connect to…", "connect"]] as const)("hands off %s at the selected portrait without fitting or recentering", async (label, action) => {
  render(<Landing />);
  fireEvent.click(screen.getByRole("button", { name: "Explore Test Artist" }));
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(useGraph.getState().order).toEqual([artist.id]));
  expect(canvas.adoptDiscovery).toHaveBeenCalledExactlyOnceWith(artist.id, expect.any(Number), expect.any(Number), expect.any(Number));
  expect(canvas.fitAll).not.toHaveBeenCalled();
  if (action === "connect") await waitFor(() => expect(useUi.getState().connectingFrom).toBe(artist.id));
  else await waitFor(() => expect(expand).toHaveBeenCalledExactlyOnceWith(artist.id, action));
});
