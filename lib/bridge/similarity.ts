import { getRadioArtists, getRelatedArtists } from "../deezer";
import type { ArtistRef } from "../types";

interface Visit {
  artist: ArtistRef;
  parent: number | null;
  depth: number;
}

type Neighbours = (id: number, limit: number) => Promise<ArtistRef[]>;
export type SimilarityBasis = "related" | "radio";

const MAX_CONNECTORS = 4;
const RELATED_FIRST_HOP = 20;
const RELATED_SECOND_HOP = 12;
const RADIO_FIRST_HOP = 64;
const RADIO_EXPANSION_LIMIT = 48;
const RADIO_BATCH_SIZE = 4;

async function safeNeighbours(
  neighbours: Neighbours,
  artistId: number,
  limit: number
): Promise<ArtistRef[]> {
  try {
    return await neighbours(artistId, limit);
  } catch {
    return [];
  }
}

function addVisits(
  visited: Map<number, Visit>,
  parent: ArtistRef,
  children: ArtistRef[]
): ArtistRef[] {
  const next: ArtistRef[] = [];
  const parentDepth = visited.get(parent.id)?.depth ?? 0;
  for (const artist of children) {
    if (visited.has(artist.id)) continue;
    visited.set(artist.id, {
      artist,
      parent: parent.id,
      depth: parentDepth + 1,
    });
    next.push(artist);
  }
  return next;
}

async function exploreRelated(seed: ArtistRef): Promise<Map<number, Visit>> {
  const visited = new Map<number, Visit>([
    [seed.id, { artist: seed, parent: null, depth: 0 }],
  ]);
  const first = await safeNeighbours(getRelatedArtists, seed.id, RELATED_FIRST_HOP);
  const frontier = addVisits(visited, seed, first);
  const groups = await Promise.all(
    frontier.slice(0, RELATED_SECOND_HOP).map(async (artist) => ({
      artist,
      children: await safeNeighbours(getRelatedArtists, artist.id, RELATED_FIRST_HOP),
    }))
  );
  for (const group of groups) addVisits(visited, group.artist, group.children);
  return visited;
}

function pathTo(seedId: number, meetId: number, visits: Map<number, Visit>): number[] {
  const reversed: number[] = [];
  let current: number | null = meetId;
  while (current !== null) {
    reversed.push(current);
    if (current === seedId) break;
    current = visits.get(current)?.parent ?? null;
  }
  return reversed.reverse();
}

export interface SimilarityPathResult {
  nodeIds: number[];
  artists: Map<number, ArtistRef>;
  basis: SimilarityBasis;
}

function collectPaths(
  a: ArtistRef,
  b: ArtistRef,
  fromA: Map<number, Visit>,
  fromB: Map<number, Visit>,
  basis: SimilarityBasis
): SimilarityPathResult[] {
  const meetings = [...fromA.keys()]
    .filter((id) => fromB.has(id))
    .sort(
      (left, right) =>
        (fromA.get(left)!.depth + fromB.get(left)!.depth) -
        (fromA.get(right)!.depth + fromB.get(right)!.depth)
    );
  const results: SimilarityPathResult[] = [];
  const seen = new Set<string>();
  for (const meetId of meetings) {
    const left = pathTo(a.id, meetId, fromA);
    const right = pathTo(b.id, meetId, fromB);
    const nodeIds = [...left, ...right.reverse().slice(1)];
    if (
      nodeIds[0] !== a.id ||
      nodeIds.at(-1) !== b.id ||
      nodeIds.length - 2 > MAX_CONNECTORS
    ) {
      continue;
    }
    const signature = nodeIds.join("-");
    if (seen.has(signature)) continue;
    seen.add(signature);
    const artists = new Map<number, ArtistRef>();
    for (const id of nodeIds) {
      const artist = fromA.get(id)?.artist ?? fromB.get(id)?.artist;
      if (artist) artists.set(id, artist);
    }
    if (artists.size === nodeIds.length) results.push({ nodeIds, artists, basis });
    if (results.length === 3) break;
  }
  return results;
}

async function createRadioSide(seed: ArtistRef): Promise<{
  visits: Map<number, Visit>;
  frontier: ArtistRef[];
}> {
  const visits = new Map<number, Visit>([
    [seed.id, { artist: seed, parent: null, depth: 0 }],
  ]);
  const first = await safeNeighbours(getRadioArtists, seed.id, RADIO_FIRST_HOP);
  return {
    visits,
    frontier: addVisits(visits, seed, first).slice(0, RADIO_EXPANSION_LIMIT),
  };
}

async function expandRadioBatch(
  visits: Map<number, Visit>,
  artists: ArtistRef[]
): Promise<void> {
  const groups = await Promise.all(
    artists.map(async (artist) => ({
      artist,
      children: await safeNeighbours(getRadioArtists, artist.id, RADIO_FIRST_HOP),
    }))
  );
  for (const group of groups) addVisits(visits, group.artist, group.children);
}

async function radioBridgePaths(
  a: ArtistRef,
  b: ArtistRef
): Promise<SimilarityPathResult[]> {
  const [fromA, fromB] = await Promise.all([createRadioSide(a), createRadioSide(b)]);
  let found = collectPaths(a, b, fromA.visits, fromB.visits, "radio");
  if (found.length) return found;

  for (let offset = 0; offset < RADIO_EXPANSION_LIMIT; offset += RADIO_BATCH_SIZE) {
    await Promise.all([
      expandRadioBatch(
        fromA.visits,
        fromA.frontier.slice(offset, offset + RADIO_BATCH_SIZE)
      ),
      expandRadioBatch(
        fromB.visits,
        fromB.frontier.slice(offset, offset + RADIO_BATCH_SIZE)
      ),
    ]);
    found = collectPaths(a, b, fromA.visits, fromB.visits, "radio");
    if (found.length) return found;
  }
  return [];
}

export async function similarityBridgePaths(
  a: ArtistRef,
  b: ArtistRef
): Promise<SimilarityPathResult[]> {
  const [fromA, fromB] = await Promise.all([exploreRelated(a), exploreRelated(b)]);
  const related = collectPaths(a, b, fromA, fromB, "related");
  return related.length ? related : radioBridgePaths(a, b);
}
