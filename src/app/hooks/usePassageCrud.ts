import { useState } from 'react';
import type { Node, Wall, WindowObj, DoorObj, PassageObj } from '../types';

interface UsePassageCrudParams {
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  selectedWallId: string | null;
  selectedPassageId: string | null;
  setSelectedPassageId: (id: string | null) => void;
  calculateNodeLabels: (wallId: string) => { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  saveHistory: (nodes: Node[], walls: Wall[], windows?: WindowObj[], doors?: DoorObj[], passages?: PassageObj[]) => void;
  setValidationError: (error: string | null) => void;
  setNodeALabel: (label: 'CW' | 'CCW') => void;
  setNodeBLabel: (label: 'CW' | 'CCW') => void;
}

export function usePassageCrud({
  nodes, walls, windows, doors, passages,
  selectedWallId, selectedPassageId, setSelectedPassageId,
  calculateNodeLabels, saveHistory, setValidationError,
  setNodeALabel, setNodeBLabel,
}: UsePassageCrudParams) {
  const [showPassagePrompt, setShowPassagePrompt] = useState(false);
  const [passageWallId, setPassageWallId] = useState<string | null>(null);
  const [passageWidth, setPassageWidth] = useState('1.2');
  const [passageOffset, setPassageOffset] = useState('');
  const [passageFromNodeA, setPassageFromNodeA] = useState(true);
  const [editingPassageId, setEditingPassageId] = useState<string | null>(null);

  const handlePlacePassage = () => {
    if (!passageWallId) return;

    const offset = parseFloat(passageOffset);
    const width = parseFloat(passageWidth);

    if (isNaN(offset) || offset < 0) { setValidationError('Please enter a valid offset (\u2265 0m)'); return; }
    if (isNaN(width) || width <= 0) { setValidationError('Please enter a valid width (> 0m)'); return; }

    const wall = walls.find(w => w.id === passageWallId);
    if (!wall) return;

    if (offset + width > wall.length) {
      setValidationError(`Passage doesn't fit: offset (${offset.toFixed(3)}m) + width (${width.toFixed(3)}m) exceeds wall length (${wall.length.toFixed(3)}m)`);
      return;
    }

    const centerOffset = passageFromNodeA ? offset + (width / 2) : offset + (width / 2);
    const position = passageFromNodeA ? centerOffset / wall.length : 1 - (centerOffset / wall.length);

    if (editingPassageId) {
      const updatedPassages = passages.map(p =>
        p.id === editingPassageId
          ? { ...p, wallId: passageWallId, position, offset, fromNodeA: passageFromNodeA, width }
          : p
      );
      saveHistory(nodes, walls, windows, doors, updatedPassages);
      setEditingPassageId(null);
    } else {
      const newPassage: PassageObj = {
        id: `passage-${Date.now()}`,
        wallId: passageWallId,
        position, offset, fromNodeA: passageFromNodeA, width,
      };
      saveHistory(nodes, walls, windows, doors, [...passages, newPassage]);
    }

    setShowPassagePrompt(false);
    setValidationError(null);
    setPassageWallId(null);
  };

  const handleEditPassage = () => {
    if (!selectedPassageId) return;
    const passage = passages.find(p => p.id === selectedPassageId);
    if (!passage) return;

    const labels = calculateNodeLabels(passage.wallId);
    setNodeALabel(labels.nodeALabel);
    setNodeBLabel(labels.nodeBLabel);
    setPassageWallId(passage.wallId);
    setPassageWidth(passage.width.toString());
    setPassageOffset(passage.offset.toFixed(3));
    setPassageFromNodeA(passage.fromNodeA);
    setEditingPassageId(passage.id);
    setShowPassagePrompt(true);
  };

  const handleAddOrEditPassage = () => {
    if (selectedPassageId) { handleEditPassage(); return; }
    if (selectedWallId) {
      const labels = calculateNodeLabels(selectedWallId);
      setNodeALabel(labels.nodeALabel);
      setNodeBLabel(labels.nodeBLabel);
      setPassageWallId(selectedWallId);
      setPassageOffset('');
      setPassageFromNodeA(labels.nodeALabel === 'CCW');
      setEditingPassageId(null);
      setShowPassagePrompt(true);
    }
  };

  const handleDeletePassage = () => {
    if (!selectedPassageId) return;
    const newPassages = passages.filter(p => p.id !== selectedPassageId);
    saveHistory(nodes, walls, windows, doors, newPassages);
    setSelectedPassageId(null);
    setShowPassagePrompt(false);
  };

  return {
    handlePlacePassage,
    handleAddOrEditPassage,
    handleDeletePassage,
    passageDialogProps: {
      visible: showPassagePrompt && !!passageWallId && !!walls.find(w => w.id === passageWallId),
      wallId: passageWallId,
      wallLength: walls.find(w => w.id === passageWallId)?.length ?? 0,
      editingPassageId,
      width: passageWidth,
      offset: passageOffset,
      fromNodeA: passageFromNodeA,
      onWidthChange: setPassageWidth,
      onOffsetChange: setPassageOffset,
      onFromNodeAChange: setPassageFromNodeA,
      onSubmit: handlePlacePassage,
      onCancel: () => { setShowPassagePrompt(false); setValidationError(null); setPassageWallId(null); setEditingPassageId(null); },
    },
  };
}