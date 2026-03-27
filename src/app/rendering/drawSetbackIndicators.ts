import type { DrawContext } from './types';

/**
 * Draws setback reference lines for all selected objects.
 * Called LAST in the render pipeline so indicators always appear on top.
 */
export function drawSetbackIndicators(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const {
    nodes, walls, windows, doors, passages, columns,
    transform, selectedTool, selectedWindowId, selectedDoorId, selectedPassageId, selectedColumnId,
    wallInteriorSign,
  } = dc;

  // Helper: draw the shared setback pattern (dashed line + reference dot)
  const drawSetbackLine = (
    nAx: number, nAy: number, wallAngle: number, len: number,
    posAlongWall: number, halfWidth: number, fromNodeA: boolean,
  ) => {
    const edgeNearA = posAlongWall - halfWidth;
    const edgeNearB = posAlongWall + halfWidth;

    ctx.save();
    ctx.translate(nAx, nAy);
    ctx.rotate(wallAngle);

    ctx.setLineDash([6 / transform.scale, 4 / transform.scale]);
    ctx.lineWidth = 2.5 / transform.scale;
    ctx.strokeStyle = '#f97316';
    ctx.beginPath();
    if (fromNodeA) {
      ctx.moveTo(edgeNearA, 0);
      ctx.lineTo(0, 0);
    } else {
      ctx.moveTo(edgeNearB, 0);
      ctx.lineTo(len, 0);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const refX = fromNodeA ? 0 : len;
    ctx.beginPath();
    ctx.arc(refX, 0, 5 / transform.scale, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / transform.scale;
    ctx.stroke();

    ctx.restore();
  };

  // Window setback
  if (selectedTool === 'window' && selectedWindowId) {
    const win = windows.find(w => w.id === selectedWindowId);
    if (win) {
      const wall = walls.find(w => w.id === win.wallId);
      const nA = wall && nodes.find(n => n.id === wall.nodeA);
      const nB = wall && nodes.find(n => n.id === wall.nodeB);
      if (wall && nA && nB) {
        const dx = nB.x - nA.x, dy = nB.y - nA.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const wallAngle = Math.atan2(dy, dx);
        const halfWidth = (win.width * 100) / 2;
        drawSetbackLine(nA.x, nA.y, wallAngle, len, win.position * len, halfWidth, win.fromNodeA);
      }
    }
  }

  // Door setback
  if (selectedTool === 'door' && selectedDoorId) {
    const door = doors.find(d => d.id === selectedDoorId);
    if (door) {
      const wall = walls.find(w => w.id === door.wallId);
      const nA = wall && nodes.find(n => n.id === wall.nodeA);
      const nB = wall && nodes.find(n => n.id === wall.nodeB);
      if (wall && nA && nB) {
        const dx = nB.x - nA.x, dy = nB.y - nA.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const wallAngle = Math.atan2(dy, dx);
        const halfWidth = (door.width * 100) / 2;
        drawSetbackLine(nA.x, nA.y, wallAngle, len, door.position * len, halfWidth, door.fromNodeA);
      }
    }
  }

  // Passage setback
  if (selectedTool === 'passage' && selectedPassageId) {
    const passage = passages.find(p => p.id === selectedPassageId);
    if (passage) {
      const wall = walls.find(w => w.id === passage.wallId);
      const nA = wall && nodes.find(n => n.id === wall.nodeA);
      const nB = wall && nodes.find(n => n.id === wall.nodeB);
      if (wall && nA && nB) {
        const dx = nB.x - nA.x, dy = nB.y - nA.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const wallAngle = Math.atan2(dy, dx);
        const halfWidth = (passage.width * 100) / 2;
        drawSetbackLine(nA.x, nA.y, wallAngle, len, passage.position * len, halfWidth, passage.fromNodeA);
      }
    }
  }

  // Column setback
  if (selectedTool === 'column' && selectedColumnId) {
    const column = columns.find(c => c.id === selectedColumnId);
    if (column) {
      const wall = walls.find(w => w.id === column.wallId);
      const nA = wall && nodes.find(n => n.id === wall.nodeA);
      const nB = wall && nodes.find(n => n.id === wall.nodeB);
      if (wall && nA && nB) {
        const dx = nB.x - nA.x, dy = nB.y - nA.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const wallAngle = Math.atan2(dy, dx);
        const colHalfW = (column.width * 100) / 2;
        const refIsNodeA = column.distanceToCW <= column.distanceToCCW;
        drawSetbackLine(nA.x, nA.y, wallAngle, len, column.position * len, colHalfW, refIsNodeA);
      }
    }
  }
}
