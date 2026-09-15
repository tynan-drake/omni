"use client";

import { neutralizePurple } from "@/lib/color-utils";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { streamingLinks } from "@/lib/links";
import { withAlpha } from "@/lib/color-utils";
import type { Album, ArtistDetails, ArtistRef } from "@/lib/types";
import { fetchDetails } from "@/store/actions";
import { useAudio } from "@/store/audio";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import {
  CloseIcon,
  ExternalIcon,
  PauseIcon,
  PlayIcon,
} from "./Icons";

function serviceLogo(name: string) {
  if (name === "Spotify") return "/assets/spotify.svg";
  if (name === "Apple Music") return "/assets/apple-music.svg";
  if (name === "YouTube Music") return "/assets/youtube-music.svg";
  return "/assets/deezer.svg";
}

const fmtFans = (fans: number) =>
  Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(fans);

function GenrePills({ genres, expanded, onToggle }: {
  genres: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const rowRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || expanded) return;
    const measure = () => setOverflowing(row.scrollWidth > row.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [genres, expanded]);

  return (
    <button
      type="button"
      className="mt-2 block w-full min-w-0 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70 enabled:cursor-pointer"
      disabled={!overflowing && !expanded}
      aria-expanded={expanded}
      aria-label={expanded ? "Show fewer genres" : overflowing ? "Show all genres" : "Genres"}
      onClick={onToggle}
    >
      <span
        key={expanded ? "expanded" : "collapsed"}
        ref={rowRef}
        className={`flex gap-1 transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none ${expanded ? "max-h-24 flex-wrap overflow-y-auto scrollbar-slim starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0 motion-reduce:starting:opacity-100" : "overflow-hidden"} ${overflowing && !expanded ? "mask-r-from-75% mask-r-to-100%" : ""}`}
      >
        {genres.map((genre) => (
          <span key={genre} className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] leading-3 text-white/80">
            {genre}
          </span>
        ))}
      </span>
    </button>
  );
}

function Discography({ artistId }: { artistId: number }) {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [releaseType, setReleaseType] = useState("album");
  const filters = [
    { type: "album", label: "Albums" },
    { type: "ep", label: "EPs" },
    { type: "single", label: "Singles" },
  ];
  const visibleAlbums = albums?.filter((album) => album.type.toLowerCase() === releaseType);
  const selectedLabel = filters.find((filter) => filter.type === releaseType)!.label;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/artist/${artistId}/albums`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Album lookup failed");
        const data = await response.json() as Album[];
        if (!controller.signal.aborted) setAlbums(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [artistId]);

  return (
    <div className="detail-section !pb-4">
      <h3>Discography</h3>
      <div role="group" aria-label="Filter discography" className="mb-3 flex gap-1 border-b border-white/10 px-1.5">
        {filters.map((filter) => (
          <button
            key={filter.type}
            type="button"
            aria-pressed={releaseType === filter.type}
            onClick={() => setReleaseType(filter.type)}
            className={`border-b-2 px-2 py-2 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${releaseType === filter.type ? "border-white/80 text-white/90" : "border-transparent text-white/40 hover:text-white/70"}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {!albums && !failed && <div className="detail-loading" aria-label="Loading discography" />}
      {failed && <p className="detail-empty">Couldn&apos;t load releases.</p>}
      {visibleAlbums?.length === 0 && <p className="detail-empty" role="status">No {selectedLabel.toLowerCase()} available yet.</p>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 px-1.5">
        {visibleAlbums?.map((album) => (
          <a
            key={album.id}
            href={`https://www.deezer.com/album/${album.id}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`${album.title} on Deezer (opens in a new tab)`}
            className="group min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
          >
            <span className="block aspect-square overflow-hidden rounded-md bg-white/5">
              {album.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={album.cover} alt="" loading="lazy" className="size-full object-cover transition-opacity group-hover:opacity-80" />
              )}
            </span>
            <span className="mt-1.5 block truncate text-xs font-medium text-white/85" title={album.title}>{album.title}</span>
            <span className="mt-0.5 block text-[10px] text-white/45">
              {[album.releaseDate?.slice(0, 4), album.type === "ep" ? "EP" : album.type].filter(Boolean).join(" · ")}
            </span>
          </a>
        ))}
      </div>
      {!!albums?.length && (
        <a href={`https://www.deezer.com/artist/${artistId}/discography`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 px-1.5 text-xs text-white/50 hover:text-white/80">
          View all on Deezer <ExternalIcon size={10} />
        </a>
      )}
    </div>
  );
}

export default function DetailPanel({ nodeId, artist, onClose }: { nodeId: number; artist?: ArtistRef; onClose?: () => void }) {
  const graphNode = useGraph((s) => s.nodes[nodeId]);
  const [details, setDetails] = useState<ArtistDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [expandedGenreArtist, setExpandedGenreArtist] = useState<number | null>(null);
  const genresExpanded = expandedGenreArtist === nodeId;
  const audio = useAudio();
  const node = graphNode ?? (artist ? { ...artist, accent: details?.accent ?? "#a3a3a3", era: null } : null);

  useEffect(() => {
    let alive = true;
    void fetchDetails(nodeId).then((d) => {
      if (!alive) return;
      if (d) setDetails(d);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [nodeId]);



  if (!node) return null;
  const accent = neutralizePurple(node.accent);

  return (
    <motion.section
      className="grid h-110 grid-cols-2 overflow-hidden"
      style={{ "--accent": accent } as React.CSSProperties}
      aria-label={`${node.name} tracks and details`}
    >
      <div className="flex min-h-0 min-w-0 flex-col border-r border-white/10">
        <div
          className="detail-hero isolate !h-auto min-h-48 !shrink-0 overflow-hidden !rounded-none"
          style={{
            backgroundImage: `linear-gradient(to top, ${withAlpha("#171717", 0.96)} 0%, ${withAlpha("#171717", 0.25)} 55%, transparent 100%), url(${node.pictureBig})`,
          }}
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -z-10 transition-[backdrop-filter,background-color] duration-300 ease-out motion-reduce:transition-none ${genresExpanded ? "bg-black/30 backdrop-blur-sm" : "bg-black/0 backdrop-blur-none"}`}
          />
          <button
            className="detail-close"
            aria-label="Back to artist actions"
            onClick={onClose ?? (() => useUi.getState().openDetail(null))}
          >
            <CloseIcon />
          </button>
          <div className="detail-title w-full min-w-0">
            <h2 className="pl-2.25">{node.name}</h2>
            <div className="detail-meta pl-2.25">
              {node.era && <span className="detail-era">{node.era}</span>}
              {details && <span>{fmtFans(details.fans)} fans</span>}
              {details?.startYear && <span>since {details.startYear}</span>}
            </div>
            {!!details?.genres?.length && (
              <GenrePills
                key={nodeId}
                genres={details.genres}
                expanded={genresExpanded}
                onToggle={() => setExpandedGenreArtist(genresExpanded ? null : nodeId)}
              />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-slim">
          <div className="detail-section detail-bio !pl-6.25 !pr-4 [&>h3]:!px-0 [&_p]:!px-0">
            <h3>About</h3>
            {!details && !failed && <div className="detail-loading" />}
            {details?.bio ? (
              <>
                <p>{details.bio}</p>
                {details.bioUrl && details.bioSource && (
                  <a
                    href={details.bioUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-white/50 transition-colors hover:text-white/80"
                  >
                    {details.bioSource} <ExternalIcon size={10} />
                  </a>
                )}
              </>
            ) : (
              details && (
                <p>
                  An editorial biography for {node.name} isn&apos;t available yet.
                </p>
              )
            )}
            {failed && <p>Couldn&apos;t load this artist&apos;s biography.</p>}
          </div>
          <div className="detail-section !pl-6.25 !pr-4 !pb-4 [&>h3]:!px-0 [&>.detail-links]:!px-0">
            <h3>
              <ExternalIcon size={12} /> Listen on
            </h3>
            <div className="detail-links">
              {streamingLinks(node.name, node.id).map((l) => (
                <a
                  key={l.name}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Listen on ${l.name}`}
                  title={l.name}
                  className="!inline-flex !size-9 !items-center !justify-center !p-0"
                >
                  <span className="flex size-4 items-center justify-center" aria-hidden="true">
                    {/* The link label provides the accessible name for this decorative logo. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={serviceLogo(l.name)}
                      alt=""
                      className="size-4 object-contain brightness-0 invert"
                    />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 min-w-0 overflow-y-auto scrollbar-slim">
        <div className="detail-section">
          <h3>Top tracks</h3>
          {!details && !failed && <div className="detail-loading" />}
          {failed && <p className="detail-empty">Couldn&apos;t load tracks.</p>}
          {details && !details.tracks.length && (
            <p className="detail-empty">No previews available.</p>
          )}
          {details?.tracks.map((track) => {
            const isCurrent = audio.track?.id === track.id;
            const playing = isCurrent && audio.playing;
            return (
              <button
                key={track.id}
                className={`track-row ${isCurrent ? "is-current" : ""}`}
                onClick={() => audio.play(track, nodeId, node.name)}
              >
                <span className="track-cover" aria-hidden="true">
                  {track.cover ? (
                    // Album covers are decorative; the track and album names follow.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.cover} alt="" />
                  ) : (
                    <span className="track-cover-fallback" />
                  )}
                  <span className="track-cover-control">
                    {playing ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
                  </span>
                </span>
                <span className="track-text">
                  <span className="track-title">{track.title}</span>
                  {track.albumTitle && (
                    <span className="track-album">{track.albumTitle}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <Discography key={nodeId} artistId={nodeId} />
      </div>
    </motion.section>
  );
}
