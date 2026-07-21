import { NextRequest, NextResponse } from "next/server";
import { searchArtists } from "@/lib/deezer";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ artists: [] });
  try {
    const artists = await searchArtists(q, 8);
    return NextResponse.json({ artists });
  } catch (err) {
    console.error("[/api/search]", err);
    return NextResponse.json({ error: "search failed" }, { status: 502 });
  }
}
