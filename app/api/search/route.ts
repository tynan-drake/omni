import { NextRequest, NextResponse } from "next/server";
import { searchArtists } from "@/lib/deezer";

import { searchSpotifyArtists, spotifySearchConfigured } from "@/lib/spotify-search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ artists: [] });
  if (q.length > 200) return NextResponse.json({ error: "Search is too long" }, { status: 400 });
  if (req.nextUrl.searchParams.get("source") !== "deezer" && spotifySearchConfigured()) {
    try {
      const artists = await searchSpotifyArtists(q);
      if (artists.length) return NextResponse.json({ artists, source: "spotify" });
    } catch {
      // A missing token, rate limit, or outage must not break artist discovery.
    }
  }
  try {
    const artists = await searchArtists(q, 8);
    return NextResponse.json({ artists, source: "deezer" });
  } catch (err) {
    console.error("[/api/search]", err);
    return NextResponse.json({ error: "search failed" }, { status: 502 });
  }
}
