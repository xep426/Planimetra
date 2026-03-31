import { useState, useEffect } from 'react';
import type { Node, Wall, WindowObj, DoorObj, PassageObj, ColumnObj, LayerType } from '../../types';
import { isLoopClosed } from '../../utils/wallGeometry';
import { findChain, solveClosedLoop } from '../../utils/solver';
import { useIsDark } from '../../contexts/ThemeContext';

interface EditorSectionProps {
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
  // For add flows -- triggers existing modal dialogs
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

// Shared input style (isDark-aware)
const inputCls = (isDark: boolean) =>
  `w-full px-2 py-1.5 rounded border text-sm focus:outline-none focus:border-cyan-500 ${isDark ? 'bg-gray-800 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'}`;
const labelCls = (isDark: boolean) =>
  `${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs block mb-1`;
const btnToggle = (active: boolean, isDark: boolean) =>
  `flex-1 px-2 py-1.5 rounded text-xs transition-colors ${active ? 'bg-gray-500 text-white' : isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;

/** Move nodeB along the existing wall direction to achieve the new length */
function moveNodeBAlongWall(nodes: Node[], walls: Wall[], wall: Wall, newLengthM: number): Node[] {
  const nA = nodes.find(n => n.id === wall.nodeA);
  const nB = nodes.find(n => n.id === wall.nodeB);
  if (!nA || !nB) return nodes;
  const dx = nB.x - nA.x;
  const dy = nB.y - nA.y;
  const currentLen = Math.hypot(dx, dy);
  if (currentLen < 0.001) return nodes;
  const newLenCm = newLengthM * 100;
  const dirX = dx / currentLen;
  const dirY = dy / currentLen;
  const deltaX = dirX * (newLenCm - currentLen);
  const deltaY = dirY * (newLenCm - currentLen);
  // BFS from nodeB (excluding nodeA) to find all downstream nodes
  const downstream = new Set<string>();
  const queue = [wall.nodeB];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (downstream.has(cur)) continue;
    downstream.add(cur);
    for (const w of walls) {
      if (w.id === wall.id) continue;
      if (w.nodeA === cur && !downstream.has(w.nodeB)) queue.push(w.nodeB);
      if (w.nodeB === cur && !downstream.has(w.nodeA)) queue.push(w.nodeA);
    }
  }
  downstream.delete(wall.nodeA);
  return nodes.map(n =>
    downstream.has(n.id) ? { ...n, x: n.x + deltaX, y: n.y + deltaY } : n
  );
}

// --- Wall Editor ---------------------------------------------------
function WallEditor({ wall, nodes, walls, unconstrainedNodes, saveHistory, setValidationError, onDeleteWall, canDeleteWall, deleteDisabledReason }: {
  wall: Wall; nodes: Node[]; walls: Wall[];
  unconstrainedNodes: Set<string>;
  saveHistory: (n: Node[], w: Wall[]) => void;
  setValidationError: (error: string | null) => void;
  onDeleteWall: () => void;
  canDeleteWall: boolean;
  deleteDisabledReason: string | null;
}) {
  const isDark = useIsDark();
  const [type, setType] = useState(wall.type);
  const [thickness, setThickness] = useState(wall.thickness);
  const [length, setLength] = useState(wall.length.toFixed(3));
  const [error, setError] = useState<string | null>(null);

  const dirty = type !== wall.type || thickness !== wall.thickness ||
    Math.abs(parseFloat(length.replace(',', '.')) - wall.length) > 0.001;
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setType(wall.type);
    setThickness(wall.thickness);
    setLength(wall.length.toFixed(3));
    setError(null);
  }, [wall.id, wall.type, wall.thickness, wall.length]);

  const handleApply = () => {
    const newLengthM = parseFloat(length.replace(',', '.'));
    const lengthChanged = !isNaN(newLengthM) && newLengthM > 0 && Math.abs(newLengthM - wall.length) > 0.001;

    let updatedNodes = nodes;
    let updatedWalls = walls.map(w =>
      w.id === wall.id ? { ...w, type, thickness, length: lengthChanged ? newLengthM : w.length } : w
    );

    if (lengthChanged) {
      const loopClosed = isLoopClosed(walls);

      if (loopClosed) {
        // Closed-loop re-solve: treat the edited wall as the "closing wall"
        const remainingWalls = walls.filter(w => w.id !== wall.id);
        const chain = findChain(wall.nodeA, wall.nodeB, remainingWalls);

        if (chain && chain.nodeIds.length >= 3) {
          const solvedNodes = solveClosedLoop(
            chain.nodeIds,
            chain.wallLengthsCm,
            newLengthM * 100,
            unconstrainedNodes,
            nodes
          );

          if (solvedNodes) {
            updatedNodes = solvedNodes;
            // Sync wall stored lengths to actual node distances after solver moves nodes
            const nodeMap = new Map(solvedNodes.map(n => [n.id, n]));
            updatedWalls = updatedWalls.map(w => {
              const nA = nodeMap.get(w.nodeA);
              const nB = nodeMap.get(w.nodeB);
              if (!nA || !nB) return w;
              return { ...w, length: Math.hypot(nB.x - nA.x, nB.y - nA.y) / 100 };
            });
          } else {
            setError('Cannot re-close the loop with that wall length.');
            return;
          }
        } else {
          updatedNodes = moveNodeBAlongWall(nodes, walls, wall, newLengthM);
        }
      } else {
        updatedNodes = moveNodeBAlongWall(nodes, walls, wall, newLengthM);
      }
    }

    setError(null);
    saveHistory(updatedNodes, updatedWalls);
    setApplied(true); setTimeout(() => setApplied(false), 1200);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls(isDark)}>Length (m)</label>
        <input type="text" inputMode="decimal" value={length} onChange={e => { setLength(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') handleApply(); }}
          className={inputCls(isDark)} />
      </div>
      <div>
        <label className={labelCls(isDark)}>Type</label>
        <div className="flex gap-1">
          <button onClick={() => setType('inner')} className={btnToggle(type === 'inner', isDark)}>Interior</button>
          <button onClick={() => setType('external')} className={btnToggle(type === 'external', isDark)}>Exterior</button>
        </div>
      </div>
      <div>
        <label className={labelCls(isDark)}>Thickness (cm)</label>
        <div className="grid grid-cols-3 gap-1">
          {[10, 15, 20, 25, 30, 40].map(t => (
            <button key={t} onClick={() => setThickness(t)} className={btnToggle(thickness === t, isDark)}>{t}</button>
          ))}
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="mt-3 pt-1 flex gap-2">
        <button onClick={handleApply} disabled={!dirty} className={`flex-1 py-1.5 text-xs rounded transition-colors ${applied ? 'bg-green-600 text-white' : dirty ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : isDark ? 'bg-cyan-900/60 text-cyan-400/50 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>{applied ? '✓ Applied' : 'Apply'}</button>
        <button onClick={onDeleteWall} disabled={!canDeleteWall}
          className={`py-1.5 px-3 text-xs rounded ${canDeleteWall ? isDark ? 'bg-gray-700 hover:bg-red-900 text-red-400' : 'bg-gray-100 hover:bg-red-100 text-red-600' : isDark ? 'bg-gray-700 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
          title={canDeleteWall ? 'Delete this wall' : deleteDisabledReason || 'Cannot delete'}>Delete</button>
      </div>
      {!canDeleteWall && deleteDisabledReason && (
        <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-[10px] mt-1 italic`}>{deleteDisabledReason}</p>
      )}
    </div>
  );
}

// --- Window Editor -------------------------------------------------
function WindowEditor({ win, wall, nodes, walls, windows, labels, interiorSign, saveHistory, onDone }: {
  win: WindowObj; wall: Wall; nodes: Node[]; walls: Wall[]; windows: WindowObj[];
  labels: { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  interiorSign: number;
  saveHistory: (n: Node[], w: Wall[], wins?: WindowObj[]) => void;
  onDone: () => void;
}) {
  const isDark = useIsDark();
  const [panelCount, setPanelCount] = useState(win.panelCount);
  const [wType, setWType] = useState(win.type);
  const [opening, setOpening] = useState(win.opening);
  const [hinge, setHinge] = useState(win.hinge);
  const [width, setWidth] = useState(win.width.toString());
  const [height, setHeight] = useState(win.height.toString());
  const [setback, setSetback] = useState(win.setback.toFixed(3));
  const [fromNodeA, setFromNodeA] = useState(win.fromNodeA);

  const dirty = panelCount !== win.panelCount || wType !== win.type || opening !== win.opening ||
    hinge !== win.hinge || fromNodeA !== win.fromNodeA ||
    Math.abs(parseFloat(width.replace(',', '.')) - win.width) > 0.0001 ||
    Math.abs(parseFloat(height.replace(',', '.')) - win.height) > 0.0001 ||
    Math.abs(parseFloat(setback.replace(',', '.')) - win.setback) > 0.0001;
  const [applied, setApplied] = useState(false);

  // Left = CCW node, Right = CW node
  const isLeftFromNodeA = labels.nodeALabel === 'CCW';
  const isLeftActive = fromNodeA === isLeftFromNodeA;

  useEffect(() => {
    setPanelCount(win.panelCount); setWType(win.type); setOpening(win.opening);
    setHinge(win.hinge); setWidth(win.width.toString()); setHeight(win.height.toString());
    setSetback(win.setback.toFixed(3)); setFromNodeA(win.fromNodeA);
  }, [win.id]);

  const handleApply = () => {
    const sb = parseFloat(setback.replace(',', '.')), w = parseFloat(width.replace(',', '.')), h = parseFloat(height.replace(',', '.'));
    if (isNaN(sb) || sb < 0 || isNaN(w) || w <= 0 || isNaN(h) || h <= 0) return;
    if (sb + w > wall.length) return;
    const centerOffset = sb + w / 2;
    const position = fromNodeA ? centerOffset / wall.length : 1 - centerOffset / wall.length;
    const newWindows = windows.map(x =>
      x.id === win.id ? { ...x, position, setback: sb, fromNodeA, panelCount, type: wType, opening, width: w, height: h, hinge } : x
    );
    saveHistory(nodes, walls, newWindows);
    setApplied(true); setTimeout(() => setApplied(false), 1200);
  };

  const handleDelete = () => {
    saveHistory(nodes, walls, windows.filter(x => x.id !== win.id));
    onDone();
  };

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls(isDark)}>Panel Count</label>
        <div className="flex gap-1">
          <button onClick={() => setPanelCount('single')} className={btnToggle(panelCount === 'single', isDark)}>Single</button>
          <button onClick={() => setPanelCount('double')} className={btnToggle(panelCount === 'double', isDark)}>Double</button>
        </div>
      </div>
      <div>
        <label className={labelCls(isDark)}>Type</label>
        <div className="flex gap-1">
          <button onClick={() => { setWType('standard'); setHeight('1.4'); }} className={btnToggle(wType === 'standard', isDark)}>Standard</button>
          <button onClick={() => { setWType('floor-to-ceiling'); setHeight('2.4'); }} className={btnToggle(wType === 'floor-to-ceiling', isDark)}>Floor-Ceil</button>
        </div>
      </div>
      <div>
        <label className={labelCls(isDark)}>Opening</label>
        <div className="flex gap-1">
          {(['fixed', 'inward', 'outward'] as const).map(o => (
            <button key={o} onClick={() => setOpening(o)} className={btnToggle(opening === o, isDark)}>{o[0].toUpperCase() + o.slice(1)}</button>
          ))}
        </div>
      </div>
      {panelCount === 'single' && opening !== 'fixed' && (
        <div>
          <label className={labelCls(isDark)}>Hinge</label>
          <div className="flex gap-1">
            <button onClick={() => setHinge('left')} className={btnToggle(hinge === 'left', isDark)}>Left</button>
            <button onClick={() => setHinge('right')} className={btnToggle(hinge === 'right', isDark)}>Right</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelCls(isDark)}>Width (m)</label><input type="number" inputMode="decimal" value={width} onChange={e => setWidth(e.target.value)} className={inputCls(isDark)} /></div>
        <div><label className={labelCls(isDark)}>Height (m)</label><input type="number" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} className={inputCls(isDark)} /></div>
      </div>
      <div>
        <label className={labelCls(isDark)}>Setback Reference</label>
        <div className="flex gap-1">
          <button onClick={() => setFromNodeA(isLeftFromNodeA)} className={btnToggle(isLeftActive, isDark)}>Left</button>
          <button onClick={() => setFromNodeA(!isLeftFromNodeA)} className={btnToggle(!isLeftActive, isDark)}>Right</button>
        </div>
      </div>
      <div><label className={labelCls(isDark)}>Setback (m)</label><input type="number" inputMode="decimal" value={setback} onChange={e => setSetback(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleApply(); }} className={inputCls(isDark)} /></div>
      <div className="mt-3 pt-1 flex gap-2">
        <button onClick={handleApply} disabled={!dirty} className={`flex-1 py-1.5 text-xs rounded transition-colors ${applied ? 'bg-green-600 text-white' : dirty ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : isDark ? 'bg-cyan-900/60 text-cyan-400/50 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>{applied ? '✓ Applied' : 'Apply'}</button>
        <button onClick={handleDelete} className={`py-1.5 px-3 text-xs rounded ${isDark ? 'bg-gray-700 hover:bg-red-900 text-red-400' : 'bg-gray-100 hover:bg-red-100 text-red-600'}`}>Delete</button>
      </div>
    </div>
  );
}

// --- Door Editor ---------------------------------------------------
function DoorEditor({ door, wall, nodes, walls, windows, doors, labels, interiorSign, saveHistory, onDone }: {
  door: DoorObj; wall: Wall; nodes: Node[]; walls: Wall[]; windows: WindowObj[]; doors: DoorObj[];
  labels: { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  interiorSign: number;
  saveHistory: (n: Node[], w: Wall[], wins?: WindowObj[], ds?: DoorObj[]) => void;
  onDone: () => void;
}) {
  const isDark = useIsDark();
  const [opening, setOpening] = useState(door.opening);
  const [hinge, setHinge] = useState(door.hinge);
  const [width, setWidth] = useState(door.width.toString());
  const [height, setHeight] = useState(door.height.toString());
  const [setback, setSetback] = useState(door.setback.toFixed(3));
  const [fromNodeA, setFromNodeA] = useState(door.fromNodeA);

  const dirty = opening !== door.opening || hinge !== door.hinge || fromNodeA !== door.fromNodeA ||
    Math.abs(parseFloat(width.replace(',', '.')) - door.width) > 0.0001 ||
    Math.abs(parseFloat(height.replace(',', '.')) - door.height) > 0.0001 ||
    Math.abs(parseFloat(setback.replace(',', '.')) - door.setback) > 0.0001;
  const [applied, setApplied] = useState(false);

  // Left = CCW node, Right = CW node
  const isLeftFromNodeA = labels.nodeALabel === 'CCW';
  const isLeftActive = fromNodeA === isLeftFromNodeA;

  useEffect(() => {
    setOpening(door.opening); setHinge(door.hinge);
    setWidth(door.width.toString()); setHeight(door.height.toString());
    setSetback(door.setback.toFixed(3)); setFromNodeA(door.fromNodeA);
  }, [door.id]);

  const handleApply = () => {
    const sb = parseFloat(setback.replace(',', '.')), w = parseFloat(width.replace(',', '.')), h = parseFloat(height.replace(',', '.'));
    if (isNaN(sb) || sb < 0 || isNaN(w) || w <= 0 || isNaN(h) || h <= 0) return;
    if (sb + w > wall.length) return;
    const centerOffset = sb + w / 2;
    const position = fromNodeA ? centerOffset / wall.length : 1 - centerOffset / wall.length;
    const newDoors = doors.map(x =>
      x.id === door.id ? { ...x, position, setback: sb, fromNodeA, opening, width: w, height: h, hinge } : x
    );
    saveHistory(nodes, walls, windows, newDoors);
    setApplied(true); setTimeout(() => setApplied(false), 1200);
  };

  const handleDelete = () => {
    saveHistory(nodes, walls, windows, doors.filter(x => x.id !== door.id));
    onDone();
  };

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls(isDark)}>Opening</label>
        <div className="flex gap-1">
          <button onClick={() => setOpening('inward')} className={btnToggle(opening === 'inward', isDark)}>Inward</button>
          <button onClick={() => setOpening('outward')} className={btnToggle(opening === 'outward', isDark)}>Outward</button>
        </div>
      </div>
      <div>
        <label className={labelCls(isDark)}>Hinge</label>
        <div className="flex gap-1">
          <button onClick={() => setHinge('left')} className={btnToggle(hinge === 'left', isDark)}>Left</button>
          <button onClick={() => setHinge('right')} className={btnToggle(hinge === 'right', isDark)}>Right</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelCls(isDark)}>Width (m)</label><input type="number" inputMode="decimal" value={width} onChange={e => setWidth(e.target.value)} className={inputCls(isDark)} /></div>
        <div><label className={labelCls(isDark)}>Height (m)</label><input type="number" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} className={inputCls(isDark)} /></div>
      </div>
      <div>
        <label className={labelCls(isDark)}>Setback Reference</label>
        <div className="flex gap-1">
          <button onClick={() => setFromNodeA(isLeftFromNodeA)} className={btnToggle(isLeftActive, isDark)}>Left</button>
          <button onClick={() => setFromNodeA(!isLeftFromNodeA)} className={btnToggle(!isLeftActive, isDark)}>Right</button>
        </div>
      </div>
      <div><label className={labelCls(isDark)}>Setback (m)</label><input type="number" inputMode="decimal" value={setback} onChange={e => setSetback(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleApply(); }} className={inputCls(isDark)} /></div>
      <div className="mt-3 pt-1 flex gap-2">
        <button onClick={handleApply} disabled={!dirty} className={`flex-1 py-1.5 text-xs rounded transition-colors ${applied ? 'bg-green-600 text-white' : dirty ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : isDark ? 'bg-cyan-900/60 text-cyan-400/50 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>{applied ? '✓ Applied' : 'Apply'}</button>
        <button onClick={handleDelete} className={`py-1.5 px-3 text-xs rounded ${isDark ? 'bg-gray-700 hover:bg-red-900 text-red-400' : 'bg-gray-100 hover:bg-red-100 text-red-600'}`}>Delete</button>
      </div>
    </div>
  );
}

// -- Passage Editor ------------------------------------------------
function PassageEditor({ passage, wall, nodes, walls, windows, doors, passages, labels, interiorSign, saveHistory, onDone }: {
  passage: PassageObj; wall: Wall; nodes: Node[]; walls: Wall[]; windows: WindowObj[]; doors: DoorObj[]; passages: PassageObj[];
  labels: { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  interiorSign: number;
  saveHistory: (n: Node[], w: Wall[], wins?: WindowObj[], ds?: DoorObj[], ps?: PassageObj[]) => void;
  onDone: () => void;
}) {
  const isDark = useIsDark();
  const [width, setWidth] = useState(passage.width.toString());
  const [offset, setOffset] = useState(passage.offset.toFixed(3));
  const [fromNodeA, setFromNodeA] = useState(passage.fromNodeA);

  const dirty = fromNodeA !== passage.fromNodeA ||
    Math.abs(parseFloat(width.replace(',', '.')) - passage.width) > 0.0001 ||
    Math.abs(parseFloat(offset.replace(',', '.')) - passage.offset) > 0.0001;
  const [applied, setApplied] = useState(false);

  // Left = CCW node, Right = CW node
  const isLeftFromNodeA = labels.nodeALabel === 'CCW';
  const isLeftActive = fromNodeA === isLeftFromNodeA;

  useEffect(() => {
    setWidth(passage.width.toString()); setOffset(passage.offset.toFixed(3)); setFromNodeA(passage.fromNodeA);
  }, [passage.id]);

  const handleApply = () => {
    const w = parseFloat(width.replace(',', '.')), o = parseFloat(offset.replace(',', '.'));
    if (isNaN(w) || w <= 0 || isNaN(o) || o < 0) return;
    if (o + w > wall.length) return;
    const centerOffset = o + w / 2;
    const position = fromNodeA ? centerOffset / wall.length : 1 - centerOffset / wall.length;
    const newPassages = passages.map(x =>
      x.id === passage.id ? { ...x, position, offset: o, fromNodeA, width: w } : x
    );
    saveHistory(nodes, walls, windows, doors, newPassages);
    setApplied(true); setTimeout(() => setApplied(false), 1200);
  };

  const handleDelete = () => {
    saveHistory(nodes, walls, windows, doors, passages.filter(x => x.id !== passage.id));
    onDone();
  };

  return (
    <div className="space-y-2.5">
      <div><label className={labelCls(isDark)}>Width (m)</label><input type="number" inputMode="decimal" value={width} onChange={e => setWidth(e.target.value)} className={inputCls(isDark)} /></div>
      <div>
        <label className={labelCls(isDark)}>Setback Reference</label>
        <div className="flex gap-1">
          <button onClick={() => setFromNodeA(isLeftFromNodeA)} className={btnToggle(isLeftActive, isDark)}>Left</button>
          <button onClick={() => setFromNodeA(!isLeftFromNodeA)} className={btnToggle(!isLeftActive, isDark)}>Right</button>
        </div>
      </div>
      <div><label className={labelCls(isDark)}>Setback (m)</label><input type="number" inputMode="decimal" value={offset} onChange={e => setOffset(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleApply(); }} className={inputCls(isDark)} /></div>
      <div className="mt-3 pt-1 flex gap-2">
        <button onClick={handleApply} disabled={!dirty} className={`flex-1 py-1.5 text-xs rounded transition-colors ${applied ? 'bg-green-600 text-white' : dirty ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : isDark ? 'bg-cyan-900/60 text-cyan-400/50 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>{applied ? '✓ Applied' : 'Apply'}</button>
        <button onClick={handleDelete} className={`py-1.5 px-3 text-xs rounded ${isDark ? 'bg-gray-700 hover:bg-red-900 text-red-400' : 'bg-gray-100 hover:bg-red-100 text-red-600'}`}>Delete</button>
      </div>
    </div>
  );
}

// --- Column Editor -------------------------------------------------
function ColumnEditor({ col, wall, nodes, walls, windows, doors, passages, columns, labels, interiorSign, saveHistory, onDone, onStartColumnJoin, canMerge }: {
  col: ColumnObj; wall: Wall; nodes: Node[]; walls: Wall[]; windows: WindowObj[]; doors: DoorObj[]; passages: PassageObj[]; columns: ColumnObj[];
  labels: { nodeALabel: 'CW' | 'CCW'; nodeBLabel: 'CW' | 'CCW' };
  interiorSign: number;
  saveHistory: (n: Node[], w: Wall[], wins?: WindowObj[], ds?: DoorObj[], ps?: PassageObj[], cs?: ColumnObj[]) => void;
  onDone: () => void;
  onStartColumnJoin: () => void;
  canMerge: boolean;
}) {
  const isDark = useIsDark();
  const isMerged = col.mergedShapes && col.mergedShapes.length > 0;
  // Left = CCW node, Right = CW node
  // 'cw' distance type = from nodeA. If nodeA is CCW, then 'cw' = Left.
  const leftType: 'cw' | 'ccw' = labels.nodeALabel === 'CCW' ? 'cw' : 'ccw';
  const rightType: 'cw' | 'ccw' = labels.nodeALabel === 'CCW' ? 'ccw' : 'cw';
  const [colWidth, setColWidth] = useState(col.width.toString());
  const [depth, setDepth] = useState(col.depth.toString());
  const [inset, setInset] = useState((col.inset ?? 0).toString());
  const [distType, setDistType] = useState<'cw' | 'ccw'>('cw');
  const [distCW, setDistCW] = useState(col.distanceToCW.toFixed(3));
  const [distCCW, setDistCCW] = useState(col.distanceToCCW.toFixed(3));

  const dirty = Math.abs(parseFloat(colWidth.replace(',', '.')) - col.width) > 0.0001 ||
    Math.abs(parseFloat(depth.replace(',', '.')) - col.depth) > 0.0001 ||
    Math.abs(parseFloat(inset.replace(',', '.')) - (col.inset ?? 0)) > 0.0001 ||
    Math.abs(parseFloat(distCW.replace(',', '.')) - col.distanceToCW) > 0.0001 ||
    Math.abs(parseFloat(distCCW.replace(',', '.')) - col.distanceToCCW) > 0.0001;
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setColWidth(col.width.toString()); setDepth(col.depth.toString());
    setInset((col.inset ?? 0).toString()); setDistCW(col.distanceToCW.toFixed(3));
    setDistCCW(col.distanceToCCW.toFixed(3));
  }, [col.id, col.width, col.depth, col.inset, col.distanceToCW, col.distanceToCCW]);

  const handleApply = () => {
    const w = parseFloat(colWidth.replace(',', '.')), d = parseFloat(depth.replace(',', '.'));
    const ins = parseFloat(inset.replace(',', '.'));
    const dist = parseFloat((distType === 'cw' ? distCW : distCCW).replace(',', '.'));
    if (isNaN(w) || w <= 0 || isNaN(d) || d <= 0 || isNaN(ins) || ins < 0 || isNaN(dist) || dist < 0) return;
    const halfW = w / 2;
    const centerDist = dist + halfW;
    const position = distType === 'cw' ? centerDist / wall.length : 1 - centerDist / wall.length;
    const otherDist = wall.length - centerDist - halfW;
    const newColumns = columns.map(x =>
      x.id === col.id ? {
        ...x, width: w, depth: d, inset: ins, position,
        distanceToCW: distType === 'cw' ? dist : otherDist,
        distanceToCCW: distType === 'ccw' ? dist : otherDist,
      } : x
    );
    saveHistory(nodes, walls, windows, doors, passages, newColumns);
    setApplied(true); setTimeout(() => setApplied(false), 1200);
  };

  const handleDelete = () => {
    saveHistory(nodes, walls, windows, doors, passages, columns.filter(x => x.id !== col.id));
    onDone();
  };

  return (
    <div className="space-y-2.5">
      {isMerged && (
        <div className={`p-2 rounded border ${isDark ? 'bg-yellow-900/30 border-yellow-600/50' : 'bg-yellow-50 border-yellow-300'}`}>
          <p className={`${isDark ? 'text-yellow-400' : 'text-yellow-700'} text-[10px]`}>Merged column \u2014 dimensions locked</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls(isDark)}>Width (m)</label>
          <input type="number" inputMode="decimal" value={colWidth} onChange={e => setColWidth(e.target.value)}
            disabled={!!isMerged} className={`${inputCls(isDark)} ${isMerged ? 'opacity-50 cursor-not-allowed' : ''}`} />
        </div>
        <div>
          <label className={labelCls(isDark)}>Depth (m)</label>
          <input type="number" inputMode="decimal" value={depth} onChange={e => setDepth(e.target.value)}
            disabled={!!isMerged} className={`${inputCls(isDark)} ${isMerged ? 'opacity-50 cursor-not-allowed' : ''}`} />
        </div>
      </div>
      <div>
        <label className={labelCls(isDark)}>Inset (m)</label>
        <input type="number" inputMode="decimal" value={inset} onChange={e => setInset(e.target.value)} className={inputCls(isDark)} />
        <p className={`${isDark ? 'text-gray-600' : 'text-gray-400'} text-[10px] mt-0.5`}>0 = flush with wall</p>
      </div>
      <div>
        <label className={labelCls(isDark)}>Setback Reference</label>
        <div className="flex gap-1">
          <button onClick={() => setDistType(leftType)} className={btnToggle(distType === leftType, isDark)}>Left</button>
          <button onClick={() => setDistType(rightType)} className={btnToggle(distType === rightType, isDark)}>Right</button>
        </div>
      </div>
      <div>
        <label className={labelCls(isDark)}>Setback (m)</label>
        <input type="number" inputMode="decimal"
          value={distType === 'cw' ? distCW : distCCW}
          onChange={e => distType === 'cw' ? setDistCW(e.target.value) : setDistCCW(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleApply(); }}
          className={inputCls(isDark)} />
      </div>
      <div className="mt-3 pt-1 flex gap-2">
        <button onClick={handleApply} disabled={!dirty} className={`flex-1 py-1.5 text-xs rounded transition-colors ${applied ? 'bg-green-600 text-white' : dirty ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : isDark ? 'bg-cyan-900/60 text-cyan-400/50 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>{applied ? '✓ Applied' : 'Apply'}</button>
        <button onClick={handleDelete} className={`py-1.5 px-3 text-xs rounded ${isDark ? 'bg-gray-700 hover:bg-red-900 text-red-400' : 'bg-gray-100 hover:bg-red-100 text-red-600'}`}>Delete</button>
      </div>
      <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-600/50' : 'border-gray-200'}`}>
        <button onClick={onStartColumnJoin} disabled={!canMerge}
          className={`w-full py-1.5 text-xs rounded ${canMerge ? isDark ? 'bg-gray-700 hover:bg-gray-600 text-green-400' : 'bg-gray-100 hover:bg-gray-200 text-green-600' : isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
          Merge Columns
        </button>
        {!canMerge && (
          <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-[10px] mt-1 italic`}>
            Requires 2+ columns that are placed along the same wall
          </p>
        )}
      </div>
    </div>
  );
}

// --- Main EditorSection --------------------------------------------
export function EditorSection(props: EditorSectionProps) {
  const {
    selectedTool, nodes, walls, windows, doors, passages, columns,
    selectedWallId, selectedWindowId, selectedDoorId, selectedPassageId, selectedColumnId,
    columnJoinMode, columnsToJoin,
    unconstrainedNodes,
    wallInteriorSign,
    calculateNodeLabels, saveHistory,
    setSelectedWindowId, setSelectedDoorId, setSelectedPassageId, setSelectedColumnId,
    setValidationError,
    onAddOrEditWindow, onAddOrEditDoor, onAddOrEditPassage, onAddOrEditColumn,
    onStartColumnJoin, onJoinColumns, onCancelColumnJoin,
    onDeleteWall, canDeleteWall, deleteWallDisabledReason,
  } = props;

  const isDark = useIsDark();
  const selectedWall = selectedWallId ? walls.find(w => w.id === selectedWallId) ?? null : null;

  // Get labels for the relevant wall
  const getLabels = (wallId: string) => {
    try { return calculateNodeLabels(wallId); }
    catch { return { nodeALabel: 'CW' as const, nodeBLabel: 'CCW' as const }; }
  };

  const sectionHeader = `text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-2`;
  const promptText = `${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs`;
  const wallInfoText = `${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs mb-2`;

  // -- Wall mode --
  if (selectedTool === 'wall') {
    if (!selectedWall) return <p className={`${promptText} italic`}>Select a wall to edit</p>;
    return (
      <div>
        <h4 className={sectionHeader}>Wall</h4>
        <WallEditor wall={selectedWall} nodes={nodes} walls={walls} unconstrainedNodes={unconstrainedNodes} saveHistory={saveHistory} setValidationError={setValidationError} onDeleteWall={onDeleteWall} canDeleteWall={canDeleteWall} deleteDisabledReason={deleteWallDisabledReason} />
      </div>
    );
  }

  // -- Window mode --
  if (selectedTool === 'window') {
    const selectedWindow = selectedWindowId ? windows.find(w => w.id === selectedWindowId) ?? null : null;
    if (selectedWindow) {
      const wall = walls.find(w => w.id === selectedWindow.wallId);
      if (!wall) return null;
      return (
        <div>
          <h4 className={sectionHeader}>Window</h4>
          <WindowEditor
            win={selectedWindow} wall={wall} nodes={nodes} walls={walls} windows={windows}
            labels={getLabels(wall.id)} interiorSign={wallInteriorSign.get(wall.id) ?? -1} saveHistory={saveHistory} onDone={() => setSelectedWindowId(null)}
          />
        </div>
      );
    }
    if (selectedWall) {
      return (
        <div>
          <h4 className={sectionHeader}>Window</h4>
          <p className={wallInfoText}>Wall selected ({selectedWall.length.toFixed(3)}m)</p>
          <button onClick={onAddOrEditWindow} className="w-full py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded">
            + Add Window
          </button>
        </div>
      );
    }
    return <p className={`${promptText} italic`}>Select a wall or window</p>;
  }

  // -- Door mode --
  if (selectedTool === 'door') {
    const selectedDoor = selectedDoorId ? doors.find(d => d.id === selectedDoorId) ?? null : null;
    if (selectedDoor) {
      const wall = walls.find(w => w.id === selectedDoor.wallId);
      if (!wall) return null;
      return (
        <div>
          <h4 className={sectionHeader}>Door</h4>
          <DoorEditor
            door={selectedDoor} wall={wall} nodes={nodes} walls={walls} windows={windows} doors={doors}
            labels={getLabels(wall.id)} interiorSign={wallInteriorSign.get(wall.id) ?? -1} saveHistory={saveHistory} onDone={() => setSelectedDoorId(null)}
          />
        </div>
      );
    }
    if (selectedWall) {
      return (
        <div>
          <h4 className={sectionHeader}>Door</h4>
          <p className={wallInfoText}>Wall selected ({selectedWall.length.toFixed(3)}m)</p>
          <button onClick={onAddOrEditDoor} className="w-full py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded">
            + Add Door
          </button>
        </div>
      );
    }
    return <p className={`${promptText} italic`}>Select a wall or door</p>;
  }

  // -- Passage mode --
  if (selectedTool === 'passage') {
    const selectedPassage = selectedPassageId ? passages.find(p => p.id === selectedPassageId) ?? null : null;
    if (selectedPassage) {
      const wall = walls.find(w => w.id === selectedPassage.wallId);
      if (!wall) return null;
      return (
        <div>
          <h4 className={sectionHeader}>Passage</h4>
          <PassageEditor
            passage={selectedPassage} wall={wall} nodes={nodes} walls={walls} windows={windows} doors={doors} passages={passages}
            labels={getLabels(wall.id)} interiorSign={wallInteriorSign.get(wall.id) ?? -1} saveHistory={saveHistory} onDone={() => setSelectedPassageId(null)}
          />
        </div>
      );
    }
    if (selectedWall) {
      return (
        <div>
          <h4 className={sectionHeader}>Passage</h4>
          <p className={wallInfoText}>Wall selected ({selectedWall.length.toFixed(3)}m)</p>
          <button onClick={onAddOrEditPassage} className="w-full py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded">
            + Add Passage
          </button>
        </div>
      );
    }
    return <p className={`${promptText} italic`}>Select a wall or passage</p>;
  }

  // -- Column mode --
  if (selectedTool === 'column') {
    if (columnJoinMode) {
      return (
        <div>
          <h4 className={sectionHeader}>Merge Columns</h4>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-xs mb-2`}>
            Selected: {columnsToJoin.length} column{columnsToJoin.length !== 1 ? 's' : ''}
          </p>
          <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-[10px] mb-3`}>Select 2 columns along the same wall to merge them</p>
          <div className="flex gap-2">
            <button onClick={onJoinColumns} disabled={columnsToJoin.length < 2}
              className={`flex-1 py-1.5 text-xs rounded ${columnsToJoin.length < 2 ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
              Merge
            </button>
            <button onClick={onCancelColumnJoin} className={`flex-1 py-1.5 text-xs rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    const selectedColumn = selectedColumnId ? columns.find(c => c.id === selectedColumnId) ?? null : null;
    if (selectedColumn) {
      const wall = walls.find(w => w.id === selectedColumn.wallId);
      if (!wall) return null;
      const sameWallColumns = columns.filter(c => c.wallId === selectedColumn.wallId);
      const canMerge = sameWallColumns.length >= 2;
      return (
        <div>
          <h4 className={sectionHeader}>Column</h4>
          <ColumnEditor
            col={selectedColumn} wall={wall} nodes={nodes} walls={walls} windows={windows} doors={doors}
            passages={passages} columns={columns} labels={getLabels(wall.id)}
            interiorSign={wallInteriorSign.get(wall.id) ?? -1}
            saveHistory={saveHistory} onDone={() => setSelectedColumnId(null)}
            onStartColumnJoin={onStartColumnJoin} canMerge={canMerge}
          />
        </div>
      );
    }
    if (selectedWall) {
      return (
        <div>
          <h4 className={sectionHeader}>Column</h4>
          <p className={wallInfoText}>Wall selected ({selectedWall.length.toFixed(3)}m)</p>
          <button onClick={onAddOrEditColumn} className="w-full py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded">
            + Add Column
          </button>
        </div>
      );
    }
    return (
      <div>
        <p className={`${promptText} italic`}>Select a wall or column</p>
      </div>
    );
  }

  return <p className={`${promptText} italic`}>Select an element to edit</p>;
}

