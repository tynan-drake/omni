import { getRelatedArtists } from "../deezer";
import type { ArtistRef } from "../types";

interface Visit {
  artist: ArtistRef;
  parent: number | null;
  depth: number;
}

async function explore(seed: ArtistRef): Promise<Map<number, Visit>> {
  const visited = new Map<number, Visit>([
    [seed.id, { artist: seed, parent: null, depth: 0 }],
  ]);
  let frontier: ArtistRef[] = [seed];
  for (let depth = 0; depth < 2 && frontier.length; depth++) {
    const batch = frontier.slice(0, depth === 0 ? 1 : 8);
    const related = await Promise.all(
      batch.map(async (artist) => {
        try {
          return { artist, related: await getRelatedArtists(artist.id, 12) };
        } catch {
          return { artist, related: [] as ArtistRef[] };
        }
      })
    );
    const next: ArtistRef[] = [];
    for (const group of related) {
      const parentDepth = visited.get(group.artist.id)?.depth ?? depth;
      for (const artist of group.related) {
        if (visited.has(artist.id)) continue;
        visited.set(artist.id, {
          artist,
          parent: group.artist.id,
          depth: parentDepth + 1,
        });
        next.push(artist);
      }
    }
    frontier = next;
  }
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
}

export async function similarityBridgePaths(
  a: ArtistRef,
  b: ArtistRef
): Promise<SimilarityPathResult[]> {
  const [fromA, fromB] = await Promise.all([explore(a), explore(b)]);
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
    if (nodeIds[0] !== a.id || nodeIds.at(-1) !== b.id || nodeIds.length - 2 > 4) continue;
    const signature = nodeIds.join("-");
    if (seen.has(signature)) continue;
    seen.add(signature);
    const artists = new Map<number, ArtistRef>();
    for (const id of nodeIds) {
      const artist = fromA.get(id)?.artist ?? fromB.get(id)?.artist;
      if (artist) artists.set(id, artist);
    }
    if (artists.size === nodeIds.length) results.push({ nodeIds, artists });
    if (results.length === 3) break;
  }
  return results;
}
