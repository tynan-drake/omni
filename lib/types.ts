export type Direction = "back" | "forward";
export type NodeKind = "seed" | "root" | "branch";
export type LineageSource = "curated" | "similarity";

export interface ArtistRef {
  id: number;
  name: string;
  picture: string;
  pictureBig: string;
}

export interface Track {
  id: number;
  title: string;
  duration: number;
  preview: string;
  albumTitle?: string;
  cover?: string;
}

export interface ArtistDetails extends ArtistRef {
  accent: string;
  fans: number;
  startYear: number | null;
  tracks: Track[];
}

export interface LineageEntry extends ArtistRef {
  accent: string;
  reason: string;
  era: string | null;
  decade: number | null;
  /** Deezer ids of other entries in the same batch with strong direct ties. */
  linkedTo: number[];
}

export interface LineageResult {
  source: LineageSource;
  direction: Direction;
  seedId: number;
  entries: LineageEntry[];
}

export interface PlaylistTrack extends Track {
  artistId: number;
  artistName: string;
}

export type PlaylistMode = "popular" | "deep" | "mixed";

/** A node on the canvas. */
export interface GraphNode {
  id: number;
  name: string;
  picture: string;
  pictureBig: string;
  accent: string;
  kind: NodeKind;
  reason: string | null;
  era: string | null;
  decade: number | null;
  generation: number;
}

export type EdgeKind = "back" | "forward" | "peer";

export interface GraphEdge {
  id: string;
  /** node id of the influencer (earlier artist) */
  from: number;
  /** node id of the influenced (later artist) */
  to: number;
  kind: EdgeKind;
}
