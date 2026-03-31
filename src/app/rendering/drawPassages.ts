import type { DrawContext } from './types';
import { findLabelPlacement } from './labelCollision';

export function drawPassages(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const { nodes, walls, passages, transform, selectedTool, selectedPassageId, labelBounds } = dc;
  const isPassageMode = selectedTool === 'passage';

  passages.forEach(passage => {
    const wall = walls.find(w => w.id === passage.wallId);
    if (!wall) return;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;

    const isSelected = passage.id === selectedPassageId && isPassageMode;

    const passageX = nA.x + (nB.x - nA.x) * passage.position;
    const passageY = nA.y + (nB.y - nA.y) * passage.position;

    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const wallAngle = Math.atan2(dy, dx);

    const perpX = -dy / len;
    const perpY = dx / len;

    const widthCm = passage.width * 100;
    const halfWidth = widthCm / 2;

    ctx.save();
    ctx.translate(passageX, passageY);
    ctx.rotate(wallAngle);

    // Draw passage opening
    ctx.strokeStyle = isSelected ? '#f97316' : (isPassageMode ? '#3b82f6' : '#444444');
    ctx.lineWidth = isSelected ? 3 / transform.scale : 2 / transform.scale;
    ctx.setLineDash([5 / transform.scale, 3 / transform.scale]);
    ctx.beginPath();
    ctx.moveTo(-halfWidth, 0);
    ctx.lineTo(halfWidth, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // Draw label on one consistent side
    ctx.font = '11px monospace';
    const txt = `PASSAGE ${passage.width.toFixed(3)}m`;
    const tw = ctx.measureText(txt).width;
    const rw = (tw + 8) / transform.scale;
    const rh = 18 / transform.scale;
    const placement = findLabelPlacement({
      anchorX: passageX,
      anchorY: passageY,
      perpX,
      perpY,
      preferredSide: 1,
      labelWidth: rw,
      labelHeight: rh,
      naturalOffset: wall.thickness / 2 * transform.scale + 27,
      scale: transform.scale,
      rotation: transform.rotation,
      existingBounds: labelBounds,
    });

    if (placement.draw) {
      const labelCenterX = placement.x;
      const labelCenterY = placement.y;

      ctx.save();
      ctx.translate(labelCenterX, labelCenterY);
      ctx.rotate(-transform.rotation);
      ctx.scale(1 / transform.scale, 1 / transform.scale);

      const defaultLabelBg = dc.isDark ? '#2a2a2a' : '#f5f5f5';
      const defaultLabelBorder = dc.isDark ? '#444444' : '#cccccc';
      const defaultLabelText = dc.isDark ? '#666666' : '#555555';
      ctx.fillStyle = isSelected ? '#9a3412' : (isPassageMode ? '#1e40af' : defaultLabelBg);
      ctx.strokeStyle = isSelected ? '#ea580c' : (isPassageMode ? '#3b82f6' : defaultLabelBorder);
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.font = '11px monospace';

      ctx.fillRect(-rw * transform.scale / 2, -rh * transform.scale / 2, rw * transform.scale, rh * transform.scale);
      ctx.strokeRect(-rw * transform.scale / 2, -rh * transform.scale / 2, rw * transform.scale, rh * transform.scale);
      ctx.fillStyle = isSelected ? '#e879f9' : (isPassageMode ? '#9ca3af' : defaultLabelText);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 0);
      ctx.restore();

      labelBounds.push({
        id: passage.id,
        type: 'passage',
        x: labelCenterX,
        y: labelCenterY,
        width: rw,
        height: rh,
      });
    }
  });
}