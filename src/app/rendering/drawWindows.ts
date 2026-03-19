import type { DrawContext } from './types';
import { findLabelPlacement } from './labelCollision';

export function drawWindows(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const { nodes, walls, windows, transform, selectedTool, selectedWindowId, wallInteriorSign, labelBounds } = dc;
  const isWindowMode = selectedTool === 'window';

  windows.forEach(win => {
    const wall = walls.find(w => w.id === win.wallId);
    if (!wall) return;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;

    const isSelected = win.id === selectedWindowId && isWindowMode;

    // Calculate window position along the wall
    const winX = nA.x + (nB.x - nA.x) * win.position;
    const winY = nA.y + (nB.y - nA.y) * win.position;

    // Wall direction
    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const wallAngle = Math.atan2(dy, dx);

    const perpX = -dy / len;
    const perpY = dx / len;

    const widthCm = win.width * 100;
    const halfWidth = widthCm / 2;

    ctx.save();
    ctx.translate(winX, winY);
    ctx.rotate(wallAngle);

    // Draw window frame
    ctx.strokeStyle = isSelected ? '#f97316' : (isWindowMode ? '#3b82f6' : '#444444');
    ctx.lineWidth = isSelected ? 3 / transform.scale : 2 / transform.scale;
    ctx.fillStyle = isSelected ? 'rgba(249, 115, 22, 0.25)' : (isWindowMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(68, 68, 68, 0.1)');
    ctx.fillRect(-halfWidth, -3 / transform.scale, widthCm, 6 / transform.scale);
    ctx.strokeRect(-halfWidth, -3 / transform.scale, widthCm, 6 / transform.scale);

    // Draw panel divider for double windows
    if (win.panelCount === 'double') {
      ctx.beginPath();
      ctx.moveTo(0, -3 / transform.scale);
      ctx.lineTo(0, 3 / transform.scale);
      ctx.stroke();
    }

    // Draw swing arc for openable windows based on hinge position
    if (win.opening !== 'fixed') {
      const intSign = wallInteriorSign.get(wall.id) ?? 1;
      const openDir = (win.opening === 'inward' ? 1 : -1) * intSign;
      const rawHinge = win.hinge ?? 'left';
      const hinge: 'left' | 'right' | 'center' = intSign > 0
        ? rawHinge
        : rawHinge === 'left' ? 'right' : rawHinge === 'right' ? 'left' : 'center';
      ctx.strokeStyle = isSelected ? '#f97316' : (isWindowMode ? '#3b82f6' : '#444444');
      ctx.lineWidth = 1 / transform.scale;

      if (win.panelCount === 'single') {
        const hingeX = hinge === 'left' ? -halfWidth : halfWidth;

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

        ctx.beginPath();
        ctx.moveTo(hingeX, 0);
        ctx.lineTo(hingeX, openDir * widthCm);
        ctx.stroke();
      } else {
        // Double pane
        ctx.beginPath();
        ctx.arc(-halfWidth, 0, halfWidth, 0, openDir * Math.PI / 2, openDir < 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-halfWidth, 0);
        ctx.lineTo(-halfWidth, openDir * halfWidth);
        ctx.stroke();

        ctx.beginPath();
        if (openDir > 0) {
          ctx.arc(halfWidth, 0, halfWidth, Math.PI, Math.PI / 2, true);
        } else {
          ctx.arc(halfWidth, 0, halfWidth, -Math.PI, -Math.PI / 2, false);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(halfWidth, 0);
        ctx.lineTo(halfWidth, openDir * halfWidth);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Draw label on the SAME side as the swing arc
    ctx.font = '9px monospace';
    const txt = `Window ${win.width.toFixed(2)}×${win.height.toFixed(2)} m`;
    const tw = ctx.measureText(txt).width;
    const rw = (tw + 8) / transform.scale;
    const rh = 14 / transform.scale;

    const labelIntSign = wallInteriorSign.get(wall.id) ?? 1;
    const labelOpenDir = win.opening === 'fixed' ? labelIntSign : (win.opening === 'inward' ? 1 : -1) * labelIntSign;

    const placement = findLabelPlacement({
      anchorX: winX,
      anchorY: winY,
      perpX,
      perpY,
      preferredSide: labelOpenDir,
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

      ctx.fillStyle = isSelected ? '#9a3412' : (isWindowMode ? '#1e40af' : '#2a2a2a');
      ctx.strokeStyle = isSelected ? '#ea580c' : (isWindowMode ? '#3b82f6' : '#444444');
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.font = '9px monospace';

      ctx.fillRect(-rw * transform.scale / 2, -rh * transform.scale / 2, rw * transform.scale, rh * transform.scale);
      ctx.strokeRect(-rw * transform.scale / 2, -rh * transform.scale / 2, rw * transform.scale, rh * transform.scale);
      ctx.fillStyle = isSelected ? '#fbbf24' : (isWindowMode ? '#9ca3af' : '#666666');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 0);
      ctx.restore();

      labelBounds.push({
        id: win.id,
        type: 'window',
        x: labelCenterX,
        y: labelCenterY,
        width: rw,
        height: rh,
      });
    }
  });
}