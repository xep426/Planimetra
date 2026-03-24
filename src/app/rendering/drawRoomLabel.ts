import type { DrawContext } from './types';
import { computePolygonAreaAndCentroid } from '../utils/geometry';

/**
 * Draw the room name and area (m^2) label at the centroid of the closed wall loop.
 * Styled to match the sketch canvas labels (dark background, monospace, light text).
 * Only renders when 3+ walls form a closed polygon.
 */
export function drawRoomLabel(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const { nodes, walls, columns, transform, roomName } = dc;
  if (walls.length < 3) return;

  // ---- Traverse walls to get ordered polygon vertices ----
  const orderedNodeIds: string[] = [];
  const visitedWalls = new Set<string>();
  const firstWall = walls[0];
  let currentNodeId = firstWall.nodeA;

  while (visitedWalls.size < walls.length) {
    const nextWall = walls.find(w =>
      !visitedWalls.has(w.id) && (w.nodeA === currentNodeId || w.nodeB === currentNodeId)
    );
    if (!nextWall) break;
    orderedNodeIds.push(currentNodeId);
    const toId = nextWall.nodeA === currentNodeId ? nextWall.nodeB : nextWall.nodeA;
    visitedWalls.add(nextWall.id);
    currentNodeId = toId;
    if (currentNodeId === firstWall.nodeA) break; // loop closed
  }

  // Only render if the loop actually closed back to the start
  if (currentNodeId !== firstWall.nodeA || orderedNodeIds.length < 3) return;

  // Map node IDs -> coordinates
  const points = orderedNodeIds
    .map(id => nodes.find(n => n.id === id))
    .filter((n): n is { id: string; x: number; y: number } => n != null);

  if (points.length < 3) return;

  const result = computePolygonAreaAndCentroid(points);
  if (!result) return;

  // Coordinates are in cm; convert area to m^2
  let areaSqM = result.area / 10000;

  // Subtract column footprints (width x depth are in meters)
  for (const col of columns) {
    areaSqM -= col.width * col.depth;
    // Also subtract any merged shapes on this column
    if (col.mergedShapes) {
      for (const ms of col.mergedShapes) {
        areaSqM -= ms.width * ms.depth;
      }
    }
  }
  if (areaSqM < 0) areaSqM = 0;

  const { x: cx, y: cy } = result.centroid;

  // ---- Render label (matches wall/door/window label style) ----
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-transform.rotation);
  ctx.scale(1 / transform.scale, 1 / transform.scale);

  const nameLine = roomName || 'Room';
  const areaLine = `${areaSqM.toFixed(2)}\u2009m\u00B2`;

  // Measure both lines
  ctx.font = '11px monospace';
  const nameWidth = ctx.measureText(nameLine).width;
  const areaWidth = ctx.measureText(areaLine).width;
  const textWidth = Math.max(nameWidth, areaWidth);

  const padX = 8;
  const padY = 4;
  const lineGap = 3;
  const lineH = 13; // approx line height for 11px monospace
  const boxW = textWidth + padX * 2;
  const boxH = lineH * 2 + lineGap + padY * 2;

  // Dark background rect (same as wall labels)
  ctx.fillStyle = 'rgba(26, 26, 26, 0.85)';
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1;
  ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
  ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

  // Room name (top line)
  ctx.fillStyle = '#cccccc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '11px monospace';
  ctx.fillText(nameLine, 0, -lineGap / 2 - lineH / 2);

  // Area (bottom line)
  ctx.fillStyle = '#999999';
  ctx.fillText(areaLine, 0, lineGap / 2 + lineH / 2);

  ctx.restore();
}