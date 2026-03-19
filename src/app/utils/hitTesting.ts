// Hit-testing functions for finding objects at world coordinates
// Pure functions — take data as arguments, no React dependency

import type { Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj, LabelBounds } from '../types';

/** Find a node within click radius at world coordinates */
export function findNodeAt(
  wx: number,
  wy: number,
  nodes: Node[],
  scale: number
): Node | null {
  const r = 15 / scale;
  return nodes.find(n => Math.hypot(n.x - wx, n.y - wy) < r) ?? null;
}

/** Count how many walls connect to a node */
export function nodeConnections(id: string, walls: Wall[]): number {
  return walls.filter(w => w.nodeA === id || w.nodeB === id).length;
}

/** Find a nearby node (within radius) that has fewer than 2 connections, excluding a specific node */
export function findNearbyNode(
  wx: number,
  wy: number,
  excludeId: string,
  nodes: Node[],
  walls: Wall[],
  scale: number
): Node | null {
  const r = 15 / scale;
  return (
    nodes.find(
      n => n.id !== excludeId && nodeConnections(n.id, walls) < 2 && Math.hypot(n.x - wx, n.y - wy) < r
    ) ?? null
  );
}

/** Find a wall near the given world coordinates (point-to-segment distance check) */
export function findWallAt(
  wx: number,
  wy: number,
  nodes: Node[],
  walls: Wall[],
  scale: number
): Wall | null {
  const thresh = 10 / scale;
  for (const wall of walls) {
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) continue;
    const dx = nB.x - nA.x, dy = nB.y - nA.y;
    const lsq = dx * dx + dy * dy;
    if (lsq === 0) continue;
    const t = Math.max(0, Math.min(1, ((wx - nA.x) * dx + (wy - nA.y) * dy) / lsq));
    if (Math.hypot(wx - (nA.x + t * dx), wy - (nA.y + t * dy)) < thresh) return wall;
  }
  return null;
}

/** Find a window near the given world coordinates */
export function findWindowAt(
  wx: number,
  wy: number,
  windows: WindowObj[],
  walls: Wall[],
  nodes: Node[],
  scale: number
): WindowObj | null {
  const thresh = 12 / scale;
  for (const win of windows) {
    const wall = walls.find(w => w.id === win.wallId);
    if (!wall) continue;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) continue;

    const winX = nA.x + (nB.x - nA.x) * win.position;
    const winY = nA.y + (nB.y - nA.y) * win.position;

    if (Math.hypot(wx - winX, wy - winY) < thresh) return win;
  }
  return null;
}

/** Find a door near the given world coordinates */
export function findDoorAt(
  wx: number,
  wy: number,
  doors: DoorObj[],
  walls: Wall[],
  nodes: Node[],
  scale: number
): DoorObj | null {
  const thresh = 12 / scale;
  for (const door of doors) {
    const wall = walls.find(w => w.id === door.wallId);
    if (!wall) continue;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) continue;

    const doorX = nA.x + (nB.x - nA.x) * door.position;
    const doorY = nA.y + (nB.y - nA.y) * door.position;

    if (Math.hypot(wx - doorX, wy - doorY) < thresh) return door;
  }
  return null;
}

/** Find a passage near the given world coordinates */
export function findPassageAt(
  wx: number,
  wy: number,
  passages: PassageObj[],
  walls: Wall[],
  nodes: Node[],
  scale: number
): PassageObj | null {
  const thresh = 12 / scale;
  for (const passage of passages) {
    const wall = walls.find(w => w.id === passage.wallId);
    if (!wall) continue;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) continue;

    const passageX = nA.x + (nB.x - nA.x) * passage.position;
    const passageY = nA.y + (nB.y - nA.y) * passage.position;

    if (Math.hypot(wx - passageX, wy - passageY) < thresh) return passage;
  }
  return null;
}

/** Find a column near the given world coordinates (bounds-aware hit test) */
export function findColumnAt(
  wx: number,
  wy: number,
  columns: ColumnObj[],
  walls: Wall[],
  nodes: Node[],
  scale: number
): ColumnObj | null {
  const thresh = 15 / scale;
  for (const column of columns) {
    const wall = walls.find(w => w.id === column.wallId);
    if (!wall) continue;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) continue;

    const columnX = nA.x + (nB.x - nA.x) * column.position;
    const columnY = nA.y + (nB.y - nA.y) * column.position;

    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const wallAngle = Math.atan2(dy, dx);

    // Transform click point to column local space
    const relX = wx - columnX;
    const relY = wy - columnY;
    const cos = Math.cos(-wallAngle);
    const sin = Math.sin(-wallAngle);
    const localX = relX * cos - relY * sin;
    const localY = relX * sin + relY * cos;

    const depthCm = column.depth * 100; // perpendicular to wall
    const widthCm = column.width * 100; // parallel to wall (along wall)
    const insetCm = (column.inset ?? 0) * 100;

    // Column bounds: width along wall, depth perpendicular (offset by inset)
    if (localX >= -widthCm / 2 && localX <= widthCm / 2 && localY >= insetCm && localY <= insetCm + depthCm) {
      return column;
    }
  }
  return null;
}

/** Find a label at world coordinates (for clickable labels) */
export function findLabelAt(
  wx: number,
  wy: number,
  labelBounds: LabelBounds[]
): LabelBounds | null {
  for (const label of labelBounds) {
    const halfW = label.width / 2;
    const halfH = label.height / 2;
    if (
      wx >= label.x - halfW &&
      wx <= label.x + halfW &&
      wy >= label.y - halfH &&
      wy <= label.y + halfH
    ) {
      return label;
    }
  }
  return null;
}