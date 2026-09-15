import { NextResponse } from "next/server";
import { getAlbums } from "@/lib/deezer";
import type { Album } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: value } = await params;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    const releases = await getAlbums(id);
    const albums: Album[] = [...new Map(releases.map((album) => [album.id, album])).values()]
      .sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))
      .map((album) => ({
        id: album.id,
        title: album.title,
        cover: album.cover_medium ?? "",
        releaseDate: album.release_date ?? "",
        type: album.record_type ?? "album",
      }));
    return NextResponse.json(albums);
  } catch (error) {
    console.warn(`[Artist albums: ${id}]`, error);
    return NextResponse.json({ error: "album lookup failed" }, { status: 502 });
  }
}
