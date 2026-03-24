import { useState, useMemo } from 'react';
import type { Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj } from '../types';
import { isLoopClosed } from '../utils/wallGeometry';
import { findChain, solveClosedLoop } from '../utils/solver';

interface UseWallCrudParams {
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];
  selectedWallId: string | null;
  setSelectedWallId: (id: string | null) => void;
  nodeConstraints: Set<string>;
  saveHistory: (
    nodes: Node[], walls: Wall[],
    windows?: WindowObj[], doors?: DoorObj[],
    passages?: PassageObj[], columns?: ColumnObj[]
  ) => void;
  setValidationError: (error: string | null) => void;
}

/** Check if a wall is at the edge of an open chain (has a node with degree 1) */
function isEdgeWall(wall: Wall, walls: Wall[]): boolean {
  const degA = walls.filter(w => w.nodeA === wall.nodeA || w.nodeB === wall.nodeA).length;
  const degB = walls.filter(w => w.nodeA === wall.nodeB || w.nodeB === wall.nodeB).length;
  return degA === 1 || degB === 1;
}

/** Get cascade info: what objects are attached to a wall */
function getCascadeInfo(
  wallId: string,
  windows: WindowObj[], doors: DoorObj[],
  passages: PassageObj[], columns: ColumnObj[]
): { windows: WindowObj[]; doors: DoorObj[]; passages: PassageObj[]; columns: ColumnObj[] } {
  return {
    windows: windows.filter(w => w.wallId === wallId),
    doors: doors.filter(d => d.wallId === wallId),
    passages: passages.filter(p => p.wallId === wallId),
    columns: columns.filter(c => c.wallId === wallId),
  };
}

/** Build a human-readable summary of what will be cascade-deleted */
function buildCascadeMessage(cascade: ReturnType<typeof getCascadeInfo>): string | null {
  const parts: string[] = [];
  if (cascade.windows.length > 0) parts.push(`${cascade.windows.length} window${cascade.windows.length > 1 ? 's' : ''}`);
  if (cascade.doors.length > 0) parts.push(`${cascade.doors.length} door${cascade.doors.length > 1 ? 's' : ''}`);
  if (cascade.passages.length > 0) parts.push(`${cascade.passages.length} passage${cascade.passages.length > 1 ? 's' : ''}`);
  if (cascade.columns.length > 0) parts.push(`${cascade.columns.length} column${cascade.columns.length > 1 ? 's' : ''}`);
  if (parts.length === 0) return null;
  return `This will also remove ${parts.join(', ')} attached to this wall.`;
}

export function useWallCrud({
  nodes, walls, windows, doors, passages, columns,
  selectedWallId, setSelectedWallId, nodeConstraints,
  saveHistory, setValidationError,
}: UseWallCrudParams) {
  const [showWallEditPrompt, setShowWallEditPrompt] = useState(false);
  const [wallEditType, setWallEditType] = useState<'inner' | 'external'>('inner');
  const [wallEditThickness, setWallEditThickness] = useState(20);
  const [wallEditLength, setWallEditLength] = useState('');

  // -- Delete confirmation state --
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState('');

  // -- Derived: can the selected wall be deleted? --
  const canDeleteSelectedWall = useMemo(() => {
    if (!selectedWallId) return false;
    const wall = walls.find(w => w.id === selectedWallId);
    if (!wall) return false;
    // In a closed loop, any wall can be deleted
    if (isLoopClosed(walls)) return true;
    // In an open chain, only edge walls
    return isEdgeWall(wall, walls);
  }, [selectedWallId, walls]);

  // -- Reason string when deletion is disabled --
  const deleteWallDisabledReason = useMemo((): string | null => {
    if (!selectedWallId) return 'Select a wall first';
    const wall = walls.find(w => w.id === selectedWallId);
    if (!wall) return 'Select a wall first';
    if (canDeleteSelectedWall) return null;
    // Must be an open chain with a mid-chain wall selected
    return 'Only end-of-chain walls can be deleted';
  }, [selectedWallId, walls, canDeleteSelectedWall]);

  // -- Edit --
  const handleEditWallClick = () => {
    if (!selectedWallId) return;
    const wall = walls.find(w => w.id === selectedWallId);
    if (wall) {
      setWallEditType(wall.type);
      setWallEditThickness(wall.thickness);
      setWallEditLength(wall.length.toFixed(3));
      setShowWallEditPrompt(true);
    }
  };

  const handleWallUpdate = () => {
    if (!selectedWallId) return;
    const wall = walls.find(w => w.id === selectedWallId);
    if (!wall) return;

    const newLengthM = parseFloat(wallEditLength.replace(',', '.'));
    const lengthChanged = !isNaN(newLengthM) && newLengthM > 0 && Math.abs(newLengthM - wall.length) > 0.001;

    let updatedWalls = walls.map(w =>
      w.id === selectedWallId
        ? { ...w, type: wallEditType, thickness: wallEditThickness, length: lengthChanged ? newLengthM : w.length }
        : w
    );

    let updatedNodes = nodes;

    if (lengthChanged) {
      const loopClosed = isLoopClosed(walls);

      if (loopClosed) {
        const remainingWalls = walls.filter(w => w.id !== selectedWallId);
        const chain = findChain(wall.nodeA, wall.nodeB, remainingWalls);

        if (chain && chain.nodeIds.length >= 3) {
          const solvedNodes = solveClosedLoop(
            chain.nodeIds, chain.wallLengthsCm,
            newLengthM * 100, nodeConstraints, nodes
          );

          if (solvedNodes) {
            updatedNodes = solvedNodes;
          } else {
            setValidationError('Cannot re-close the loop with that wall length \u2014 geometry is impossible.');
            return;
          }
        } else {
          updatedNodes = moveNodeBAlongWall(nodes, wall, newLengthM);
        }
      } else {
        updatedNodes = moveNodeBAlongWall(nodes, wall, newLengthM);
      }
    }

    saveHistory(updatedNodes, updatedWalls);
    setShowWallEditPrompt(false);
    setValidationError(null);
  };

  // -- Delete --

  /** Initiate wall deletion -- shows confirmation if cascade objects exist */
  const handleDeleteWallClick = () => {
    if (!selectedWallId || !canDeleteSelectedWall) return;

    setShowWallEditPrompt(false); // Close edit dialog before deleting

    const cascade = getCascadeInfo(selectedWallId, windows, doors, passages, columns);
    const cascadeMsg = buildCascadeMessage(cascade);

    if (cascadeMsg) {
      setDeleteConfirmMessage(cascadeMsg);
      setShowDeleteConfirm(true);
    } else {
      // No cascade, delete immediately
      executeWallDeletion();
    }
  };

  /** Actually perform the wall deletion with cascade cleanup */
  const executeWallDeletion = () => {
    if (!selectedWallId) return;
    const wall = walls.find(w => w.id === selectedWallId);
    if (!wall) return;

    // Remove the wall
    const updatedWalls = walls.filter(w => w.id !== selectedWallId);

    // Remove attached objects
    const cascade = getCascadeInfo(selectedWallId, windows, doors, passages, columns);
    const cascadeWindowIds = new Set(cascade.windows.map(w => w.id));
    const cascadeDoorIds = new Set(cascade.doors.map(d => d.id));
    const cascadePassageIds = new Set(cascade.passages.map(p => p.id));
    const cascadeColumnIds = new Set(cascade.columns.map(c => c.id));

    const updatedWindows = windows.filter(w => !cascadeWindowIds.has(w.id));
    const updatedDoors = doors.filter(d => !cascadeDoorIds.has(d.id));
    const updatedPassages = passages.filter(p => !cascadePassageIds.has(p.id));
    const updatedColumns = columns.filter(c => !cascadeColumnIds.has(c.id));

    // Clean up orphaned nodes (nodes with no remaining wall connections)
    const nodesInUse = new Set<string>();
    updatedWalls.forEach(w => {
      nodesInUse.add(w.nodeA);
      nodesInUse.add(w.nodeB);
    });
    const updatedNodes = nodes.filter(n => nodesInUse.has(n.id));

    // Deselect and save
    setSelectedWallId(null);
    setShowDeleteConfirm(false);
    setDeleteConfirmMessage('');
    saveHistory(updatedNodes, updatedWalls, updatedWindows, updatedDoors, updatedPassages, updatedColumns);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmMessage('');
  };

  return {
    handleEditWallClick,
    handleWallUpdate,
    handleDeleteWallClick,
    canDeleteSelectedWall,
    deleteWallDisabledReason,
    wallEditDialogProps: {
      visible: showWallEditPrompt && !!selectedWallId,
      wallEditType,
      wallEditThickness,
      wallEditLength,
      onTypeChange: setWallEditType,
      onThicknessChange: setWallEditThickness,
      onLengthChange: setWallEditLength,
      onSubmit: handleWallUpdate,
      onCancel: () => setShowWallEditPrompt(false),
    },
    wallDeleteConfirmProps: {
      visible: showDeleteConfirm,
      message: deleteConfirmMessage,
      onConfirm: executeWallDeletion,
      onCancel: handleCancelDelete,
    },
  };
}

/** Move nodeB along the existing wall direction to achieve the new length */
function moveNodeBAlongWall(nodes: Node[], wall: Wall, newLengthM: number): Node[] {
  const nA = nodes.find(n => n.id === wall.nodeA);
  const nB = nodes.find(n => n.id === wall.nodeB);
  if (!nA || !nB) return nodes;

  const dx = nB.x - nA.x;
  const dy = nB.y - nA.y;
  const currentLen = Math.hypot(dx, dy);
  if (currentLen < 0.001) return nodes;

  const dirX = dx / currentLen;
  const dirY = dy / currentLen;
  const newLenCm = newLengthM * 100;

  return nodes.map(n =>
    n.id === wall.nodeB
      ? { ...n, x: nA.x + dirX * newLenCm, y: nA.y + dirY * newLenCm }
      : n
  );
}
