import type { LabelBounds } from '../types';

interface LabelPlacementOpts {
  anchorX: number;
  anchorY: number;
  perpX: number;
  perpY: number;
  preferredSide: number;
  labelWidth: number;
  labelHeight: number;
  naturalOffset: number;
  scale: number;
  rotation: number;
  existingBounds: LabelBounds[];
}

export interface PlacementResult {
  x: number;
  y: number;
  draw: true;
}

// Check overlap in screen-rotated space — labels are screen-aligned, so their
// AABB is in screen coordinates. Rotate the centre-to-centre vector by the
// canvas rotation before comparing against the half-extents.
function rectsOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
  cosR: number, sinR: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dxRot = dx * cosR - dy * sinR;
  const dyRot = dx * sinR + dy * cosR;
  return !(
    Math.abs(dxRot) >= (w1 + w2) / 2 ||
    Math.abs(dyRot) >= (h1 + h2) / 2
  );
}

function hasOverlap(x: number, y: number, w: number, h: number, bounds: LabelBounds[], cosR: number, sinR: number): boolean {
  for (const b of bounds) {
    if (rectsOverlap(x, y, w, h, b.x, b.y, b.width, b.height, cosR, sinR)) return true;
  }
  return false;
}

export function findLabelPlacement(opts: LabelPlacementOpts): PlacementResult {
  const { anchorX, anchorY, perpX, perpY, preferredSide, labelWidth, labelHeight, naturalOffset, scale, rotation, existingBounds } = opts;

  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  // Along-wall direction
  const dirX = -perpY;
  const dirY = perpX;

  const off = naturalOffset / scale;

  // Steps proportional to label size — zoom-independent
  const perpStep = labelHeight * 1.1;
  const alongStep = labelWidth * 0.6;

  const sides = [preferredSide, -preferredSide];

  for (const side of sides) {
    const baseX = anchorX + perpX * side * off;
    const baseY = anchorY + perpY * side * off;

    // Check natural position first
    if (!hasOverlap(baseX, baseY, labelWidth, labelHeight, existingBounds, cosR, sinR)) {
      return { x: baseX, y: baseY, draw: true };
    }

    // Expand outward perpendicularly, trying along-wall offsets at each step
    for (let p = 1; p <= 12; p++) {
      const px = baseX + perpX * side * perpStep * p;
      const py = baseY + perpY * side * perpStep * p;

      if (!hasOverlap(px, py, labelWidth, labelHeight, existingBounds, cosR, sinR)) {
        return { x: px, y: py, draw: true };
      }

      for (const along of [1, -1]) {
        for (let a = 1; a <= 6; a++) {
          const cx = px + dirX * along * alongStep * a;
          const cy = py + dirY * along * alongStep * a;
          if (!hasOverlap(cx, cy, labelWidth, labelHeight, existingBounds, cosR, sinR)) {
            return { x: cx, y: cy, draw: true };
          }
        }
      }
    }

    // Pure along-wall sweep at natural offset
    for (const along of [1, -1]) {
      for (let a = 1; a <= 12; a++) {
        const cx = baseX + dirX * along * alongStep * a;
        const cy = baseY + dirY * along * alongStep * a;
        if (!hasOverlap(cx, cy, labelWidth, labelHeight, existingBounds, cosR, sinR)) {
          return { x: cx, y: cy, draw: true };
        }
      }
    }
  }

  // Fallback: natural position
  return { x: anchorX + perpX * preferredSide * off, y: anchorY + perpY * preferredSide * off, draw: true };
}
