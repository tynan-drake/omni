import { NextRequest, NextResponse } from "next/server";
import { resolveSpotifyArtist } from "@/lib/spotify-search";

export async function POST(request: NextRequest) {
  let id: unknown;
  try { id = (await request.json()).spotifyId; }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (typeof id !== "string" || !/^[a-zA-Z0-9]{22}$/.test(id)) return NextResponse.json({ error: "Invalid artist" }, { status: 400 });
  try {
    const artist = await resolveSpotifyArtist(id);
    return artist ? NextResponse.json({ artist }) : NextResponse.json({ error: "No confident match" }, { status: 422 });
  } catch {
    return NextResponse.json({ error: "Artist lookup unavailable" }, { status: 502 });
  }
}
