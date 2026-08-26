export interface SelectionPoint {
  x: number;
  y: number;
}

export interface SelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function selectionRect(a: SelectionPoint, b: SelectionPoint): SelectionRect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function rectsIntersect(a: SelectionRect, b: SelectionRect): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function mergeSelection(
  current: number[],
  incoming: number[],
  additive: boolean
): number[] {
  return additive ? [...new Set([...current, ...incoming])] : [...new Set(incoming)];
}
