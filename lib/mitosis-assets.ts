"use client";

const PRELOAD_BUDGET_MS = 1600;

const imagePromises = new Map<string, Promise<HTMLImageElement>>();

export function loadMitosisImage(source: string): Promise<HTMLImageElement> {
  const cached = imagePromises.get(source);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load orb image: ${source}`));
    image.src = source;
  });
  imagePromises.set(source, promise);
  return promise;
}

/** Warm the exact textures the shared surface needs before its short timeline. */
export async function preloadMitosisImages(sources: string[]): Promise<void> {
  const settled = Promise.allSettled([...new Set(sources)].map(loadMitosisImage));
  const budget = new Promise<void>((resolve) => {
    setTimeout(resolve, PRELOAD_BUDGET_MS);
  });
  await Promise.race([settled.then(() => undefined), budget]);
}
