import { NextRequest, NextResponse } from "next/server";
import { getArtist, getTopTracks, getCareerStartYear } from "@/lib/deezer";
import { getAccentColor } from "@/lib/colors";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { ArtistDetails } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const cacheKey = `artist-${id}`;
  const cached = await cacheGet<ArtistDetails>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const [artist, tracks, startYear] = await Promise.all([
      getArtist(id),
      getTopTracks(id, 5),
      getCareerStartYear(id),
    ]);
    const accent = await getAccentColor(id, artist.name, artist.picture);
    const details: ArtistDetails = { ...artist, accent, startYear, tracks };
    await cacheSet(cacheKey, details);
    return NextResponse.json(details);
  } catch (err) {
    console.error(`[/api/artist/${id}]`, err);
    return NextResponse.json({ error: "artist lookup failed" }, { status: 502 });
  }
}
