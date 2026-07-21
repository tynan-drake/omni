import { getCareerStartYear, getRelatedArtists } from "../deezer";
import type { ArtistRef, Direction } from "../types";

export interface HeuristicEntry extends ArtistRef {
  reason: string;
  era: string | null;
  decade: number | null;
}

/**
 * Keyless fallback lineage: Deezer related artists split into earlier/later
 * eras by estimated career start (earliest release year).
 */
export async function similarityLineage(
  seedId: number,
  direction: Direction,
  limit = 8
): Promise<HeuristicEntry[]> {
  const related = (await getRelatedArtists(seedId, 15)).filter(
    (a) => a.id !== seedId
  );

  const [seedYear, ...years] = await Promise.all([
    getCareerStartYear(seedId),
    ...related.map((a) => getCareerStartYear(a.id)),
  ]);

  const dated = related
    .map((artist, i) => ({ artist, year: years[i] }))
    .filter((e): e is { artist: ArtistRef; year: number } => e.year !== null);

  // Without a seed date, split around the median year instead.
  const pivot =
    seedYear ??
    dated.map((e) => e.year).sort((a, b) => a - b)[Math.floor(dated.length / 2)] ??
    null;
  if (pivot === null) return [];

  const matches = dated
    .filter((e) => (direction === "back" ? e.year < pivot : e.year > pivot))
    .sort((a, b) => (direction === "back" ? a.year - b.year : b.year - a.year))
    .slice(0, limit);

  return matches.map(({ artist, year }) => {
    const decade = Math.floor(year / 10) * 10;
    return {
      ...artist,
      reason:
        direction === "back"
          ? `Kindred artist from an earlier era — active since ~${year}`
          : `Kindred artist from a later era — emerged around ${year}`,
      era: `${decade}s`,
      decade,
    };
  });
}
