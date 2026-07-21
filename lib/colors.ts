import { Vibrant } from "node-vibrant/node";
import { cacheGet, cacheSet } from "./cache";

/** Curated fallback hues so failed extractions still look intentional. */
const FALLBACK_HUES = [265, 210, 330, 160, 35, 190, 290, 15];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) =>
    lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s * 100, l * 100];
}

/** Clamp an accent into a range that glows well against the dark canvas. */
function tuneAccent(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, Math.max(s, 45), Math.min(Math.max(l, 48), 68));
}

export function fallbackAccent(name: string): string {
  const hue = FALLBACK_HUES[hashName(name) % FALLBACK_HUES.length];
  return hslToHex(hue, 60, 58);
}

/**
 * Extract a display accent color from an artist portrait, cached by artist id.
 */
export async function getAccentColor(
  artistId: number,
  name: string,
  imageUrl: string
): Promise<string> {
  const key = `accent-${artistId}`;
  const cached = await cacheGet<{ accent: string }>(key);
  if (cached?.accent) return cached.accent;

  let accent: string;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`image HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const palette = await Vibrant.from(buffer).getPalette();
    const swatch =
      palette.Vibrant ??
      palette.LightVibrant ??
      palette.Muted ??
      palette.DarkVibrant ??
      palette.LightMuted;
    accent = swatch ? tuneAccent(swatch.hex) : fallbackAccent(name);
  } catch {
    accent = fallbackAccent(name);
  }

  await cacheSet(key, { accent });
  return accent;
}
