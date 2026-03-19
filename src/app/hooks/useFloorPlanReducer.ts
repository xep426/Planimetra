import { useReducer, useCallback } from 'react';
import type {
  Transform, Node, Wall, WindowObj, DoorObj,
  PassageObj, ColumnObj, PreviewLine, PendingConnection, HistoryEntry,
  LayerType,
} from '../types';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface FloorPlanState {
  // Scene data
  transform: Transform;
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];

  // History (undo/redo)
  history: HistoryEntry[];
  historyIndex: number;

  // Active tool & selections
  selectedTool: LayerType;
  selectedWallId: string | null;
  selectedWindowId: string | null;
  selectedDoorId: string | null;
  selectedPassageId: string | null;
  selectedColumnId: string | null;

  // Column join
  columnJoinMode: boolean;
  columnsToJoin: string[];

  // Preview / drawing
  previewLine: PreviewLine | null;
  snapToGridEnabled: boolean;

  // Node constraints (unconstrained node set)
  nodeConstraints: Set<string>;

  // Wall-length dialog
  showLengthPrompt: boolean;
  pendingConnection: PendingConnection | null;
  lengthInput: string;

  // Close-loop dialog
  showCloseLoopPrompt: boolean;
  closeLoopLength: string;
  openLoopEndpoints: { nodeA: string; nodeB: string } | null;

  // Validation
  validationError: string | null;

  // UI chrome
  isPanMode: boolean;
  showModeIndicator: boolean;
  menuOpen: boolean;
  layerOpen: boolean;

  // Node direction labels
  nodeALabel: 'CW' | 'CCW';
  nodeBLabel: 'CW' | 'CCW';
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_NODES: Node[] = [{ id: 'origin', x: 0, y: 0 }];

export const INITIAL_STATE: FloorPlanState = {
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  nodes: INITIAL_NODES,
  walls: [],
  windows: [],
  doors: [],
  passages: [],
  columns: [],

  history: [{ nodes: INITIAL_NODES, walls: [], windows: [], doors: [], passages: [], columns: [] }],
  historyIndex: 0,

  selectedTool: 'wall',
  selectedWallId: null,
  selectedWindowId: null,
  selectedDoorId: null,
  selectedPassageId: null,
  selectedColumnId: null,

  columnJoinMode: false,
  columnsToJoin: [],

  previewLine: null,
  snapToGridEnabled: true,

  nodeConstraints: new Set(),

  showLengthPrompt: false,
  pendingConnection: null,
  lengthInput: '',

  showCloseLoopPrompt: false,
  closeLoopLength: '',
  openLoopEndpoints: null,

  validationError: null,

  isPanMode: false,
  showModeIndicator: false,
  menuOpen: false,
  layerOpen: false,

  nodeALabel: 'CW',
  nodeBLabel: 'CCW',
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Generic field-setter action (mapped discriminated union) */
type SetFieldAction = {
  [K in keyof FloorPlanState]: {
    type: 'SET';
    field: K;
    value: FloorPlanState[K];
  };
}[keyof FloorPlanState];

/** Functional-updater actions for fields that need prev-state access */
type UpdateTransformAction = {
  type: 'UPDATE_TRANSFORM';
  updater: (prev: Transform) => Transform;
};

type UpdateNodeConstraintsAction = {
  type: 'UPDATE_NODE_CONSTRAINTS';
  updater: (prev: Set<string>) => Set<string>;
};

/** Composite batch actions */
type SaveHistoryAction = {
  type: 'SAVE_HISTORY';
  nodes: Node[];
  walls: Wall[];
  windows?: WindowObj[];
  doors?: DoorObj[];
  passages?: PassageObj[];
  columns?: ColumnObj[];
};

type UndoAction = { type: 'UNDO' };
type RedoAction = { type: 'REDO' };

type ClearAllAction = { type: 'CLEAR_ALL' };

type ClearSelectionsAction = { type: 'CLEAR_SELECTIONS' };

type LoadStateAction = {
  type: 'LOAD_STATE';
  payload: Partial<FloorPlanState>;
};

type ToggleNodeConstraintAction = {
  type: 'TOGGLE_NODE_CONSTRAINT';
  nodeId: string;
};

export type FloorPlanAction =
  | SetFieldAction
  | UpdateTransformAction
  | UpdateNodeConstraintsAction
  | SaveHistoryAction
  | UndoAction
  | RedoAction
  | ClearAllAction
  | ClearSelectionsAction
  | LoadStateAction
  | ToggleNodeConstraintAction;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clearSelections = (s: FloorPlanState): FloorPlanState => ({
  ...s,
  selectedWallId: null,
  selectedWindowId: null,
  selectedDoorId: null,
  selectedPassageId: null,
  selectedColumnId: null,
});

const applyHistoryEntry = (s: FloorPlanState, entry: HistoryEntry, index: number): FloorPlanState =>
  clearSelections({
    ...s,
    historyIndex: index,
    nodes: entry.nodes,
    walls: entry.walls,
    windows: entry.windows,
    doors: entry.doors,
    passages: entry.passages,
    columns: entry.columns,
  });

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function floorPlanReducer(state: FloorPlanState, action: FloorPlanAction): FloorPlanState {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.field]: action.value };

    case 'UPDATE_TRANSFORM':
      return { ...state, transform: action.updater(state.transform) };

    case 'UPDATE_NODE_CONSTRAINTS':
      return { ...state, nodeConstraints: action.updater(state.nodeConstraints) };

    case 'SAVE_HISTORY': {
      const h = state.history.slice(0, state.historyIndex + 1);
      h.push({
        nodes: action.nodes,
        walls: action.walls,
        windows: action.windows ?? state.windows,
        doors: action.doors ?? state.doors,
        passages: action.passages ?? state.passages,
        columns: action.columns ?? state.columns,
      });
      return {
        ...state,
        history: h,
        historyIndex: h.length - 1,
        nodes: action.nodes,
        walls: action.walls,
        windows: action.windows !== undefined ? action.windows : state.windows,
        doors: action.doors !== undefined ? action.doors : state.doors,
        passages: action.passages !== undefined ? action.passages : state.passages,
        columns: action.columns !== undefined ? action.columns : state.columns,
      };
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const i = state.historyIndex - 1;
      return applyHistoryEntry(state, state.history[i], i);
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const i = state.historyIndex + 1;
      return applyHistoryEntry(state, state.history[i], i);
    }

    case 'CLEAR_ALL':
      return { ...INITIAL_STATE };

    case 'CLEAR_SELECTIONS':
      return clearSelections(state);

    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'TOGGLE_NODE_CONSTRAINT': {
      const next = new Set(state.nodeConstraints);
      if (next.has(action.nodeId)) next.delete(action.nodeId);
      else next.add(action.nodeId);
      return { ...state, nodeConstraints: next };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook — wraps useReducer with convenience setter functions
// ---------------------------------------------------------------------------

/** Helper type: simple value setter */
type Setter<T> = (value: T) => void;

/** Helper type: setter that accepts value OR functional updater */
type DispatchSetter<T> = React.Dispatch<React.SetStateAction<T>>;

export interface FloorPlanSetters {
  setTransform: DispatchSetter<Transform>;
  setNodes: Setter<Node[]>;
  setWalls: Setter<Wall[]>;
  setWindows: Setter<WindowObj[]>;
  setDoors: Setter<DoorObj[]>;
  setPassages: Setter<PassageObj[]>;
  setColumns: Setter<ColumnObj[]>;
  setPreviewLine: Setter<PreviewLine | null>;
  setShowLengthPrompt: Setter<boolean>;
  setPendingConnection: Setter<PendingConnection | null>;
  setLengthInput: Setter<string>;
  setSnapToGridEnabled: Setter<boolean>;
  setSelectedWallId: Setter<string | null>;
  setSelectedTool: Setter<LayerType>;
  setHistory: Setter<HistoryEntry[]>;
  setHistoryIndex: Setter<number>;
  setShowCloseLoopPrompt: Setter<boolean>;
  setCloseLoopLength: Setter<string>;
  setOpenLoopEndpoints: Setter<{ nodeA: string; nodeB: string } | null>;
  setValidationError: Setter<string | null>;
  setNodeConstraints: DispatchSetter<Set<string>>;
  setIsPanMode: Setter<boolean>;
  setShowModeIndicator: Setter<boolean>;
  setMenuOpen: Setter<boolean>;
  setLayerOpen: Setter<boolean>;
  setSelectedWindowId: Setter<string | null>;
  setSelectedDoorId: Setter<string | null>;
  setSelectedPassageId: Setter<string | null>;
  setSelectedColumnId: Setter<string | null>;
  setColumnJoinMode: Setter<boolean>;
  setColumnsToJoin: Setter<string[]>;
  setNodeALabel: Setter<'CW' | 'CCW'>;
  setNodeBLabel: Setter<'CW' | 'CCW'>;
}

export function useFloorPlanReducer() {
  const [state, dispatch] = useReducer(floorPlanReducer, INITIAL_STATE);

  // -- Simple field setters (stable via useCallback + dispatch identity) ------
  const set = useCallback(
    <K extends keyof FloorPlanState>(field: K, value: FloorPlanState[K]) =>
      dispatch({ type: 'SET', field, value } as SetFieldAction),
    [],
  );

  // -- Functional-updater-aware setters for transform & nodeConstraints ------
  const setTransform: DispatchSetter<Transform> = useCallback(
    (v) => {
      if (typeof v === 'function') dispatch({ type: 'UPDATE_TRANSFORM', updater: v });
      else dispatch({ type: 'SET', field: 'transform', value: v });
    },
    [],
  );

  const setNodeConstraints: DispatchSetter<Set<string>> = useCallback(
    (v) => {
      if (typeof v === 'function') dispatch({ type: 'UPDATE_NODE_CONSTRAINTS', updater: v });
      else dispatch({ type: 'SET', field: 'nodeConstraints', value: v });
    },
    [],
  );

  // -- Build stable setters object -------------------------------------------
  // Each setter is a thin wrapper around `set`. Because `set` and `dispatch`
  // have stable identities, these closures only allocate once per mount.
  const setters: FloorPlanSetters = {
    setTransform,
    setNodes:               useCallback((v: Node[])               => set('nodes', v), [set]),
    setWalls:               useCallback((v: Wall[])               => set('walls', v), [set]),
    setWindows:             useCallback((v: WindowObj[])           => set('windows', v), [set]),
    setDoors:               useCallback((v: DoorObj[])             => set('doors', v), [set]),
    setPassages:            useCallback((v: PassageObj[])          => set('passages', v), [set]),
    setColumns:             useCallback((v: ColumnObj[])           => set('columns', v), [set]),
    setPreviewLine:         useCallback((v: PreviewLine | null)    => set('previewLine', v), [set]),
    setShowLengthPrompt:    useCallback((v: boolean)               => set('showLengthPrompt', v), [set]),
    setPendingConnection:   useCallback((v: PendingConnection | null) => set('pendingConnection', v), [set]),
    setLengthInput:         useCallback((v: string)                => set('lengthInput', v), [set]),
    setSnapToGridEnabled:   useCallback((v: boolean)               => set('snapToGridEnabled', v), [set]),
    setSelectedWallId:      useCallback((v: string | null)         => set('selectedWallId', v), [set]),
    setSelectedTool:        useCallback((v: LayerType)             => set('selectedTool', v), [set]),
    setHistory:             useCallback((v: HistoryEntry[])        => set('history', v), [set]),
    setHistoryIndex:        useCallback((v: number)                => set('historyIndex', v), [set]),
    setShowCloseLoopPrompt: useCallback((v: boolean)               => set('showCloseLoopPrompt', v), [set]),
    setCloseLoopLength:     useCallback((v: string)                => set('closeLoopLength', v), [set]),
    setOpenLoopEndpoints:   useCallback((v: { nodeA: string; nodeB: string } | null) => set('openLoopEndpoints', v), [set]),
    setValidationError:     useCallback((v: string | null)         => set('validationError', v), [set]),
    setNodeConstraints,
    setIsPanMode:           useCallback((v: boolean)               => set('isPanMode', v), [set]),
    setShowModeIndicator:   useCallback((v: boolean)               => set('showModeIndicator', v), [set]),
    setMenuOpen:            useCallback((v: boolean)               => set('menuOpen', v), [set]),
    setLayerOpen:           useCallback((v: boolean)               => set('layerOpen', v), [set]),
    setSelectedWindowId:    useCallback((v: string | null)         => set('selectedWindowId', v), [set]),
    setSelectedDoorId:      useCallback((v: string | null)         => set('selectedDoorId', v), [set]),
    setSelectedPassageId:   useCallback((v: string | null)         => set('selectedPassageId', v), [set]),
    setSelectedColumnId:    useCallback((v: string | null)         => set('selectedColumnId', v), [set]),
    setColumnJoinMode:      useCallback((v: boolean)               => set('columnJoinMode', v), [set]),
    setColumnsToJoin:       useCallback((v: string[])              => set('columnsToJoin', v), [set]),
    setNodeALabel:          useCallback((v: 'CW' | 'CCW')         => set('nodeALabel', v), [set]),
    setNodeBLabel:          useCallback((v: 'CW' | 'CCW')         => set('nodeBLabel', v), [set]),
  };

  return { state, dispatch, ...setters };
}
