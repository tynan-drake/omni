"use client";

import { memo } from "react";
import { GLASS_VARIANTS, useOrbDials } from "@/store/orb-dials";

/* ─────────────────────────────────────────────────────────────────────────
 * LIQUID GLASS FILTERS
 *
 * One hidden <svg> mounted once for the whole app, holding the displacement
 * filters that bend the photo inside every orb. Each orb picks a variant by
 * id (see components/Orb.tsx) so neighbouring orbs don't warp identically —
 * the seed is the only thing that differs between them.
 *
 * The filters are deliberately static: a fractal noise field is rasterised
 * once per variant and reused by every orb that references it. Motion comes
 * from the CSS layers above the photo (sheen, iridescence, fringe), which
 * ride the compositor instead of re-running turbulence every frame.
 * ───────────────────────────────────────────────────────────────────────── */

function OrbFiltersImpl() {
  const glass = useOrbDials((s) => s.glass);

  return (
    <svg aria-hidden className="orb-filter-defs" width="0" height="0">
      <defs>
        {Array.from({ length: GLASS_VARIANTS }, (_, i) => (
          <filter
            key={i}
            id={`orb-liquid-${i}`}
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            filterUnits="objectBoundingBox"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${glass.frequency} ${glass.frequency * 1.35}`}
              numOctaves={glass.detail}
              seed={i * 17 + 3}
              result="noise"
            />
            {/* Softening the noise turns crinkled foil into flowing liquid. */}
            <feGaussianBlur in="noise" stdDeviation={glass.smooth} result="field" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="field"
              scale={glass.warp}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

export const OrbFilters = memo(OrbFiltersImpl);
export default OrbFilters;
