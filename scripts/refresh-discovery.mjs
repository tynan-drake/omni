// Refresh the bundled discovery shelf from public Deezer artist metadata.
// Runtime browsing needs no catalogue API requests; search remains live.
import { writeFile } from 'node:fs/promises';
const names = [
  'Kendrick Lamar', 'Björk', 'Radiohead', 'Miles Davis', 'Daft Punk', 'Nina Simone',
  'David Bowie', 'Sade', 'Frank Ocean', 'Aphex Twin', 'Erykah Badu', 'Talking Heads',
  'Joni Mitchell', 'Prince', 'Massive Attack', 'Stevie Wonder', 'Kate Bush', 'Outkast',
  'Amy Winehouse', 'Fela Kuti', 'The Cure', 'Solange', 'Portishead', 'John Coltrane',
  'Lauryn Hill', 'The Beatles', 'Gorillaz', 'Alice Coltrane', 'Tyler, The Creator', 'Cocteau Twins',
  'Billie Holiday', 'MF DOOM', 'FKA twigs', 'Brian Eno', 'D\u0027Angelo', 'Fleetwood Mac',
  'SZA', 'Khruangbin', 'Marvin Gaye', 'The Smiths', 'J Dilla', 'Patti Smith',
  'Arctic Monkeys', 'Grace Jones', 'A Tribe Called Quest', 'Burial', 'Elliott Smith', 'Beyoncé',
  'Deftones', 'Nujabes', 'PJ Harvey', 'Tame Impala', 'Herbie Hancock', 'LCD Soundsystem',
  'Nirvana', 'BADBADNOTGOOD', 'Rosalía', 'Dolly Parton', 'Flying Lotus', 'Lana Del Rey',
  'Ryuichi Sakamoto', 'Bob Marley & The Wailers', 'St. Vincent', 'Duke Ellington', 'The Strokes', 'Little Simz',
  'Chet Baker', 'Tirzah', 'The Velvet Underground', 'Anderson .Paak', 'Gustavo Cerati', 'Bicep',
  'Fiona Apple', 'The Internet', 'The Clash', 'Hiroshi Yoshimura', 'Aaliyah', 'Bon Iver',
  'Gustav Mahler', 'Mitski', 'De La Soul', 'Yves Tumor', 'Nick Drake', 'Nicolas Jaar',
  'Chaka Khan', 'Four Tet', 'Brittany Howard', 'Ravi Shankar', 'Sonic Youth', 'Róisín Murphy',
  'Curtis Mayfield', 'Sufjan Stevens', 'Weyes Blood', 'Kraftwerk', 'Caetano Veloso', 'Santana',
  'Bad Bunny', 'Nusrat Fateh Ali Khan', 'Buena Vista Social Club', 'Jorge Ben Jor', 'Youssou N\u0027Dour', 'Burna Boy',
  'Ravyn Lenae', 'Dijon', 'Sampha', 'Arooj Aftab', 'Ichiko Aoba', 'Beth Gibbons',
  'Leonard Cohen', 'Otis Redding', 'Caroline Polachek', 'Air', 'Jeff Buckley', 'The Avalanches',
  'SOPHIE', 'Charli xcx', 'SAULT', 'Laufey', 'Turnstile', 'Jungle',
];
const results = new Array(names.length);
let next = 0;
await Promise.all(Array.from({ length: 2 }, async () => {
  while (next < names.length) {
    const index = next++;
    const name = names[index];
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const response = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=10`, {signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let data = await response.json();
      for (let attempt = 0; data.error?.code === 4 && attempt < 3; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        data = await (await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=10`, {signal: AbortSignal.timeout(15000)})).json();
      }
      if (data.error) throw new Error(data.error.message);
      const normalize = (value) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const artist = data.data?.filter((item) => normalize(item.name) === normalize(name)).sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0];
      if (!artist?.picture_medium) throw new Error('No exact match');
      results[index] = { id: artist.id, name: artist.name, picture: artist.picture_medium, pictureBig: artist.picture_xl };
    } catch (error) { console.error(`${name}: ${error.message}`); }
  }
}));
const artists = results.filter(Boolean).filter((artist, index, all) => all.findIndex((other) => other.id === artist.id) === index);
if (artists.length < 90) throw new Error(`Only ${artists.length} artists resolved; keeping the previous catalogue.`);
await writeFile(new URL('../lib/discovery-artists.json', import.meta.url), JSON.stringify(artists, null, 2) + '\n');
console.log(`Saved ${artists.length} discovery artists.`);
