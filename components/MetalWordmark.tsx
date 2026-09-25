"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { MetalText, isMetalFxSupported } from "metal-fx";

export default function MetalWordmark() {
  const host = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedEffects();
  const [font, setFont] = useState("");

  useEffect(() => {
    const element = host.current;
    if (!element || reducedMotion !== false || !isMetalFxSupported()) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const style = getComputedStyle(element);
      setFont(`${style.fontWeight} ${style.fontSize}/1 ${style.fontFamily}`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [reducedMotion]);

  return <span ref={host} className="metal-wordmark" aria-hidden="true">
    {font && reducedMotion === false
      ? <MetalText font={font} color="#d4d4d4" theme="dark" strength={0.55}>{"O\u2004M\u2004N\u2004I"}</MetalText>
      : "OMNI"}
  </span>;
}
