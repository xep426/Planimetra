import { useState } from 'react';
import type { Node, Wall, WindowObj } from '../types';

interface UseWindowCrudParams {
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  selectedWallId: string | null;
  selectedWindowId: string | null;
  setSelectedWindowId: (id: string | null) => void;
  calculateNodeLabels: (wallId: string) => { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  saveHistory: (nodes: Node[], walls: Wall[], windows?: WindowObj[]) => void;
  setValidationError: (error: string | null) => void;
  setNodeALabel: (label: 'CW' | 'CCW') => void;
  setNodeBLabel: (label: 'CW' | 'CCW') => void;
}

export function useWindowCrud({
  nodes, walls, windows,
  selectedWallId, selectedWindowId, setSelectedWindowId,
  calculateNodeLabels, saveHistory, setValidationError,
  setNodeALabel, setNodeBLabel,
}: UseWindowCrudParams) {
  const [showWindowPrompt, setShowWindowPrompt] = useState(false);
  const [windowWallId, setWindowWallId] = useState<string | null>(null);
  const [windowPanelCount, setWindowPanelCount] = useState<'single' | 'double'>('single');
  const [windowType, setWindowType] = useState<'standard' | 'floor-to-ceiling'>('standard');
  const [windowOpening, setWindowOpening] = useState<'fixed' | 'inward' | 'outward'>('inward');
  const [windowWidth, setWindowWidth] = useState('1.2');
  const [windowHeight, setWindowHeight] = useState('1.4');
  const [windowSetback, setWindowSetback] = useState('');
  const [windowFromNodeA, setWindowFromNodeA] = useState(true);
  const [windowHinge, setWindowHinge] = useState<'left' | 'right' | 'center'>('left');
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null);

  const handleWindowSubmit = () => {
    if (!windowWallId) { setShowWindowPrompt(false); return; }

    const wall = walls.find(w => w.id === windowWallId);
    if (!wall) { setShowWindowPrompt(false); return; }

    const setback = parseFloat(windowSetback.replace(',', '.'));
    const width = parseFloat(windowWidth.replace(',', '.'));
    const height = parseFloat(windowHeight.replace(',', '.'));

    if (isNaN(setback) || setback < 0) { setValidationError('Please enter a valid setback (\u2265 0)'); return; }
    if (isNaN(width) || width <= 0) { setValidationError('Please enter a valid width (> 0)'); return; }
    if (isNaN(height) || height <= 0) { setValidationError('Please enter a valid height (> 0)'); return; }
    if (setback + width > wall.length) {
      setValidationError(`Window doesn't fit: setback (${setback.toFixed(3)}m) + width (${width.toFixed(3)}m) exceeds wall length (${wall.length.toFixed(3)}m)`);
      return;
    }

    const centerOffset = setback + (width / 2);
    const position = windowFromNodeA ? centerOffset / wall.length : 1 - (centerOffset / wall.length);

    if (editingWindowId) {
      const newWindows = windows.map(w =>
        w.id === editingWindowId
          ? { ...w, wallId: windowWallId, position, setback, fromNodeA: windowFromNodeA,
              panelCount: windowPanelCount, type: windowType, opening: windowOpening, width, height, hinge: windowHinge }
          : w
      );
      saveHistory(nodes, walls, newWindows);
      setEditingWindowId(null);
      setSelectedWindowId(null);
    } else {
      const newWindow: WindowObj = {
        id: `win-${Date.now()}`,
        wallId: windowWallId,
        position, setback, fromNodeA: windowFromNodeA,
        panelCount: windowPanelCount, type: windowType, opening: windowOpening,
        width, height, hinge: windowHinge,
      };
      saveHistory(nodes, walls, [...windows, newWindow]);
    }

    setShowWindowPrompt(false);
    setValidationError(null);
    setWindowWallId(null);
  };

  const handleEditWindow = () => {
    if (!selectedWindowId) return;
    const win = windows.find(w => w.id === selectedWindowId);
    if (!win) return;

    const labels = calculateNodeLabels(win.wallId);
    setNodeALabel(labels.nodeALabel);
    setNodeBLabel(labels.nodeBLabel);
    setWindowWallId(win.wallId);
    setWindowPanelCount(win.panelCount);
    setWindowType(win.type);
    setWindowOpening(win.opening);
    setWindowWidth(win.width.toString());
    setWindowHeight(win.height.toString());
    setWindowSetback(win.setback.toFixed(3));
    setWindowFromNodeA(win.fromNodeA);
    setWindowHinge(win.hinge ?? 'left');
    setEditingWindowId(win.id);
    setShowWindowPrompt(true);
  };

  const handleAddOrEditWindow = () => {
    if (selectedWindowId) { handleEditWindow(); return; }
    if (selectedWallId) {
      const labels = calculateNodeLabels(selectedWallId);
      setNodeALabel(labels.nodeALabel);
      setNodeBLabel(labels.nodeBLabel);
      setWindowWallId(selectedWallId);
      setWindowSetback('');
      setWindowFromNodeA(labels.nodeALabel === 'CCW');
      setEditingWindowId(null);
      setShowWindowPrompt(true);
    }
  };

  const handleDeleteWindow = () => {
    if (!selectedWindowId) return;
    const newWindows = windows.filter(w => w.id !== selectedWindowId);
    saveHistory(nodes, walls, newWindows);
    setSelectedWindowId(null);
    setShowWindowPrompt(false);
  };

  return {
    handleWindowSubmit,
    handleAddOrEditWindow,
    handleDeleteWindow,
    windowDialogProps: {
      visible: showWindowPrompt && !!windowWallId && !!walls.find(w => w.id === windowWallId),
      wallId: windowWallId,
      wallLength: walls.find(w => w.id === windowWallId)?.length ?? 0,
      editingWindowId,
      panelCount: windowPanelCount,
      windowType,
      opening: windowOpening,
      width: windowWidth,
      height: windowHeight,
      setback: windowSetback,
      fromNodeA: windowFromNodeA,
      hinge: windowHinge,
      onPanelCountChange: setWindowPanelCount,
      onTypeChange: setWindowType,
      onOpeningChange: setWindowOpening,
      onWidthChange: setWindowWidth,
      onHeightChange: setWindowHeight,
      onSetbackChange: setWindowSetback,
      onFromNodeAChange: setWindowFromNodeA,
      onHingeChange: setWindowHinge,
      onSubmit: handleWindowSubmit,
      onCancel: () => { setShowWindowPrompt(false); setValidationError(null); setWindowWallId(null); setEditingWindowId(null); },
    },
  };
}