import type { DrawContext } from './types';
import { findLabelPlacement } from './labelCollision';

export function drawDoors(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const { nodes, walls, doors, transform, selectedTool, selectedDoorId, wallInteriorSign, labelBounds } = dc;
  const isDoorMode = selectedTool === 'door';

  doors.forEach(door => {
    const wall = walls.find(w => w.id === door.wallId);
    if (!wall) return;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;

    const isSelected = door.id === selectedDoorId && isDoorMode;

    const doorX = nA.x + (nB.x - nA.x) * door.position;
    const doorY = nA.y + (nB.y - nA.y) * door.position;

    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const wallAngle = Math.atan2(dy, dx);

    const perpX = -dy / len;
    const perpY = dx / len;

    const widthCm = door.width * 100;
    const halfWidth = widthCm / 2;

    const intSign = wallInteriorSign.get(wall.id) ?? 1;
    const effectiveOpenDir = (door.opening === 'inward' ? 1 : -1) * intSign;
    const effectiveHinge: 'left' | 'right' = intSign > 0
      ? (door.hinge ?? 'left')
      : (door.hinge ?? 'left') === 'left' ? 'right' : 'left';

    ctx.save();
    ctx.translate(doorX, doorY);
    ctx.rotate(wallAngle);

    // Draw door frame
    ctx.strokeStyle = isSelected ? '#f97316' : (isDoorMode ? '#3b82f6' : '#444444');
    ctx.lineWidth = isSelected ? 3 / transform.scale : 2 / transform.scale;
    ctx.fillStyle = isSelected ? 'rgba(249, 115, 22, 0.25)' : (isDoorMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(68, 68, 68, 0.1)');
    ctx.fillRect(-halfWidth, -3 / transform.scale, widthCm, 6 / transform.scale);
    ctx.strokeRect(-halfWidth, -3 / transform.scale, widthCm, 6 / transform.scale);

    // Draw swing arc based on hinge position
    const openDir = effectiveOpenDir;
    const hinge = effectiveHinge;
    const hingeX = hinge === 'left' ? -halfWidth : halfWidth;

    ctx.strokeStyle = isSelected ? '#f97316' : (isDoorMode ? '#3b82f6' : '#444444');
    ctx.lineWidth = 1 / transform.scale;
    ctx.beginPath();

    if (hinge === 'left') {
      ctx.arc(hingeX, 0, widthCm, 0, openDir * Math.PI / 2, openDir < 0);
    } else {
      if (openDir > 0) {
        ctx.arc(hingeX, 0, widthCm, Math.PI, Math.PI / 2, true);
      } else {
        ctx.arc(hingeX, 0, widthCm, -Math.PI, -Math.PI / 2, false);
      }
    }
    ctx.stroke();

    // Draw door leaf line
    ctx.beginPath();
    ctx.moveTo(hingeX, 0);
    ctx.lineTo(hingeX, openDir * widthCm);
    ctx.stroke();

    ctx.restore();

    // Draw label on the SAME side as the swing arc
    ctx.font = '9px monospace';
    const txt = `Door ${door.width.toFixed(2)}\u00D7${door.height.toFixed(2)} m`;
    const tw = ctx.measureText(txt).width;
    const rw = (tw + 8) / transform.scale;
    const rh = 14 / transform.scale;

    const placement = findLabelPlacement({
      anchorX: doorX,
      anchorY: doorY,
      perpX,
      perpY,
      preferredSide: openDir,
      labelWidth: rw,
      labelHeight: rh,
      naturalOffset: 40,
      scale: transform.scale,
      existingBounds: labelBounds,
    });

    if (placement.draw) {
      const labelCenterX = placement.x;
      const labelCenterY = placement.y;

      ctx.save();
      ctx.translate(labelCenterX, labelCenterY);
      ctx.rotate(-transform.rotation);
      ctx.scale(1 / transform.scale, 1 / transform.scale);

      ctx.fillStyle = isSelected ? '#9a3412' : (isDoorMode ? '#1e40af' : '#2a2a2a');
      ctx.strokeStyle = isSelected ? '#ea580c' : (isDoorMode ? '#3b82f6' : '#444444');
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.font = '9px monospace';

      ctx.fillRect(-rw * transform.scale / 2, -rh * transform.scale / 2, rw * transform.scale, rh * transform.scale);
      ctx.strokeRect(-rw * transform.scale / 2, -rh * transform.scale / 2, rw * transform.scale, rh * transform.scale);
      ctx.fillStyle = isSelected ? '#fbbf24' : (isDoorMode ? '#9ca3af' : '#666666');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 0);
      ctx.restore();

      labelBounds.push({
        id: door.id,
        type: 'door',
        x: labelCenterX,
        y: labelCenterY,
        width: rw,
        height: rh,
      });
    }
  });
}
