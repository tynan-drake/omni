export interface StreamingLink {
  name: string;
  url: string;
}

export function streamingLinks(artistName: string, deezerId: number): StreamingLink[] {
  const q = encodeURIComponent(artistName);
  return [
    { name: "Spotify", url: `https://open.spotify.com/search/${q}/artists` },
    { name: "Apple Music", url: `https://music.apple.com/us/search?term=${q}` },
    { name: "YouTube Music", url: `https://music.youtube.com/search?q=${q}` },
    { name: "Deezer", url: `https://www.deezer.com/artist/${deezerId}` },
  ];
}
