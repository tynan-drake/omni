export type Direction = "back" | "forward";
export type NodeKind = "seed" | "root" | "branch" | "connector";
export type LineageSource = "curated" | "similarity";
export type BridgeMode = "influence" | "adjacent";
export type BridgeGenerationSource = "curated" | "similarity";
export type RelationshipKind =
  | "influence"
  | "peer"
  | "collaboration"
  | "sample"
  | "scene"
  | "similarity";

export interface EvidenceSource {
  title: string;
  url: string;
}

export interface ArtistRef {
  id: number;
  name: string;
  picture: string;
  pictureBig: string;
}

export interface DeezerSearchResult extends ArtistRef {
  source?: "deezer";
  fans?: number;
}

export interface SpotifySearchResult {
  id: string;
  source: "spotify";
  name: string;
  picture: string;
  pictureBig: string;
  spotifyUrl: string;
}

export type ArtistSearchResult = DeezerSearchResult | SpotifySearchResult;

export interface Track {
  id: number;
  title: string;
  duration: number;
  preview: string;
  albumTitle?: string;
  cover?: string;
}

export interface Album {
  id: number;
  title: string;
  cover: string;
  releaseDate: string;
  type: string;
}

export interface ArtistDetails extends ArtistRef {
  accent: string;
  fans: number;
  genres?: string[];
  genresCheckedAt?: number;
  startYear: number | null;
  tracks: Track[];
  bio: string | null;
  bioUrl: string | null;
  bioSource: "Wikipedia" | null;
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
  /** JSON-safe ownership markers such as seed, explored, or bridge:<id>. */
  origins: string[];
}

/** Back/forward remain for existing lineage expansions; both mean influence. */
export type EdgeKind = Direction | RelationshipKind;

export interface GraphEdge {
  id: string;
  /** node id of the influencer (earlier artist) */
  from: number;
  /** node id of the influenced (later artist) */
  to: number;
  kind: EdgeKind;
  reason: string | null;
  sources: EvidenceSource[];
  origins: string[];
}

export interface BridgeArtist extends ArtistRef {
  accent: string;
  era: string | null;
  decade: number | null;
}

export interface BridgeRelationship {
  id: string;
  from: number;
  to: number;
  kind: Exclude<RelationshipKind, "peer">;
  reason: string;
  sources: EvidenceSource[];
}

export interface BridgePath {
  id: string;
  shape: "chain" | "shared-root";
  nodeIds: number[];
  edgeIds: string[];
  commonRootId?: number;
}

export interface BridgeResult {
  status: "found" | "no_path";
  mode: BridgeMode;
  generationSource: BridgeGenerationSource;
  degraded: boolean;
  endpoints: [number, number];
  entries: BridgeArtist[];
  edges: BridgeRelationship[];
  paths: BridgePath[];
  message?: string;
}

export interface ArtistBridge {
  id: string;
  name: string;
  endpointIds: [number, number];
  mode: BridgeMode;
  generationSource: BridgeGenerationSource;
  degraded: boolean;
  paths: BridgePath[];
  nodeIds: number[];
  edgeIds: string[];
  createdAt: number;
  updatedAt: number;
}
