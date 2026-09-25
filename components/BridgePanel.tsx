"use client";

import { canvas } from "@/lib/canvas-controller";
import { connectArtists } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import ArtistSearch from "./ArtistSearch";
import BusyOrb from "./BusyOrb";
import { CloseIcon, LinkIcon, TrashIcon } from "./Icons";

export default function BridgePanel() {
  const nodes = useGraph((state) => state.nodes);
  const edges = useGraph((state) => state.edges);
  const bridges = useGraph((state) => state.bridges);
  const bridgeOrder = useGraph((state) => state.bridgeOrder);
  const activeBridgeId = useGraph((state) => state.activeBridgeId);
  const connectingFrom = useUi((state) => state.connectingFrom);
  const request = useUi((state) => state.bridgeRequest);
  const activeBridge = activeBridgeId ? bridges[activeBridgeId] : null;
  const source = connectingFrom === null ? null : nodes[connectingFrom];
  const loading = request?.status === "loading";

  const selectBridge = (id: string | null) => {
    useGraph.getState().setActiveBridge(id);
    if (id) setTimeout(() => canvas.fitNodes(bridges[id].nodeIds), 80);
    else setTimeout(() => canvas.fitAll(), 80);
  };

  return (
    <>
      <div className="nav-flyout-body bridge-panel scrollbar-slim">
        {source && (
          <section className="bridge-connect" aria-labelledby="bridge-connect-title">
            <div className="bridge-connect-source">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source.picture} alt="" />
              <div>
                <h3 id="bridge-connect-title">Connect {source.name}</h3>
                <p>Select another orb or search for an artist.</p>
                <button className="mt-2 text-xs text-neutral-400 hover:text-neutral-100" onClick={() => useUi.getState().cancelConnecting()}>Cancel connection</button>
              </div>
            </div>

            {!request && (
              <ArtistSearch
                variant="panel"
                label={`Artist to connect with ${source.name}`}
                placeholder="Search the other artist…"
                autoFocus
                excludeId={source.id}
                onPick={(artist) => connectArtists(source.id, artist)}
              />
            )}

            <div className="bridge-request-status" role="status" aria-live="polite">
              {request && (
                <div className={`bridge-status is-${request.status}`}>
                  <BusyOrb active={loading} state="searching" requestKey={request} />
                  <p>{request.message}</p>
                  {request.status === "no_path" && request.mode === "influence" && (
                    <button
                      className="bridge-primary"
                      onClick={() =>
                        void connectArtists(request.fromId, request.target, "adjacent")
                      }
                    >
                      Try broader musical ties
                    </button>
                  )}
                  {request.status === "error" && (
                    <button
                      className="bridge-primary"
                      onClick={() =>
                        void connectArtists(request.fromId, request.target, request.mode)
                      }
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {bridgeOrder.length > 0 && (
          <section className="bridge-library" aria-label="Saved bridges">
            {bridgeOrder.map((id) => {
              const bridge = bridges[id];
              if (!bridge) return null;
              return (
                <div key={id} className={`bridge-row ${activeBridgeId === id ? "is-active" : ""}`}>
                    <button
                      className="bridge-row-main"
                      aria-pressed={activeBridgeId === id}
                      onClick={() => selectBridge(id)}
                    >
                      <span className="bridge-row-name">{bridge.name}</span>
                      <span className="bridge-row-meta">
                        {bridge.paths.length} {bridge.paths.length === 1 ? "path" : "paths"} · {bridge.mode === "influence" ? "lineage" : "broader ties"}
                      </span>
                    </button>
                  <div className="bridge-row-actions">
                      <button
                        aria-label={`Delete ${bridge.name} and its exclusive connector artists`}
                        onClick={() => {
                          useGraph.getState().deleteBridge(id);
                          useUi.getState().showToast("Bridge deleted");
                        }}
                      >
                        <TrashIcon size={13} />
                      </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {!source && bridgeOrder.length === 0 && (
          <div className="bridge-empty">
            <span className="bridge-empty-icon"><LinkIcon size={18} /></span>
            <h3>Connect two artists</h3>
            <p>Open any artist orb and choose “Connect to…” to trace the music between them.</p>
          </div>
        )}

        {activeBridge && (
          <section className="bridge-detail" aria-labelledby="active-bridge-title">
            <div className="bridge-detail-heading">
              <div>
                <h3 id="active-bridge-title">{activeBridge.name}</h3>
                <p>
                  {activeBridge.degraded
                    ? "Deezer similarity bridge"
                    : "Curated influence bridge"}
                </p>
              </div>
              <button
                aria-label="Close bridge spotlight"
                onClick={() => selectBridge(null)}
              >
                <CloseIcon size={13} />
              </button>
            </div>
            <div className="bridge-paths">
              {activeBridge.paths.map((path, index) => (
                <article key={path.id} className="bridge-path-card">
                  <header>
                    <span>Path {index + 1}{index === 0 ? " · shortest" : ""}</span>
                    <span>{path.shape === "shared-root" ? "shared root" : "chain"}</span>
                  </header>
                  <ol className="m-0 flex list-none flex-col items-stretch p-0">
                    {path.nodeIds.map((nodeId, step) => {
                      const nextId = path.nodeIds[step + 1];
                      const edge = path.edgeIds.map(id => edges.find(candidate => candidate.id === id)).find(candidate =>
                        candidate && ((candidate.from === nodeId && candidate.to === nextId) || (candidate.to === nodeId && candidate.from === nextId))
                      );
                      const relationship = !edge ? "connected to" :
                        edge.kind === "similarity" ? "musically similar to" :
                        edge.kind === "collaboration" ? "collaborated with" :
                        edge.kind === "scene" ? "shares a scene with" :
                        edge.kind === "sample" ? "linked through sampling" :
                        edge.kind === "peer" ? "musical peers" :
                        edge.from === nodeId ? "influenced" : "influenced by";
                      return <li key={`${path.id}:${nodeId}:${step}`} className="flex flex-col items-center">
                        <div className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-medium text-neutral-100">
                          {nodes[nodeId]?.name ?? "Unknown artist"}
                        </div>
                        {step < path.nodeIds.length - 1 && <div className="flex w-full flex-col items-center px-3 py-1">
                          <span aria-hidden="true" className="h-3 w-px bg-white/20" />
                          <span className="py-1 text-center text-xs text-neutral-400">{relationship}</span>
                          {edge?.reason && <details className="w-full text-center text-xs text-neutral-400">
                            <summary className="cursor-pointer rounded py-1 text-neutral-500 transition-colors hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Why this connection</summary>
                            <p className="m-0 py-2 text-left leading-relaxed">{edge.reason}</p>
                          </details>}
                          <span aria-hidden="true" className="h-3 w-px bg-white/20" />
                          <span aria-hidden="true" className="-mt-1 text-xs text-neutral-500">↓</span>
                        </div>}
                      </li>;
                    })}
                  </ol>
                </article>
              ))}
            </div>
            {activeBridge.routeOptions && activeBridge.paths.length < activeBridge.routeOptions.paths.length ? (
              <button type="button" className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => {
                useGraph.getState().revealBridgePath(activeBridge.id);
                const updated = useGraph.getState().bridges[activeBridge.id];
                useUi.getState().showToast(`Path ${updated.paths.length} added`);
                setTimeout(() => canvas.fitNodes(updated.nodeIds), 80);
              }}>Explore another pathway</button>
            ) : <p className="m-0 px-1 text-xs text-neutral-500" role="status">{activeBridge.paths.length === 1 ? "No other pathways found." : "All discovered pathways are shown."}</p>}
          </section>
        )}
      </div>
    </>
  );
}
