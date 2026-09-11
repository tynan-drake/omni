/** Stable cells in an unbounded, repeating discovery shelf. */
export interface DiscoveryCell {
  key: string;
  index: number;
  x: number;
  y: number;
  size: number;
}
const modulo = (value: number, length: number) => ((value % length) + length) % length;

export function discoveryCells(
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  count: number,
): DiscoveryCell[] {
  if (!count || !viewport.width || !viewport.height) return [];
  const scale = viewport.width < 600 ? 0.78 : 1;
  const stepX = 250 * scale;
  const stepY = 245 * scale;
  const left = Math.floor((-camera.x - viewport.width / 2) / stepX) - 1;
  const right = Math.ceil((-camera.x + viewport.width / 2) / stepX) + 1;
  const top = Math.floor((-camera.y - viewport.height / 2) / stepY) - 1;
  const bottom = Math.ceil((-camera.y + viewport.height / 2) / stepY) + 1;
  const cells: DiscoveryCell[] = [];
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const hash = ((Math.imul(col + 91, 374761393) ^ Math.imul(row + 53, 668265263)) >>> 0);
      cells.push({
        key: `${col}:${row}`,
        index: modulo(row * 13 + col, count),
        x: (col + modulo(row, 2) * 0.46) * stepX + ((hash % 49) - 24) * scale,
        y: row * stepY + (((hash >>> 8) % 49) - 24) * scale,
        size: (98 + ((hash >>> 16) % 53)) * scale,
      });
    }
  }
  return cells;
}
