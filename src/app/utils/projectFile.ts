// Save / Load floor plan project files (.floorplan JSON)
// Supports multi-room projects and legacy single-room imports

import type {
  Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj,
  Transform, HistoryEntry, RoomData, MultiRoomProject,
} from '../types';

/** Legacy single-room format (v1) */
export interface ProjectData {
  version: number;
  savedAt: string;
  nodes: Node[];
  walls: Wall[];
  windows: WindowObj[];
  doors: DoorObj[];
  passages: PassageObj[];
  columns: ColumnObj[];
  selectedTool: string;
  history: HistoryEntry[];
  historyIndex: number;
  transform: Transform;
  unconstrainedNodes: string[];
}

const CURRENT_VERSION = 2; // v2 = multi-room

// ---------------------------------------------------------------------------
// Multi-room project save
// ---------------------------------------------------------------------------

export function saveMultiRoomProject(
  projectName: string,
  rooms: RoomData[],
  activeRoomId: string,
): void {
  const project: MultiRoomProject = {
    version: CURRENT_VERSION,
    savedAt: new Date().toISOString(),
    projectName,
    rooms,
    activeRoomId,
  };

  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'project';
  const filename = `${safeName}-${timestamp}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Multi-room project load (with legacy single-room fallback)
// ---------------------------------------------------------------------------

export interface LoadedProject {
  projectName: string;
  rooms: RoomData[];
  activeRoomId: string;
}

/** Helper: normalise a legacy single-room file into a RoomData */
function legacyToRoom(parsed: any): RoomData {
  const id = `room-${Date.now()}`;
  return {
    id,
    name: 'Imported Room',
    nodes: parsed.nodes ?? [],
    walls: parsed.walls ?? [],
    windows: (parsed.windows ?? []).map((w: any) => ({
      ...w,
      hinge: w.hinge ?? 'left',
      setback: w.setback !== undefined && w.offset !== undefined
        ? w.offset : w.setback ?? w.offset ?? 0,
    })),
    doors: (parsed.doors ?? []).map((d: any) => ({
      ...d,
      hinge: d.hinge ?? 'left',
      setback: d.setback ?? d.offset ?? 0,
    })),
    passages: parsed.passages ?? [],
    columns: parsed.columns ?? [],
    history: parsed.history ?? [{
      nodes: parsed.nodes ?? [],
      walls: parsed.walls ?? [],
      windows: [],
      doors: [],
      passages: [],
      columns: [],
    }],
    historyIndex: parsed.historyIndex ?? 0,
    transform: parsed.transform ?? { x: 0, y: 0, scale: 1, rotation: 0 },
    unconstrainedNodes: parsed.unconstrainedNodes ?? [],
    selectedTool: parsed.selectedTool ?? 'wall',
  };
}

export function loadMultiRoomProject(): Promise<LoadedProject> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { reject(new Error('No file selected')); return; }

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const parsed = JSON.parse(text);

          // Validate minimum structure
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid project file');
          }

          // --- Detect multi-room (v2+) vs legacy (v1 / unversioned) ---
          if (parsed.version >= 2 && Array.isArray(parsed.rooms)) {
            // Multi-room project
            const rooms: RoomData[] = parsed.rooms.map((r: any) => ({
              ...r,
              windows: (r.windows ?? []).map((w: any) => ({
                ...w,
                hinge: w.hinge ?? 'left',
                setback: w.setback !== undefined && w.offset !== undefined
                  ? w.offset : w.setback ?? w.offset ?? 0,
              })),
              doors: (r.doors ?? []).map((d: any) => ({
                ...d,
                hinge: d.hinge ?? 'left',
                setback: d.setback ?? d.offset ?? 0,
              })),
            }));
            resolve({
              projectName: parsed.projectName ?? 'Untitled Project',
              rooms,
              activeRoomId: parsed.activeRoomId ?? rooms[0]?.id ?? '',
            });
          } else {
            // Legacy single-room file
            if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
              throw new Error('Invalid project file: missing nodes');
            }
            if (!parsed.walls || !Array.isArray(parsed.walls)) {
              throw new Error('Invalid project file: missing walls');
            }
            const room = legacyToRoom(parsed);
            resolve({
              projectName: 'Imported Project',
              rooms: [room],
              activeRoomId: room.id,
            });
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to parse project file'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };

    input.oncancel = () => reject(new Error('File selection cancelled'));
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Legacy exports (kept for backward compatibility, used by mobile menu)
// ---------------------------------------------------------------------------

export function saveProject(state: Omit<ProjectData, 'version' | 'savedAt'>): void {
  const project: ProjectData = {
    version: 1,
    savedAt: new Date().toISOString(),
    ...state,
  };

  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `planimetra-${timestamp}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadProject(): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const parsed = JSON.parse(text);

          if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
            throw new Error('Invalid project file: missing nodes');
          }
          if (!parsed.walls || !Array.isArray(parsed.walls)) {
            throw new Error('Invalid project file: missing walls');
          }

          const project: ProjectData = {
            version: parsed.version ?? 1,
            savedAt: parsed.savedAt ?? '',
            nodes: parsed.nodes,
            walls: parsed.walls,
            windows: parsed.windows ?? [],
            doors: parsed.doors ?? [],
            passages: parsed.passages ?? [],
            columns: parsed.columns ?? [],
            selectedTool: parsed.selectedTool ?? 'wall',
            history: parsed.history ?? [{ nodes: parsed.nodes, walls: parsed.walls, windows: [], doors: [], passages: [], columns: [] }],
            historyIndex: parsed.historyIndex ?? 0,
            transform: parsed.transform ?? { x: 0, y: 0, scale: 1, rotation: 0 },
            unconstrainedNodes: parsed.unconstrainedNodes ?? [],
          };

          resolve(project);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to parse project file'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };

    input.oncancel = () => reject(new Error('File selection cancelled'));
    input.click();
  });
}
