import type { ArtistDetails } from "./types";

/** Missing genres may be a temporary upstream failure; retry after five minutes. */
export function hasFreshGenres(details: ArtistDetails, now = Date.now()): boolean {
  return Boolean(details.genres?.length) ||
    (details.genresCheckedAt !== undefined && now - details.genresCheckedAt < 5 * 60 * 1000);
}
