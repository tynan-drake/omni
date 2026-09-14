import { NextRequest, NextResponse } from "next/server";
import { getArtist, getTopTracks, getCareerStartYear } from "@/lib/deezer";
import { getAccentColor } from "@/lib/colors";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getArtistBiography } from "@/lib/wikipedia";
import { hasFreshGenres } from "@/lib/artist-details-cache";
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

  const cacheKey = `artist-v3-${id}`;
  const cached = await cacheGet<ArtistDetails>(cacheKey);
  if (cached && hasFreshGenres(cached)) return NextResponse.json(cached);
  if (cached) {
    const biography = await getArtistBiography(cached.name);
    const refreshed = {
      ...cached,
      genres: biography?.genres ?? [],
      genresCheckedAt: Date.now(),
    };
    await cacheSet(cacheKey, refreshed);
    return NextResponse.json(refreshed);
  }

  try {
    const artist = await getArtist(id);
    const [tracks, startYear, biography] = await Promise.all([
      getTopTracks(id, 5),
      getCareerStartYear(id),
      getArtistBiography(artist.name),
    ]);
    const accent = await getAccentColor(id, artist.name, artist.picture);
    const details: ArtistDetails = {
      ...artist,
      accent,
      startYear,
      tracks,
      genres: biography?.genres ?? [],
      genresCheckedAt: Date.now(),
      bio: biography?.text ?? null,
      bioUrl: biography?.url ?? null,
      bioSource: biography?.source ?? null,
    };
    await cacheSet(cacheKey, details);
    return NextResponse.json(details);
  } catch (err) {
    console.error(`[/api/artist/${id}]`, err);
    return NextResponse.json({ error: "artist lookup failed" }, { status: 502 });
  }
}
