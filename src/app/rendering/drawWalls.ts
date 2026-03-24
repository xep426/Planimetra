import type { LabelBounds } from '../types';
import type { DrawContext } from './types';
import { findLabelPlacement } from './labelCollision';

// Store computed exterior perps so drawWallLabels can access them
let _lastWallExteriorPerp = new Map<string, {perpX: number, perpY: number}>();

export function drawWalls(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const { nodes, walls, windows, doors, passages, columns, transform, selectedWallId, selectedTool, closeLoopPreview } = dc;
  const newLabelBounds: LabelBounds[] = [];

  // --- Compute CW loop exterior perpendiculars for outer wall preview ---
  const wallExteriorPerp = new Map<string, {perpX: number, perpY: number}>();
  // Mitered outer wall endpoints: wall.id -> { ax, ay, bx, by }
  const wallMiteredOuter = new Map<string, {ax: number, ay: number, bx: number, by: number}>();

  if (dc.loopClosed && walls.length >= 3) {
    const orderedTraversal: Array<{wall: typeof walls[0], fromId: string, toId: string}> = [];
    const visitedWalls = new Set<string>();
    const firstWall = walls[0];
    let currentNodeId = firstWall.nodeA;

    while (visitedWalls.size < walls.length) {
      const nextWall = walls.find(w =>
        !visitedWalls.has(w.id) && (w.nodeA === currentNodeId || w.nodeB === currentNodeId)
      );
      if (!nextWall) break;
      const fromId = currentNodeId;
      const toId = nextWall.nodeA === currentNodeId ? nextWall.nodeB : nextWall.nodeA;
      orderedTraversal.push({ wall: nextWall, fromId, toId });
      visitedWalls.add(nextWall.id);
      currentNodeId = toId;
      if (currentNodeId === firstWall.nodeA) break;
    }

    let signedArea = 0;
    const ordNodes = orderedTraversal.map(t => nodes.find(n => n.id === t.fromId)!).filter(Boolean);
    for (let i = 0; i < ordNodes.length; i++) {
      const curr = ordNodes[i];
      const next = ordNodes[(i + 1) % ordNodes.length];
      signedArea += (next.x - curr.x) * (next.y + curr.y);
    }
    // In screen space (Y-down): negative signed area = visually CW
    const isCW = signedArea < 0;

    orderedTraversal.forEach(({ wall, fromId, toId }) => {
      const nFrom = nodes.find(n => n.id === fromId);
      const nTo = nodes.find(n => n.id === toId);
      if (!nFrom || !nTo) return;
      const ddx = nTo.x - nFrom.x;
      const ddy = nTo.y - nFrom.y;
      const dlen = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dlen < 0.0001) return;
      const sign = isCW ? 1 : -1;
      wallExteriorPerp.set(wall.id, {
        perpX: sign * ddy / dlen,
        perpY: sign * -ddx / dlen,
      });
    });

    // Store for use by drawWallLabels
    _lastWallExteriorPerp = wallExteriorPerp;

    // --- Compute mitered outer wall endpoints ---
    const tn = orderedTraversal.length;
    if (tn >= 3) {
      const outerLines: Array<{ax: number, ay: number, bx: number, by: number}> = [];
      orderedTraversal.forEach(({ wall, fromId, toId }) => {
        const nFrom = nodes.find(nd => nd.id === fromId)!;
        const nTo = nodes.find(nd => nd.id === toId)!;
        const ext = wallExteriorPerp.get(wall.id);
        if (!ext) {
          outerLines.push({ ax: nFrom.x, ay: nFrom.y, bx: nTo.x, by: nTo.y });
          return;
        }
        outerLines.push({
          ax: nFrom.x + ext.perpX * wall.thickness,
          ay: nFrom.y + ext.perpY * wall.thickness,
          bx: nTo.x + ext.perpX * wall.thickness,
          by: nTo.y + ext.perpY * wall.thickness,
        });
      });

      // Line-line intersection (infinite lines through p1->p2 and p3->p4)
      const intersectLines = (
        p1x: number, p1y: number, p2x: number, p2y: number,
        p3x: number, p3y: number, p4x: number, p4y: number
      ): {x: number, y: number} | null => {
        const d1x = p2x - p1x, d1y = p2y - p1y;
        const d2x = p4x - p3x, d2y = p4y - p3y;
        const cross = d1x * d2y - d1y * d2x;
        if (Math.abs(cross) < 0.0001) return null;
        const t = ((p3x - p1x) * d2y - (p3y - p1y) * d2x) / cross;
        return { x: p1x + t * d1x, y: p1y + t * d1y };
      };

      for (let i = 0; i < tn; i++) {
        const prev = (i - 1 + tn) % tn;
        const next = (i + 1) % tn;
        const cur = outerLines[i];

        const miterA = intersectLines(
          outerLines[prev].ax, outerLines[prev].ay, outerLines[prev].bx, outerLines[prev].by,
          cur.ax, cur.ay, cur.bx, cur.by
        );

        const miterB = intersectLines(
          cur.ax, cur.ay, cur.bx, cur.by,
          outerLines[next].ax, outerLines[next].ay, outerLines[next].bx, outerLines[next].by
        );

        wallMiteredOuter.set(orderedTraversal[i].wall.id, {
          ax: miterA ? miterA.x : cur.ax,
          ay: miterA ? miterA.y : cur.ay,
          bx: miterB ? miterB.x : cur.bx,
          by: miterB ? miterB.y : cur.by,
        });
      }
    }
  }

  walls.forEach(wall => {
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;
    const sel = wall.id === selectedWallId;

    // Orange in wall mode (editing wall itself), green in other modes (target for adding objects)
    const selColor = selectedTool === 'wall' ? '#f97316' : '#22c55e';
    const baseColor = closeLoopPreview ? '#22c55e' : '#ffffff';

    // Draw wall as a simple line (inner face)
    ctx.strokeStyle = closeLoopPreview ? baseColor : (sel ? selColor : baseColor);
    ctx.lineWidth = sel ? 3 / transform.scale : (wall.type === 'external' ? 3.5 / transform.scale : 1.2 / transform.scale);
    ctx.beginPath();
    ctx.moveTo(nA.x, nA.y);
    ctx.lineTo(nB.x, nB.y);
    ctx.stroke();

    // Draw outer wall preview line (gray, thin) with mitered corners
    const mitered = wallMiteredOuter.get(wall.id);
    if (mitered) {
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 0.8 / transform.scale;
      ctx.beginPath();
      ctx.moveTo(mitered.ax, mitered.ay);
      ctx.lineTo(mitered.bx, mitered.by);
      ctx.stroke();
    }
  });
}

export function drawWallLabels(ctx: CanvasRenderingContext2D, dc: DrawContext) {
  const { nodes, walls, windows, doors, passages, columns, transform, selectedWallId, selectedTool } = dc;
  const newLabelBounds: LabelBounds[] = [];
  const wallExteriorPerp = _lastWallExteriorPerp;

  walls.forEach(wall => {
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;
    const sel = wall.id === selectedWallId;

    // Calculate wall direction for label positioning
    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len;
    const perpY = dx / len;

    const wallLengthM = len / 100;
    const dirX = dx / len;
    const dirY = dy / len;

    // --- Determine wall segments split by flush (inset=0) columns ---
    const flushCols = columns
      .filter(c => c.wallId === wall.id && (c.inset ?? 0) === 0)
      .sort((a, b) => a.position - b.position);

    interface WallSegment { startM: number; endM: number; }
    const segments: WallSegment[] = [];

    if (flushCols.length === 0) {
      segments.push({ startM: 0, endM: wallLengthM });
    } else {
      let cursor = 0;
      for (const col of flushCols) {
        const centerM = col.position * wallLengthM;
        const halfWidth = col.width / 2;
        const colStart = Math.max(0, centerM - halfWidth);
        const colEnd = Math.min(wallLengthM, centerM + halfWidth);
        if (colStart > cursor + 0.001) {
          segments.push({ startM: cursor, endM: colStart });
        }
        cursor = colEnd;
      }
      if (cursor < wallLengthM - 0.001) {
        segments.push({ startM: cursor, endM: wallLengthM });
      }
    }

    // --- Draw a label for each segment ---
    for (const seg of segments) {
      const segLenM = seg.endM - seg.startM;
      if (segLenM < 0.001) continue;

      const segMidM = (seg.startM + seg.endM) / 2;
      const baseMidX = nA.x + dirX * segMidM * 100;
      const baseMidY = nA.y + dirY * segMidM * 100;

      const ext = wallExteriorPerp.get(wall.id);
      const offsetX = ext ? ext.perpX * wall.thickness / 2 : perpX * wall.thickness / 2;
      const offsetY = ext ? ext.perpY * wall.thickness / 2 : perpY * wall.thickness / 2;
      const midX = baseMidX + offsetX;
      const midY = baseMidY + offsetY;

      ctx.font = '11px monospace';
      const txt = segLenM.toFixed(3) + '\u2009m';
      const tw = ctx.measureText(txt).width;
      const rw = tw + 12;
      const rh = 18;
      const labelWidth = rw / transform.scale;
      const labelHeight = rh / transform.scale;

      const labelCenterX = midX;
      const labelCenterY = midY;

      newLabelBounds.push({
        id: wall.id,
        type: 'wall',
        x: labelCenterX,
        y: labelCenterY,
        width: labelWidth,
        height: labelHeight,
      });

      ctx.save();
      ctx.translate(labelCenterX, labelCenterY);
      ctx.rotate(-transform.rotation);
      ctx.scale(1 / transform.scale, 1 / transform.scale);
      ctx.fillStyle = 'rgba(26, 26, 26, 0.85)';
      const labelSelColor = selectedTool === 'wall' ? '#f97316' : '#22c55e';
      ctx.strokeStyle = sel ? labelSelColor : '#666666';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
      ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
      ctx.fillStyle = '#cccccc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
  });

  dc.labelBounds.push(...newLabelBounds);
}
