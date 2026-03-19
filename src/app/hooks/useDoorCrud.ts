import { useState } from 'react';
import type { Node, Wall, WindowObj, DoorObj } from '../types';

interface UseDoorCrudParams {
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  selectedWallId: string | null;
  selectedDoorId: string | null;
  setSelectedDoorId: (id: string | null) => void;
  calculateNodeLabels: (wallId: string) => { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  saveHistory: (nodes: Node[], walls: Wall[], windows?: WindowObj[], doors?: DoorObj[]) => void;
  setValidationError: (error: string | null) => void;
  setNodeALabel: (label: 'CW' | 'CCW') => void;
  setNodeBLabel: (label: 'CW' | 'CCW') => void;
}

export function useDoorCrud({
  nodes, walls, windows, doors,
  selectedWallId, selectedDoorId, setSelectedDoorId,
  calculateNodeLabels, saveHistory, setValidationError,
  setNodeALabel, setNodeBLabel,
}: UseDoorCrudParams) {
  const [showDoorPrompt, setShowDoorPrompt] = useState(false);
  const [doorWallId, setDoorWallId] = useState<string | null>(null);
  const [doorWidth, setDoorWidth] = useState('0.9');
  const [doorHeight, setDoorHeight] = useState('2.1');
  const [doorOpening, setDoorOpening] = useState<'inward' | 'outward'>('inward');
  const [doorSetback, setDoorSetback] = useState('');
  const [doorFromNodeA, setDoorFromNodeA] = useState(true);
  const [doorHinge, setDoorHinge] = useState<'left' | 'right'>('left');
  const [editingDoorId, setEditingDoorId] = useState<string | null>(null);

  const handlePlaceDoor = () => {
    if (!doorWallId) return;

    const setback = parseFloat(doorSetback);
    const width = parseFloat(doorWidth);
    const height = parseFloat(doorHeight);

    if (isNaN(setback) || setback < 0) { setValidationError('Please enter a valid setback (\u2265 0m)'); return; }
    if (isNaN(width) || width <= 0) { setValidationError('Please enter a valid width (> 0m)'); return; }
    if (isNaN(height) || height <= 0) { setValidationError('Please enter a valid height (> 0m)'); return; }

    const wall = walls.find(w => w.id === doorWallId);
    if (!wall) return;

    if (setback + width > wall.length) {
      setValidationError(`Door doesn't fit: setback (${setback.toFixed(3)}m) + width (${width.toFixed(3)}m) exceeds wall length (${wall.length.toFixed(3)}m)`);
      return;
    }

    const centerOffset = setback + (width / 2);
    const position = doorFromNodeA ? centerOffset / wall.length : 1 - (centerOffset / wall.length);

    if (editingDoorId) {
      const updatedDoors = doors.map(d =>
        d.id === editingDoorId
          ? { ...d, wallId: doorWallId, position, setback, fromNodeA: doorFromNodeA, width, height, opening: doorOpening, hinge: doorHinge }
          : d
      );
      saveHistory(nodes, walls, windows, updatedDoors);
      setEditingDoorId(null);
    } else {
      const newDoor: DoorObj = {
        id: `door-${Date.now()}`,
        wallId: doorWallId,
        position, setback, fromNodeA: doorFromNodeA,
        width, height, opening: doorOpening, hinge: doorHinge,
      };
      saveHistory(nodes, walls, windows, [...doors, newDoor]);
    }

    setShowDoorPrompt(false);
    setValidationError(null);
    setDoorWallId(null);
  };

  const handleEditDoor = () => {
    if (!selectedDoorId) return;
    const door = doors.find(d => d.id === selectedDoorId);
    if (!door) return;

    const labels = calculateNodeLabels(door.wallId);
    setNodeALabel(labels.nodeALabel);
    setNodeBLabel(labels.nodeBLabel);
    setDoorWallId(door.wallId);
    setDoorWidth(door.width.toString());
    setDoorHeight(door.height.toString());
    setDoorOpening(door.opening);
    setDoorSetback(door.setback.toFixed(3));
    setDoorFromNodeA(door.fromNodeA);
    setDoorHinge(door.hinge ?? 'left');
    setEditingDoorId(door.id);
    setShowDoorPrompt(true);
  };

  const handleAddOrEditDoor = () => {
    if (selectedDoorId) { handleEditDoor(); return; }
    if (selectedWallId) {
      const labels = calculateNodeLabels(selectedWallId);
      setNodeALabel(labels.nodeALabel);
      setNodeBLabel(labels.nodeBLabel);
      setDoorWallId(selectedWallId);
      setDoorSetback('');
      setDoorFromNodeA(labels.nodeALabel === 'CCW');
      setEditingDoorId(null);
      setShowDoorPrompt(true);
    }
  };

  const handleDeleteDoor = () => {
    if (!selectedDoorId) return;
    const newDoors = doors.filter(d => d.id !== selectedDoorId);
    saveHistory(nodes, walls, windows, newDoors);
    setSelectedDoorId(null);
    setShowDoorPrompt(false);
  };

  return {
    handlePlaceDoor,
    handleAddOrEditDoor,
    handleDeleteDoor,
    doorDialogProps: {
      visible: showDoorPrompt && !!doorWallId && !!walls.find(w => w.id === doorWallId),
      wallId: doorWallId,
      wallLength: walls.find(w => w.id === doorWallId)?.length ?? 0,
      editingDoorId,
      width: doorWidth,
      height: doorHeight,
      opening: doorOpening,
      setback: doorSetback,
      fromNodeA: doorFromNodeA,
      hinge: doorHinge,
      onWidthChange: setDoorWidth,
      onHeightChange: setDoorHeight,
      onOpeningChange: setDoorOpening,
      onSetbackChange: setDoorSetback,
      onFromNodeAChange: setDoorFromNodeA,
      onHingeChange: setDoorHinge,
      onSubmit: handlePlaceDoor,
      onCancel: () => { setShowDoorPrompt(false); setValidationError(null); setDoorWallId(null); setEditingDoorId(null); },
    },
  };
}