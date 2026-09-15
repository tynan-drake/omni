import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/artist/[id]/albums/route";
import { getAlbums } from "../lib/deezer";

vi.mock("../lib/deezer", () => ({ getAlbums: vi.fn() }));
const request = (id: string) => GET(new Request("http://localhost"), { params: Promise.resolve({ id }) });

beforeEach(() => vi.resetAllMocks());
describe("artist discography", () => {
  it("rejects invalid artist IDs before contacting Deezer", async () => {
    expect((await request("12abc")).status).toBe(400);
    expect(getAlbums).not.toHaveBeenCalled();
  });
  it("deduplicates releases and sorts newest first", async () => {
    const older = { id: 1, title: "First", release_date: "1999-01-01", record_type: "album", cover_medium: "cover.jpg" };
    const newer = { ...older, id: 2, title: "Second", release_date: "2001-01-01" };
    vi.mocked(getAlbums).mockResolvedValue([older, newer, older]);
    const response = await request("166");
    const albums = await response.json();
    expect(albums.map((album: { id: number }) => album.id)).toEqual([2, 1]);
    expect(albums[0]).toMatchObject({ title: "Second", releaseDate: "2001-01-01", cover: "cover.jpg", type: "album" });
  });
  it("returns an error for unavailable discography", async () => {
    vi.mocked(getAlbums).mockRejectedValue(new Error("Unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await request("166")).status).toBe(502);
    warning.mockRestore();
  });
});
