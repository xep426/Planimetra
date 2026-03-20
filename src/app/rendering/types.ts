import type {
  Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj,
  Transform, LabelBounds, LayerType,
} from '../types';

/** Shared state bundle passed to every draw function. */
export interface DrawContext {
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];
  transform: Transform;
  selectedTool: LayerType;
  selectedWallId: string | null;
  selectedWindowId: string | null;
  selectedDoorId: string | null;
  selectedPassageId: string | null;
  selectedColumnId: string | null;
  nodeConstraints: Set<string>;
  wallInteriorSign: Map<string, number>;
  columnsToJoin: string[];
  columnJoinMode: boolean;
  /** Whether the wall loop is closed (all nodes have 2 connections). */
  loopClosed: boolean;
  /** True while dragging from one open endpoint to the other (close-loop preview). */
  closeLoopPreview: boolean;
  /** Mutable array — drawWalls populates it, subsequent drawers append to it. */
  labelBounds: LabelBounds[];
  pendingNode: { id: string; x: number; y: number } | null;
  /** Current room name for the room label. */
  roomName: string;
}
