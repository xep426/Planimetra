// DXF export utility for architectural floor plans
// Generates AC1015 (AutoCAD 2000) compliant DXF with full handle tracking,
// subclass markers, and proper table definitions for maximum compatibility
// with AutoCAD, Blender (ezdxf), LibreCAD, FreeCAD, BricsCAD, etc.

import type { Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj } from '../types';

// DXF uses slightly different shapes of some types (subset of fields),
// so we define local aliases for the function signature
type DxfWindow = Pick<WindowObj, 'id' | 'wallId' | 'position' | 'width' | 'height' | 'hinge' | 'opening' | 'panelCount'>;
type DxfDoor = Pick<DoorObj, 'id' | 'wallId' | 'position' | 'width' | 'height' | 'opening' | 'hinge'>;
type DxfPassage = Pick<PassageObj, 'id' | 'wallId' | 'position' | 'width' | 'offset' | 'fromNodeA'>;
type DxfColumn = Pick<ColumnObj, 'id' | 'wallId' | 'position' | 'width' | 'depth' | 'inset' | 'mergedShapes'>;

// ---------------------------------------------------------------------------
// Handle allocator -- every DXF object (table, table entry, block, entity)
// needs a unique hex handle (group code 5).
// ---------------------------------------------------------------------------
class HandleAllocator {
  private next = 1;
  /** Return the next unique hex handle string */
  h(): string {
    return (this.next++).toString(16).toUpperCase();
  }
  /** Return the current high-water mark (for $HANDSEED) */
  seed(): string {
    return (this.next + 1).toString(16).toUpperCase();
  }
}

export function exportToDXF(
  nodes: Node[],
  walls: Wall[],
  windows: DxfWindow[],
  doors: DxfDoor[],
  passages: DxfPassage[],
  columns: DxfColumn[]
): void {
  const H = new HandleAllocator();

  // --- Unit conversion helpers ---
  const cmToMm = (cm: number) => cm * 10;
  const mToMm = (m: number) => m * 1000;

  // =========================================================================
  // Pre-allocate handles for infrastructure objects so we can cross-reference
  // =========================================================================
  const hBlockRecordTable = H.h();   // BLOCK_RECORD table
  const hModelSpaceBR     = H.h();   // *Model_Space block record
  const hPaperSpaceBR     = H.h();   // *Paper_Space block record
  const hLtypeTable       = H.h();   // LTYPE table
  const hLtByBlock        = H.h();   // ByBlock linetype
  const hLtByLayer        = H.h();   // ByLayer linetype
  const hLtContinuous     = H.h();   // CONTINUOUS linetype
  const hLayerTable       = H.h();   // LAYER table
  const hLayer0           = H.h();   // layer "0"
  const hLayerWalls       = H.h();   // WALLS
  const hLayerWindows     = H.h();   // WINDOWS
  const hLayerDoors       = H.h();   // DOORS
  const hLayerColumns     = H.h();   // COLUMNS
  const hStyleTable       = H.h();   // STYLE table
  const hStyleStandard    = H.h();   // Standard text style
  const hVportTable       = H.h();   // VPORT table
  const hVportActive      = H.h();   // *Active viewport
  const hAppIdTable       = H.h();   // APPID table
  const hAppIdAcad        = H.h();   // ACAD app id
  const hDimStyleTable    = H.h();   // DIMSTYLE table
  const hViewTable        = H.h();   // VIEW table
  const hUcsTable         = H.h();   // UCS table
  // Block definition handles
  const hModelBlock       = H.h();   // BLOCK entity for *Model_Space
  const hModelEndBlk      = H.h();   // ENDBLK for *Model_Space
  const hPaperBlock       = H.h();   // BLOCK entity for *Paper_Space
  const hPaperEndBlk      = H.h();   // ENDBLK for *Paper_Space

  // Owner for all entities in model space = *Model_Space block record handle
  const modelOwner = hModelSpaceBR;

  // =========================================================================
  // HEADER section
  // =========================================================================
  let dxf = '';
  dxf += '0\nSECTION\n2\nHEADER\n';
  dxf += '9\n$ACADVER\n1\nAC1015\n';
  dxf += '9\n$INSUNITS\n70\n4\n';
  dxf += '9\n$INSUNITSDEFSOURCE\n70\n4\n';
  dxf += '9\n$INSUNITSDEFTARGET\n70\n4\n';
  dxf += '9\n$MEASUREMENT\n70\n1\n';
  dxf += '9\n$LUNITS\n70\n2\n';
  dxf += '9\n$LUPREC\n70\n6\n';
  // $HANDSEED -- placeholder, we patch it at the very end
  const HANDSEED_MARKER = '%%HANDSEED%%';
  dxf += `9\n$HANDSEED\n5\n${HANDSEED_MARKER}\n`;
  dxf += '0\nENDSEC\n';

  // =========================================================================
  // TABLES section
  // =========================================================================
  dxf += '0\nSECTION\n2\nTABLES\n';

  // --- VPORT table ---
  dxf += '0\nTABLE\n2\nVPORT\n';
  dxf += `5\n${hVportTable}\n330\n0\n100\nAcDbSymbolTable\n70\n1\n`;
  dxf += '0\nVPORT\n';
  dxf += `5\n${hVportActive}\n330\n${hVportTable}\n`;
  dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbViewportTableRecord\n';
  dxf += '2\n*Active\n70\n0\n';
  dxf += '10\n0.0\n20\n0.0\n';     // lower-left corner
  dxf += '11\n1.0\n21\n1.0\n';     // upper-right corner
  dxf += '12\n0.0\n22\n0.0\n';     // view center
  dxf += '40\n1000.0\n';           // view height
  dxf += '41\n2.0\n';              // aspect ratio
  dxf += '0\nENDTAB\n';

  // --- LTYPE table ---
  dxf += '0\nTABLE\n2\nLTYPE\n';
  dxf += `5\n${hLtypeTable}\n330\n0\n100\nAcDbSymbolTable\n70\n3\n`;

  // ByBlock
  dxf += '0\nLTYPE\n';
  dxf += `5\n${hLtByBlock}\n330\n${hLtypeTable}\n`;
  dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbLinetypeTableRecord\n';
  dxf += '2\nByBlock\n70\n0\n3\n\n72\n65\n73\n0\n40\n0.0\n';

  // ByLayer
  dxf += '0\nLTYPE\n';
  dxf += `5\n${hLtByLayer}\n330\n${hLtypeTable}\n`;
  dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbLinetypeTableRecord\n';
  dxf += '2\nByLayer\n70\n0\n3\n\n72\n65\n73\n0\n40\n0.0\n';

  // CONTINUOUS
  dxf += '0\nLTYPE\n';
  dxf += `5\n${hLtContinuous}\n330\n${hLtypeTable}\n`;
  dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbLinetypeTableRecord\n';
  dxf += '2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';

  dxf += '0\nENDTAB\n';

  // --- LAYER table ---
  const layerDefs: Array<{
    handle: string; name: string; color: number; lineweight: number;
  }> = [
    { handle: hLayer0,       name: '0',       color: 7,  lineweight: -3 }, // default
    { handle: hLayerWalls,   name: 'WALLS',   color: 7,  lineweight: 50 }, // 0.50mm
    { handle: hLayerWindows, name: 'WINDOWS', color: 5,  lineweight: 25 }, // 0.25mm  blue
    { handle: hLayerDoors,   name: 'DOORS',   color: 3,  lineweight: 25 }, // 0.25mm  green
    { handle: hLayerColumns, name: 'COLUMNS', color: 8,  lineweight: 35 }, // 0.35mm  gray
  ];

  dxf += '0\nTABLE\n2\nLAYER\n';
  dxf += `5\n${hLayerTable}\n330\n0\n100\nAcDbSymbolTable\n70\n${layerDefs.length}\n`;

  layerDefs.forEach(l => {
    dxf += '0\nLAYER\n';
    dxf += `5\n${l.handle}\n330\n${hLayerTable}\n`;
    dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n';
    dxf += `2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`;
    dxf += `370\n${l.lineweight}\n390\n0\n`;
  });

  dxf += '0\nENDTAB\n';

  // --- STYLE table ---
  dxf += '0\nTABLE\n2\nSTYLE\n';
  dxf += `5\n${hStyleTable}\n330\n0\n100\nAcDbSymbolTable\n70\n1\n`;
  dxf += '0\nSTYLE\n';
  dxf += `5\n${hStyleStandard}\n330\n${hStyleTable}\n`;
  dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbTextStyleTableRecord\n';
  dxf += '2\nStandard\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n2.5\n3\ntxt\n4\n\n';
  dxf += '0\nENDTAB\n';

  // --- VIEW table (empty) ---
  dxf += '0\nTABLE\n2\nVIEW\n';
  dxf += `5\n${hViewTable}\n330\n0\n100\nAcDbSymbolTable\n70\n0\n`;
  dxf += '0\nENDTAB\n';

  // --- UCS table (empty) ---
  dxf += '0\nTABLE\n2\nUCS\n';
  dxf += `5\n${hUcsTable}\n330\n0\n100\nAcDbSymbolTable\n70\n0\n`;
  dxf += '0\nENDTAB\n';

  // --- APPID table ---
  dxf += '0\nTABLE\n2\nAPPID\n';
  dxf += `5\n${hAppIdTable}\n330\n0\n100\nAcDbSymbolTable\n70\n1\n`;
  dxf += '0\nAPPID\n';
  dxf += `5\n${hAppIdAcad}\n330\n${hAppIdTable}\n`;
  dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbRegAppTableRecord\n';
  dxf += '2\nACAD\n70\n0\n';
  dxf += '0\nENDTAB\n';

  // --- DIMSTYLE table (empty) ---
  dxf += '0\nTABLE\n2\nDIMSTYLE\n';
  dxf += `5\n${hDimStyleTable}\n330\n0\n100\nAcDbSymbolTable\n70\n0\n100\nAcDbDimStyleTable\n`;
  dxf += '0\nENDTAB\n';

  // --- BLOCK_RECORD table ---
  dxf += '0\nTABLE\n2\nBLOCK_RECORD\n';
  dxf += `5\n${hBlockRecordTable}\n330\n0\n100\nAcDbSymbolTable\n70\n2\n`;

  dxf += '0\nBLOCK_RECORD\n';
  dxf += `5\n${hModelSpaceBR}\n330\n${hBlockRecordTable}\n`;
  dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbBlockTableRecord\n';
  dxf += '2\n*Model_Space\n';

  dxf += '0\nBLOCK_RECORD\n';
  dxf += `5\n${hPaperSpaceBR}\n330\n${hBlockRecordTable}\n`;
  dxf += '100\nAcDbSymbolTableRecord\n100\nAcDbBlockTableRecord\n';
  dxf += '2\n*Paper_Space\n';

  dxf += '0\nENDTAB\n';
  dxf += '0\nENDSEC\n';

  // =========================================================================
  // BLOCKS section -- *Model_Space and *Paper_Space (required, even if empty)
  // =========================================================================
  dxf += '0\nSECTION\n2\nBLOCKS\n';

  // *Model_Space
  dxf += '0\nBLOCK\n';
  dxf += `5\n${hModelBlock}\n330\n${hModelSpaceBR}\n`;
  dxf += '100\nAcDbEntity\n8\n0\n100\nAcDbBlockBegin\n';
  dxf += '2\n*Model_Space\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*Model_Space\n1\n\n';
  dxf += '0\nENDBLK\n';
  dxf += `5\n${hModelEndBlk}\n330\n${hModelSpaceBR}\n`;
  dxf += '100\nAcDbEntity\n8\n0\n100\nAcDbBlockEnd\n';

  // *Paper_Space
  dxf += '0\nBLOCK\n';
  dxf += `5\n${hPaperBlock}\n330\n${hPaperSpaceBR}\n`;
  dxf += '100\nAcDbEntity\n8\n0\n100\nAcDbBlockBegin\n';
  dxf += '2\n*Paper_Space\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*Paper_Space\n1\n\n';
  dxf += '0\nENDBLK\n';
  dxf += `5\n${hPaperEndBlk}\n330\n${hPaperSpaceBR}\n`;
  dxf += '100\nAcDbEntity\n8\n0\n100\nAcDbBlockEnd\n';

  dxf += '0\nENDSEC\n';

  // =========================================================================
  // ENTITIES section
  // =========================================================================
  dxf += '0\nSECTION\n2\nENTITIES\n';

  // --- Entity writer helpers (with proper handles + subclass markers) ---

  // Shared angle helper: CCW sweep from s to e in degrees
  const ccwSweep = (s: number, e: number) => ((e - s) % 360 + 360) % 360;

  const writeLine = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    layer: string = 'WALLS'
  ) => {
    dxf += '0\nLINE\n';
    dxf += `5\n${H.h()}\n330\n${modelOwner}\n`;
    dxf += `100\nAcDbEntity\n8\n${layer}\n`;
    dxf += '100\nAcDbLine\n';
    dxf += `10\n${p1.x.toFixed(6)}\n20\n${p1.y.toFixed(6)}\n30\n0.0\n`;
    dxf += `11\n${p2.x.toFixed(6)}\n21\n${p2.y.toFixed(6)}\n31\n0.0\n`;
  };

  const writePolyline = (
    vertices: Array<{ x: number; y: number }>,
    layer: string,
    closed: boolean = true
  ) => {
    dxf += '0\nLWPOLYLINE\n';
    dxf += `5\n${H.h()}\n330\n${modelOwner}\n`;
    dxf += `100\nAcDbEntity\n8\n${layer}\n`;
    dxf += '100\nAcDbPolyline\n';
    dxf += `90\n${vertices.length}\n`;
    dxf += `70\n${closed ? 1 : 0}\n`;
    dxf += '43\n0.0\n'; // constant width = 0
    vertices.forEach(v => {
      dxf += `10\n${v.x.toFixed(6)}\n20\n${v.y.toFixed(6)}\n`;
    });
  };

  const writeArc = (
    center: { x: number; y: number },
    radius: number,
    startAngleDeg: number,
    endAngleDeg: number,
    layer: string
  ) => {
    const norm = (a: number) => ((a % 360) + 360) % 360;
    dxf += '0\nARC\n';
    dxf += `5\n${H.h()}\n330\n${modelOwner}\n`;
    dxf += `100\nAcDbEntity\n8\n${layer}\n`;
    // ARC inherits from CIRCLE -- needs AcDbCircle for center + radius
    dxf += '100\nAcDbCircle\n';
    dxf += `10\n${center.x.toFixed(6)}\n20\n${center.y.toFixed(6)}\n30\n0.0\n`;
    dxf += `40\n${radius.toFixed(6)}\n`;
    dxf += '100\nAcDbArc\n';
    dxf += `50\n${norm(startAngleDeg).toFixed(6)}\n`;
    dxf += `51\n${norm(endAngleDeg).toFixed(6)}\n`;
  };

  // =========================================================================
  // Geometry computation (unchanged from previous version)
  // =========================================================================

  // --- Determine CW loop order and exterior perpendicular per wall ---
  const orderedTraversal: Array<{ wall: Wall; fromId: string; toId: string }> = [];
  if (walls.length >= 3) {
    const visitedWalls = new Set<string>();
    const firstWall = walls[0];
    let currentNodeId = firstWall.nodeA;

    while (visitedWalls.size < walls.length) {
      const nextWall = walls.find(
        w => !visitedWalls.has(w.id) && (w.nodeA === currentNodeId || w.nodeB === currentNodeId)
      );
      if (!nextWall) break;

      const fromId = currentNodeId;
      const toId = nextWall.nodeA === currentNodeId ? nextWall.nodeB : nextWall.nodeA;
      orderedTraversal.push({ wall: nextWall, fromId, toId });
      visitedWalls.add(nextWall.id);
      currentNodeId = toId;

      if (currentNodeId === firstWall.nodeA) break;
    }
  }

  // Signed area (screen space Y-down): negative = visually CW
  let signedArea = 0;
  const orderedNodes = orderedTraversal
    .map(t => nodes.find(n => n.id === t.fromId)!)
    .filter(Boolean);
  for (let i = 0; i < orderedNodes.length; i++) {
    const curr = orderedNodes[i];
    const next = orderedNodes[(i + 1) % orderedNodes.length];
    signedArea += (next.x - curr.x) * (next.y + curr.y);
  }
  const isCW = signedArea < 0;

  // wallId -> +1 if A->B perp points interior, -1 if exterior
  const wallInteriorSign = new Map<string, number>();
  orderedTraversal.forEach(({ wall, fromId }) => {
    const traversalFollowsAB = fromId === wall.nodeA;
    wallInteriorSign.set(wall.id, isCW === traversalFollowsAB ? 1 : -1);
  });

  // wallId -> exterior perpendicular (canvas space, unit length)
  const wallExteriorPerp = new Map<string, { perpX: number; perpY: number }>();
  orderedTraversal.forEach(({ wall, fromId, toId }) => {
    const nFrom = nodes.find(n => n.id === fromId);
    const nTo = nodes.find(n => n.id === toId);
    if (!nFrom || !nTo) return;
    const dx = nTo.x - nFrom.x;
    const dy = nTo.y - nFrom.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) return;
    const sign = isCW ? 1 : -1;
    wallExteriorPerp.set(wall.id, {
      perpX: (sign * dy) / len,
      perpY: (sign * -dx) / len,
    });
  });

  // --- Mitered outer wall endpoints ---
  const intersectLines = (
    p1x: number, p1y: number, p2x: number, p2y: number,
    p3x: number, p3y: number, p4x: number, p4y: number
  ): { x: number; y: number } | null => {
    const d1x = p2x - p1x, d1y = p2y - p1y;
    const d2x = p4x - p3x, d2y = p4y - p3y;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 0.0001) return null;
    const t = ((p3x - p1x) * d2y - (p3y - p1y) * d2x) / cross;
    return { x: p1x + t * d1x, y: p1y + t * d1y };
  };

  const wallMiteredOuter = new Map<string, { ax: number; ay: number; bx: number; by: number }>();
  const tn = orderedTraversal.length;

  if (tn >= 3) {
    const outerLines: Array<{ ax: number; ay: number; bx: number; by: number; wallId: string }> = [];
    orderedTraversal.forEach(({ wall, fromId, toId }) => {
      const nFrom = nodes.find(n => n.id === fromId)!;
      const nTo = nodes.find(n => n.id === toId)!;
      const ext = wallExteriorPerp.get(wall.id);
      const fax = cmToMm(nFrom.x), fay = -cmToMm(nFrom.y);
      const fbx = cmToMm(nTo.x), fby = -cmToMm(nTo.y);
      if (!ext) {
        outerLines.push({ ax: fax, ay: fay, bx: fbx, by: fby, wallId: wall.id });
        return;
      }
      const dxfPerpX = ext.perpX;
      const dxfPerpY = -ext.perpY;
      const thickMm = cmToMm(wall.thickness);
      outerLines.push({
        ax: fax + dxfPerpX * thickMm,
        ay: fay + dxfPerpY * thickMm,
        bx: fbx + dxfPerpX * thickMm,
        by: fby + dxfPerpY * thickMm,
        wallId: wall.id,
      });
    });

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
      wallMiteredOuter.set(cur.wallId, {
        ax: miterA ? miterA.x : cur.ax,
        ay: miterA ? miterA.y : cur.ay,
        bx: miterB ? miterB.x : cur.bx,
        by: miterB ? miterB.y : cur.by,
      });
    }
  }

  // =========================================================================
  // WALLS -- 2 LINEs per wall (inner face + mitered outer face)
  // =========================================================================
  walls.forEach(wall => {
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;

    const ax = cmToMm(nA.x), ay = -cmToMm(nA.y);
    const bx = cmToMm(nB.x), by = -cmToMm(nB.y);

    writeLine({ x: ax, y: ay }, { x: bx, y: by });

    const mitered = wallMiteredOuter.get(wall.id);
    if (mitered) {
      writeLine({ x: mitered.ax, y: mitered.ay }, { x: mitered.bx, y: mitered.by });
    } else {
      const ext = wallExteriorPerp.get(wall.id);
      if (ext) {
        const dxfPerpX = ext.perpX;
        const dxfPerpY = -ext.perpY;
        const thickMm = cmToMm(wall.thickness);
        writeLine(
          { x: ax + dxfPerpX * thickMm, y: ay + dxfPerpY * thickMm },
          { x: bx + dxfPerpX * thickMm, y: by + dxfPerpY * thickMm }
        );
      } else {
        const dx = bx - ax, dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.0001) {
          const perpX = -dy / len, perpY = dx / len;
          const thickMm = cmToMm(wall.thickness);
          writeLine(
            { x: ax + perpX * thickMm, y: ay + perpY * thickMm },
            { x: bx + perpX * thickMm, y: by + perpY * thickMm }
          );
        }
      }
    }
  });

  // =========================================================================
  // COLUMNS
  // =========================================================================
  columns.forEach(column => {
    const wall = walls.find(w => w.id === column.wallId);
    if (!wall) return;
    const nodeA = nodes.find(n => n.id === wall.nodeA);
    const nodeB = nodes.find(n => n.id === wall.nodeB);
    if (!nodeA || !nodeB) return;

    const t = column.position;
    const centerX = cmToMm(nodeA.x + t * (nodeB.x - nodeA.x));
    const centerY = -cmToMm(nodeA.y + t * (nodeB.y - nodeA.y));

    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const wallDirX = dx / len;
    const wallDirY = -dy / len;
    const rawPerpX = wallDirY;
    const rawPerpY = -wallDirX;

    // Apply wallInteriorSign so columns always extend toward the interior
    const intSign = wallInteriorSign.get(wall.id) ?? 1;
    const perpX = rawPerpX * intSign;
    const perpY = rawPerpY * intSign;

    const insetCm = (column.inset ?? 0) * 100;

    if (column.mergedShapes && column.mergedShapes.length > 0) {
      const sortedShapes = [...column.mergedShapes].sort((a, b) => a.relativePosition - b.relativePosition);
      const vertices: Array<{ x: number; y: number }> = [];
      const toWorld = (alongWall: number, perpToWall: number) => ({
        x: centerX + wallDirX * cmToMm(alongWall) + perpX * cmToMm(perpToWall),
        y: centerY + wallDirY * cmToMm(alongWall) + perpY * cmToMm(perpToWall),
      });

      const firstShape = sortedShapes[0];
      const firstWidthCm = firstShape.width * 100;
      const firstX = firstShape.relativePosition;
      vertices.push(toWorld(firstX - firstWidthCm / 2, insetCm));

      sortedShapes.forEach(shape => {
        const shapeWidthCm = shape.width * 100;
        const shapeX = shape.relativePosition;
        vertices.push(toWorld(shapeX + shapeWidthCm / 2, insetCm));
      });

      const lastShape = sortedShapes[sortedShapes.length - 1];
      const lastWidthCm = lastShape.width * 100;
      const lastDepthCm = lastShape.depth * 100;
      const lastX = lastShape.relativePosition;
      vertices.push(toWorld(lastX + lastWidthCm / 2, insetCm + lastDepthCm));

      for (let i = sortedShapes.length - 1; i >= 0; i--) {
        const shape = sortedShapes[i];
        const shapeWidthCm = shape.width * 100;
        const shapeDepthCm = shape.depth * 100;
        const shapeX = shape.relativePosition;
        vertices.push(toWorld(shapeX + shapeWidthCm / 2, insetCm + shapeDepthCm));
        vertices.push(toWorld(shapeX - shapeWidthCm / 2, insetCm + shapeDepthCm));
      }

      const firstDepthCm = firstShape.depth * 100;
      vertices.push(toWorld(firstX - firstWidthCm / 2, insetCm + firstDepthCm));
      vertices.push(toWorld(firstX - firstWidthCm / 2, insetCm));

      writePolyline(vertices, 'COLUMNS', true);
    } else {
      const halfWidth = mToMm(column.width) / 2;
      const colDepthMm = mToMm(column.depth);
      const insetMm = mToMm(column.inset ?? 0);
      const corners = [
        { x: centerX - wallDirX * halfWidth + perpX * insetMm, y: centerY - wallDirY * halfWidth + perpY * insetMm },
        { x: centerX + wallDirX * halfWidth + perpX * insetMm, y: centerY + wallDirY * halfWidth + perpY * insetMm },
        { x: centerX + wallDirX * halfWidth + perpX * (insetMm + colDepthMm), y: centerY + wallDirY * halfWidth + perpY * (insetMm + colDepthMm) },
        { x: centerX - wallDirX * halfWidth + perpX * (insetMm + colDepthMm), y: centerY - wallDirY * halfWidth + perpY * (insetMm + colDepthMm) },
      ];
      writePolyline(corners, 'COLUMNS', true);
    }
  });

  // =========================================================================
  // WINDOWS -- frame rectangle + 2 glass lines + swing arc for openable
  // =========================================================================
  windows.forEach(win => {
    const wall = walls.find(w => w.id === win.wallId);
    if (!wall) return;
    const nodeA = nodes.find(n => n.id === wall.nodeA);
    const nodeB = nodes.find(n => n.id === wall.nodeB);
    if (!nodeA || !nodeB) return;

    const cx = cmToMm(nodeA.x + win.position * (nodeB.x - nodeA.x));
    const cy = -cmToMm(nodeA.y + win.position * (nodeB.y - nodeA.y));

    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) return;
    // Wall-aligned orthonormal basis in DXF world coords (Y flipped)
    const wdx = dx / len;
    const wdy = -dy / len;
    const pdx = wdy;   // perp X (interior side direction before intSign)
    const pdy = -wdx;  // perp Y

    const toWorld = (lx: number, ly: number) => ({
      x: cx + lx * wdx + ly * pdx,
      y: cy + lx * wdy + ly * pdy,
    });

    const widthMm = mToMm(win.width);
    const halfW = widthMm / 2;
    const depth = 100; // 10cm = 100mm frame depth

    // Frame rectangle -- flush on inner wall face
    writePolyline(
      [
        toWorld(-halfW, 0),
        toWorld(halfW, 0),
        toWorld(halfW, depth),
        toWorld(-halfW, depth),
      ],
      'WINDOWS',
      true
    );

    // Glass line 1 (1/3 depth)
    const g1 = depth / 3;
    writeLine(toWorld(-halfW, g1), toWorld(halfW, g1), 'WINDOWS');

    // Glass line 2 (2/3 depth)
    const g2 = (depth * 2) / 3;
    writeLine(toWorld(-halfW, g2), toWorld(halfW, g2), 'WINDOWS');

    // Swing arc + leaf line for openable windows (mirrors canvas drawWindows)
    if (win.opening !== 'fixed') {
      const intSign = wallInteriorSign.get(wall.id) ?? 1;
      const openDir = (win.opening === 'inward' ? 1 : -1) * intSign;
      const rawHinge = win.hinge ?? 'left';
      const hinge: 'left' | 'right' | 'center' = intSign > 0
        ? rawHinge
        : rawHinge === 'left' ? 'right' : rawHinge === 'right' ? 'left' : 'center';

      if (win.panelCount === 'single') {
        // Single pane -- one hinge, full-width swing
        const hingeLocalX = hinge === 'left' ? -halfW : halfW;
        const hp = toWorld(hingeLocalX, 0);

        // Leaf line at 90 deg open position
        const openTip = toWorld(hingeLocalX, openDir * widthMm);
        writeLine(hp, openTip, 'WINDOWS');

        // Quarter-circle swing arc
        const closedLocalDir = hinge === 'left' ? 1 : -1;
        const closedTip = toWorld(hingeLocalX + closedLocalDir * widthMm, 0);

        const closedAngle = Math.atan2(closedTip.y - hp.y, closedTip.x - hp.x) * (180 / Math.PI);
        const openAngle = Math.atan2(openTip.y - hp.y, openTip.x - hp.x) * (180 / Math.PI);

        const [startA, endA] =
          ccwSweep(closedAngle, openAngle) <= 180
            ? [closedAngle, openAngle]
            : [openAngle, closedAngle];

        writeArc(hp, widthMm, startA, endA, 'WINDOWS');
      } else {
        // Double pane -- two half-width swings from outer edges
        // Left pane: hinge at -halfW, swings half-width
        const hpL = toWorld(-halfW, 0);
        const openTipL = toWorld(-halfW, openDir * halfW);
        writeLine(hpL, openTipL, 'WINDOWS');

        const closedTipL = toWorld(0, 0); // closed tip at center
        const closedAngleL = Math.atan2(closedTipL.y - hpL.y, closedTipL.x - hpL.x) * (180 / Math.PI);
        const openAngleL = Math.atan2(openTipL.y - hpL.y, openTipL.x - hpL.x) * (180 / Math.PI);

        const [startL, endL] =
          ccwSweep(closedAngleL, openAngleL) <= 180
            ? [closedAngleL, openAngleL]
            : [openAngleL, closedAngleL];
        writeArc(hpL, halfW, startL, endL, 'WINDOWS');

        // Right pane: hinge at +halfW, swings half-width
        const hpR = toWorld(halfW, 0);
        const openTipR = toWorld(halfW, openDir * halfW);
        writeLine(hpR, openTipR, 'WINDOWS');

        const closedTipR = toWorld(0, 0); // closed tip at center
        const closedAngleR = Math.atan2(closedTipR.y - hpR.y, closedTipR.x - hpR.x) * (180 / Math.PI);
        const openAngleR = Math.atan2(openTipR.y - hpR.y, openTipR.x - hpR.x) * (180 / Math.PI);

        const [startR, endR] =
          ccwSweep(closedAngleR, openAngleR) <= 180
            ? [closedAngleR, openAngleR]
            : [openAngleR, closedAngleR];
        writeArc(hpR, halfW, startR, endR, 'WINDOWS');
      }
    }
  });

  // =========================================================================
  // DOORS -- frame rect + leaf line + swing arc  (mirrors canvas drawDoors)
  // =========================================================================
  doors.forEach(door => {
    const wall = walls.find(w => w.id === door.wallId);
    if (!wall) return;
    const nodeA = nodes.find(n => n.id === wall.nodeA);
    const nodeB = nodes.find(n => n.id === wall.nodeB);
    if (!nodeA || !nodeB) return;

    const cx = cmToMm(nodeA.x + door.position * (nodeB.x - nodeA.x));
    const cy = -cmToMm(nodeA.y + door.position * (nodeB.y - nodeA.y));

    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) return;
    const wdx = dx / len;
    const wdy = -dy / len;
    const pdx = wdy;
    const pdy = -wdx;

    const toWorld = (lx: number, ly: number) => ({
      x: cx + lx * wdx + ly * pdx,
      y: cy + lx * wdy + ly * pdy,
    });

    const widthMm = mToMm(door.width);
    const halfW = widthMm / 2;

    const intSign = wallInteriorSign.get(wall.id) ?? 1;
    const openDir = (door.opening === 'inward' ? 1 : -1) * intSign;
    const hinge: 'left' | 'right' =
      intSign > 0 ? door.hinge : door.hinge === 'left' ? 'right' : 'left';

    const hingeLocalX = hinge === 'left' ? -halfW : halfW;

    // Door frame: thin rectangle centered on wall line
    const frameThin = 25; // 25mm half-thickness
    writePolyline(
      [
        toWorld(-halfW, -frameThin),
        toWorld(halfW, -frameThin),
        toWorld(halfW, frameThin),
        toWorld(-halfW, frameThin),
      ],
      'DOORS',
      true
    );

    // Hinge point on the inner wall face
    const hp = toWorld(hingeLocalX, 0);

    // Door leaf line: 90-degree open position
    const openTip = toWorld(hingeLocalX, openDir * widthMm);
    writeLine(hp, openTip, 'DOORS');

    // Swing arc: quarter circle from closed tip to open tip
    const closedLocalDir = hinge === 'left' ? 1 : -1;
    const closedTip = toWorld(hingeLocalX + closedLocalDir * widthMm, 0);

    const closedAngle = Math.atan2(closedTip.y - hp.y, closedTip.x - hp.x) * (180 / Math.PI);
    const openAngle = Math.atan2(openTip.y - hp.y, openTip.x - hp.x) * (180 / Math.PI);

    // Pick ordering that gives the short (~90deg) CCW sweep
    const [startA, endA] =
      ccwSweep(closedAngle, openAngle) <= 180
        ? [closedAngle, openAngle]
        : [openAngle, closedAngle];

    writeArc(hp, widthMm, startA, endA, 'DOORS');
  });

  // =========================================================================
  // Close ENTITIES + EOF
  // =========================================================================
  dxf += '0\nENDSEC\n';
  dxf += '0\nEOF\n';

  // Patch the $HANDSEED placeholder with the actual high-water handle
  dxf = dxf.replace(HANDSEED_MARKER, H.seed());

  // Download
  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'planimetra-export.dxf';
  a.click();
  URL.revokeObjectURL(url);
}