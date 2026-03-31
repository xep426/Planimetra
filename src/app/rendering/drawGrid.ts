import type { Transform } from '../types';

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: Transform,
  isDark = true,
) {
  const gridSize = 10;
  const extent = (Math.max(width, height) * 2) / transform.scale;
  ctx.strokeStyle = isDark ? '#2a2a2a' : '#e0e0e0';
  ctx.lineWidth = 1 / transform.scale;
  const startX = Math.floor(-extent / gridSize) * gridSize;
  const startY = Math.floor(-extent / gridSize) * gridSize;
  for (let x = startX; x <= extent; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, -extent); ctx.lineTo(x, extent); ctx.stroke();
  }
  for (let y = startY; y <= extent; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(-extent, y); ctx.lineTo(extent, y); ctx.stroke();
  }
}
