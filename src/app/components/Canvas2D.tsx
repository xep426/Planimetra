import { useEffect, useMemo, useRef } from 'react';
// Canvas2D — orchestration shell for 2D floor plan sketch
import { exportToDXF as dxfExport } from '../utils/dxfExport';
import type {
  Node, Wall, WindowObj, DoorObj,
  PassageObj, ColumnObj, LabelBounds, HistoryEntry,
} from '../types';
import {
  screenToWorld as screenToWorldUtil, snapToGrid as snapToGridUtil,
  validateGeometry
} from '../utils/geometry';
import {
  findNodeAt as findNodeAtUtil, nodeConnections as nodeConnectionsUtil,
  findNearbyNode as findNearbyNodeUtil, findWallAt as findWallAtUtil,
  findWindowAt as findWindowAtUtil, findDoorAt as findDoorAtUtil,
  findPassageAt as findPassageAtUtil, findColumnAt as findColumnAtUtil,
  findLabelAt as findLabelAtUtil
} from '../utils/hitTesting';
import {
  snapDirection as snapDirectionUtil,
  isLoopClosed as isLoopClosedUtil, calculateNodeLabels as calculateNodeLabelsUtil
} from '../utils/wallGeometry';
import {
  detectOpenLoop as detectOpenLoopUtil, findChain as findChainUtil,
  solveClosedLoop as solveClosedLoopUtil
} from '../utils/solver';
import {
  WallLengthDialog, CloseLoopDialog, WindowDialog, DoorDialog,
  PassageDialog, ColumnDialog, WallEditDialog, WallDeleteConfirmDialog,
} from './dialogs';
import { LayersDropdown, AppMenu, ActionBar, RightPanel } from './toolbar';
import {
  type DrawContext, drawGrid, drawNodes, drawWalls, drawWallLabels, drawWindows,
  drawDoors, drawPassages, drawColumns, drawPreviewLine, drawRoomLabel, drawSetbackIndicators,
} from '../rendering';
import {
  useWindowCrud, useDoorCrud, usePassageCrud, useColumnCrud, useWallCrud,
  useGestures, useFloorPlanReducer, useProjectManager,
} from '../hooks';

export function Canvas2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawSceneRef = useRef<((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void) | null>(null);
  const labelBoundsRef = useRef<LabelBounds[]>([]);

  // ---- Centralised state (Phase 6) ------------------------------------------

  const {
    state, dispatch,
    setTransform, setNodes, setWalls, setWindows, setDoors, setPassages, setColumns,
    setPreviewLine, setShowLengthPrompt, setPendingConnection,
    setLengthInput, setSelectedWallId, setSelectedTool,
    setShowCloseLoopPrompt, setCloseLoopLength, setOpenLoopEndpoints,
    setValidationError, setNodeConstraints,
    setMenuOpen, setLayerOpen,
    setSelectedWindowId, setSelectedDoorId, setSelectedPassageId, setSelectedColumnId,
    setColumnJoinMode, setColumnsToJoin,
    setNodeALabel, setNodeBLabel,
  } = useFloorPlanReducer();

  const {
    transform, nodes, walls, windows, doors, passages, columns,
    history, historyIndex,
    selectedTool, selectedWallId, selectedWindowId, selectedDoorId,
    selectedPassageId, selectedColumnId,
    columnJoinMode, columnsToJoin,
    previewLine, snapToGridEnabled, nodeConstraints,
    showLengthPrompt, pendingConnection, lengthInput,
    showCloseLoopPrompt, closeLoopLength, openLoopEndpoints,
    validationError,
    menuOpen, layerOpen,
    nodeALabel, nodeBLabel,
  } = state;

  // ---- Project / Room management (hook) -------------------------------------

  const {
    projectName, setProjectName,
    rooms, activeRoomId,
    panelOpen, setPanelOpen,
    getRoomsWithCurrent,
    handleSwitchRoom, handleAddRoom, handleRenameRoom, handleDeleteRoom,
    handleSaveProject, handleLoadProject, handleClearAll,
  } = useProjectManager({
    nodes, walls, windows, doors, passages, columns,
    history, historyIndex, transform, nodeConstraints, selectedTool,
    dispatch,
  });

  // ---- resize ----------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) requestAnimationFrame(() => drawSceneRef.current?.(ctx, canvas));
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- draw ------------------------------------------------------------------

  const wallInteriorSign = useMemo(() => {
    const signMap = new Map<string, number>();
    if (walls.length < 3) return signMap;

    const orderedTraversal: Array<{wall: typeof walls[0], fromId: string, toId: string}> = [];
    const visitedWalls = new Set<string>();
    const firstWall = walls[0];
    let currentNodeId = firstWall.nodeA;

    while (visitedWalls.size < walls.length) {
      const nextWall = walls.find(w =>
        !visitedWalls.has(w.id) && (w.nodeA === currentNodeId || w.nodeB === currentNodeId)
      );
      if (!nextWall) break;
      const fromId = currentNodeId;
      const toId = nextWall.nodeA === currentNodeId ? nextWall.nodeB : nextWall.nodeA;
      orderedTraversal.push({ wall: nextWall, fromId, toId });
      visitedWalls.add(nextWall.id);
      currentNodeId = toId;
      if (currentNodeId === firstWall.nodeA) break;
    }

    let signedArea = 0;
    const ordNodes = orderedTraversal.map(t => nodes.find(n => n.id === t.fromId)!).filter(Boolean);
    for (let i = 0; i < ordNodes.length; i++) {
      const curr = ordNodes[i];
      const next = ordNodes[(i + 1) % ordNodes.length];
      signedArea += (next.x - curr.x) * (next.y + curr.y);
    }
    const isCW = signedArea < 0;

    orderedTraversal.forEach(({ wall, fromId }) => {
      const traversalFollowsAB = fromId === wall.nodeA;
      signMap.set(wall.id, isCW === traversalFollowsAB ? 1 : -1);
    });

    return signMap;
  }, [nodes, walls]);

  // ---- coordinate helpers (delegating to extracted utils) --------------------

  const screenToWorld = (sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return screenToWorldUtil(sx, sy, canvas.width, canvas.height, transform);
  };

  const snapToGrid = (x: number, y: number) => snapToGridUtil(x, y);

  const snapped = (wx: number, wy: number) =>
    snapToGridEnabled ? snapToGrid(wx, wy) : { x: wx, y: wy };

  // ---- node helpers ---------------------------------------------------------

  const findNodeAt = (wx: number, wy: number) =>
    findNodeAtUtil(wx, wy, nodes, transform.scale);

  const nodeConnections = (id: string) =>
    nodeConnectionsUtil(id, walls);

  const findNearbyNode = (wx: number, wy: number, excludeId: string) =>
    findNearbyNodeUtil(wx, wy, excludeId, nodes, walls, transform.scale);

  // ---- wall/object helpers --------------------------------------------------

  const findWallAt = (wx: number, wy: number) =>
    findWallAtUtil(wx, wy, nodes, walls, transform.scale);

  const findWindowAt = (wx: number, wy: number) =>
    findWindowAtUtil(wx, wy, windows, walls, nodes, transform.scale);

  const findDoorAt = (wx: number, wy: number) =>
    findDoorAtUtil(wx, wy, doors, walls, nodes, transform.scale);

  const findPassageAt = (wx: number, wy: number) =>
    findPassageAtUtil(wx, wy, passages, walls, nodes, transform.scale);

  const findColumnAt = (wx: number, wy: number) =>
    findColumnAtUtil(wx, wy, columns, walls, nodes, transform.scale);

  const findLabelAt = (wx: number, wy: number) =>
    findLabelAtUtil(wx, wy, labelBoundsRef.current);

  // ---- angle helpers --------------------------------------------------------

  const snapDirection = (fx: number, fy: number, tx: number, ty: number, refId?: string) =>
    snapDirectionUtil(fx, fy, tx, ty, refId, walls, nodes);

  // ---- history (dispatch-based) ---------------------------------------------

  const saveHistory = (newNodes: Node[], newWalls: Wall[], newWindows?: WindowObj[], newDoors?: DoorObj[], newPassages?: PassageObj[], newColumns?: ColumnObj[]) => {
    dispatch({
      type: 'SAVE_HISTORY',
      nodes: newNodes, walls: newWalls,
      windows: newWindows, doors: newDoors,
      passages: newPassages, columns: newColumns,
    });
  };

  const handleUndo = () => dispatch({ type: 'UNDO' });
  const handleRedo = () => dispatch({ type: 'REDO' });

  // ---- undo/redo action labels (computed by diffing history entries) ----------

  const describeHistoryChange = (prev: HistoryEntry, curr: HistoryEntry): string => {
    if (curr.walls.length > prev.walls.length) return 'Add Wall';
    if (curr.walls.length < prev.walls.length) return 'Delete Wall';
    if (curr.windows.length > prev.windows.length) return 'Add Window';
    if (curr.windows.length < prev.windows.length) return 'Delete Window';
    if (curr.doors.length > prev.doors.length) return 'Add Door';
    if (curr.doors.length < prev.doors.length) return 'Delete Door';
    if (curr.passages.length > prev.passages.length) return 'Add Passage';
    if (curr.passages.length < prev.passages.length) return 'Delete Passage';
    if (curr.columns.length > prev.columns.length) return 'Add Column';
    if (curr.columns.length < prev.columns.length) {
      // Detect merge: column count decreased but a merged column appeared
      const hasMergedNew = curr.columns.some(c => c.mergedShapes && c.mergedShapes.length > 0 &&
        !prev.columns.some(p => p.id === c.id && p.mergedShapes && p.mergedShapes.length > 0));
      return hasMergedNew ? 'Merge Columns' : 'Delete Column';
    }
    // Same counts — check for edits
    const wallsChanged = curr.walls.some((w, i) => {
      const p = prev.walls[i]; return !p || w.length !== p.length || w.thickness !== p.thickness || w.type !== p.type;
    });
    if (wallsChanged) return 'Edit Wall';
    const winsChanged = curr.windows.some((w, i) => {
      const p = prev.windows[i]; return !p || w.width !== p.width || w.height !== p.height || w.position !== p.position;
    });
    if (winsChanged) return 'Edit Window';
    const doorsChanged = curr.doors.some((d, i) => {
      const p = prev.doors[i]; return !p || d.width !== p.width || d.height !== p.height || d.position !== p.position;
    });
    if (doorsChanged) return 'Edit Door';
    const passChanged = curr.passages.some((pa, i) => {
      const p = prev.passages[i]; return !p || pa.width !== p.width || pa.position !== p.position;
    });
    if (passChanged) return 'Edit Passage';
    const colsChanged = curr.columns.some((c, i) => {
      const p = prev.columns[i]; return !p || c.width !== p.width || c.depth !== p.depth || c.position !== p.position;
    });
    if (colsChanged) return 'Edit Column';
    return 'Change';
  };

  const undoLabel = useMemo(() => {
    if (historyIndex <= 0) return '';
    return describeHistoryChange(history[historyIndex - 1], history[historyIndex]);
  }, [history, historyIndex]);

  const redoLabel = useMemo(() => {
    if (historyIndex >= history.length - 1) return '';
    return describeHistoryChange(history[historyIndex], history[historyIndex + 1]);
  }, [history, historyIndex]);

  // ---- open-loop detection ---------------------------------------------------

  const detectOpenLoop = () => detectOpenLoopUtil(walls, nodes);

  useEffect(() => { setOpenLoopEndpoints(detectOpenLoop()); }, [nodes, walls]);

  const isLoopClosed = () => isLoopClosedUtil(walls);

  // ---- Calculate node direction labels --------------------------------------

  const calculateNodeLabels = (wallId: string) =>
    calculateNodeLabelsUtil(wallId, walls, nodes);

  // ---- Per-layer CRUD hooks (Phase 4) ----------------------------------------

  const { handleAddOrEditWindow, handleDeleteWindow, windowDialogProps } = useWindowCrud({
    nodes, walls, windows,
    selectedWallId, selectedWindowId, setSelectedWindowId,
    calculateNodeLabels, saveHistory, setValidationError,
    setNodeALabel, setNodeBLabel,
  });

  const { handleAddOrEditDoor, handleDeleteDoor, doorDialogProps } = useDoorCrud({
    nodes, walls, windows, doors,
    selectedWallId, selectedDoorId, setSelectedDoorId,
    calculateNodeLabels, saveHistory, setValidationError,
    setNodeALabel, setNodeBLabel,
  });

  const { handleAddOrEditPassage, handleDeletePassage, passageDialogProps } = usePassageCrud({
    nodes, walls, windows, doors, passages,
    selectedWallId, selectedPassageId, setSelectedPassageId,
    calculateNodeLabels, saveHistory, setValidationError,
    setNodeALabel, setNodeBLabel,
  });

  const {
    handleAddOrEditColumn, handleDeleteColumn,
    handleStartColumnJoin, handleCancelColumnJoin, handleJoinColumns,
    columnDialogProps,
    setPendingColumnWallId, setColumnWidth, setColumnDepth,
    setColumnDistanceToCW, setColumnDistanceToCCW, setColumnDistanceType,
    setColumnInset, setEditingColumnId, setShowColumnPrompt,
  } = useColumnCrud({
    nodes, walls, windows, doors, passages, columns,
    selectedWallId, selectedColumnId, setSelectedColumnId, setSelectedWallId,
    columnJoinMode, setColumnJoinMode, columnsToJoin, setColumnsToJoin,
    calculateNodeLabels, saveHistory, setValidationError,
    setNodeALabel, setNodeBLabel,
  });

  const { handleEditWallClick, handleDeleteWallClick, canDeleteSelectedWall, deleteWallDisabledReason, wallEditDialogProps, wallDeleteConfirmProps } = useWallCrud({
    nodes, walls, windows, doors, passages, columns,
    selectedWallId, setSelectedWallId, nodeConstraints,
    saveHistory, setValidationError,
  });

  // ---- node constraint toggle ------------------------------------------------

  const toggleNodeConstraint = (nodeId: string) => {
    dispatch({ type: 'TOGGLE_NODE_CONSTRAINT', nodeId });
  };

  // ---- Gesture hook (Phase 5) ------------------------------------------------

  /** Called when user drags from one open-loop endpoint to the other */
  const handleCloseLoopDrag = (_sourceNodeId: string, _targetNodeId: string) => {
    setCloseLoopLength('');
    setValidationError(null);
    setShowCloseLoopPrompt(true);
  };

  const {
    handleTouchStart, handleTouchMove, handleTouchEnd,
    handleMouseDown, handleMouseMove, handleMouseUp, handleWheel,
    pendingNodeRef,
  } = useGestures({
    canvasRef,
    transform, nodes, walls, columns, previewLine,
    selectedTool, selectedWallId, selectedWindowId, selectedDoorId,
    selectedPassageId, selectedColumnId,
    snapToGridEnabled,
    columnJoinMode, columnsToJoin, labelBoundsRef,
    loopClosed: isLoopClosed(),
    nodeConstraints,
    openLoopEndpoints,
    setTransform, setPreviewLine, setSelectedTool,
    setSelectedWallId, setSelectedWindowId, setSelectedDoorId,
    setSelectedPassageId, setSelectedColumnId,
    setColumnsToJoin, setValidationError,
    setShowLengthPrompt, setPendingConnection,
    setPendingColumnWallId, setColumnWidth, setColumnDepth,
    setColumnDistanceToCW, setColumnDistanceToCCW, setColumnDistanceType,
    setColumnInset, setEditingColumnId, setShowColumnPrompt,
    screenToWorld, snapped, findNodeAt, nodeConnections, findNearbyNode,
    findWallAt, findWindowAt, findDoorAt, findPassageAt, findColumnAt, findLabelAt,
    snapDirection, toggleNodeConstraint,
    saveHistory,
    onCloseLoop: handleCloseLoopDrag,
  });

  // ---- renderScene -----------------------------------------------------------

  const activeRoomName = rooms.find(r => r.id === activeRoomId)?.name ?? 'Room';

  const renderScene = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const labelBoundsArr: LabelBounds[] = [];
    const closeLoopPreview = Boolean(
      previewLine &&
      openLoopEndpoints &&
      previewLine.snapNodeId &&
      (
        (previewLine.fromNodeId === openLoopEndpoints.nodeA && previewLine.snapNodeId === openLoopEndpoints.nodeB) ||
        (previewLine.fromNodeId === openLoopEndpoints.nodeB && previewLine.snapNodeId === openLoopEndpoints.nodeA)
      )
    );
    const dc: DrawContext = {
      nodes, walls, windows, doors, passages, columns,
      transform, selectedTool,
      selectedWallId, selectedWindowId, selectedDoorId, selectedPassageId, selectedColumnId,
      nodeConstraints, wallInteriorSign, columnsToJoin, columnJoinMode,
      loopClosed: isLoopClosed(),
      closeLoopPreview,
      labelBounds: labelBoundsArr,
      pendingNode: pendingNodeRef.current,
      roomName: activeRoomName,
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(transform.x, transform.y);
    drawGrid(ctx, canvas.width, canvas.height, transform);
    drawWalls(ctx, dc);
    drawWindows(ctx, dc);
    drawDoors(ctx, dc);
    drawPassages(ctx, dc);
    drawColumns(ctx, dc);
    if (previewLine) drawPreviewLine(ctx, previewLine, dc);
    drawNodes(ctx, dc);
    drawWallLabels(ctx, dc);
    drawRoomLabel(ctx, dc);
    drawSetbackIndicators(ctx, dc);
    ctx.restore();

    labelBoundsRef.current = labelBoundsArr;
  };

  drawSceneRef.current = renderScene;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderScene(ctx, canvas);
  }, [transform, nodes, walls, previewLine, openLoopEndpoints, selectedWallId, nodeConstraints, windows, selectedWindowId, doors, selectedDoorId, passages, selectedPassageId, columns, selectedColumnId, selectedTool, columnsToJoin, columnJoinMode, activeRoomName]);

  // ---- DXF Export ------------------------------------------------------------

  const exportToDXF = () => {
    dxfExport(nodes, walls, windows, doors, passages, columns);
  };

  // ---- actions ---------------------------------------------------------------

  // ---- BFS chain finder -----------------------------------------------------

  const findChain = (nodeAId: string, nodeBId: string) =>
    findChainUtil(nodeAId, nodeBId, walls);

  // ---- Weighted angular correction solver -----------------------------------

  const solveClosedLoop = (
    chainNodeIds: string[],
    wallLengthsCm: number[],
    closingLengthCm: number,
    uncons: Set<string>
  ) => solveClosedLoopUtil(chainNodeIds, wallLengthsCm, closingLengthCm, uncons, nodes);

  // ---- close-loop action -----------------------------------------------------

  const handleCloseLoopSubmit = () => {
    if (!openLoopEndpoints) { setShowCloseLoopPrompt(false); setCloseLoopLength(''); return; }

    const desiredMeters = parseFloat(closeLoopLength.replace(',', '.'));
    if (isNaN(desiredMeters) || desiredMeters <= 0) {
      setValidationError('Please enter a valid length greater than 0');
      return;
    }

    const chain = findChain(openLoopEndpoints.nodeA, openLoopEndpoints.nodeB);
    if (!chain || chain.nodeIds.length < 3) {
      setValidationError('Need at least 3 walls before closing a loop.');
      return;
    }

    const solvedNodes = solveClosedLoop(
      chain.nodeIds,
      chain.wallLengthsCm,
      desiredMeters * 100,
      nodeConstraints
    );

    if (!solvedNodes) {
      const totalM = (chain.wallLengthsCm.reduce((a, b) => a + b, 0) / 100).toFixed(3);
      setValidationError(
        `Impossible geometry — the closing wall must be shorter than the total of all other walls (${totalM} m).`
      );
      return;
    }

    saveHistory(solvedNodes, [
      ...walls,
      { id: `w-${Date.now()}`, nodeA: openLoopEndpoints.nodeA, nodeB: openLoopEndpoints.nodeB, length: desiredMeters, type: 'inner', thickness: 15 },
    ]);
    setShowCloseLoopPrompt(false);
    setCloseLoopLength('');
    setValidationError(null);
  };

  const handleLengthSubmit = () => {
    const m = parseFloat(lengthInput.replace(',', '.'));
    if (!pendingConnection || isNaN(m) || m <= 0) {
      setShowLengthPrompt(false); setPendingConnection(null); setLengthInput(''); return;
    }
    const cm = m * 100;
    const { nodeA: sourceId, nodeB: endId, directionX: dx, directionY: dy, fixedX, fixedY } = pendingConnection;

    if (dx === undefined || dy === undefined || fixedX === undefined || fixedY === undefined) {
      setShowLengthPrompt(false); setPendingConnection(null); setLengthInput(''); return;
    }

    if (sourceId) {
      // New flow: dragging FROM an existing node into empty space
      const sourceNode = nodes.find(n => n.id === sourceId);
      if (!sourceNode) return;
      const ex = sourceNode.x + dx * cm;
      const ey = sourceNode.y + dy * cm;
      const v = validateGeometry(sourceNode.x, sourceNode.y, ex, ey, m);
      if (!v.ok) { setValidationError(v.error ?? null); return; }
      const newNode: Node = { id: `n-${Date.now()}-e`, x: ex, y: ey };
      const w: Wall = { id: `w-${Date.now()}`, nodeA: sourceNode.id, nodeB: newNode.id, length: m, type: 'inner', thickness: 15 };
      saveHistory([...nodes, newNode], [...walls, w]);
    } else if (endId) {
      // Legacy flow: nodeA='' means "new node", nodeB=existing target
      const endNode = nodes.find(n => n.id === endId);
      if (!endNode) return;
      const sx = endNode.x - dx * cm;
      const sy = endNode.y - dy * cm;
      const v = validateGeometry(sx, sy, endNode.x, endNode.y, m);
      if (!v.ok) { setValidationError(v.error ?? null); return; }
      const startNode: Node = { id: `n-${Date.now()}-s`, x: sx, y: sy };
      const w: Wall = { id: `w-${Date.now()}`, nodeA: startNode.id, nodeB: endNode.id, length: m, type: 'inner', thickness: 15 };
      saveHistory([...nodes, startNode], [...walls, w]);
    }
    setShowLengthPrompt(false); setPendingConnection(null); setLengthInput('');
  };

  // ---- render ----------------------------------------------------------------

  return (
    <>
      <canvas
        ref={canvasRef}
        className="touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
      />

      <ActionBar
        selectedTool={selectedTool}
        selectedWallId={selectedWallId}
        selectedWindowId={selectedWindowId}
        selectedDoorId={selectedDoorId}
        selectedPassageId={selectedPassageId}
        selectedColumnId={selectedColumnId}
        columnJoinMode={columnJoinMode}
        columnsToJoinCount={columnsToJoin.length}
        columnsCount={columns.length}
        historyIndex={historyIndex}
        historyLength={history.length}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onEditWall={handleEditWallClick}
        onAddOrEditWindow={handleAddOrEditWindow}
        onDeleteWindow={handleDeleteWindow}
        onAddOrEditDoor={handleAddOrEditDoor}
        onDeleteDoor={handleDeleteDoor}
        onAddOrEditPassage={handleAddOrEditPassage}
        onDeletePassage={handleDeletePassage}
        onAddOrEditColumn={handleAddOrEditColumn}
        onDeleteColumn={handleDeleteColumn}
        onStartColumnJoin={handleStartColumnJoin}
        onJoinColumns={handleJoinColumns}
        onCancelColumnJoin={handleCancelColumnJoin}
      />

      <LayersDropdown
        selectedTool={selectedTool}
        layerOpen={layerOpen}
        loopClosed={isLoopClosed()}
        onToolChange={setSelectedTool}
        onToggleOpen={() => setLayerOpen(!layerOpen)}
        onClose={() => setLayerOpen(false)}
      />

      <AppMenu
        menuOpen={menuOpen}
        loopClosed={isLoopClosed()}
        historyIndex={historyIndex}
        historyLength={history.length}
        onToggleMenu={() => setMenuOpen(!menuOpen)}
        onCloseMenu={() => setMenuOpen(false)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        undoLabel={undoLabel}
        redoLabel={redoLabel}
        onExportDXF={exportToDXF}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onClearAll={handleClearAll}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        rooms={getRoomsWithCurrent()}
        activeRoomId={activeRoomId}
        onSwitchRoom={handleSwitchRoom}
        onAddRoom={handleAddRoom}
        onRenameRoom={handleRenameRoom}
        onDeleteRoom={handleDeleteRoom}
      />

      <RightPanel
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen(!panelOpen)}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        rooms={getRoomsWithCurrent()}
        activeRoomId={activeRoomId}
        loopClosed={isLoopClosed()}
        onSwitchRoom={handleSwitchRoom}
        onAddRoom={handleAddRoom}
        onRenameRoom={handleRenameRoom}
        onDeleteRoom={handleDeleteRoom}
        onExportDXF={exportToDXF}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onClearAll={handleClearAll}
        historyIndex={historyIndex}
        historyLength={history.length}
        onUndo={handleUndo}
        onRedo={handleRedo}
        undoLabel={undoLabel}
        redoLabel={redoLabel}
        // Editor props
        selectedTool={selectedTool}
        nodes={nodes}
        walls={walls}
        windows={windows}
        doors={doors}
        passages={passages}
        columns={columns}
        selectedWallId={selectedWallId}
        selectedWindowId={selectedWindowId}
        selectedDoorId={selectedDoorId}
        selectedPassageId={selectedPassageId}
        selectedColumnId={selectedColumnId}
        columnJoinMode={columnJoinMode}
        columnsToJoin={columnsToJoin}
        nodeConstraints={nodeConstraints}
        wallInteriorSign={wallInteriorSign}
        calculateNodeLabels={calculateNodeLabels}
        saveHistory={saveHistory}
        setSelectedWindowId={setSelectedWindowId}
        setSelectedDoorId={setSelectedDoorId}
        setSelectedPassageId={setSelectedPassageId}
        setSelectedColumnId={setSelectedColumnId}
        setValidationError={setValidationError}
        onAddOrEditWindow={handleAddOrEditWindow}
        onAddOrEditDoor={handleAddOrEditDoor}
        onAddOrEditPassage={handleAddOrEditPassage}
        onAddOrEditColumn={handleAddOrEditColumn}
        onStartColumnJoin={handleStartColumnJoin}
        onJoinColumns={handleJoinColumns}
        onCancelColumnJoin={handleCancelColumnJoin}
        onDeleteWall={handleDeleteWallClick}
        canDeleteWall={canDeleteSelectedWall}
        deleteWallDisabledReason={deleteWallDisabledReason}
      />

      <WallLengthDialog
        visible={showLengthPrompt}
        lengthInput={lengthInput}
        validationError={validationError}
        onLengthChange={v => { setLengthInput(v); setValidationError(null); }}
        onSubmit={handleLengthSubmit}
        onCancel={() => { setShowLengthPrompt(false); setPendingConnection(null); setLengthInput(''); setValidationError(null); }}
      />

      <CloseLoopDialog
        visible={showCloseLoopPrompt}
        closeLoopLength={closeLoopLength}
        validationError={validationError}
        onLengthChange={v => { setCloseLoopLength(v); setValidationError(null); }}
        onSubmit={handleCloseLoopSubmit}
        onCancel={() => { setShowCloseLoopPrompt(false); setCloseLoopLength(''); setValidationError(null); }}
      />

      <WindowDialog
        {...windowDialogProps}
        interiorSign={wallInteriorSign.get(windowDialogProps.wallId ?? '') ?? -1}
        nodeALabel={nodeALabel}
        nodeBLabel={nodeBLabel}
        validationError={validationError}
        onValidationErrorChange={setValidationError}
        onDelete={handleDeleteWindow}
      />

      <DoorDialog
        {...doorDialogProps}
        interiorSign={wallInteriorSign.get(doorDialogProps.wallId ?? '') ?? -1}
        nodeALabel={nodeALabel}
        nodeBLabel={nodeBLabel}
        validationError={validationError}
        onValidationErrorChange={setValidationError}
        onDelete={handleDeleteDoor}
      />

      <PassageDialog
        {...passageDialogProps}
        interiorSign={wallInteriorSign.get(passageDialogProps.wallId ?? '') ?? -1}
        nodeALabel={nodeALabel}
        nodeBLabel={nodeBLabel}
        validationError={validationError}
        onValidationErrorChange={setValidationError}
        onDelete={handleDeletePassage}
      />

      <ColumnDialog
        {...columnDialogProps}
        interiorSign={wallInteriorSign.get(columnDialogProps.wallId ?? '') ?? -1}
        nodeALabel={nodeALabel}
        nodeBLabel={nodeBLabel}
        validationError={validationError}
        onValidationErrorChange={setValidationError}
        onDelete={handleDeleteColumn}
      />

      <WallEditDialog
        {...wallEditDialogProps}
        onDelete={handleDeleteWallClick}
        canDelete={canDeleteSelectedWall}
        deleteDisabledReason={deleteWallDisabledReason}
      />

      <WallDeleteConfirmDialog
        {...wallDeleteConfirmProps}
      />
    </>
  );
}
