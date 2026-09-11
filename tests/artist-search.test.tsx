// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArtistSearch } from "../hooks/useArtistSearch";

const artist = { id: 1, name: "Test artist", picture: "", pictureBig: "" };
const reply = (artists = [artist]) => ({ ok: true, json: async () => ({ artists }) });
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(200); });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("artist search requests", () => {
  it("debounces typing and does not restart or hang on whitespace edits", async () => {
    const fetch = vi.fn().mockResolvedValue(reply()); vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(({ q }) => useArtistSearch(q), { initialProps: { q: "whitespace" } });
    rerender({ q: "whitespace test" });
    await tick();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    rerender({ q: "whitespace test " });
    expect(result.current.loading).toBe(false);
    expect(result.current.results).toEqual([artist]);
    await tick(); expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("ignores late responses after clearing and aborts the request", async () => {
    let resolve!: (value: unknown) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise((r) => { resolve = r; })); vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(({ q }) => useArtistSearch(q), { initialProps: { q: "clear race" } });
    await tick();
    rerender({ q: "" });
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { resolve(reply()); });
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    rerender({ q: "new request" });
    expect(result.current.results).toEqual([]);
  });

  it("retains the previous results while marking them as loading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply()));
    const { result, rerender } = renderHook(({ q }) => useArtistSearch(q), { initialProps: { q: "retain" } });
    await tick();
    rerender({ q: "retain next" });
    expect(result.current.results).toEqual([artist]);
    expect(result.current.loading).toBe(true);
    await tick(); expect(result.current.loading).toBe(false);
  });

  it("surfaces failures and recovers on retry", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(reply()); vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useArtistSearch("retry failure"));
    await tick(); expect(result.current.error).toBeTruthy();
    act(() => result.current.retry());
    expect(result.current.loading).toBe(true);
    await tick(); expect(result.current.error).toBe(""); expect(result.current.results).toEqual([artist]);
  });

  it("reuses cached results and filters the excluded artist", async () => {
    const fetch = vi.fn().mockResolvedValue(reply()); vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(({ q, excluded }) => useArtistSearch(q, excluded), { initialProps: { q: "cached artist", excluded: 2 } });
    await tick();
    rerender({ q: "", excluded: 1 });
    rerender({ q: "cached artist", excluded: 1 });
    await tick();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.results).toEqual([]);
  });
});
