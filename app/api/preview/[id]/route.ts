import { NextResponse } from "next/server";
import { getTrackPreview } from "@/lib/deezer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  try {
    const preview = await getTrackPreview(id);
    if (!preview) {
      return NextResponse.json({ error: "preview unavailable" }, { status: 404 });
    }
    return NextResponse.json(
      { preview },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[/api/preview/${id}]`, error);
    return NextResponse.json({ error: "preview lookup failed" }, { status: 502 });
  }
}
