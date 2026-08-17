"use client";

import { useEffect } from "react";
import { DialRoot, useDialKit, type DialConfig, type ResolvedValues } from "dialkit";
import "dialkit/styles.css";
import { canvas } from "@/lib/canvas-controller";
import { scatter, setPhysics } from "@/lib/simulation";
import { useOrbDials } from "@/store/orb-dials";

/* ─────────────────────────────────────────────────────────────────────────
 * ORB CONTROL PANEL
 *
 * A live playground for the feel of the canvas. Three kinds of parameter:
 *
 *   form / light / atmosphere / label / edges  → CSS custom properties on
 *       :root, consumed by app/globals.css. No React re-render.
 *   physics                                    → d3 forces, pushed straight
 *       into the running simulation.
 *   size + entrance                            → the zustand slice, since
 *       they have to reach React (orb geometry, Motion springs).
 *
 * Values persist to localStorage, so a setup you like survives a reload.
 * DialRoot hides itself in production builds.
 * ───────────────────────────────────────────────────────────────────────── */

const CONFIG = {
  form: {
    /** Scales the orb and its collision radius together. */
    size: [1.18, 0.3, 2.5, 0.02],
    shadowY: [14, -40, 60],
    shadowBlur: [45, 0, 90],
    shadowOpacity: [0.33, 0, 1, 0.01],
    rimWidth: [1.3, 0, 6, 0.1],
    rimGlow: [38, 0, 60],
    /** How much of the artist's accent colour the rim takes on. */
    rimTint: [28, 0, 100],
    saturation: [1.15, 0, 3, 0.05],
    brightness: [1, 0.2, 2, 0.05],
    contrast: [1, 0.2, 2, 0.05],
    /** Rotates every cover's hue — the whole field shifts key together. */
    hueShift: [0, -180, 180],
  },

  /* One virtual light source. Moving the angle swings the specular highlight
   * and the shadow terminator in lockstep, so the orbs read as lit, not
   * decorated. 0° is straight above; negative is up-and-left. */
  light: {
    angle: [-140, -180, 180],
    shineDistance: [57, 0, 60],
    shineStrength: [0.4, 0, 1, 0.01],
    shineSpread: [100, 10, 100],
    limbDistance: [10, 0, 60],
    limbStart: [65, 0, 90],
    limbDepth: [0.66, 0, 1, 0.01],
  },

  atmosphere: {
    size: [0, 0, 140],
    opacity: [0.3, 0, 1, 0.01],
    blur: [28, 0, 60],
    /** Where the accent glow fades to nothing. Low = tight halo. */
    falloff: [75, 20, 100],
    /** Slow scale pulse — orbs feel alive rather than parked. */
    breathe: [0.1, 0, 0.6, 0.01],
    breatheGlow: [0, 0, 1.5, 0.05],
    breatheSeconds: [4, 0.5, 20, 0.1],
  },

  drift: {
    lift: [6, 0, 40],
    sway: [3, 0, 40],
    tilt: [2, 0, 24],
    seconds: [5.2, 1, 30, 0.1],
    /** Spread of start times. 0 makes every orb bob in unison. */
    phaseSpread: [6, 0, 20, 0.1],
    /** Ties drift speed to orb size. Positive = big orbs move slower. */
    parallax: [1.05, -1, 2, 0.05],
  },

  physics: {
    repulsion: [640, 0, 900],
    /** Negative values let orbs overlap and clump. */
    collidePadding: [10, -30, 80],
    /** How hard a hovered orb shoves its neighbours aside. */
    hoverPush: [30, 0, 140],
    linkDistance: [190, 40, 500],
    peerDistance: [310, 40, 500],
    linkStrength: [0.19, 0, 1, 0.01],
    peerStrength: [0.39, 0, 1, 0.01],
    gravity: [0.034, 0, 0.2, 0.001],
    friction: [0.35, 0.05, 0.95, 0.01],
    /** How fast the field stops caring. Low = keeps rearranging for ages. */
    settle: [0.08, 0.005, 0.2, 0.005],
    /** Above 0 the field never rests — a permanent restless jitter. */
    chaos: [0, 0, 3, 0.05],
    /** Tangential pull about the origin: the constellation slowly swirls. */
    orbit: [0, -1, 1, 0.01],
  },

  interaction: {
    hoverScale: [1.14, 1, 1.8, 0.01],
    hoverLift: [4, 0, 30],
    hoverAtmosphere: [0.96, 0, 1, 0.01],
    hoverAtmosphereScale: [1.33, 1, 2, 0.01],
    selectedAtmosphere: [1, 0, 1, 0.01],
    selectedAtmosphereScale: [1.15, 1, 2, 0.01],
    selectedRimWidth: [1.5, 0, 8, 0.1],
    /** Opacity + saturation of orbs filtered out of view. */
    dimOpacity: [0.34, 0, 1, 0.01],
    dimSaturation: [0.25, 0, 1, 0.01],
    responseMs: [700, 0, 1200, 10],
    entrance: { type: "spring", visualDuration: 0.45, bounce: 0.35 },
  },

  edges: {
    opacity: [0.28, 0, 1, 0.01],
    width: [1.4, 0, 6, 0.1],
    flowOpacity: [0.75, 0, 1, 0.01],
    flowWidth: [1.7, 0, 6, 0.1],
    dash: [3, 0, 30, 0.5],
    gap: [11, 0, 40, 0.5],
    flowSeconds: [1.9, 0.2, 12, 0.1],
    peerDash: [2, 0, 30, 0.5],
    peerGap: [7, 0, 40, 0.5],
    peerOpacity: [0.34, 0, 1, 0.01],
    dimOpacity: [0.1, 0, 1, 0.01],
  },

  label: {
    offset: [0, -40, 80],
    opacity: [1, 0, 1, 0.01],
    nameSize: [12, 6, 30, 0.5],
    eraSize: [9, 6, 24, 0.5],
  },

  scatter: { type: "action", label: "Scatter" },
  replay: { type: "action", label: "Replay entrances" },
  refit: { type: "action", label: "Fit to screen" },
} satisfies DialConfig;

type OrbDialValues = ResolvedValues<typeof CONFIG>;

function setVars(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

/** Polar → percentage offset from the sphere's centre, for the light source. */
function lightPoint(angle: number, distance: number): [string, string] {
  const rad = (angle * Math.PI) / 180;
  return [
    `${(50 + Math.sin(rad) * distance).toFixed(2)}%`,
    `${(50 - Math.cos(rad) * distance).toFixed(2)}%`,
  ];
}

function applyLook(p: OrbDialValues): void {
  const [shineX, shineY] = lightPoint(p.light.angle, p.light.shineDistance);
  const [limbX, limbY] = lightPoint(p.light.angle, p.light.limbDistance);

  setVars({
    "--orb-shadow-y": `${p.form.shadowY}px`,
    "--orb-shadow-blur": `${p.form.shadowBlur}px`,
    "--orb-shadow-opacity": `${p.form.shadowOpacity}`,
    "--orb-rim-width": `${p.form.rimWidth}px`,
    "--orb-rim-glow": `${p.form.rimGlow}px`,
    "--orb-rim-tint": `${p.form.rimTint}%`,
    "--orb-saturation": `${p.form.saturation}`,
    "--orb-brightness": `${p.form.brightness}`,
    "--orb-contrast": `${p.form.contrast}`,
    "--orb-hue": `${p.form.hueShift}deg`,

    "--orb-shine-x": shineX,
    "--orb-shine-y": shineY,
    "--orb-shine-strength": `${p.light.shineStrength}`,
    "--orb-shine-spread": `${p.light.shineSpread}%`,
    "--orb-limb-x": limbX,
    "--orb-limb-y": limbY,
    "--orb-limb-start": `${p.light.limbStart}%`,
    "--orb-limb-depth": `${p.light.limbDepth}`,

    "--orb-atmo-inset": `${-p.atmosphere.size}%`,
    "--orb-atmo-opacity": `${p.atmosphere.opacity}`,
    "--orb-atmo-blur": `${p.atmosphere.blur}px`,
    "--orb-atmo-falloff": `${p.atmosphere.falloff}%`,
    "--orb-atmo-breathe": `${p.atmosphere.breathe}`,
    "--orb-atmo-breathe-glow": `${p.atmosphere.breatheGlow}`,
    "--orb-atmo-breathe-dur": `${p.atmosphere.breatheSeconds}s`,

    "--orb-drift-lift": `${p.drift.lift}px`,
    "--orb-drift-sway": `${p.drift.sway}px`,
    "--orb-drift-tilt": `${p.drift.tilt}deg`,
    "--orb-drift-dur": `${p.drift.seconds}s`,
    "--orb-drift-spread": `${p.drift.phaseSpread}`,
    "--orb-drift-parallax": `${p.drift.parallax}`,

    "--orb-response": `${p.interaction.responseMs}ms`,
    "--orb-hover-scale": `${p.interaction.hoverScale}`,
    "--orb-hover-lift": `${p.interaction.hoverLift}px`,
    "--orb-hover-atmo-opacity": `${p.interaction.hoverAtmosphere}`,
    "--orb-hover-atmo-scale": `${p.interaction.hoverAtmosphereScale}`,
    "--orb-selected-atmo-opacity": `${p.interaction.selectedAtmosphere}`,
    "--orb-selected-atmo-scale": `${p.interaction.selectedAtmosphereScale}`,
    "--orb-selected-rim-width": `${p.interaction.selectedRimWidth}px`,
    "--orb-dim-opacity": `${p.interaction.dimOpacity}`,
    "--orb-dim-saturation": `${p.interaction.dimSaturation}`,

    "--orb-label-offset": `${p.label.offset}px`,
    "--orb-label-opacity": `${p.label.opacity}`,
    "--orb-label-name-size": `${p.label.nameSize}px`,
    "--orb-label-era-size": `${p.label.eraSize}px`,

    "--edge-opacity": `${p.edges.opacity}`,
    "--edge-width": `${p.edges.width}`,
    "--edge-flow-opacity": `${p.edges.flowOpacity}`,
    "--edge-flow-width": `${p.edges.flowWidth}`,
    "--edge-dash": `${p.edges.dash}`,
    "--edge-gap": `${p.edges.gap}`,
    "--edge-flow-dur": `${p.edges.flowSeconds}s`,
    "--edge-peer-dash": `${p.edges.peerDash}`,
    "--edge-peer-gap": `${p.edges.peerGap}`,
    "--edge-peer-opacity": `${p.edges.peerOpacity}`,
    "--edge-dim-opacity": `${p.edges.dimOpacity}`,
  });
}

export default function OrbDials() {
  const params = useDialKit("Orbs", CONFIG, {
    id: "orbs",
    persist: true,
    onAction: (action) => {
      if (action === "scatter") scatter();
      if (action === "replay") useOrbDials.getState().replay();
      if (action === "refit") canvas.fitAll();
    },
  });

  useEffect(() => {
    applyLook(params);
    setPhysics(params.physics);

    const { setSizeScale, setEntrance } = useOrbDials.getState();
    setSizeScale(params.form.size);
    // The transition control can only produce a spring for a spring config,
    // but the resolved type is the wider union — narrow before storing.
    if (params.interaction.entrance.type === "spring") {
      setEntrance(params.interaction.entrance);
    }
  }, [params]);

  return <DialRoot position="top-right" />;
}
