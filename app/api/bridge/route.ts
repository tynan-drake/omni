import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  bridgeModel,
  claudeBridge,
  curatedBridgeAvailable,
} from "@/lib/bridge/claude";
import { similarityBridgePaths } from "@/lib/bridge/similarity";
import { getAccentColor } from "@/lib/colors";
import {
  getArtist,
  getCareerStartYear,
  resolveArtistByName,
} from "@/lib/deezer";
import type {
  ArtistRef,
  BridgeArtist,
  BridgeMode,
  BridgePath,
  BridgeRelationship,
  BridgeResult,
} from "@/lib/types";

interface EndpointInput {
  id: number;
  name: string;
}

const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const edgeId = (from: number, to: number, kind: string) => `${from}-${to}-${kind}`;

function endpointMention(name: string, endpoints: ArtistRef[]): ArtistRef | undefined {
  const key = norm(name);
  return endpoints.find((endpoint) => {
    const endpointKey = norm(endpoint.name);
    return (
      key === endpointKey ||
      (Math.min(key.length, endpointKey.length) >= 5 &&
        (key.endsWith(endpointKey) ||
          endpointKey.endsWith(key) ||
          key.startsWith(endpointKey) ||
          endpointKey.startsWith(key)))
    );
  });
}

async function withMetadata(artists: ArtistRef[]): Promise<BridgeArtist[]> {
  return Promise.all(
    artists.map(async (artist) => {
      const [accent, year] = await Promise.all([
        getAccentColor(artist.id, artist.name, artist.picture),
        getCareerStartYear(artist.id),
      ]);
      const decade = year === null ? null : Math.floor(year / 10) * 10;
      return {
        ...artist,
        accent,
        era: decade === null ? null : `${decade}s`,
        decade,
      };
    })
  );
}

function connectsEndpoints(
  endpointIds: [number, number],
  edges: BridgeRelationship[]
): boolean {
  const adjacency = new Map<number, number[]>();
  for (const edge of edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from]);
  }
  const seen = new Set<number>([endpointIds[0]]);
  const queue = [endpointIds[0]];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === endpointIds[1]) return true;
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

async function resolvedCuratedResult(
  a: ArtistRef,
  b: ArtistRef,
  mode: BridgeMode
): Promise<BridgeResult> {
  const rawPaths = await claudeBridge(a.name, b.name, mode);
  const refsByName = new Map<string, ArtistRef>([
    [norm(a.name), a],
    [norm(b.name), b],
  ]);
  const names = [
    ...new Set(
      rawPaths.flatMap((path) =>
        path.relationships.flatMap((edge) => [edge.from, edge.to])
      )
    ),
  ];
  await Promise.all(
    names.map(async (name) => {
      const key = norm(name);
      if (refsByName.has(key)) return;
      const endpoint = endpointMention(name, [a, b]);
      if (endpoint) {
        refsByName.set(key, endpoint);
        return;
      }
      const ref = await resolveArtistByName(name);
      if (ref) refsByName.set(key, ref);
    })
  );

  const relationships = new Map<string, BridgeRelationship>();
  const paths: BridgePath[] = [];
  for (const [index, rawPath] of rawPaths.entries()) {
    const pathEdges = rawPath.relationships.flatMap((raw): BridgeRelationship[] => {
      const from = refsByName.get(norm(raw.from));
      const to = refsByName.get(norm(raw.to));
      if (!from || !to || from.id === to.id) return [];
      const id = edgeId(from.id, to.id, raw.type);
      return [{
        id,
        from: from.id,
        to: to.id,
        kind: raw.type,
        reason: raw.reason,
        sources: [],
      }];
    });
    const pathNodeIds = [...new Set(pathEdges.flatMap((edge) => [edge.from, edge.to]))];
    const connectorCount = pathNodeIds.filter((id) => id !== a.id && id !== b.id).length;
    if (
      connectorCount > 4 ||
      !pathNodeIds.includes(a.id) ||
      !pathNodeIds.includes(b.id) ||
      !connectsEndpoints([a.id, b.id], pathEdges)
    ) {
      continue;
    }
    for (const edge of pathEdges) {
      if (!relationships.has(edge.id)) relationships.set(edge.id, edge);
    }
    const commonRootId = rawPath.commonRoot
      ? refsByName.get(norm(rawPath.commonRoot))?.id
      : undefined;
    paths.push({
      id: `path-${index + 1}`,
      shape: rawPath.shape,
      nodeIds: [
        a.id,
        ...pathNodeIds.filter((id) => id !== a.id && id !== b.id),
        b.id,
      ],
      edgeIds: pathEdges.map((edge) => edge.id),
      ...(commonRootId !== undefined && { commonRootId }),
    });
  }

  if (!paths.length) {
    return {
      status: "no_path",
      mode,
      generationSource: "curated",
      degraded: false,
      endpoints: [a.id, b.id],
      entries: [],
      edges: [],
      paths: [],
      message:
        mode === "influence"
          ? `No credible influence bridge was found between ${a.name} and ${b.name}.`
          : `No broader musical bridge was found between ${a.name} and ${b.name}.`,
    };
  }
  const usedIds = new Set(paths.flatMap((path) => path.nodeIds));
  const refs = [...refsByName.values()].filter((artist) => usedIds.has(artist.id));
  return {
    status: "found",
    mode,
    generationSource: "curated",
    degraded: false,
    endpoints: [a.id, b.id],
    entries: await withMetadata(refs),
    edges: [...relationships.values()],
    paths,
  };
}

async function similarityResult(a: ArtistRef, b: ArtistRef): Promise<BridgeResult> {
  const found = await similarityBridgePaths(a, b);
  if (!found.length) {
    return {
      status: "no_path",
      mode: "adjacent",
      generationSource: "similarity",
      degraded: true,
      endpoints: [a.id, b.id],
      entries: [],
      edges: [],
      paths: [],
      message:
        "A historical bridge may exist, but curated influence lookup is unavailable and Deezer’s discovery graph did not surface a reliable fallback.",
    };
  }
  const refs = new Map<number, ArtistRef>();
  const relationships = new Map<string, BridgeRelationship>();
  const paths = found.map((result, index): BridgePath => {
    for (const [id, artist] of result.artists) refs.set(id, artist);
    const ids: string[] = [];
    for (let i = 0; i < result.nodeIds.length - 1; i++) {
      const from = result.nodeIds[i];
      const to = result.nodeIds[i + 1];
      const id = edgeId(from, to, "similarity");
      ids.push(id);
      if (!relationships.has(id)) {
        const fromName = result.artists.get(from)?.name ?? "These artists";
        const toName = result.artists.get(to)?.name ?? "this artist";
        const discoverySource =
          result.basis === "radio" ? "artist-radio graph" : "related-artist graph";
        relationships.set(id, {
          id,
          from,
          to,
          kind: "similarity",
          reason: `${fromName} and ${toName} are linked by Deezer’s ${discoverySource}.`,
          sources: [],
        });
      }
    }
    return {
      id: `path-${index + 1}`,
      shape: "chain",
      nodeIds: result.nodeIds,
      edgeIds: ids,
    };
  });
  return {
    status: "found",
    mode: "adjacent",
    generationSource: "similarity",
    degraded: true,
    endpoints: [a.id, b.id],
    entries: await withMetadata([...refs.values()]),
    edges: [...relationships.values()],
    paths,
  };
}

async function endpointRef(input: EndpointInput): Promise<ArtistRef> {
  try {
    return await getArtist(input.id);
  } catch {
    const resolved = await resolveArtistByName(input.name);
    if (!resolved) throw new Error(`Unable to resolve ${input.name}`);
    return resolved;
  }
}

export async function POST(request: Request) {
  let body: { a?: EndpointInput; b?: EndpointInput; mode?: BridgeMode };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { a, b } = body;
  const mode = body.mode;
  if (
    !a ||
    !b ||
    !Number.isFinite(a.id) ||
    !Number.isFinite(b.id) ||
    a.id === b.id ||
    !a.name?.trim() ||
    !b.name?.trim() ||
    !["influence", "adjacent"].includes(mode ?? "")
  ) {
    return NextResponse.json({ error: "invalid bridge endpoints" }, { status: 400 });
  }
  const requestedMode = mode as BridgeMode;

  const sorted = [a.id, b.id].sort((left, right) => left - right);
  const source = curatedBridgeAvailable() ? bridgeModel() : "similarity-radio-v2";
  const cacheKey = `bridge-${sorted[0]}-${sorted[1]}-${requestedMode}-${source}`;
  const cached = await cacheGet<BridgeResult>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const [firstInput, secondInput] = a.id < b.id ? [a, b] : [b, a];
    const [artistA, artistB] = await Promise.all([
      endpointRef(firstInput),
      endpointRef(secondInput),
    ]);
    let result: BridgeResult;
    if (!curatedBridgeAvailable()) {
      result = await similarityResult(artistA, artistB);
    } else {
      try {
        result = await resolvedCuratedResult(artistA, artistB, requestedMode);
      } catch (error) {
        console.error("[/api/bridge] curated generation failed, using similarity:", error);
        result = await similarityResult(artistA, artistB);
      }
    }
    if (result.status === "found") await cacheSet(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/bridge]", error);
    return NextResponse.json({ error: "bridge lookup failed" }, { status: 502 });
  }
}
