import { NextRequest, NextResponse } from "next/server";
import { resolveArtistByName } from "@/lib/deezer";
import { getAccentColor } from "@/lib/colors";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  claudeAvailable,
  claudeLineage,
  parseDecade,
  type RawLineageArtist,
} from "@/lib/lineage/claude";
import { similarityLineage } from "@/lib/lineage/heuristic";
import type { ArtistRef, Direction, LineageEntry, LineageResult } from "@/lib/types";

const LIMIT = 8;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

async function withAccents<T extends ArtistRef>(
  entries: T[]
): Promise<(T & { accent: string })[]> {
  return Promise.all(
    entries.map(async (e) => ({
      ...e,
      accent: await getAccentColor(e.id, e.name, e.picture),
    }))
  );
}

async function curated(
  seedId: number,
  artistName: string,
  direction: Direction
): Promise<LineageEntry[]> {
  const raw = await claudeLineage(artistName, direction);

  const resolved = await Promise.all(
    raw.map(async (r) => ({ raw: r, ref: await resolveArtistByName(r.name) }))
  );

  const seen = new Set<number>([seedId]);
  const kept: Array<{ raw: RawLineageArtist; ref: ArtistRef }> = [];
  for (const r of resolved) {
    if (!r.ref || seen.has(r.ref.id)) continue;
    seen.add(r.ref.id);
    kept.push(r as { raw: RawLineageArtist; ref: ArtistRef });
    if (kept.length >= LIMIT) break;
  }

  // Map Claude's peer-link names (pre-resolution) to resolved Deezer ids.
  const idByName = new Map(kept.map((k) => [norm(k.raw.name), k.ref.id]));

  const entries = kept.map(({ raw, ref }) => ({
    ...ref,
    reason: raw.reason,
    era: raw.era,
    decade: parseDecade(raw.era),
    linkedTo: raw.linkedTo
      .map((n) => idByName.get(norm(n)))
      .filter((id): id is number => id !== undefined && id !== ref.id),
  }));

  return withAccents(entries);
}

async function similarity(
  seedId: number,
  direction: Direction
): Promise<LineageEntry[]> {
  const entries = await similarityLineage(seedId, direction, LIMIT);
  return withAccents(entries.map((e) => ({ ...e, linkedTo: [] as number[] })));
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const seedId = parseInt(params.get("id") ?? "", 10);
  const artistName = params.get("artist")?.trim();
  const direction = params.get("direction") as Direction;

  if (!Number.isFinite(seedId) || !artistName || !["back", "forward"].includes(direction)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }

  const wantCurated = claudeAvailable();
  const cacheKey = (source: string) => `lineage-${seedId}-${direction}-${source}`;

  const cached = await cacheGet<LineageResult>(
    cacheKey(wantCurated ? "curated" : "similarity")
  );
  if (cached) return NextResponse.json(cached);

  try {
    let result: LineageResult;
    if (wantCurated) {
      try {
        result = {
          source: "curated",
          direction,
          seedId,
          entries: await curated(seedId, artistName, direction),
        };
      } catch (err) {
        console.error("[/api/lineage] curated path failed, falling back:", err);
        result = {
          source: "similarity",
          direction,
          seedId,
          entries: await similarity(seedId, direction),
        };
      }
    } else {
      result = {
        source: "similarity",
        direction,
        seedId,
        entries: await similarity(seedId, direction),
      };
    }

    if (result.entries.length) await cacheSet(cacheKey(result.source), result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/lineage]", err);
    return NextResponse.json({ error: "lineage lookup failed" }, { status: 502 });
  }
}
