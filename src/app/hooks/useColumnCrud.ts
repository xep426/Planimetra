import { useState } from 'react';
import type { Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj } from '../types';

interface UseColumnCrudParams {
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];
  selectedWallId: string | null;
  selectedColumnId: string | null;
  setSelectedColumnId: (id: string | null) => void;
  setSelectedWallId: (id: string | null) => void;
  columnJoinMode: boolean;
  setColumnJoinMode: (v: boolean) => void;
  columnsToJoin: string[];
  setColumnsToJoin: (v: string[]) => void;
  calculateNodeLabels: (wallId: string) => { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  saveHistory: (nodes: Node[], walls: Wall[], windows?: WindowObj[], doors?: DoorObj[], passages?: PassageObj[], columns?: ColumnObj[]) => void;
  setValidationError: (error: string | null) => void;
  setNodeALabel: (label: 'CW' | 'CCW') => void;
  setNodeBLabel: (label: 'CW' | 'CCW') => void;
}

export function useColumnCrud({
  nodes, walls, windows, doors, passages, columns,
  selectedWallId, selectedColumnId, setSelectedColumnId, setSelectedWallId,
  columnJoinMode, setColumnJoinMode, columnsToJoin, setColumnsToJoin,
  calculateNodeLabels, saveHistory, setValidationError,
  setNodeALabel, setNodeBLabel,
}: UseColumnCrudParams) {
  const [showColumnPrompt, setShowColumnPrompt] = useState(false);
  const [columnWidth, setColumnWidth] = useState('0.3');
  const [columnDepth, setColumnDepth] = useState('0.3');
  const [columnDistanceToCW, setColumnDistanceToCW] = useState('');
  const [columnDistanceToCCW, setColumnDistanceToCCW] = useState('');
  const [columnDistanceType, setColumnDistanceType] = useState<'cw' | 'ccw'>('cw');
  const [columnInset, setColumnInset] = useState('0');
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [pendingColumnWallId, setPendingColumnWallId] = useState<string | null>(null);

  const handlePlaceColumn = () => {
    if (!pendingColumnWallId) return;

    const width = parseFloat(columnWidth);
    const depth = parseFloat(columnDepth);
    const inset = parseFloat(columnInset) || 0;

    if (isNaN(width) || width <= 0) { setValidationError('Please enter a valid width (> 0m)'); return; }
    if (isNaN(depth) || depth <= 0) { setValidationError('Please enter a valid depth (> 0m)'); return; }
    if (isNaN(inset) || inset < 0) { setValidationError('Please enter a valid inset (>= 0m)'); return; }

    const wall = walls.find(w => w.id === pendingColumnWallId);
    if (!wall) return;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;

    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);

    let position = 0.5;
    let distanceToCW = 0;
    let distanceToCCW = 0;

    if (columnDistanceType === 'cw') {
      const dist = parseFloat(columnDistanceToCW);
      if (isNaN(dist) || dist < 0) { setValidationError('Please enter a valid distance (>= 0m)'); return; }
      if (dist + width > (wallLength / 100)) {
        setValidationError(`Column doesn't fit: distance (${dist.toFixed(3)}m) + width (${width.toFixed(3)}m) exceeds wall length (${(wallLength / 100).toFixed(3)}m)`);
        return;
      }
      const centerOffset = dist + (width / 2);
      position = (centerOffset * 100) / wallLength;
      distanceToCW = dist;
      distanceToCCW = (wallLength / 100) - dist - width;
    } else {
      const dist = parseFloat(columnDistanceToCCW);
      if (isNaN(dist) || dist < 0) { setValidationError('Please enter a valid distance (>= 0m)'); return; }
      if (dist + width > (wallLength / 100)) {
        setValidationError(`Column doesn't fit: distance (${dist.toFixed(3)}m) + width (${width.toFixed(3)}m) exceeds wall length (${(wallLength / 100).toFixed(3)}m)`);
        return;
      }
      const centerOffset = dist + (width / 2);
      position = 1 - ((centerOffset * 100) / wallLength);
      distanceToCCW = dist;
      distanceToCW = (wallLength / 100) - dist - width;
    }

    if (editingColumnId) {
      const updatedColumns = columns.map(c =>
        c.id === editingColumnId
          ? { ...c, wallId: pendingColumnWallId, position, distanceToCW, distanceToCCW, width, depth, inset }
          : c
      );
      saveHistory(nodes, walls, windows, doors, passages, updatedColumns);
      setEditingColumnId(null);
    } else {
      const newColumn: ColumnObj = {
        id: `column-${Date.now()}`,
        wallId: pendingColumnWallId,
        position, distanceToCW, distanceToCCW, width, depth, inset,
      };
      saveHistory(nodes, walls, windows, doors, passages, [...columns, newColumn]);
    }

    setShowColumnPrompt(false);
    setValidationError(null);
    setPendingColumnWallId(null);
  };

  const handleEditColumn = () => {
    if (!selectedColumnId) return;
    const column = columns.find(c => c.id === selectedColumnId);
    if (!column) return;

    const labels = calculateNodeLabels(column.wallId);
    setNodeALabel(labels.nodeALabel);
    setNodeBLabel(labels.nodeBLabel);

    setColumnWidth(column.width.toString());
    setColumnDepth(column.depth.toString());
    setColumnDistanceToCW(column.distanceToCW.toFixed(3));
    setColumnDistanceToCCW(column.distanceToCCW.toFixed(3));
    const useCW = column.distanceToCW <= column.distanceToCCW;
    setColumnDistanceType(useCW ? 'cw' : 'ccw');
    setColumnInset((column.inset ?? 0).toString());

    setPendingColumnWallId(column.wallId);
    setEditingColumnId(column.id);
    setShowColumnPrompt(true);
  };

  const handleAddOrEditColumn = () => {
    if (selectedColumnId) { handleEditColumn(); return; }
    if (selectedWallId) {
      const labels = calculateNodeLabels(selectedWallId);
      setNodeALabel(labels.nodeALabel);
      setNodeBLabel(labels.nodeBLabel);

      setPendingColumnWallId(selectedWallId);
      setColumnWidth('0.3');
      setColumnDepth('0.3');
      setColumnDistanceToCW('');
      setColumnDistanceToCCW('');
      setColumnDistanceType(labels.nodeALabel === 'CCW' ? 'cw' : 'ccw');
      setColumnInset('0');
      setEditingColumnId(null);
      setShowColumnPrompt(true);
    }
  };

  const handleDeleteColumn = () => {
    if (!selectedColumnId) return;
    const newColumns = columns.filter(c => c.id !== selectedColumnId);
    saveHistory(nodes, walls, windows, doors, passages, newColumns);
    setSelectedColumnId(null);
    setShowColumnPrompt(false);
  };

  const handleStartColumnJoin = () => {
    setColumnJoinMode(true);
    setColumnsToJoin([]);
    setSelectedColumnId(null);
    setSelectedWallId(null);
  };

  const handleCancelColumnJoin = () => {
    setColumnJoinMode(false);
    setColumnsToJoin([]);
  };

  const handleJoinColumns = () => {
    if (columnsToJoin.length < 2) return;

    const colsToJoin = columns.filter(c => columnsToJoin.includes(c.id));
    if (colsToJoin.length < 2) return;

    const wallId = colsToJoin[0].wallId;
    if (!colsToJoin.every(c => c.wallId === wallId)) {
      setValidationError('All columns must be on the same wall to merge');
      return;
    }

    const wall = walls.find(w => w.id === wallId);
    if (!wall) return;
    const nA = nodes.find(n => n.id === wall.nodeA);
    const nB = nodes.find(n => n.id === wall.nodeB);
    if (!nA || !nB) return;

    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);

    const sortedCols = [...colsToJoin].sort((a, b) => a.position - b.position);

    let minEdge = Infinity;
    let maxDepth = -Infinity;
    let maxInset = 0;

    for (const col of sortedCols) {
      const centerCm = col.position * wallLength;
      const widthCm = col.width * 100;
      const leftEdge = centerCm - (widthCm / 2);
      minEdge = Math.min(minEdge, leftEdge);
      maxDepth = Math.max(maxDepth, col.depth);
      maxInset = Math.max(maxInset, col.inset ?? 0);
    }

    let currentPosition = minEdge;
    const mergedShapes: Array<{ centerCm: number; width: number; depth: number }> = [];

    for (const col of sortedCols) {
      const widthCm = col.width * 100;

      if (col.mergedShapes && col.mergedShapes.length > 0) {
        for (const shape of col.mergedShapes) {
          const shapeWidthCm = shape.width * 100;
          const shapeCenterCm = currentPosition + (shapeWidthCm / 2);
          mergedShapes.push({ centerCm: shapeCenterCm, width: shape.width, depth: shape.depth });
          currentPosition += shapeWidthCm;
        }
      } else {
        const colCenterCm = currentPosition + (widthCm / 2);
        mergedShapes.push({ centerCm: colCenterCm, width: col.width, depth: col.depth });
        currentPosition += widthCm;
      }
    }

    const totalWidthCm = currentPosition - minEdge;
    const newWidth = totalWidthCm / 100;
    const newCenterCm = minEdge + (totalWidthCm / 2);
    const newPosition = newCenterCm / wallLength;
    const newDepth = maxDepth;

    const centerDistFromA = newCenterCm / 100;
    const distanceToCW = centerDistFromA - (newWidth / 2);
    const distanceToCCW = (wallLength / 100) - centerDistFromA - (newWidth / 2);

    const mergedShapesRelative = mergedShapes.map(shape => ({
      relativePosition: shape.centerCm - newCenterCm,
      width: shape.width,
      depth: shape.depth,
    }));

    const mergedColumn: ColumnObj = {
      id: `column-${Date.now()}`,
      wallId,
      position: newPosition,
      distanceToCW, distanceToCCW,
      width: newWidth, depth: newDepth,
      inset: maxInset,
      mergedShapes: mergedShapesRelative,
    };

    const newColumns = columns.filter(c => !columnsToJoin.includes(c.id));
    newColumns.push(mergedColumn);
    saveHistory(nodes, walls, windows, doors, passages, newColumns);

    setColumnJoinMode(false);
    setColumnsToJoin([]);
    setValidationError(null);
  };

  return {
    handlePlaceColumn,
    handleAddOrEditColumn,
    handleDeleteColumn,
    handleStartColumnJoin,
    handleCancelColumnJoin,
    handleJoinColumns,
    showColumnPrompt,
    pendingColumnWallId,
    editingColumnId,
    columnDialogProps: {
      visible: showColumnPrompt && !!pendingColumnWallId && !!walls.find(w => w.id === pendingColumnWallId),
      wallId: pendingColumnWallId,
      wallLength: walls.find(w => w.id === pendingColumnWallId)?.length ?? 0,
      editingColumnId,
      editingColumn: editingColumnId ? columns.find(c => c.id === editingColumnId) ?? null : null,
      columnWidth,
      columnDepth,
      columnInset,
      distanceType: columnDistanceType,
      distanceToCW: columnDistanceToCW,
      distanceToCCW: columnDistanceToCCW,
      onWidthChange: setColumnWidth,
      onDepthChange: setColumnDepth,
      onInsetChange: setColumnInset,
      onDistanceTypeChange: setColumnDistanceType,
      onDistanceToCWChange: setColumnDistanceToCW,
      onDistanceToCCWChange: setColumnDistanceToCCW,
      onSubmit: handlePlaceColumn,
      onCancel: () => { setShowColumnPrompt(false); setValidationError(null); setPendingColumnWallId(null); setEditingColumnId(null); },
    },
    // Expose for touch handler column-tap-to-add shortcut
    setPendingColumnWallId,
    setColumnWidth,
    setColumnDepth,
    setColumnDistanceToCW,
    setColumnDistanceToCCW,
    setColumnDistanceType,
    setColumnInset,
    setEditingColumnId,
    setShowColumnPrompt,
  };
}