// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDelayedBusy } from "../hooks/useDelayedBusy";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

it("suppresses quick requests and clears the indicator immediately on completion", () => {
  const { result, rerender } = renderHook(({ active }) => useDelayedBusy(active, 2000), { initialProps: { active: true } });
  advance(1999);
  expect(result.current).toBe(false);
  rerender({ active: false });
  advance(100);
  expect(result.current).toBe(false);
  rerender({ active: true });
  advance(2000);
  expect(result.current).toBe(true);
  rerender({ active: false });
  expect(result.current).toBe(false);
  rerender({ active: true });
  expect(result.current).toBe(false);
});

it("restarts the delay when a pending search is replaced without going idle", () => {
  const { result, rerender } = renderHook(({ query }) => useDelayedBusy(true, 3000, query), { initialProps: { query: "first" } });
  advance(2500);
  rerender({ query: "second" });
  advance(500);
  expect(result.current).toBe(false);
  advance(2500);
  expect(result.current).toBe(true);
  rerender({ query: "third" });
  expect(result.current).toBe(false);
  advance(3000);
  expect(result.current).toBe(true);
});
