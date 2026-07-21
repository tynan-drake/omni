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
