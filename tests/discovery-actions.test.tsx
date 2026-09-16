// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Landing from "../components/Landing";
import OrbMenu from "../components/OrbMenu";
import { registerOrb } from "../lib/registry";
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
  useGraph.setState({ nodes: {}, order: [], edges: [], expanded: {}, hydrated: true, selectedIds: [], selectedId: null });
  useUi.getState().closeAll();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => { registerOrb(artist.id, null); cleanup(); vi.unstubAllGlobals(); });

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

function registerFocusedArtist() {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ x: 200, y: 250, width: 120, height: 120, top: 250, left: 200, right: 320, bottom: 370, toJSON: () => ({}) });
  registerOrb(artist.id, element);
}

it("keeps the circular menu after discovery hands off to the focused canvas", async () => {
  registerFocusedArtist();
  render(<><Landing /><OrbMenu /></>);
  fireEvent.click(screen.getByRole("button", { name: "Explore Test Artist" }));
  fireEvent.click(screen.getByRole("button", { name: "Branches" }));
  await waitFor(() => expect(expand).toHaveBeenCalledWith(artist.id, "forward"));
  act(() => useUi.getState().openMenu(artist.id));
  expect(screen.getByRole("button", { name: "Roots" }).className).toContain("rounded-full");
  expect(screen.getByRole("button", { name: "Connect to…" }).className).toContain("size-11");
  expect(screen.getByRole("button", { name: "Play preview" })).toBeDefined();
  expect(screen.queryByText("Years active")).toBeNull();
  expect(screen.queryByText("Open in")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Artist details for Test Artist" }));
  await screen.findByText("An artist biography.");
  expect(useUi.getState().detailFor).toBe(artist.id);
  fireEvent.click(screen.getByRole("button", { name: "Back to artist actions" }));
  expect(screen.getByRole("button", { name: "Branches" })).toBeDefined();
  expect(useUi.getState().detailFor).toBeNull();
});

it("preserves explored and loading states in the focused circular menu", () => {
  registerFocusedArtist();
  useGraph.getState().addSeed({ ...artist, accent: "#a3a3a3" });
  useGraph.setState({ expanded: { [artist.id]: { back: true, forward: false } } });
  useUi.getState().setExpanding(artist.id, "forward", true);
  useUi.getState().openMenu(artist.id);
  render(<OrbMenu />);
  const roots = screen.getByRole("button", { name: "Roots" }) as HTMLButtonElement;
  const branches = screen.getByRole("button", { name: "Branches" }) as HTMLButtonElement;
  expect(roots.disabled).toBe(true);
  expect(branches.disabled).toBe(true);
  expect(branches.getAttribute("aria-busy")).toBe("true");
  fireEvent.click(roots);
  fireEvent.click(branches);
  expect(expand).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Connect to…" }));
  expect(useUi.getState().connectingFrom).toBe(artist.id);
});
