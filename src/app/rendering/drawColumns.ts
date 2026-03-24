import type { DrawContext } from './types';
import { findLabelPlacement } from './labelCollision';

export function drawColumns(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const { nodes, walls, columns, transform, selectedTool, selectedColumnId, columnsToJoin, columnJoinMode, wallInteriorSign, labelBounds } = dc;
  const isColumnMode = selectedTool === 'column';

  columns.forEach(column => {
    const wall = walls.find(w => w.id === column.wallId);
    if (!wall) return;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;

    const isSelected = column.id === selectedColumnId && isColumnMode;
    const isMarkedForJoin = columnsToJoin.includes(column.id) && columnJoinMode;

    const columnX = nA.x + (nB.x - nA.x) * column.position;
    const columnY = nA.y + (nB.y - nA.y) * column.position;

    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const wallAngle = Math.atan2(dy, dx);

    const widthCm = column.width * 100;
    const depthCm = column.depth * 100;
    const insetCm = (column.inset ?? 0) * 100;

    ctx.save();
    ctx.translate(columnX, columnY);
    ctx.rotate(wallAngle);

    // Flip local Y axis when wallInteriorSign is -1 so columns always extend toward interior
    const intSign = wallInteriorSign.get(wall.id) ?? 1;
    ctx.scale(1, intSign);

    // Draw gray dotted inset indicator line (from wall edge to column)
    if (insetCm > 0) {
      ctx.save();
      ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 1.5 / transform.scale;
      ctx.beginPath();
      // Line from wall surface (y=0) center of column to inset start
      ctx.moveTo(0, 0);
      ctx.lineTo(0, insetCm);
      ctx.stroke();

      // Small perpendicular tick marks at both ends for clarity
      const tickHalf = Math.min(widthCm * 0.3, 6 / transform.scale);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(-tickHalf, 0);
      ctx.lineTo(tickHalf, 0);
      ctx.moveTo(-tickHalf, insetCm);
      ctx.lineTo(tickHalf, insetCm);
      ctx.stroke();
      ctx.restore();
    }

    // Set colors and line width
    ctx.fillStyle = isMarkedForJoin ? 'rgba(34, 197, 94, 0.5)' : (isSelected ? 'rgba(249, 115, 22, 0.25)' : (isColumnMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(68, 68, 68, 0.1)'));
    ctx.strokeStyle = isMarkedForJoin ? '#22c55e' : (isSelected ? '#f97316' : (isColumnMode ? '#3b82f6' : '#444444'));
    ctx.lineWidth = isMarkedForJoin ? 4 / transform.scale : (isSelected ? 3 / transform.scale : 2 / transform.scale);

    // Check if this is a merged column with individual shapes
    if (column.mergedShapes && column.mergedShapes.length > 0) {
      // Draw fills for each individual shape (no stroke to avoid internal lines)
      column.mergedShapes.forEach(shape => {
        const shapeWidthCm = shape.width * 100;
        const shapeDepthCm = shape.depth * 100;
        const shapeRelativeX = shape.relativePosition;

        ctx.fillRect(shapeRelativeX - shapeWidthCm / 2, insetCm, shapeWidthCm, shapeDepthCm);
      });

      // Draw the actual outline following each individual column's shape
      ctx.beginPath();

      const firstShape = column.mergedShapes[0];
      const firstWidthCm = firstShape.width * 100;
      const firstX = firstShape.relativePosition;
      ctx.moveTo(firstX - firstWidthCm / 2, insetCm);

      // Draw along the bottom (y=insetCm, along the wall)
      column.mergedShapes.forEach(shape => {
        const shapeWidthCm = shape.width * 100;
        const shapeX = shape.relativePosition;
        ctx.lineTo(shapeX + shapeWidthCm / 2, insetCm);
      });

      // Draw up the right side of the last shape
      const lastShape = column.mergedShapes[column.mergedShapes.length - 1];
      const lastWidthCm = lastShape.width * 100;
      const lastDepthCm = lastShape.depth * 100;
      const lastX = lastShape.relativePosition;
      ctx.lineTo(lastX + lastWidthCm / 2, insetCm + lastDepthCm);

      // Draw along the top (perpendicular edge) from right to left
      for (let i = column.mergedShapes.length - 1; i >= 0; i--) {
        const shape = column.mergedShapes[i];
        const shapeWidthCm = shape.width * 100;
        const shapeDepthCm = shape.depth * 100;
        const shapeX = shape.relativePosition;

        ctx.lineTo(shapeX + shapeWidthCm / 2, insetCm + shapeDepthCm);
        ctx.lineTo(shapeX - shapeWidthCm / 2, insetCm + shapeDepthCm);
      }

      // Draw down the left side of the first shape back to start
      const firstDepthCm = firstShape.depth * 100;
      ctx.lineTo(firstX - firstWidthCm / 2, insetCm + firstDepthCm);
      ctx.lineTo(firstX - firstWidthCm / 2, insetCm);

      ctx.closePath();
      ctx.stroke();
    } else {
      // Draw single column rectangle
      ctx.fillRect(-widthCm / 2, insetCm, widthCm, depthCm);
      ctx.strokeRect(-widthCm / 2, insetCm, widthCm, depthCm);
    }

    ctx.restore();

    // Draw label
    ctx.font = '9px monospace';
    const txt = `COL ${column.width.toFixed(3)}\u00D7${column.depth.toFixed(3)}m`;
    const tw = ctx.measureText(txt).width;
    const rw = (tw + 8) / transform.scale;
    const rh = 14 / transform.scale;

    const perpX = (-dy / len) * intSign;
    const perpY = (dx / len) * intSign;
    const columnCenterOffset = (insetCm + depthCm / 2);

    const placement = findLabelPlacement({
      anchorX: columnX + perpX * columnCenterOffset,
      anchorY: columnY + perpY * columnCenterOffset,
      perpX,
      perpY,
      preferredSide: 1,
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

      ctx.fillStyle = isMarkedForJoin ? '#166534' : (isSelected ? '#9a3412' : (isColumnMode ? '#1e40af' : '#2a2a2a'));
      ctx.strokeStyle = isMarkedForJoin ? '#22c55e' : (isSelected ? '#ea580c' : (isColumnMode ? '#3b82f6' : '#444444'));
      ctx.lineWidth = isMarkedForJoin ? 1.5 : (isSelected ? 1.5 : 1);
      ctx.font = '9px monospace';

      ctx.fillRect(-rw * transform.scale / 2, -rh * transform.scale / 2, rw * transform.scale, rh * transform.scale);
      ctx.strokeRect(-rw * transform.scale / 2, -rh * transform.scale / 2, rw * transform.scale, rh * transform.scale);
      ctx.fillStyle = isMarkedForJoin ? '#86efac' : (isSelected ? '#5eead4' : (isColumnMode ? '#9ca3af' : '#666666'));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 0);
      ctx.restore();

      labelBounds.push({
        id: column.id,
        type: 'column',
        x: labelCenterX,
        y: labelCenterY,
        width: rw,
        height: rh,
      });
    }
  });
}
