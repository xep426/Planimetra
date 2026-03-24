import { useRef } from 'react';
import type {
  Transform, TouchPoint, Node, Wall, WindowObj, DoorObj,
  PassageObj, ColumnObj, PreviewLine, LabelBounds, PendingConnection,
} from '../types';

// ---------------------------------------------------------------------------
// Params interface
// ---------------------------------------------------------------------------

export interface UseGesturesParams {
  // Canvas ref
  canvasRef: React.RefObject<HTMLCanvasElement | null>;

  // State (read-only from gesture perspective)
  transform: Transform;
  nodes: Node[];
  walls: Wall[];
  columns: ColumnObj[];
  previewLine: PreviewLine | null;
  selectedTool: 'wall' | 'window' | 'door' | 'passage' | 'column';
  selectedWallId: string | null;
  selectedWindowId: string | null;
  selectedDoorId: string | null;
  selectedPassageId: string | null;
  selectedColumnId: string | null;
  snapToGridEnabled: boolean;
  columnJoinMode: boolean;
  columnsToJoin: string[];
  labelBoundsRef: React.RefObject<LabelBounds[]>;
  loopClosed: boolean;

  // Node constraints (set of unconstrained node IDs)
  nodeConstraints: Set<string>;

  // Open loop endpoints for close-loop detection
  openLoopEndpoints: { nodeA: string; nodeB: string } | null;

  // State setters
  setTransform: React.Dispatch<React.SetStateAction<Transform>>;
  setPreviewLine: (pl: PreviewLine | null) => void;
  setSelectedTool: (tool: 'wall' | 'window' | 'door' | 'passage' | 'column') => void;
  setSelectedWallId: (id: string | null) => void;
  setSelectedWindowId: (id: string | null) => void;
  setSelectedDoorId: (id: string | null) => void;
  setSelectedPassageId: (id: string | null) => void;
  setSelectedColumnId: (id: string | null) => void;
  setColumnsToJoin: (ids: string[]) => void;
  setValidationError: (err: string | null) => void;
  setShowLengthPrompt: (v: boolean) => void;
  setPendingConnection: (c: PendingConnection | null) => void;

  // Column-crud setters exposed by useColumnCrud
  setPendingColumnWallId: (id: string | null) => void;
  setColumnWidth: (v: string) => void;
  setColumnDepth: (v: string) => void;
  setColumnDistanceToCW: (v: string) => void;
  setColumnDistanceToCCW: (v: string) => void;
  setColumnDistanceType: (v: 'cw' | 'ccw') => void;
  setColumnInset: (v: string) => void;
  setEditingColumnId: (v: string | null) => void;
  setShowColumnPrompt: (v: boolean) => void;

  // Utility functions (delegating to extracted utils)
  screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  snapped: (wx: number, wy: number) => { x: number; y: number };
  findNodeAt: (wx: number, wy: number) => Node | undefined;
  nodeConnections: (id: string) => number;
  findNearbyNode: (wx: number, wy: number, excludeId: string) => Node | undefined;
  findWallAt: (wx: number, wy: number) => Wall | undefined;
  findWindowAt: (wx: number, wy: number) => WindowObj | undefined;
  findDoorAt: (wx: number, wy: number) => DoorObj | undefined;
  findPassageAt: (wx: number, wy: number) => PassageObj | undefined;
  findColumnAt: (wx: number, wy: number) => ColumnObj | undefined;
  findLabelAt: (wx: number, wy: number) => LabelBounds | undefined;
  snapDirection: (fx: number, fy: number, tx: number, ty: number, refId?: string) => { directionX: number; directionY: number } | undefined;
  toggleNodeConstraint: (nodeId: string) => void;

  // Direct wall creation (for node-to-node connections without length prompt)
  saveHistory: (nodes: Node[], walls: Wall[]) => void;

  // Close-loop callback: fires when user drags between two open-loop endpoints
  onCloseLoop: (sourceNodeId: string, targetNodeId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAG_THRESHOLD = 8; // px - distinguishes tap from drag (mouse)
const DRAG_THRESHOLD_TOUCH = 18; // px - larger for finger imprecision on touch screens
const NODE_HIT_RADIUS = 18; // px
const NODE_HIT_RADIUS_TOUCH = NODE_HIT_RADIUS + 10; // px - more forgiving for finger imprecision
const CLOSE_LOOP_RADIUS_TOUCH = NODE_HIT_RADIUS + 16; // px - extra forgiveness to hit the opposite endpoint
const CLOSE_LOOP_SNAP_PX_TOUCH = 48; // px - prefer endpoint when finger is close in screen space
const CLOSE_LOOP_SNAP_PX_MOUSE = 24; // px

// Module-level mutable store for the last preview direction during wall drag.
// Safe because only one Canvas2D instance exists at a time.
let _lastPreviewDir: { directionX: number; directionY: number } | null = null;

// Helper: rotate screen-space deltas into world-space accounting for canvas rotation
function screenDeltaToWorld(dx: number, dy: number, scale: number, rotation: number) {
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  return {
    x: (dx * cos - dy * sin) / scale,
    y: (dx * sin + dy * cos) / scale,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGestures(p: UseGesturesParams) {
  // Refs for gesture state
  const touchesRef = useRef<TouchPoint[]>([]);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; angle: number; scale: number; rotation: number } | null>(null);
  const pendingNodeRef = useRef<Node | null>(null);

  // Wall-creation drag state
  const dragSourceRef = useRef<string | null>(null); // node id we're dragging from
  const dragStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingWallRef = useRef(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPreviewLineRef = useRef<PreviewLine | null>(null);
  // Middle-mouse rotation state
  const rotateRef = useRef<{ startScreenX: number; pivotWX: number; pivotWY: number; startRotation: number; startX: number; startY: number } | null>(null);

  // ---------------------------------------------------------------------------
  // Helper: clear all selections
  // ---------------------------------------------------------------------------

  const clearSelections = () => {
    p.setSelectedWallId(null);
    p.setSelectedWindowId(null);
    p.setSelectedDoorId(null);
    p.setSelectedPassageId(null);
    p.setSelectedColumnId(null);
  };

  // ---------------------------------------------------------------------------
  // Helper: handle column click (normal or join mode)
  // ---------------------------------------------------------------------------

  const handleColumnClick = (colId: string, wallId: string) => {
    if (p.columnJoinMode) {
      // Toggle selection for joining
      const idx = p.columnsToJoin.indexOf(colId);
      if (idx >= 0) {
        p.setColumnsToJoin(p.columnsToJoin.filter(c => c !== colId));
      } else {
        p.setColumnsToJoin([...p.columnsToJoin, colId]);
      }
      return;
    }
    clearSelections();
    p.setSelectedTool('column');
    p.setSelectedColumnId(colId);
  };

  // ---------------------------------------------------------------------------
  // Cross-layer label hit test. Returns true if handled.
  // ---------------------------------------------------------------------------

  const tryCrossLayerHit = (wx: number, wy: number): boolean => {
    const clickedLabel = p.findLabelAt(wx, wy);
    if (clickedLabel) {
      if (clickedLabel.type === 'wall') {
        if (p.selectedTool === 'wall' && p.selectedWallId === clickedLabel.id) {
          return true;
        }
        clearSelections(); p.setSelectedWallId(clickedLabel.id);
      } else if (clickedLabel.type === 'window') {
        if (!p.loopClosed && p.selectedTool !== 'window') { p.setValidationError('Close the wall loop before switching layers'); return true; }
        if (p.selectedTool === 'wall') return true;
        if (p.selectedTool === 'window' && p.selectedWindowId === clickedLabel.id) {
          return true;
        }
        clearSelections(); p.setSelectedTool('window'); p.setSelectedWindowId(clickedLabel.id);
      } else if (clickedLabel.type === 'door') {
        if (!p.loopClosed && p.selectedTool !== 'door') { p.setValidationError('Close the wall loop before switching layers'); return true; }
        if (p.selectedTool === 'wall') return true;
        if (p.selectedTool === 'door' && p.selectedDoorId === clickedLabel.id) {
          return true;
        }
        clearSelections(); p.setSelectedTool('door'); p.setSelectedDoorId(clickedLabel.id);
      } else if (clickedLabel.type === 'passage') {
        if (!p.loopClosed && p.selectedTool !== 'passage') { p.setValidationError('Close the wall loop before switching layers'); return true; }
        if (p.selectedTool === 'wall') return true;
        if (p.selectedTool === 'passage' && p.selectedPassageId === clickedLabel.id) {
          return true;
        }
        clearSelections(); p.setSelectedTool('passage'); p.setSelectedPassageId(clickedLabel.id);
      } else if (clickedLabel.type === 'column') {
        if (p.selectedTool === 'wall') return true;
        if (p.selectedTool === 'column' && !p.columnJoinMode && p.selectedColumnId === clickedLabel.id) {
          return true;
        }
        const col = p.columns.find(c => c.id === clickedLabel.id);
        handleColumnClick(clickedLabel.id, col?.wallId ?? '');
      }
      return true;
    }

    // Geometric hit-test for objects
    const crossWin = p.findWindowAt(wx, wy);
    if (crossWin) {
      if (p.selectedTool === 'wall') return true;
      if (!p.loopClosed && p.selectedTool !== 'window') { p.setValidationError('Close the wall loop before switching layers'); return true; }
      clearSelections(); p.setSelectedTool('window'); p.setSelectedWindowId(crossWin.id); return true;
    }
    const crossDoor = p.findDoorAt(wx, wy);
    if (crossDoor) {
      if (p.selectedTool === 'wall') return true;
      if (!p.loopClosed && p.selectedTool !== 'door') { p.setValidationError('Close the wall loop before switching layers'); return true; }
      clearSelections(); p.setSelectedTool('door'); p.setSelectedDoorId(crossDoor.id); return true;
    }
    const crossPass = p.findPassageAt(wx, wy);
    if (crossPass) {
      if (p.selectedTool === 'wall') return true;
      if (!p.loopClosed && p.selectedTool !== 'passage') { p.setValidationError('Close the wall loop before switching layers'); return true; }
      clearSelections(); p.setSelectedTool('passage'); p.setSelectedPassageId(crossPass.id); return true;
    }
    const crossCol = p.findColumnAt(wx, wy);
    if (crossCol) {
      if (p.selectedTool === 'wall') return true;
      handleColumnClick(crossCol.id, crossCol.wallId); return true;
    }

    return false;
  };

  // ---------------------------------------------------------------------------
  // Wall/tool-specific click after cross-layer miss. Returns true if handled.
  // ---------------------------------------------------------------------------

  const tryWallHit = (wx: number, wy: number): boolean => {
    const cw = p.findWallAt(wx, wy);

    if (p.selectedTool === 'column' && cw) {
      clearSelections();
      p.setSelectedWallId(cw.id);
      return true;
    }

    if (cw && (p.selectedTool === 'window' || p.selectedTool === 'door' || p.selectedTool === 'passage')) {
      clearSelections(); p.setSelectedWallId(cw.id); return true;
    }

    if (p.selectedTool !== 'wall') {
      clearSelections(); return true;
    }

    // Wall mode
    if (cw) {
      if (p.selectedWallId === cw.id) {
        return true;
      }
      clearSelections(); p.setSelectedWallId(cw.id); return true;
    }

    return false;
  };

  // ---------------------------------------------------------------------------
  // processTap -- called on a quick tap (no drag)
  // ---------------------------------------------------------------------------

  const processTap = (sx: number, sy: number) => {
    const { x: wx, y: wy } = p.screenToWorld(sx, sy);

    // Clear validation errors on any tap
    p.setValidationError(null);

    // Cross-layer label/object hit
    if (tryCrossLayerHit(wx, wy)) return;

    // Node tap in wall mode: toggle constraint
    if (p.selectedTool === 'wall') {
      const hitWall = p.findWallAt(wx, wy);
      const node = p.findNodeAt(wx, wy);
      if (hitWall && (!node || Math.hypot(node.x - wx, node.y - wy) > 12 / p.transform.scale)) {
        clearSelections(); p.setSelectedWallId(hitWall.id);
        return;
      }
      if (node) {
        p.toggleNodeConstraint(node.id);
        return;
      }
    }

    // Wall / tool hit
    if (tryWallHit(wx, wy)) return;

    // Empty space tap
    if (p.selectedTool === 'wall' && p.nodes.length === 0) {
      // First node creation
      const { x: snx, y: sny } = p.snapped(wx, wy);
      const newNode: Node = { id: `n-${Date.now()}`, x: snx, y: sny };
      p.saveHistory([newNode], []);
      return;
    }

    // Deselect
    clearSelections();
  };

  // ---------------------------------------------------------------------------
  // Wall drag handling
  // ---------------------------------------------------------------------------

  const getOpenEndpoints = () => {
    const ends = p.nodes.filter(n => p.nodeConnections(n.id) === 1).map(n => n.id);
    return ends.length === 2 ? { nodeA: ends[0], nodeB: ends[1] } : null;
  };

  const openEndpoints = p.openLoopEndpoints ?? getOpenEndpoints();

  const startWallDrag = (nodeId: string) => {
    dragSourceRef.current = nodeId;
    isDraggingWallRef.current = true;
  };

  const canStartWallFromNode = (nodeId: string) =>
    p.nodeConnections(nodeId) < 2;

  const findNearbyNodeWithRadius = (wx: number, wy: number, excludeId: string, radiusPx: number) => {
    const r = radiusPx / p.transform.scale;
    return (
      p.nodes.find(
        n => n.id !== excludeId &&
          p.nodeConnections(n.id) < 2 &&
          Math.hypot(n.x - wx, n.y - wy) < r
      ) ?? undefined
    );
  };

  const updateWallDrag = (sx: number, sy: number, isTouch = false) => {
    if (!dragSourceRef.current) return;
    const sourceNode = p.nodes.find(n => n.id === dragSourceRef.current);
    if (!sourceNode) return;

    const { x: wx, y: wy } = p.screenToWorld(sx, sy);
    const worldToScreen = (wx2: number, wy2: number) => {
      const canvas = p.canvasRef.current;
      if (!canvas) return null;
      const cos = Math.cos(p.transform.rotation);
      const sin = Math.sin(p.transform.rotation);
      const x1 = (wx2 + p.transform.x) * p.transform.scale;
      const y1 = (wy2 + p.transform.y) * p.transform.scale;
      const xr = x1 * cos - y1 * sin;
      const yr = x1 * sin + y1 * cos;
      return { x: xr + canvas.width / 2, y: yr + canvas.height / 2 };
    };
    // Check for snap to existing node using raw world coords (avoid grid-snapping away from nodes)
    let nearNode = p.findNearbyNode(wx, wy, dragSourceRef.current);
    if (!nearNode && isTouch) {
      nearNode = findNearbyNodeWithRadius(wx, wy, dragSourceRef.current, NODE_HIT_RADIUS_TOUCH);
    }

    // Special-case: if we are dragging from an open-loop endpoint, prefer snapping to the opposite endpoint
    if (!nearNode && openEndpoints && dragSourceRef.current) {
      const { nodeA: epA, nodeB: epB } = openEndpoints;
      const targetId = dragSourceRef.current === epA ? epB : (dragSourceRef.current === epB ? epA : null);
      if (targetId) {
        const targetNode = p.nodes.find(n => n.id === targetId);
        if (targetNode) {
          const r = (isTouch ? CLOSE_LOOP_RADIUS_TOUCH : NODE_HIT_RADIUS) / p.transform.scale;
          const screenPos = worldToScreen(targetNode.x, targetNode.y);
          const snapPx = isTouch ? CLOSE_LOOP_SNAP_PX_TOUCH : CLOSE_LOOP_SNAP_PX_MOUSE;
          const closeInScreen = screenPos ? Math.hypot(screenPos.x - sx, screenPos.y - sy) < snapPx : false;
          if (closeInScreen || Math.hypot(targetNode.x - wx, targetNode.y - wy) < r) {
            nearNode = targetNode;
          }
        }
      }
    }
    const { x: snx, y: sny } = p.snapped(wx, wy);

    // Is the source node unconstrained (free angle)?
    const isFreeAngle = p.nodeConstraints.has(dragSourceRef.current);

    if (nearNode && p.nodeConnections(nearNode.id) < 2) {
      _lastPreviewDir = null; // snapping to node, no direction needed
      const preview: PreviewLine = {
        fromNodeId: dragSourceRef.current,
        toX: nearNode.x,
        toY: nearNode.y,
        snapNodeId: nearNode.id,
      };
      lastPreviewLineRef.current = preview;
      p.setPreviewLine(preview);
    } else if (isFreeAngle) {
      // Unconstrained: no angle snapping at all, use raw snapped position
      const dx = snx - sourceNode.x;
      const dy = sny - sourceNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        _lastPreviewDir = { directionX: dx / dist, directionY: dy / dist };
      }
      const preview: PreviewLine = {
        fromNodeId: dragSourceRef.current,
        toX: snx,
        toY: sny,
      };
      lastPreviewLineRef.current = preview;
      p.setPreviewLine(preview);
    } else {
      // Snap direction from source node
      const dir = p.snapDirection(sourceNode.x, sourceNode.y, snx, sny, dragSourceRef.current);
      if (dir) {
        _lastPreviewDir = dir;
        const dx = snx - sourceNode.x;
        const dy = sny - sourceNode.y;
        const projLen = dx * dir.directionX + dy * dir.directionY;
        const projX = sourceNode.x + dir.directionX * projLen;
        const projY = sourceNode.y + dir.directionY * projLen;
        const preview: PreviewLine = {
          fromNodeId: dragSourceRef.current,
          toX: projX,
          toY: projY,
          directionX: dir.directionX,
          directionY: dir.directionY,
        };
        lastPreviewLineRef.current = preview;
        p.setPreviewLine(preview);
      } else {
        _lastPreviewDir = null;
        const preview: PreviewLine = {
          fromNodeId: dragSourceRef.current,
          toX: snx,
          toY: sny,
        };
        lastPreviewLineRef.current = preview;
        p.setPreviewLine(preview);
      }
    }
  };

  const endWallDrag = (sx: number, sy: number, isTouch = false) => {
    if (!dragSourceRef.current) return;
    const sourceId = dragSourceRef.current;
    const sourceNode = p.nodes.find(n => n.id === sourceId);
    dragSourceRef.current = null;
    isDraggingWallRef.current = false;
    p.setPreviewLine(null);
    const lastPreview = lastPreviewLineRef.current;
    lastPreviewLineRef.current = null;

    if (!sourceNode) return;

    const { x: wx, y: wy } = p.screenToWorld(sx, sy);
    const worldToScreen = (wx2: number, wy2: number) => {
      const canvas = p.canvasRef.current;
      if (!canvas) return null;
      const cos = Math.cos(p.transform.rotation);
      const sin = Math.sin(p.transform.rotation);
      const x1 = (wx2 + p.transform.x) * p.transform.scale;
      const y1 = (wy2 + p.transform.y) * p.transform.scale;
      const xr = x1 * cos - y1 * sin;
      const yr = x1 * sin + y1 * cos;
      return { x: xr + canvas.width / 2, y: yr + canvas.height / 2 };
    };
    // Use raw world coords for near-node detection to avoid grid snap jitter on touch
    let nearNode = p.findNearbyNode(wx, wy, sourceId);
    if (!nearNode && isTouch) {
      nearNode = findNearbyNodeWithRadius(wx, wy, sourceId, NODE_HIT_RADIUS_TOUCH);
    }

    // Prefer close-loop endpoint even if near-node detection fails
    if (!nearNode && openEndpoints) {
      const { nodeA: epA, nodeB: epB } = openEndpoints;
      const targetId = sourceId === epA ? epB : (sourceId === epB ? epA : null);
      if (targetId) {
        const targetNode = p.nodes.find(n => n.id === targetId);
        if (targetNode) {
          const r = (isTouch ? CLOSE_LOOP_RADIUS_TOUCH : NODE_HIT_RADIUS) / p.transform.scale;
          const screenPos = worldToScreen(targetNode.x, targetNode.y);
          const snapPx = isTouch ? CLOSE_LOOP_SNAP_PX_TOUCH : CLOSE_LOOP_SNAP_PX_MOUSE;
          const closeInScreen = screenPos ? Math.hypot(screenPos.x - sx, screenPos.y - sy) < snapPx : false;
          const closeInWorld = Math.hypot(targetNode.x - wx, targetNode.y - wy) < r;
          const previewSnappedToTarget = lastPreview?.snapNodeId === targetId;
          const previewNearTarget = lastPreview
            ? Math.hypot(targetNode.x - lastPreview.toX, targetNode.y - lastPreview.toY) < r
            : false;
          if (closeInScreen || closeInWorld || previewSnappedToTarget || previewNearTarget) {
            nearNode = targetNode;
          }
        }
      }
    }
    const { x: snx, y: sny } = p.snapped(wx, wy);

    // Check for close-loop: dragging between open-loop endpoints
    if (nearNode && openEndpoints) {
      const { nodeA: epA, nodeB: epB } = openEndpoints;
      if ((sourceId === epA && nearNode.id === epB) || (sourceId === epB && nearNode.id === epA)) {
        p.onCloseLoop(sourceId, nearNode.id);
        return;
      }
    }

    if (nearNode && p.nodeConnections(nearNode.id) < 2) {
      // Check if wall already exists between these nodes
      const existsAlready = p.walls.some(
        w => (w.nodeA === sourceId && w.nodeB === nearNode.id) ||
             (w.nodeA === nearNode.id && w.nodeB === sourceId)
      );
      if (existsAlready) {
        p.setValidationError('Wall already exists between these nodes');
        return;
      }
      // Direct connection: calculate length from positions
      const dx = nearNode.x - sourceNode.x;
      const dy = nearNode.y - sourceNode.y;
      const lengthCm = Math.sqrt(dx * dx + dy * dy);
      const lengthM = lengthCm / 100;
      const newWall: Wall = {
        id: `w-${Date.now()}`,
        nodeA: sourceId,
        nodeB: nearNode.id,
        length: lengthM,
        type: 'inner',
        thickness: 15,
      };
      p.saveHistory([...p.nodes], [...p.walls, newWall]);
    } else {
      // Drag to empty space: open length prompt
      const isFreeAngle = p.nodeConstraints.has(sourceId);

      if (isFreeAngle) {
        // Unconstrained: use raw direction, no angle snapping
        const dx = snx - sourceNode.x;
        const dy = sny - sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return; // too close, ignore
        p.setPendingConnection({
          nodeA: sourceId,
          nodeB: '',
          directionX: dx / dist,
          directionY: dy / dist,
          fixedX: sourceNode.x,
          fixedY: sourceNode.y,
        });
      } else {
        const dir = _lastPreviewDir;
        if (dir) {
          p.setPendingConnection({
            nodeA: sourceId,
            nodeB: '',
            directionX: dir.directionX,
            directionY: dir.directionY,
            fixedX: sourceNode.x,
            fixedY: sourceNode.y,
          });
        } else {
          const dx = snx - sourceNode.x;
          const dy = sny - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) return; // too close, ignore
          p.setPendingConnection({
            nodeA: sourceId,
            nodeB: '',
            directionX: dx / dist,
            directionY: dy / dist,
            fixedX: sourceNode.x,
            fixedY: sourceNode.y,
          });
        }
      }
      p.setShowLengthPrompt(true);
    }
  };

  // ---------------------------------------------------------------------------
  // Mouse handlers
  // ---------------------------------------------------------------------------

  const handleMouseDown = (e: React.MouseEvent) => {
    const sx = e.clientX;
    const sy = e.clientY;

    // Middle-click: start rotation
    if (e.button === 1) {
      e.preventDefault();
      const { x: wx, y: wy } = p.screenToWorld(sx, sy);
      rotateRef.current = {
        startScreenX: sx,
        pivotWX: wx, pivotWY: wy,
        startRotation: p.transform.rotation,
        startX: p.transform.x, startY: p.transform.y,
      };
      return;
    }

    // Right-click: start pan
    if (e.button === 2) {
      lastPanRef.current = { x: sx, y: sy };
      return;
    }

    if (e.button !== 0) return;

    const { x: wx, y: wy } = p.screenToWorld(sx, sy);

    // Wall mode: check node hit for drag-to-create
    if (p.selectedTool === 'wall') {
      const hitNode = p.findNodeAt(wx, wy);
      if (hitNode) {
        if (canStartWallFromNode(hitNode.id)) {
          dragStartScreenRef.current = { x: sx, y: sy };
          dragSourceRef.current = hitNode.id;
          isDraggingWallRef.current = false; // not dragging yet, waiting for threshold
          _lastPreviewDir = null; // reset for new drag
          return;
        }
        dragStartScreenRef.current = { x: sx, y: sy };
        lastPanRef.current = { x: sx, y: sy };
        return;
      }
    }

    // Start pan with left button
    lastPanRef.current = { x: sx, y: sy };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const sx = e.clientX;
    const sy = e.clientY;

    // Middle-mouse rotation
    if (rotateRef.current) {
      const totalDx = sx - rotateRef.current.startScreenX;
      const dAngle = totalDx * 0.005;
      const { pivotWX, pivotWY, startRotation, startX, startY } = rotateRef.current;
      const newRotation = startRotation + dAngle;
      // Absolute pivot math: rotate (pivot + startTranslation) by -dAngle to get new translation
      const A = pivotWX + startX;
      const B = pivotWY + startY;
      const cos = Math.cos(dAngle);
      const sin = Math.sin(dAngle);
      const newX = A * cos + B * sin - pivotWX;
      const newY = -A * sin + B * cos - pivotWY;
      p.setTransform(prev => ({ ...prev, rotation: newRotation, x: newX, y: newY }));
      return;
    }

    // Wall drag detection
    if (dragSourceRef.current && dragStartScreenRef.current) {
      const dx = sx - dragStartScreenRef.current.x;
      const dy = sy - dragStartScreenRef.current.y;
      if (!isDraggingWallRef.current && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        isDraggingWallRef.current = true;
      }
      if (isDraggingWallRef.current) {
        updateWallDrag(sx, sy);
        return;
      }
    }

    // Pan
    if (lastPanRef.current) {
      const dx = sx - lastPanRef.current.x;
      const dy = sy - lastPanRef.current.y;
      lastPanRef.current = { x: sx, y: sy };
      p.setTransform(prev => {
        const d = screenDeltaToWorld(dx, dy, prev.scale, prev.rotation);
        return { ...prev, x: prev.x + d.x, y: prev.y + d.y };
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const sx = e.clientX;
    const sy = e.clientY;

    // End middle-mouse rotation
    if (e.button === 1) {
      rotateRef.current = null;
      return;
    }

    // Wall drag end
    if (dragSourceRef.current) {
      if (isDraggingWallRef.current) {
        endWallDrag(sx, sy);
      } else {
        // Was a tap on a node (no drag threshold reached)
        processTap(sx, sy);
      }
      dragSourceRef.current = null;
      dragStartScreenRef.current = null;
      isDraggingWallRef.current = false;
      p.setPreviewLine(null);
      lastPanRef.current = null;
      return;
    }

    if (lastPanRef.current) {
      const moved = Math.abs(sx - (dragStartScreenRef.current?.x ?? sx)) > 3 ||
                    Math.abs(sy - (dragStartScreenRef.current?.y ?? sy)) > 3;
      lastPanRef.current = null;
      if (!moved) {
        processTap(sx, sy);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    // Shift+wheel = rotate around cursor position
    if (e.shiftKey) {
      const dAngle = e.deltaY > 0 ? 0.05 : -0.05;
      const { x: pivotWX, y: pivotWY } = p.screenToWorld(e.clientX, e.clientY);
      p.setTransform(prev => {
        const A = pivotWX + prev.x;
        const B = pivotWY + prev.y;
        const cos = Math.cos(dAngle);
        const sin = Math.sin(dAngle);
        return {
          ...prev,
          rotation: prev.rotation + dAngle,
          x: A * cos + B * sin - pivotWX,
          y: -A * sin + B * cos - pivotWY,
        };
      });
      return;
    }
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const { x: pivotWX, y: pivotWY } = p.screenToWorld(e.clientX, e.clientY);
    p.setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * factor, 0.1), 20);
      const ratio = newScale / prev.scale;
      return {
        ...prev,
        scale: newScale,
        x: (pivotWX + prev.x) / ratio - pivotWX,
        y: (pivotWY + prev.y) / ratio - pivotWY,
      };
    });
  };

  // ---------------------------------------------------------------------------
  // Touch handlers (multi-touch pan/zoom/rotate + single-touch tap/drag)
  // ---------------------------------------------------------------------------

  const getTouches = (e: React.TouchEvent): TouchPoint[] =>
    Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = getTouches(e);
    touchesRef.current = touches;

    if (touches.length === 1) {
      const t = touches[0];

      // Wall mode: check node hit for drag-to-create
      if (p.selectedTool === 'wall') {
        const { x: wx, y: wy } = p.screenToWorld(t.x, t.y);
        const hitNode = p.findNodeAt(wx, wy);
        if (hitNode) {
          if (canStartWallFromNode(hitNode.id)) {
            dragStartScreenRef.current = { x: t.x, y: t.y };
            dragSourceRef.current = hitNode.id;
            isDraggingWallRef.current = false;
            _lastPreviewDir = null; // reset for new drag
            return;
          }
          lastPanRef.current = { x: t.x, y: t.y };
          dragStartScreenRef.current = { x: t.x, y: t.y };
          return;
        }
      }

      lastPanRef.current = { x: t.x, y: t.y };
      dragStartScreenRef.current = { x: t.x, y: t.y };
    } else if (touches.length === 2) {
      // Cancel any wall drag in progress
      if (dragSourceRef.current) {
        dragSourceRef.current = null;
        isDraggingWallRef.current = false;
        p.setPreviewLine(null);
      }
      lastPanRef.current = null;
      dragStartScreenRef.current = null;

      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      pinchRef.current = {
        dist: Math.sqrt(dx * dx + dy * dy),
        angle: Math.atan2(dy, dx),
        scale: p.transform.scale,
        rotation: p.transform.rotation,
      };
      // Store midpoint for pinch-pan
      const midX = (touches[0].x + touches[1].x) / 2;
      const midY = (touches[0].y + touches[1].y) / 2;
      lastPanRef.current = { x: midX, y: midY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = getTouches(e);

    if (touches.length === 1 && !pinchRef.current) {
      const t = touches[0];

      // Wall drag
      if (dragSourceRef.current && dragStartScreenRef.current) {
        const dx = t.x - dragStartScreenRef.current.x;
        const dy = t.y - dragStartScreenRef.current.y;
        if (!isDraggingWallRef.current && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD_TOUCH) {
          isDraggingWallRef.current = true;
        }
        if (isDraggingWallRef.current) {
        updateWallDrag(t.x, t.y, true);
        return;
      }
        return; // Still within threshold, wait
      }

      // Pan
      if (lastPanRef.current) {
        const dx = t.x - lastPanRef.current.x;
        const dy = t.y - lastPanRef.current.y;
        lastPanRef.current = { x: t.x, y: t.y };
        p.setTransform(prev => {
          const d = screenDeltaToWorld(dx, dy, prev.scale, prev.rotation);
          return { ...prev, x: prev.x + d.x, y: prev.y + d.y };
        });
      }
    } else if (touches.length === 2 && pinchRef.current) {
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const scaleFactor = dist / pinchRef.current.dist;
      const newScale = Math.min(Math.max(pinchRef.current.scale * scaleFactor, 0.1), 20);
      const newRotation = pinchRef.current.rotation + (angle - pinchRef.current.angle);

      // Pan with midpoint
      const midX = (touches[0].x + touches[1].x) / 2;
      const midY = (touches[0].y + touches[1].y) / 2;
      if (lastPanRef.current) {
        const pdx = midX - lastPanRef.current.x;
        const pdy = midY - lastPanRef.current.y;
        const d = screenDeltaToWorld(pdx, pdy, newScale, newRotation);
        p.setTransform(prev => ({ ...prev, scale: newScale, rotation: newRotation, x: prev.x + d.x, y: prev.y + d.y }));
      } else {
        p.setTransform(prev => ({ ...prev, scale: newScale, rotation: newRotation }));
      }
      lastPanRef.current = { x: midX, y: midY };
    }

    touchesRef.current = touches;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    const remaining = getTouches(e);

    // Wall drag end
    if (dragSourceRef.current && touchesRef.current.length === 1 && remaining.length === 0) {
      const lastTouch = touchesRef.current[0];
      if (isDraggingWallRef.current) {
        endWallDrag(lastTouch.x, lastTouch.y, true);
      } else {
        processTap(lastTouch.x, lastTouch.y);
      }
      dragSourceRef.current = null;
      dragStartScreenRef.current = null;
      isDraggingWallRef.current = false;
      p.setPreviewLine(null);
      touchesRef.current = remaining;
      lastPanRef.current = null;
      pinchRef.current = null;
      return;
    }

    // Single touch end (pan) -- detect tap
    if (touchesRef.current.length === 1 && remaining.length === 0 && !pinchRef.current) {
      const lastTouch = touchesRef.current[0];
      if (dragStartScreenRef.current) {
        const dx = lastTouch.x - dragStartScreenRef.current.x;
        const dy = lastTouch.y - dragStartScreenRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_TOUCH) {
          processTap(lastTouch.x, lastTouch.y);
        }
      }
    }

    if (remaining.length < 2) {
      pinchRef.current = null;
    }
    if (remaining.length === 1) {
      lastPanRef.current = { x: remaining[0].x, y: remaining[0].y };
    } else {
      lastPanRef.current = null;
    }
    dragStartScreenRef.current = null;
    touchesRef.current = remaining;
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    pendingNodeRef,
  };
}
