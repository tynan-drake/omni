"use client";

import { useEffect, useRef } from "react";
import { useDialKit, type DialConfig } from "dialkit";

const CONFIG = {
  enabled: true,
  blur: [6, 0, 32, 0.5],
  focusArea: [44, 10, 85, 1],
  feather: [35, 5, 90, 1],
  horizontalStretch: [1.3, 0.6, 2, 0.05],
  verticalStretch: [1.35, 0.6, 2, 0.05],
} satisfies DialConfig;

/** Viewport-fixed lens: the world moves beneath it; interface controls stay sharp. */
export default function DiscoveryLens() {
  const ref = useRef<HTMLDivElement>(null);
  const params = useDialKit("Canvas lens", CONFIG, {
    id: "discovery-lens",
    persist: true,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Dynamic dial values follow the app's existing CSS-variable dial pattern.
    const values = {
      "--lens-blur": `${params.blur}px`,
      "--lens-focus": `${params.focusArea}%`,
      "--lens-falloff": `${params.focusArea + params.feather}%`,
      "--lens-width": `${50 * params.horizontalStretch}%`,
      "--lens-height": `${50 * params.verticalStretch}%`,
    };
    for (const [name, value] of Object.entries(values)) element.style.setProperty(name, value);
  }, [params]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-discovery-lens
      className={`pointer-events-none absolute inset-0 z-10 backdrop-blur-(--lens-blur) [mask-image:radial-gradient(ellipse_var(--lens-width)_var(--lens-height)_at_center,transparent_var(--lens-focus),black_var(--lens-falloff))] ${params.enabled && params.blur > 0 ? "" : "hidden"}`}
    />
  );
}
