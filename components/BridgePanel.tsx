"use client";

import { useState } from "react";
import { canvas } from "@/lib/canvas-controller";
import { connectArtists } from "@/store/actions";
import { useGraph } from "@/store/graph";
import { useUi } from "@/store/ui";
import ArtistSearch from "./ArtistSearch";
import { CloseIcon, EditIcon, LinkIcon, TrashIcon } from "./Icons";

export default function BridgePanel() {
  const nodes = useGraph((state) => state.nodes);
  const edges = useGraph((state) => state.edges);
  const bridges = useGraph((state) => state.bridges);
  const bridgeOrder = useGraph((state) => state.bridgeOrder);
  const activeBridgeId = useGraph((state) => state.activeBridgeId);
  const connectingFrom = useUi((state) => state.connectingFrom);
  const request = useUi((state) => state.bridgeRequest);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const activeBridge = activeBridgeId ? bridges[activeBridgeId] : null;
  const source = connectingFrom === null ? null : nodes[connectingFrom];
  const loading = request?.status === "loading";

  const selectBridge = (id: string | null) => {
    useGraph.getState().setActiveBridge(id);
    if (id) setTimeout(() => canvas.fitNodes(bridges[id].nodeIds), 80);
    else setTimeout(() => canvas.fitAll(), 80);
  };

  const saveName = (id: string) => {
    useGraph.getState().renameBridge(id, draftName);
    setEditingId(null);
  };

  return (
    <>
      <header className="nav-flyout-head">
        <h2>Bridges</h2>
        {source && (
          <button
            className="nav-flyout-clear bridge-cancel"
            onClick={() => useUi.getState().cancelConnecting()}
          >
            Cancel
          </button>
        )}
      </header>
      <div className="nav-flyout-body bridge-panel scrollbar-slim">
        {source && (
          <section className="bridge-connect" aria-labelledby="bridge-connect-title">
            <div className="bridge-connect-source">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source.picture} alt="" />
              <div>
                <h3 id="bridge-connect-title">Connect {source.name}</h3>
                <p>Select another orb or search for an artist.</p>
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
                  {loading && <span className="search-spinner" aria-hidden="true" />}
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
          <section className="bridge-library" aria-labelledby="saved-bridges-title">
            <h3 id="saved-bridges-title" className="bridge-section-title">
              Saved bridges
            </h3>
            <button
              className={`bridge-row bridge-universe ${activeBridgeId === null ? "is-active" : ""}`}
              aria-pressed={activeBridgeId === null}
              onClick={() => selectBridge(null)}
            >
              <span className="bridge-row-icon"><LinkIcon /></span>
              <span>All universe</span>
            </button>
            {bridgeOrder.map((id) => {
              const bridge = bridges[id];
              if (!bridge) return null;
              const editing = editingId === id;
              return (
                <div key={id} className={`bridge-row ${activeBridgeId === id ? "is-active" : ""}`}>
                  {editing ? (
                    <input
                      className="bridge-name-input"
                      aria-label="Bridge name"
                      value={draftName}
                      autoFocus
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => saveName(id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveName(id);
                        if (event.key === "Escape") setEditingId(null);
                      }}
                    />
                  ) : (
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
                  )}
                  {!editing && (
                    <div className="bridge-row-actions">
                      <button
                        aria-label={`Rename ${bridge.name}`}
                        onClick={() => {
                          setDraftName(bridge.name);
                          setEditingId(id);
                        }}
                      >
                        <EditIcon size={13} />
                      </button>
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
                  )}
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
                    ? "Similarity bridge"
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
                    <span>Path {index + 1}</span>
                    <span>{path.shape === "shared-root" ? "shared root" : "chain"}</span>
                  </header>
                  <div className="bridge-relations">
                    {path.edgeIds.map((id) => {
                      const edge = edges.find((candidate) => candidate.id === id);
                      if (!edge) return null;
                      return (
                        <div key={id} className="bridge-relation">
                          <div className="bridge-relation-title">
                            <span>{nodes[edge.from]?.name}</span>
                            <span aria-hidden="true">→</span>
                            <span>{nodes[edge.to]?.name}</span>
                          </div>
                          <span className="bridge-relation-kind">
                            {edge.kind === "back" || edge.kind === "forward"
                              ? "influence"
                              : edge.kind}
                          </span>
                          {edge.reason && <p>{edge.reason}</p>}
                          <span className="bridge-evidence">Sources coming later</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
