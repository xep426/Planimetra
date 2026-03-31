import type { DrawContext } from './types';

export function drawNodes(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const isWallMode = dc.selectedTool === 'wall';

  if (!isWallMode) return;

  dc.nodes.forEach(node => {
    const r = 5 / dc.transform.scale;
    const unconstrained = dc.unconstrainedNodes.has(node.id);

    const nodeColor = dc.isDark ? '#ffffff' : '#333333';
    // Filled solid circle - gray out when not in wall mode
    ctx.fillStyle = nodeColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Ring: solid = constrained, dashed = unconstrained
    ctx.strokeStyle = nodeColor;
    ctx.lineWidth = 1.5 / dc.transform.scale;
    if (unconstrained) {
      const dl = 2.5 / dc.transform.scale;
      ctx.setLineDash([dl, dl]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.arc(node.x, node.y, r * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}
