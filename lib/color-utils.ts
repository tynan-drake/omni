/** Client-safe color helpers (no node-vibrant import). */

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) || 0;
}

/** Mix two hex colors 50/50. */
export function mixHex(a: string, b: string): string {
  const toHex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  const parts = [0, 1, 2].map((i) => toHex((channel(a, i) + channel(b, i)) / 2));
  return `#${parts.join("")}`;
}

/** hex + alpha → rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  return `rgba(${channel(hex, 0)}, ${channel(hex, 1)}, ${channel(hex, 2)}, ${alpha})`;
}

/** Remove purple from UI accents, including colors in previously saved graphs. */
export function neutralizePurple(hex: string): string {
  if (!/^#[\da-f]{6}$/i.test(hex)) return hex;
  const [r, g, b] = [0, 1, 2].map((i) => channel(hex, i) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (!delta) return hex;
  const hue = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
  return hue >= 220 && hue <= 330 ? neutralHex(hex) : hex;
}

/** Preserve approximate brightness while making a decorative color neutral. */
export function neutralHex(hex: string): string {
  const level = Math.round(channel(hex, 0) * 0.2126 + channel(hex, 1) * 0.7152 + channel(hex, 2) * 0.0722);
  return `#${level.toString(16).padStart(2, "0").repeat(3)}`;
}
