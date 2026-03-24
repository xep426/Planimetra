import type { LabelBounds } from '../types';

/**
 * Lightweight label-collision nudge.
 *
 * Places the label at its natural position first.  If it actually overlaps
 * an existing label, nudge it outward in small steps along the perpendicular
 * until clear (or give up and keep best position).  Always draws.
 */

interface LabelPlacementOpts {
  /** Anchor point in world coords. */
  anchorX: number;
  anchorY: number;
  /** Unit perpendicular direction away from the wall. */
  perpX: number;
  perpY: number;
  /** +1 or -1 -- preferred side. */
  preferredSide: number;
  /** World-space label dimensions. */
  labelWidth: number;
  labelHeight: number;
  /** Natural offset in screen-px (divided by scale internally). */
  naturalOffset: number;
  /** Current transform scale. */
  scale: number;
  /** Existing labels to check against. */
  existingBounds: LabelBounds[];
}

export interface PlacementResult {
  x: number;
  y: number;
  draw: true;
}

function rectsOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
): boolean {
  return !(
    x1 + w1 / 2 < x2 - w2 / 2 ||
    x1 - w1 / 2 > x2 + w2 / 2 ||
    y1 + h1 / 2 < y2 - h2 / 2 ||
    y1 - h1 / 2 > y2 + h2 / 2
  );
}

function hasOverlap(
  x: number, y: number,
  w: number, h: number,
  existingBounds: LabelBounds[],
): boolean {
  for (const b of existingBounds) {
    if (rectsOverlap(x, y, w, h, b.x, b.y, b.width, b.height)) {
      return true;
    }
  }
  return false;
}

export function findLabelPlacement(opts: LabelPlacementOpts): PlacementResult {
  const {
    anchorX, anchorY, perpX, perpY, preferredSide,
    labelWidth, labelHeight, naturalOffset, scale,
    existingBounds,
  } = opts;

  const off = naturalOffset / scale;
  const posX = anchorX + perpX * preferredSide * off;
  const posY = anchorY + perpY * preferredSide * off;

  // No overlap -> keep natural position
  if (!hasOverlap(posX, posY, labelWidth, labelHeight, existingBounds)) {
    return { x: posX, y: posY, draw: true };
  }

  // Nudge in small 10-screen-px steps outward on the same side, then opposite
  const step = 10 / scale;
  const sides = [preferredSide, -preferredSide];

  for (const side of sides) {
    const baseX = anchorX + perpX * side * off;
    const baseY = anchorY + perpY * side * off;
    for (let i = 1; i <= 4; i++) {
      const nx = baseX + perpX * side * step * i;
      const ny = baseY + perpY * side * step * i;
      if (!hasOverlap(nx, ny, labelWidth, labelHeight, existingBounds)) {
        return { x: nx, y: ny, draw: true };
      }
    }
  }

  // Give up -- draw at natural position anyway
  return { x: posX, y: posY, draw: true };
}
