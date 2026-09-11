// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ArtistSearch from "../components/ArtistSearch";

vi.mock("@/store/actions", () => ({ seedFromSearch: vi.fn() }));
vi.mock("@/lib/canvas-controller", () => ({ canvas: { fitAll: vi.fn() } }));
const artists = [{ id: 1, name: "First artist", picture: "photo", pictureBig: "photo" }, { id: 2, name: "Second artist", picture: "photo", pictureBig: "photo" }];
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(200); });
const search = async (q: string) => {
  const input = screen.getByRole("combobox");
  fireEvent.focus(input); fireEvent.change(input, { target: { value: q } }); await tick(); return input;
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ artists }) }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("moves from the first result with arrows and picks the active result once", async () => {
  const onPick = vi.fn().mockResolvedValue(undefined);
  render(<ArtistSearch variant="panel" onPick={onPick} />);
  const input = await search("keyboard");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); fireEvent.keyDown(input, { key: "Enter" }); });
  expect(onPick).toHaveBeenCalledExactlyOnceWith(artists[1]);
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("does not reopen dismissed results when a pending request completes", async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise((r) => { resolve = r; })));
  render(<ArtistSearch variant="panel" />);
  const input = await search("dismiss pending");
  fireEvent.keyDown(input, { key: "Escape" });
  await act(async () => { resolve({ ok: true, json: async () => ({ artists }) }); });
  expect(input.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("blocks stale selections during a new query and preserves input on pick failure", async () => {
  const onPick = vi.fn().mockRejectedValue(new Error("offline"));
  render(<ArtistSearch variant="panel" onPick={onPick} />);
  const input = await search("stale selection");
  fireEvent.change(input, { target: { value: "updated selection" } });
  fireEvent.click(screen.getAllByRole("option")[0]);
  expect(onPick).not.toHaveBeenCalled();
  await tick();
  await act(async () => { fireEvent.click(screen.getAllByRole("option")[0]); });
  expect(screen.getByRole("status").textContent).toContain("Couldn't open First artist");
  expect((input as HTMLInputElement).value).toBe("updated selection");
  expect(input.hasAttribute("readonly")).toBe(false);
});

it("uses unique input IDs and closes on focus leaving the widget", async () => {
  const { unmount } = render(<><ArtistSearch variant="panel" /><ArtistSearch variant="panel" /></>);
  const inputs = screen.getAllByRole("combobox");
  expect(inputs[0].id).not.toBe(inputs[1].id);
  unmount();
  render(<ArtistSearch variant="panel" />);
  const input = await search("blur test");
  fireEvent.blur(input, { relatedTarget: document.body });
  expect(input.getAttribute("aria-expanded")).toBe("false");
});
