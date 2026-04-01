import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { LayerType } from '../../types';
import { useIsDark } from '../../contexts/ThemeContext';

interface ActionBarProps {
  selectedTool: LayerType;
  selectedWallId: string | null;
  selectedWindowId: string | null;
  selectedDoorId: string | null;
  selectedPassageId: string | null;
  selectedColumnId: string | null;
  columnJoinMode: boolean;
  columnsToJoinCount: number;
  columnsCount: number;
  historyIndex: number;
  historyLength: number;
  onUndo: () => void;
  onRedo: () => void;
  onEditWall: () => void;
  onAddOrEditWindow: () => void;
  onDeleteWindow: () => void;
  onAddOrEditDoor: () => void;
  onDeleteDoor: () => void;
  onAddOrEditPassage: () => void;
  onDeletePassage: () => void;
  onAddOrEditColumn: () => void;
  onDeleteColumn: () => void;
  onStartColumnJoin: () => void;
  onJoinColumns: () => void;
  onCancelColumnJoin: () => void;
  guiReady?: boolean;
  hideMobile?: boolean;
  renderOverride?: React.ReactNode;
}

export function ActionBar({
  guiReady = true,
  selectedTool,
  selectedWallId, selectedWindowId, selectedDoorId, selectedPassageId, selectedColumnId,
  columnJoinMode, columnsToJoinCount, columnsCount,
  historyIndex, historyLength,
  onUndo, onRedo,
  onEditWall, onAddOrEditWindow, onDeleteWindow, onAddOrEditDoor, onDeleteDoor,
  onAddOrEditPassage, onDeletePassage, onAddOrEditColumn, onDeleteColumn,
  onStartColumnJoin, onJoinColumns, onCancelColumnJoin,
  hideMobile = false,
  renderOverride,
}: ActionBarProps) {
  const isDark = useIsDark();
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;
  const showMobile = !hideMobile;

  // Column tool shows two label buttons; everything else shows one
  const labelThreshold = (selectedTool === 'column' && !columnJoinMode) ? 420 : 320;
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const showLabels = windowWidth >= labelThreshold;

  const disabledToast = (msg: string) => toast.error(msg, { duration: 2000 });

  // Round icon-only button
  const iconBtn = (active: boolean, green = false) =>
    `w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90 ${
      active
        ? green ? 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white' : 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700'
        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
    }`;

  // Pill button with icon + label
  const labelBtn = (active: boolean, green = false) =>
    `h-11 rounded-full px-4 shadow-lg flex items-center gap-2 text-sm font-medium transition-all active:scale-95 ${
      active
        ? green ? 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white' : 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700'
        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
    }`;

  const editIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );

  const addIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  const divider = <div className={`w-px h-5 mx-1 ${isDark ? 'bg-gray-300/50' : 'bg-gray-500/50'}`} />;
  const label = (text: string) => showLabels ? <span>{text}</span> : null;

  // Context action (right of divider)
  const contextAction = (() => {
    if (selectedTool === 'wall') {
      const active = !!selectedWallId;
      return (
        <button onClick={active ? onEditWall : () => disabledToast('Select a wall first')}
          className={showLabels ? labelBtn(active) : iconBtn(active)}>
          {editIcon}{label('Edit Wall')}
        </button>
      );
    }
    if (selectedTool === 'window') {
      const active = !!selectedWindowId || !!selectedWallId;
      const green = !selectedWindowId && !!selectedWallId;
      return (
        <button onClick={active ? onAddOrEditWindow : () => disabledToast('Select a wall first')}
          className={showLabels ? labelBtn(active, green) : iconBtn(active, green)}>
          {selectedWindowId ? editIcon : addIcon}
          {label(selectedWindowId ? 'Edit Window' : 'Add Window')}
        </button>
      );
    }
    if (selectedTool === 'door') {
      const active = !!selectedDoorId || !!selectedWallId;
      const green = !selectedDoorId && !!selectedWallId;
      return (
        <button onClick={active ? onAddOrEditDoor : () => disabledToast('Select a wall first')}
          className={showLabels ? labelBtn(active, green) : iconBtn(active, green)}>
          {selectedDoorId ? editIcon : addIcon}
          {label(selectedDoorId ? 'Edit Door' : 'Add Door')}
        </button>
      );
    }
    if (selectedTool === 'passage') {
      const active = !!selectedPassageId || !!selectedWallId;
      const green = !selectedPassageId && !!selectedWallId;
      return (
        <button onClick={active ? onAddOrEditPassage : () => disabledToast('Select a wall first')}
          className={showLabels ? labelBtn(active, green) : iconBtn(active, green)}>
          {selectedPassageId ? editIcon : addIcon}
          {label(selectedPassageId ? 'Edit Passage' : 'Add Passage')}
        </button>
      );
    }
    if (selectedTool === 'column' && !columnJoinMode) {
      const active = !!selectedColumnId || !!selectedWallId;
      const green = !selectedColumnId && !!selectedWallId;
      const isMergeDisabled = columnsCount < 2;
      return (<>
        <button onClick={active ? onAddOrEditColumn : () => disabledToast('Select a wall first')}
          className={showLabels ? labelBtn(active, green) : iconBtn(active, green)}>
          {selectedColumnId ? editIcon : addIcon}
          {label(selectedColumnId ? 'Edit Column' : 'Add Column')}
        </button>
        <button onClick={isMergeDisabled ? () => disabledToast('Need at least 2 columns to merge') : onStartColumnJoin}
          className={showLabels ? labelBtn(!isMergeDisabled) : iconBtn(!isMergeDisabled)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="8" height="8" /><rect x="2" y="13" width="8" height="8" /><rect x="13" y="3" width="8" height="18" />
          </svg>
          {label('Merge')}
        </button>
      </>);
    }
    if (selectedTool === 'column' && columnJoinMode) {
      return (<>
        <button onClick={columnsToJoinCount < 2 ? () => disabledToast('Select at least 2 columns') : onJoinColumns}
          className={iconBtn(columnsToJoinCount >= 2, true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </button>
        <button onClick={onCancelColumnJoin} className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center bg-white hover:bg-red-50 active:bg-red-100 active:scale-90 transition-all" title="Cancel Merge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </>);
    }
    return null;
  })();

  const normalButtons = (
    <div className="flex items-center gap-2">
      {/* Undo + Redo */}
      <button onClick={canUndo ? onUndo : () => disabledToast('Nothing to undo')} className={iconBtn(canUndo)} title="Undo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </svg>
      </button>
      <button onClick={canRedo ? onRedo : () => disabledToast('Nothing to redo')} className={iconBtn(canRedo)} title="Redo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />
        </svg>
      </button>

      {divider}

      {/* Right: context action */}
      {contextAction}
    </div>
  );

  return (
    <>
      <div className={`md:hidden fixed bottom-4 inset-x-0 flex justify-center z-40 transition-all ${guiReady ? 'duration-500 translate-y-0 opacity-100' : 'duration-0 translate-y-4 opacity-0'}`}>
        <div className="relative">
          {renderOverride && (
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${showMobile ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              {renderOverride}
            </div>
          )}
          <div className={`absolute inset-0 transition-opacity duration-200 ${showMobile ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {normalButtons}
          </div>
          <div className="opacity-0 pointer-events-none">
            {normalButtons}
          </div>
        </div>
      </div>
    </>
  );
}
