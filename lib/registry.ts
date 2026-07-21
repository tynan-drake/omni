"use client";

/**
 * DOM registries for imperative per-frame updates. The force simulation writes
 * orb transforms and edge endpoints directly so React never re-renders on tick.
 */

const orbEls = new Map<number, HTMLDivElement>();
const edgeEls = new Map<string, SVGGElement>();

export function registerOrb(id: number, el: HTMLDivElement | null): void {
  if (el) orbEls.set(id, el);
  else orbEls.delete(id);
}

export function registerEdge(id: string, el: SVGGElement | null): void {
  if (el) edgeEls.set(id, el);
  else edgeEls.delete(id);
}

export const getOrbEls = () => orbEls;
export const getEdgeEls = () => edgeEls;
