import { useState } from 'react';
import type { RoomData, Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj, LayerType } from '../../types';
import { EditorSection } from './EditorSection';

// -- Compute room area in m^2 using Shoelace on ordered wall-loop nodes --------

function computeRoomAreaM2(nodes: Node[], walls: Wall[]): number | null {
  if (walls.length < 3 || nodes.length < 3) return null;

  // Build adjacency from walls
  const adj = new Map<string, string[]>();
  for (const w of walls) {
    if (!adj.has(w.nodeA)) adj.set(w.nodeA, []);
    if (!adj.has(w.nodeB)) adj.set(w.nodeB, []);
    adj.get(w.nodeA)!.push(w.nodeB);
    adj.get(w.nodeB)!.push(w.nodeA);
  }

  // Every node must have exactly 2 connections for a closed loop
  for (const [, neighbors] of adj) {
    if (neighbors.length !== 2) return null;
  }

  // Walk the loop
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const startId = walls[0].nodeA;
  const ordered: Node[] = [];
  let current = startId;
  let prev = '';

  for (let i = 0; i < adj.size; i++) {
    const node = nodeMap.get(current);
    if (!node) return null;
    ordered.push(node);
    const neighbors = adj.get(current)!;
    const next = neighbors[0] === prev ? neighbors[1] : neighbors[0];
    prev = current;
    current = next;
  }

  // Check it loops back
  if (current !== startId) return null;

  // Shoelace formula (coords are in cm -> result in cm^2 -> convert to m^2)
  let area = 0;
  const n = ordered.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += ordered[i].x * ordered[j].y;
    area -= ordered[j].x * ordered[i].y;
  }
  return Math.abs(area) / 2 / 10000; // cm^2 -> m^2
}

// Collapsible Section wrapper 

function CollapsibleSection({
  title, defaultOpen = true, borderBottom = true, children,
}: {
  title: string; defaultOpen?: boolean; borderBottom?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={borderBottom ? 'border-b border-gray-700' : ''}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/60 transition-colors"
      >
        <span className="text-xs text-gray-400 uppercase tracking-wider">{title}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// Props 

interface RightPanelProps {
  guiReady?: boolean;
  // Panel state
  panelOpen: boolean;
  onTogglePanel: () => void;

  // Project section
  projectName: string;
  onProjectNameChange: (name: string) => void;
  rooms: RoomData[];
  activeRoomId: string;
  loopClosed: boolean;
  onSwitchRoom: (roomId: string) => void;
  onAddRoom: (name: string) => void;
  onRenameRoom: (roomId: string, name: string) => void;
  onDeleteRoom: (roomId: string) => void;

  // Actions
  onExportDXF: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onClearAll: () => void;

  // Undo/Redo
  historyIndex: number;
  historyLength: number;
  onUndo: () => void;
  onRedo: () => void;
  undoLabel: string;
  redoLabel: string;

  // Editor section
  selectedTool: LayerType;
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];
  selectedWallId: string | null;
  selectedWindowId: string | null;
  selectedDoorId: string | null;
  selectedPassageId: string | null;
  selectedColumnId: string | null;
  columnJoinMode: boolean;
  columnsToJoin: string[];
  unconstrainedNodes: Set<string>;
  wallInteriorSign: Map<string, number>;
  calculateNodeLabels: (wallId: string) => { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  saveHistory: (
    nodes: Node[], walls: Wall[],
    windows?: WindowObj[], doors?: DoorObj[],
    passages?: PassageObj[], columns?: ColumnObj[]
  ) => void;
  setSelectedWindowId: (id: string | null) => void;
  setSelectedDoorId: (id: string | null) => void;
  setSelectedPassageId: (id: string | null) => void;
  setSelectedColumnId: (id: string | null) => void;
  setValidationError: (error: string | null) => void;
  onAddOrEditWindow: () => void;
  onAddOrEditDoor: () => void;
  onAddOrEditPassage: () => void;
  onAddOrEditColumn: () => void;
  onStartColumnJoin: () => void;
  onJoinColumns: () => void;
  onCancelColumnJoin: () => void;
  onDeleteWall: () => void;
  canDeleteWall: boolean;
  deleteWallDisabledReason: string | null;
}

export function RightPanel(props: RightPanelProps) {
  const {
    guiReady = true,
    panelOpen, onTogglePanel,
    projectName, onProjectNameChange,
    rooms, activeRoomId, loopClosed,
    onSwitchRoom, onAddRoom, onRenameRoom, onDeleteRoom,
    onExportDXF, onSaveProject, onLoadProject, onClearAll,
    // undo/redo
    historyIndex, historyLength, onUndo, onRedo, undoLabel, redoLabel,
    // editor
    selectedTool, nodes, walls, windows, doors, passages, columns,
    selectedWallId, selectedWindowId, selectedDoorId, selectedPassageId, selectedColumnId,
    columnJoinMode, columnsToJoin, unconstrainedNodes, wallInteriorSign,
    calculateNodeLabels, saveHistory,
    setSelectedWindowId, setSelectedDoorId, setSelectedPassageId, setSelectedColumnId,
    setValidationError,
    onAddOrEditWindow, onAddOrEditDoor, onAddOrEditPassage, onAddOrEditColumn,
    onStartColumnJoin, onJoinColumns, onCancelColumnJoin,
    onDeleteWall, canDeleteWall, deleteWallDisabledReason,
  } = props;

  // -- Project name editing --
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');

  const handleStartEditProjectName = () => {
    setEditingProjectName(true);
    setProjectNameDraft(projectName);
  };
  const handleFinishEditProjectName = () => {
    const name = projectNameDraft.trim();
    if (name) onProjectNameChange(name);
    setEditingProjectName(false);
  };

  // -- Room CRUD --
  const [showNewRoomPrompt, setShowNewRoomPrompt] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState('');

  const handleAddRoom = () => {
    const name = newRoomName.trim() || `Room ${rooms.length + 1}`;
    onAddRoom(name);
    setNewRoomName('');
    setShowNewRoomPrompt(false);
  };
  const handleStartRename = (room: RoomData) => {
    setEditingRoomId(room.id);
    setEditingRoomName(room.name);
  };
  const handleFinishRename = () => {
    if (editingRoomId && editingRoomName.trim()) {
      onRenameRoom(editingRoomId, editingRoomName.trim());
    }
    setEditingRoomId(null);
    setEditingRoomName('');
  };

  return (
    <>
      {/* Toggle tab small, near top, desktop only */}
      <button
        onClick={onTogglePanel}
        className={`hidden md:flex fixed top-3 z-40 w-5 h-8 items-center justify-center
          bg-gray-800/80 border border-gray-700 border-r-0 rounded-l
          hover:bg-gray-700 transition-all duration-500 ease-in-out
          ${panelOpen ? 'right-72' : 'right-0'}
          ${guiReady ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}`}
        title={panelOpen ? 'Hide Panel' : 'Show Panel'}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${!panelOpen ? '' : 'rotate-180'}`}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Panel -- desktop only, slides in/out */}
      <div
        className={`hidden md:flex fixed top-0 bottom-0 w-72 bg-gray-900/95 backdrop-blur border-l border-gray-700 z-30 flex-col overflow-hidden
          transition-transform duration-500 ease-in-out ${panelOpen && guiReady ? 'right-0 translate-x-0' : 'right-0 translate-x-full'}`}
      >
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* === 1. PROJECT SECTION === */}
          <CollapsibleSection title="Project" defaultOpen={true}>
            {/* Project name */}
            <div className="mb-3">
              {editingProjectName ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={projectNameDraft}
                    onChange={e => setProjectNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleFinishEditProjectName(); if (e.key === 'Escape') setEditingProjectName(false); }}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm outline-none focus:border-cyan-500"
                  />
                  <button onClick={handleFinishEditProjectName} className="text-cyan-400 hover:text-cyan-300 text-sm">OK</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group cursor-pointer" onClick={handleStartEditProjectName}>
                  <h2 className="text-sm text-white truncate flex-1">{projectName}</h2>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Rooms header + Add */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Rooms</span>
              <button
                onClick={() => { setNewRoomName(''); setShowNewRoomPrompt(true); }}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add
              </button>
            </div>

            {/* New room prompt */}
            {showNewRoomPrompt && (
              <div className="mb-2 p-2 bg-gray-800 rounded-lg border border-gray-600">
                <input
                  autoFocus
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddRoom(); if (e.key === 'Escape') setShowNewRoomPrompt(false); }}
                  placeholder="Room name..."
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-cyan-500 placeholder-gray-500 mb-2"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddRoom}
                    className="flex-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors">
                    Create
                  </button>
                  <button onClick={() => setShowNewRoomPrompt(false)}
                    className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Rooms list */}
            <div className="space-y-1">
              {rooms.map(room => {
                const isActive = room.id === activeRoomId;
                const isEditing = editingRoomId === room.id;
                const wallCount = room.walls.length;
                const hasContent = wallCount > 0;
                const areaM2 = computeRoomAreaM2(room.nodes, room.walls);

                return (
                  <div
                    key={room.id}
                    className={`group rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-cyan-900/40 border border-cyan-700/50'
                        : 'bg-gray-800/60 border border-transparent hover:bg-gray-800 hover:border-gray-700'
                    }`}
                    onClick={() => { if (!isEditing) onSwitchRoom(room.id); }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-cyan-400' : hasContent ? 'bg-gray-500' : 'bg-gray-700'}`} />

                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingRoomName}
                          onChange={e => setEditingRoomName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingRoomId(null); }}
                          onBlur={handleFinishRename}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-white text-sm outline-none focus:border-cyan-500 min-w-0"
                        />
                      ) : (
                        <span className={`flex-1 text-sm truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
                          {room.name}
                        </span>
                      )}

                      {!isEditing && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); handleStartRename(room); }}
                            className="p-0.5 hover:text-cyan-400 text-gray-500"
                            title="Rename"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          {rooms.length > 1 && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                if (confirm(`Delete room "${room.name}"?`)) onDeleteRoom(room.id);
                              }}
                              className="p-0.5 hover:text-red-400 text-gray-500"
                              title="Delete Room"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-1 ml-4 text-[10px] text-gray-500">
                      {wallCount} wall{wallCount !== 1 ? 's' : ''}
                      {room.windows.length > 0 && ` \u00b7 ${room.windows.length} win`}
                      {room.doors.length > 0 && ` \u00b7 ${room.doors.length} door`}
                      {room.columns.length > 0 && ` \u00b7 ${room.columns.length} col`}
                      {areaM2 !== null && ` \u00b7 ${areaM2.toFixed(1)} m\u00b2`}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* === 2. OBJECT EDITOR SECTION === */}
          <CollapsibleSection title="Object Editor" defaultOpen={true} borderBottom={false}>
            <EditorSection
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
              unconstrainedNodes={unconstrainedNodes}
              wallInteriorSign={wallInteriorSign}
              calculateNodeLabels={calculateNodeLabels}
              saveHistory={saveHistory}
              setSelectedWindowId={setSelectedWindowId}
              setSelectedDoorId={setSelectedDoorId}
              setSelectedPassageId={setSelectedPassageId}
              setSelectedColumnId={setSelectedColumnId}
              setValidationError={setValidationError}
              onAddOrEditWindow={onAddOrEditWindow}
              onAddOrEditDoor={onAddOrEditDoor}
              onAddOrEditPassage={onAddOrEditPassage}
              onAddOrEditColumn={onAddOrEditColumn}
              onStartColumnJoin={onStartColumnJoin}
              onJoinColumns={onJoinColumns}
              onCancelColumnJoin={onCancelColumnJoin}
              onDeleteWall={onDeleteWall}
              canDeleteWall={canDeleteWall}
              deleteWallDisabledReason={deleteWallDisabledReason}
            />
          </CollapsibleSection>
          {/* === 3. ACTIONS SECTION === */}
          <div className="px-3 py-3 border-t border-gray-700 space-y-1.5 mt-auto">
            {/* Undo / Redo */}
            <div className="space-y-1.5 pb-1.5 border-b border-gray-800">
              <button onClick={onUndo} disabled={historyIndex <= 0}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm transition-colors ${
                  historyIndex <= 0
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white'
                }`}
                title={undoLabel ? `Undo: ${undoLabel}` : 'Undo'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
                <span className="flex-1 text-left">Undo</span>
                {undoLabel && <span className="text-xs text-gray-400">{undoLabel}</span>}
              </button>
              <button onClick={onRedo} disabled={historyIndex >= historyLength - 1}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm transition-colors ${
                  historyIndex >= historyLength - 1
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white'
                }`}
                title={redoLabel ? `Redo: ${redoLabel}` : 'Redo'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                </svg>
                <span className="flex-1 text-left">Redo</span>
                {redoLabel && <span className="text-xs text-gray-400">{redoLabel}</span>}
              </button>
            </div>
            <button onClick={onSaveProject}
              className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              Save Project
            </button>
            <button onClick={onLoadProject}
              className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><polyline points="9 14 12 11 15 14" />
              </svg>
              Load Project
            </button>
              <button onClick={onClearAll}
                className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              New Project
            </button>
            <button onClick={onExportDXF} disabled={!loopClosed}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm transition-colors ${
                !loopClosed
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white'
              }`}
              title={loopClosed ? 'Export to DXF' : 'Close the wall loop first'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export DXF
            </button>
            <div className="pt-1 pb-0.3">
              <a
                href="https://github.com/xep426/Planimetra"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-[11px] text-gray-300 hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.1c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.78-1.34-1.78-1.1-.75.08-.74.08-.74 1.21.08 1.85 1.24 1.85 1.24 1.08 1.84 2.84 1.31 3.53 1 .11-.78.42-1.31.76-1.61-2.67-.31-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.31-.54-1.57.12-3.27 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.7.24 2.96.12 3.27.77.84 1.24 1.91 1.24 3.22 0 4.62-2.8 5.64-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.58A12 12 0 0 0 12 .5Z" />
                </svg>
                Visit the project on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

