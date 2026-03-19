// Shared type definitions for the floor plan application

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface Node {
  id: string;
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  nodeA: string;
  nodeB: string;
  length: number;
  type: 'inner' | 'external';
  thickness: number; // cm
}

export interface MergedShape {
  relativePosition: number; // Position along wall relative to merged column center (in cm)
  width: number; // meters (along wall)
  depth: number; // meters (perpendicular to wall)
}

export interface WindowObj {
  id: string;
  wallId: string;
  position: number; // 0-1, position along the wall
  setback: number; // meters from reference node (distance along wall)
  fromNodeA: boolean; // true = setback from nodeA, false = setback from nodeB
  panelCount: 'single' | 'double';
  type: 'standard' | 'floor-to-ceiling';
  opening: 'fixed' | 'inward' | 'outward';
  width: number; // meters
  height: number; // meters
  hinge: 'left' | 'right' | 'center';
}

export interface DoorObj {
  id: string;
  wallId: string;
  position: number; // 0-1, position along the wall
  setback: number; // meters from reference node (distance along wall)
  fromNodeA: boolean; // true = setback from nodeA, false = setback from nodeB
  width: number; // meters
  height: number; // meters
  opening: 'inward' | 'outward';
  hinge: 'left' | 'right';
}

export interface PassageObj {
  id: string;
  wallId: string;
  position: number; // 0-1, position along the wall
  offset: number; // meters from reference node
  fromNodeA: boolean; // true = offset from nodeA, false = offset from nodeB
  width: number; // meters
}

export interface ColumnObj {
  id: string;
  wallId: string; // Placed on walls
  position: number; // 0.0 to 1.0 along wall
  distanceToCW: number; // Distance to clockwise node (meters)
  distanceToCCW: number; // Distance to counter-clockwise node (meters)
  width: number; // meters (along wall)
  depth: number; // meters (perpendicular to wall, into room)
  inset: number; // meters (perpendicular offset from wall into room, 0 = flush)
  mergedShapes?: MergedShape[];
}

export interface PreviewLine {
  fromNodeId: string;
  toX: number;
  toY: number;
  snapNodeId?: string;
  directionX?: number;
  directionY?: number;
}

export interface LabelBounds {
  id: string;
  type: 'wall' | 'window' | 'door' | 'passage' | 'column';
  x: number;  // center in world coords
  y: number;  // center in world coords
  width: number;  // in world coords
  height: number; // in world coords
}

export type LayerType = 'wall' | 'window' | 'door' | 'passage' | 'column';

// --- Room / Project types ---------------------------------------------------

export interface RoomData {
  id: string;
  name: string;
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];
  history: HistoryEntry[];
  historyIndex: number;
  transform: Transform;
  nodeConstraints: string[]; // serialised Set<string>
  selectedTool: LayerType;
}

export interface MultiRoomProject {
  version: number;
  savedAt: string;
  projectName: string;
  rooms: RoomData[];
  activeRoomId: string;
}

export interface PendingConnection {
  nodeA: string;
  nodeB: string;
  directionX?: number;
  directionY?: number;
  fixedX?: number;
  fixedY?: number;
}

export interface HistoryEntry {
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];
}