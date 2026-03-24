// Pure geometry and coordinate helper functions
// No React dependency -- all functions are stateless

import type { Transform } from '../types';

/** Convert screen pixel coordinates to world coordinates */
export function screenToWorld(
  sx: number,
  sy: number,
  canvasWidth: number,
  canvasHeight: number,
  transform: Transform
): { x: number; y: number } {
  const cx = sx - canvasWidth / 2;
  const cy = sy - canvasHeight / 2;
  const cos = Math.cos(-transform.rotation);
  const sin = Math.sin(-transform.rotation);
  return {
    x: (cx * cos - cy * sin) / transform.scale - transform.x,
    y: (cx * sin + cy * cos) / transform.scale - transform.y,
  };
}

/** Snap coordinates to a grid of size g (default 10) */
export function snapToGrid(x: number, y: number, g: number = 10): { x: number; y: number } {
  return { x: Math.round(x / g) * g, y: Math.round(y / g) * g };
}

/** Euclidean distance between two points */
export function calcDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Validate that the geometric distance matches the user-entered length */
export function validateGeometry(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  meters: number
): { ok: boolean; error?: string } {
  const actualCm = calcDistance(sx, sy, ex, ey);
  const inputCm = meters * 100;
  const diff = Math.abs(actualCm - inputCm);
  if (diff > 0.1) {
    return {
      ok: false,
      error: `Mismatch: entered ${meters.toFixed(3)} m but distance is ${(actualCm / 100).toFixed(3)} m`,
    };
  }
  return { ok: true };
}

/** Snap an angle (radians) to the nearest 45-degree increment */
export function snapAngle45(rad: number): number {
  return (Math.round((rad * 180) / Math.PI / 45) * 45 * Math.PI) / 180;
}

/** Check if two axis-aligned rectangles overlap (given centers and dimensions in world coords) */
export function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 &&
    Math.abs(ay - by) < (ah + bh) / 2
  );
}

/**
 * Compute signed area and centroid of a simple polygon using the shoelace formula.
 * Coordinates are in whatever unit the caller provides (typically cm for this app).
 * Returns absolute area and the geometric centroid { x, y }.
 */
export function computePolygonAreaAndCentroid(
  points: ReadonlyArray<{ x: number; y: number }>
): { area: number; centroid: { x: number; y: number } } | null {
  const n = points.length;
  if (n < 3) return null;

  let signedArea2 = 0; // 2 x signed area
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const next = points[(i + 1) % n];
    const cross = curr.x * next.y - next.x * curr.y;
    signedArea2 += cross;
    cx += (curr.x + next.x) * cross;
    cy += (curr.y + next.y) * cross;
  }

  if (Math.abs(signedArea2) < 1e-6) return null;

  const area = Math.abs(signedArea2) / 2;
  const factor = 1 / (3 * signedArea2);
  return {
    area,
    centroid: { x: cx * factor, y: cy * factor },
  };
}