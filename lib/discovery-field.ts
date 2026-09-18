import { offscreenFlightOffset } from "./search-flight";

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

/** Resolve an artist to its nearest stable occurrence, or reserve an unseen cell. */
export function discoverySearchTarget(
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  count: number,
  artistIndex: number,
  occupiedKeys: ReadonlySet<string> = new Set(),
  savedKey?: string,
  random: () => number = Math.random,
): DiscoveryCell {
  const scale = viewport.width < 600 ? 0.78 : 1;
  const cellAt = (col: number, row: number) => {
    const hash = ((Math.imul(col + 91, 374761393) ^ Math.imul(row + 53, 668265263)) >>> 0);
    return {
      key: `${col}:${row}`,
      index: modulo(row * 13 + col, count),
      x: (col + modulo(row, 2) * 0.46) * 250 * scale + ((hash % 49) - 24) * scale,
      y: row * 245 * scale + (((hash >>> 8) % 49) - 24) * scale,
      size: (98 + ((hash >>> 16) % 53)) * scale,
    };
  };
  if (savedKey) {
    const [col, row] = savedKey.split(":").map(Number);
    return cellAt(col, row);
  }
  const centerCol = Math.round(-camera.x / (250 * scale));
  const centerRow = Math.round(-camera.y / (245 * scale));
  if (artistIndex >= 0 && count > 0) {
    let nearest: DiscoveryCell | undefined;
    let distance = Infinity;
    // A complete catalogue period covers every possible nearby occurrence.
    for (let row = centerRow - count; row <= centerRow + count; row++) {
      const baseCol = artistIndex - row * 13;
      const period = Math.round((centerCol - baseCol) / count);
      for (let offset = -1; offset <= 1; offset++) {
        const cell = cellAt(baseCol + (period + offset) * count, row);
        const d = Math.hypot(cell.x + camera.x, cell.y + camera.y);
        if (d < distance && !occupiedKeys.has(cell.key)) { nearest = cell; distance = d; }
      }
    }
    if (nearest) return nearest;
  }
  // Padding covers cell rounding, row stagger, jitter, and the portrait radius.
  const offset = offscreenFlightOffset(viewport, 300 * scale, random);
  const length = Math.hypot(offset.x, offset.y);
  for (let step = 0; ; step++) {
    const x = -camera.x + offset.x + offset.x / length * step * 250 * scale;
    const y = -camera.y + offset.y + offset.y / length * step * 250 * scale;
    const row = Math.round(y / (245 * scale));
    const col = Math.round(x / (250 * scale) - modulo(row, 2) * 0.46);
    const cell = cellAt(col, row);
    if (!occupiedKeys.has(cell.key)) return cell;
  }
}
