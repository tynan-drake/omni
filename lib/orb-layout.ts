export interface LabelLayout {
  offset: number;
  nameSize: number;
  eraSize: number;
}

export interface OrbLayout {
  r: number;
  labelWidth: number;
  labelHeight: number;
  labelOffset: number;
}

export const DEFAULT_LABEL_LAYOUT: LabelLayout = {
  offset: 10,
  nameSize: 12,
  eraSize: 9,
};

const LABEL_CLEARANCE = 12;

/**
 * Generous single-line label estimate that reserves room for the real text,
 * including wider uppercase glyphs, before an orb reaches the DOM.
 */
export function estimateLabelWidth(name: string, nameSize: number): number {
  return Math.max(nameSize * 4, Math.ceil(name.length * nameSize * 0.82 + nameSize));
}

export function createOrbLayout(
  r: number,
  name: string,
  hasEra: boolean,
  label: LabelLayout
): OrbLayout {
  return {
    r,
    labelWidth: estimateLabelWidth(name, label.nameSize),
    labelHeight:
      label.nameSize * 1.25 + (hasEra ? label.eraSize * 1.35 + 1 : 0),
    labelOffset: label.offset,
  };
}

export interface FootprintOverlap {
  x: number;
  y: number;
}

/**
 * Returns the overlap between two full orb footprints: the circular artwork
 * plus the one-line name and optional era directly beneath it.
 */
export function footprintOverlap(
  a: OrbLayout,
  ax: number,
  ay: number,
  b: OrbLayout,
  bx: number,
  by: number
): FootprintOverlap | null {
  const aHalfWidth = Math.max(a.r, a.labelWidth / 2) + LABEL_CLEARANCE;
  const bHalfWidth = Math.max(b.r, b.labelWidth / 2) + LABEL_CLEARANCE;
  const overlapX = aHalfWidth + bHalfWidth - Math.abs(ax - bx);
  if (overlapX <= 0) return null;

  const aTop = ay - a.r - LABEL_CLEARANCE;
  const aBottom = ay + a.r + a.labelOffset + a.labelHeight + LABEL_CLEARANCE;
  const bTop = by - b.r - LABEL_CLEARANCE;
  const bBottom = by + b.r + b.labelOffset + b.labelHeight + LABEL_CLEARANCE;
  const overlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
  if (overlapY <= 0) return null;

  return { x: overlapX, y: overlapY };
}
