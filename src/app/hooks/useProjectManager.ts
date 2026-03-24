import { useState, useRef, useCallback, useEffect, type Dispatch } from 'react';
import { saveMultiRoomProject, loadMultiRoomProject } from '../utils/projectFile';
import type {
  Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj,
  Transform, HistoryEntry, RoomData, LayerType,
} from '../types';
import type { FloorPlanAction } from './useFloorPlanReducer';

// ---------------------------------------------------------------------------
// Params -- what Canvas2D needs to hand in
// ---------------------------------------------------------------------------

interface UseProjectManagerParams {
  // Current reducer state slices the hook needs to snapshot
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];
  history: HistoryEntry[];
  historyIndex: number;
  transform: Transform;
  unconstrainedNodes: Set<string>;
  selectedTool: LayerType;

  // Reducer dispatch (for LOAD_STATE / CLEAR_ALL)
  dispatch: Dispatch<FloorPlanAction>;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface ProjectManagerResult {
  // Project-level state
  projectName: string;
  setProjectName: (name: string) => void;
  rooms: RoomData[];
  activeRoomId: string;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;

  // Computed helpers
  getRoomsWithCurrent: () => RoomData[];

  // Room CRUD
  handleSwitchRoom: (roomId: string) => void;
  handleAddRoom: (name: string) => void;
  handleRenameRoom: (roomId: string, name: string) => void;
  handleDeleteRoom: (roomId: string) => void;

  // Project file I/O
  handleSaveProject: () => void;
  handleLoadProject: () => Promise<void>;

  // Clear all (resets rooms + dispatch CLEAR_ALL)
  handleClearAll: () => void;
}

// ---------------------------------------------------------------------------
// Helper: create a fresh empty room
// ---------------------------------------------------------------------------

function createEmptyRoom(id: string, name: string): RoomData {
  return {
    id,
    name,
    nodes: [{ id: 'origin', x: 0, y: 0 }],
    walls: [],
    windows: [],
    doors: [],
    passages: [],
    columns: [],
    history: [{
      nodes: [{ id: 'origin', x: 0, y: 0 }],
      walls: [], windows: [], doors: [], passages: [], columns: [],
    }],
    historyIndex: 0,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    unconstrainedNodes: [],
    selectedTool: 'wall',
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectManager({
  nodes, walls, windows, doors, passages, columns,
  history, historyIndex, transform, unconstrainedNodes, selectedTool,
  dispatch,
}: UseProjectManagerParams): ProjectManagerResult {

  // ---- state ---------------------------------------------------------------

  const [projectName, setProjectName] = useState('Untitled Project');
  const initialRoomIdRef = useRef(`room-init-${Date.now()}`);
  const [rooms, setRooms] = useState<RoomData[]>(() => [
    createEmptyRoom(initialRoomIdRef.current, 'Room 1'),
  ]);
  const [activeRoomId, setActiveRoomId] = useState(() => initialRoomIdRef.current);
  const [panelOpen, setPanelOpen] = useState(true);

  const roomSwitchingRef = useRef(false);

  // ---- snapshot / load helpers ---------------------------------------------

  const snapshotCurrentRoom = useCallback((): RoomData => {
    const room = rooms.find(r => r.id === activeRoomId);
    return {
      id: activeRoomId,
      name: room?.name ?? 'Room',
      nodes, walls, windows, doors, passages, columns,
      history, historyIndex, transform,
      unconstrainedNodes: Array.from(unconstrainedNodes),
      selectedTool,
    };
  }, [activeRoomId, rooms, nodes, walls, windows, doors, passages, columns,
      history, historyIndex, transform, unconstrainedNodes, selectedTool]);

  const loadRoomIntoReducer = useCallback((room: RoomData) => {
    dispatch({
      type: 'LOAD_STATE',
      payload: {
        nodes: room.nodes.length > 0 ? room.nodes : [{ id: 'origin', x: 0, y: 0 }],
        walls: room.walls,
        windows: room.windows,
        doors: room.doors,
        passages: room.passages,
        columns: room.columns,
        history: room.history.length > 0 ? room.history : [{
          nodes: room.nodes.length > 0 ? room.nodes : [{ id: 'origin', x: 0, y: 0 }],
          walls: [], windows: [], doors: [], passages: [], columns: [],
        }],
        historyIndex: room.historyIndex,
        transform: room.transform,
        unconstrainedNodes: new Set(room.unconstrainedNodes),
        selectedTool: room.selectedTool as any,
        selectedWallId: null, selectedWindowId: null,
        selectedDoorId: null, selectedPassageId: null, selectedColumnId: null,
        previewLine: null, showLengthPrompt: false, pendingConnection: null,
      },
    });
  }, [dispatch]);

  const getRoomsWithCurrent = useCallback((): RoomData[] => {
    const snap = snapshotCurrentRoom();
    return rooms.map(r => r.id === activeRoomId ? snap : r);
  }, [rooms, activeRoomId, snapshotCurrentRoom]);

  // ---- room CRUD -----------------------------------------------------------

  const handleSwitchRoom = useCallback((roomId: string) => {
    if (roomId === activeRoomId) return;
    roomSwitchingRef.current = true;
    const snap = snapshotCurrentRoom();
    setRooms(prev => prev.map(r => r.id === activeRoomId ? snap : r));
    const targetRoom = rooms.find(r => r.id === roomId);
    if (targetRoom) {
      loadRoomIntoReducer(targetRoom);
      setActiveRoomId(roomId);
    }
    setTimeout(() => { roomSwitchingRef.current = false; }, 100);
  }, [activeRoomId, rooms, snapshotCurrentRoom, loadRoomIntoReducer]);

  const handleAddRoom = useCallback((name: string) => {
    const snap = snapshotCurrentRoom();
    const newId = `room-${Date.now()}`;
    const newRoom = createEmptyRoom(newId, name);
    roomSwitchingRef.current = true;
    setRooms(prev => [...prev.map(r => r.id === activeRoomId ? snap : r), newRoom]);
    loadRoomIntoReducer(newRoom);
    setActiveRoomId(newId);
    setTimeout(() => { roomSwitchingRef.current = false; }, 100);
  }, [activeRoomId, snapshotCurrentRoom, loadRoomIntoReducer]);

  const handleRenameRoom = useCallback((roomId: string, name: string) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name } : r));
  }, []);

  const handleDeleteRoom = useCallback((roomId: string) => {
    if (rooms.length <= 1) return;
    const remaining = rooms.filter(r => r.id !== roomId);
    setRooms(remaining);
    if (roomId === activeRoomId) {
      roomSwitchingRef.current = true;
      const target = remaining[0];
      loadRoomIntoReducer(target);
      setActiveRoomId(target.id);
      setTimeout(() => { roomSwitchingRef.current = false; }, 100);
    }
  }, [rooms, activeRoomId, loadRoomIntoReducer]);

  // ---- project file I/O ----------------------------------------------------

  const handleSaveProject = useCallback(() => {
    const allRooms = getRoomsWithCurrent();
    saveMultiRoomProject(projectName, allRooms, activeRoomId);
  }, [getRoomsWithCurrent, projectName, activeRoomId]);

  const handleLoadProject = useCallback(async () => {
    try {
      const loaded = await loadMultiRoomProject();
      roomSwitchingRef.current = true;
      setProjectName(loaded.projectName);
      setRooms(loaded.rooms);
      setActiveRoomId(loaded.activeRoomId);
      const target = loaded.rooms.find(r => r.id === loaded.activeRoomId) ?? loaded.rooms[0];
      loadRoomIntoReducer(target);
      setTimeout(() => { roomSwitchingRef.current = false; }, 100);
    } catch (err: any) {
      if (err?.message !== 'File selection cancelled') {
        alert('Failed to load project: ' + (err?.message || 'Unknown error'));
      }
    }
  }, [loadRoomIntoReducer]);

  // ---- clear all -----------------------------------------------------------

  const handleClearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    localStorage.removeItem('planimetraAppState');
    localStorage.removeItem('planimetraProject');
    const freshId = `room-${Date.now()}`;
    setProjectName('Untitled Project');
    setRooms([createEmptyRoom(freshId, 'Room 1')]);
    setActiveRoomId(freshId);
  }, [dispatch]);

  // ---- localStorage persistence --------------------------------------------

  // Load on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('planimetraProject');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rooms && Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
          setProjectName(parsed.projectName ?? 'Untitled Project');
          setRooms(parsed.rooms);
          const targetId = parsed.activeRoomId ?? parsed.rooms[0].id;
          setActiveRoomId(targetId);
          const target = parsed.rooms.find((r: RoomData) => r.id === targetId) ?? parsed.rooms[0];
          loadRoomIntoReducer(target);
          return;
        }
      }
      // Fallback: legacy single-room format
      const legacySaved = localStorage.getItem('planimetraAppState');
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        const legacyRoom: RoomData = {
          id: `room-legacy-${Date.now()}`,
          name: 'Room 1',
          nodes: parsed.nodes ?? [],
          walls: parsed.walls ?? [],
          windows: (parsed.windows ?? []).map((w: any) => ({
            ...w, hinge: w.hinge ?? 'left',
            setback: w.setback !== undefined && w.offset !== undefined
              ? w.offset : w.setback ?? w.offset ?? 0,
          })),
          doors: (parsed.doors ?? []).map((d: any) => ({
            ...d, hinge: d.hinge ?? 'left',
            setback: d.setback ?? d.offset ?? 0,
          })),
          passages: parsed.passages ?? [],
          columns: parsed.columns ?? [],
          history: parsed.history ?? [{
            nodes: parsed.nodes ?? [],
            walls: [], windows: [], doors: [], passages: [], columns: [],
          }],
          historyIndex: parsed.historyIndex ?? 0,
          transform: parsed.transform ?? { x: 0, y: 0, scale: 1, rotation: 0 },
          unconstrainedNodes: parsed.unconstrainedNodes ?? [],
          selectedTool: parsed.selectedTool ?? 'wall',
        };
        setRooms([legacyRoom]);
        setActiveRoomId(legacyRoom.id);
        loadRoomIntoReducer(legacyRoom);
      }
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save whenever state changes
  useEffect(() => {
    if (roomSwitchingRef.current) return;
    try {
      const currentRooms = getRoomsWithCurrent();
      const projectState = { projectName, rooms: currentRooms, activeRoomId };
      localStorage.setItem('planimetraProject', JSON.stringify(projectState));
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
    }
  }, [nodes, walls, windows, doors, passages, columns, selectedTool,
      history, historyIndex, transform, unconstrainedNodes,
      projectName, rooms, activeRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- public API ----------------------------------------------------------

  return {
    projectName, setProjectName,
    rooms, activeRoomId,
    panelOpen, setPanelOpen,
    getRoomsWithCurrent,
    handleSwitchRoom, handleAddRoom, handleRenameRoom, handleDeleteRoom,
    handleSaveProject, handleLoadProject, handleClearAll,
  };
}

