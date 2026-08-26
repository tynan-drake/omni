"use client";

import { useEffect } from "react";
import { hydrateCanvas, startCanvasPersistence } from "@/store/persistence";

export default function CanvasPersistence() {
  useEffect(() => {
    hydrateCanvas();
    return startCanvasPersistence();
  }, []);
  return null;
}
