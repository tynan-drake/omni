"use client";

import { useEffect } from "react";
import { Liquid } from "liquid-gooey";
import { canvas } from "@/lib/canvas-controller";
import { getPositions } from "@/lib/simulation";
import { makeSplitBudPlans } from "@/lib/split-formation";
import type { GraphNode } from "@/lib/types";
import { useOrbDials } from "@/store/orb-dials";
import type { SplitFormationState } from "@/store/ui";

/* ─────────────────────────────────────────────────────────────────────────
 * LIQUID-GOOEY MITOSIS STORYBOARD
 *
 *    0ms   tiny source-image buds sit inside one shared membrane
 *   90ms   every bud swells at once and pulls toward its destination
 *  330ms   liquid necks stretch; the source artist still fills each lobe
 *  650ms   contact dissolves as destination artists resolve through the skin
 *  900ms   droplets overshoot, recoil, and become independent circular orbs
 * 1120ms   the liquid layer hands the settled family back to the canvas
 * ───────────────────────────────────────────────────────────────────────── */

const STAGE = {
  travel: [0, 0.015, 0.11, 0.38, 0.73, 1],
  scale: [0, 0.12, 0.3, 0.7, 1.055, 1],
  imageReveal: 4,
} as const;

const MOTION: Record<number, { duration: number; ease: string }> = {
  1: { duration: 90, ease: "cubic-bezier(0.33, 0, 0.67, 1)" },
  2: { duration: 240, ease: "cubic-bezier(0.2, 0.75, 0.25, 1)" },
  3: { duration: 320, ease: "cubic-bezier(0.25, 0.7, 0.2, 1)" },
  4: { duration: 250, ease: "cubic-bezier(0.15, 0.8, 0.2, 1.08)" },
  5: { duration: 220, ease: "cubic-bezier(0.2, 0.8, 0.25, 1)" },
};

interface GooeyMitosisSurfaceProps {
  formation: SplitFormationState;
  parent: GraphNode;
  buds: GraphNode[];
}

export default function GooeyMitosisSurface({
  formation,
  parent,
  buds,
}: GooeyMitosisSurfaceProps) {
  const tuning = useOrbDials((state) => state.gooeyMitosis);
  const positions = getPositions();
  const parentPosition = positions.get(formation.parentId);
  const transform = canvas.getTransform();
  const plans = makeSplitBudPlans(formation.childIds, formation.direction);
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const stage = Math.max(1, Math.min(formation.stage, 5));
  const travel = STAGE.travel[stage];
  const scale = STAGE.scale[stage];

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".canvas-root");
    if (!root) return;
    root.dataset.mitosisId = String(formation.id);
    root.classList.add("is-mitosis-rendering", "is-gooey-mitosis-rendering");
    return () => {
      if (root.dataset.mitosisId !== String(formation.id)) return;
      delete root.dataset.mitosisId;
      root.classList.remove("is-mitosis-rendering", "is-gooey-mitosis-rendering");
    };
  }, [formation.id]);

  if (!parentPosition) return null;

  const parentRadius = parentPosition.r * transform.k;
  const parentX = parentPosition.x * transform.k + transform.x;
  const parentY = parentPosition.y * transform.k + transform.y;

  return (
    <Liquid
      className="gooey-mitosis-surface"
      blur={tuning.blur}
      contrast={tuning.contrast}
      fill="rgba(160, 175, 255, 0.42)"
      shadow="0 0 2px rgba(232, 238, 255, .9) inset, 0 0 24px rgba(126, 102, 255, .44)"
      filterPadding={72}
      waviness={tuning.waviness}
      wavinessFreq={0.012}
    >
      <Liquid.Item
        radius={parentRadius}
        dissolve={tuning.dissolve}
        morph={{
          shape: true,
          speed: tuning.speed,
          bounce: tuning.bounce,
          contentBlur: 2,
          advanced: { blobInset: 1, bridgeGrow: 12 },
        }}
      >
        <div
          className="gooey-mitosis-orb gooey-mitosis-parent"
          style={{
            left: parentX - parentRadius,
            top: parentY - parentRadius,
            width: parentRadius * 2,
            height: parentRadius * 2,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={parent.picture} alt="" draggable={false} />
        </div>
      </Liquid.Item>

      {buds.map((bud, index) => {
        const plan = plansById.get(bud.id);
        const childPosition = positions.get(bud.id);
        if (!plan || !childPosition) return null;
        const radius = childPosition.r * transform.k;
        const stagger = Math.min(index, 5) * 12;
        return (
          <Liquid.Item
            key={bud.id}
            radius={radius}
            dissolve={{
              warp: 30,
              blur: 9,
              mix: 0.72,
              gravity: 64,
              taper: 1,
              flowSpeed: 24,
              detail: 2,
              zone: 22,
              range: 56,
              strength: tuning.dissolve,
              releaseMs: 120,
            }}
            morph={{
              shape: true,
              speed: tuning.speed,
              bounce: tuning.bounce,
              contentBlur: 3,
              advanced: {
                blobInset: 1,
                bridgeGrow: 14,
                evolve: { anticipation: 55, travel: 38, roundness: 1 },
              },
            }}
          >
            <div
              className={`gooey-mitosis-orb ${
                stage >= STAGE.imageReveal ? "is-destination" : ""
              }`}
              style={{
                left: parentX - radius,
                top: parentY - radius,
                width: radius * 2,
                height: radius * 2,
                transform: `translate(${plan.x * transform.k * travel}px, ${
                  plan.y * transform.k * travel
                }px) scale(${scale})`,
                transition: `transform ${MOTION[stage].duration}ms ${
                  MOTION[stage].ease
                } ${stagger}ms`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="gooey-mitosis-source" src={parent.picture} alt="" draggable={false} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="gooey-mitosis-destination" src={bud.picture} alt="" draggable={false} />
            </div>
          </Liquid.Item>
        );
      })}
    </Liquid>
  );
}
