import type { ArtistRef } from "./types";

// Deliberately curated across genres and generations, rather than live charts.
export const INTRO_ARTISTS = [
  "Kendrick Lamar", "Björk", "Radiohead", "Miles Davis",
  "Daft Punk", "Nina Simone", "David Bowie", "Sade",
  "Frank Ocean", "Aphex Twin", "Erykah Badu", "Talking Heads",
  "Joni Mitchell", "Prince", "Massive Attack", "Stevie Wonder",
  "Kate Bush", "Outkast", "Amy Winehouse", "Fela Kuti",
  "The Cure", "Solange", "Portishead", "John Coltrane",
  "Lauryn Hill", "The Beatles", "Gorillaz", "Tyler, The Creator",
  "Cocteau Twins", "Billie Holiday", "MF DOOM", "FKA twigs",
  "Brian Eno", "D'Angelo", "Fleetwood Mac", "SZA",
  "Khruangbin", "Marvin Gaye", "The Smiths", "J Dilla",
  "Patti Smith", "Arctic Monkeys", "Grace Jones", "A Tribe Called Quest",
  "Elliott Smith", "Beyoncé", "Deftones", "PJ Harvey",
  "Tame Impala", "Herbie Hancock", "LCD Soundsystem", "Nirvana",
  "ROSALÍA", "Dolly Parton", "Flying Lotus", "Lana Del Rey",
  "Ryuichi Sakamoto", "Bob Marley & The Wailers", "St. Vincent", "Duke Ellington",
  "The Strokes", "Little Simz", "Chet Baker", "The Velvet Underground",
  "Anderson .Paak", "Gustavo Cerati", "Fiona Apple", "The Internet",
  "The Clash", "Aaliyah", "Bon Iver", "Gustav Mahler",
  "Mitski", "De La Soul", "Nick Drake", "Chaka Khan",
  "Four Tet", "Brittany Howard", "Ravi Shankar", "Sonic Youth",
  "Curtis Mayfield", "Sufjan Stevens", "Kraftwerk", "Caetano Veloso",
  "Santana", "Bad Bunny", "Nusrat Fateh Ali Khan", "Buena Vista Social Club",
  "Youssou N'Dour", "Burna Boy", "SAMPHA", "Leonard Cohen",
  "Otis Redding", "Caroline Polachek", "Air", "Jeff Buckley",
  "SOPHIE", "Charli xcx", "Laufey", "Jungle",
] as const;

/** Put one featured artist at the intro's origin without duplicating any artists. */
export function featuredDiscoveryCatalogue<T extends ArtistRef>(artists: readonly T[], random = Math.random): T[] {
  const eligible = artists.flatMap((artist, index) =>
    INTRO_ARTISTS.some((name) => name === artist.name) ? [index] : []);
  const result = [...artists];
  if (!eligible.length) return result;
  const chosen = eligible[Math.floor(random() * eligible.length)];
  [result[0], result[chosen]] = [result[chosen], result[0]];
  return result;
}
