import type { PreviewLine } from '../types';
import type { DrawContext } from './types';

export function drawPreviewLine(
  ctx: CanvasRenderingContext2D,
  preview: PreviewLine,
  dc: DrawContext,
) {
  const { nodes, transform, pendingNode, closeLoopPreview } = dc;
  const fromNode = nodes.find(n => n.id === preview.fromNodeId);
  let fromX: number, fromY: number;
  if (!fromNode && pendingNode?.id === preview.fromNodeId) {
    fromX = pendingNode.x;
    fromY = pendingNode.y;
  } else if (fromNode) {
    fromX = fromNode.x; fromY = fromNode.y;
  } else return;

  const isSnapping = !!preview.snapNodeId;
  const lineColor = closeLoopPreview ? '#22c55e' : (isSnapping ? (dc.isDark ? '#888888' : '#999999') : (dc.isDark ? '#555555' : '#888888'));
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5 / transform.scale;
  ctx.lineCap = 'butt';
  ctx.setLineDash([8 / transform.scale, 8 / transform.scale]);
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(preview.toX, preview.toY); ctx.stroke();
  ctx.setLineDash([]);

  if (!fromNode && pendingNode) {
    ctx.fillStyle = dc.isDark ? '#555555' : '#888888';
    ctx.beginPath(); ctx.arc(fromX, fromY, 4 / transform.scale, 0, Math.PI * 2); ctx.fill();
  }
  if (!isSnapping) {
    ctx.strokeStyle = lineColor; ctx.lineWidth = 1 / transform.scale;
    ctx.beginPath(); ctx.arc(preview.toX, preview.toY, 4 / transform.scale, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.strokeStyle = lineColor; ctx.lineWidth = 1.5 / transform.scale;
    ctx.beginPath(); ctx.arc(preview.toX, preview.toY, 6 / transform.scale, 0, Math.PI * 2); ctx.stroke();
  }
}
