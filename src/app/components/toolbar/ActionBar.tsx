import type { LayerType } from '../../types';

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
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;
  const showMobile = !hideMobile;

  const undoBtn = (
    <button onClick={onUndo} disabled={!canUndo}
      className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-colors ${canUndo ? 'bg-white hover:bg-gray-50 text-gray-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
      title="Undo">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
      </svg>
    </button>
  );

  const redoBtn = (
    <button onClick={onRedo} disabled={!canRedo}
      className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-colors ${canRedo ? 'bg-white hover:bg-gray-50 text-gray-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
      title="Redo">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />
      </svg>
    </button>
  );

  const normalButtons = (
    <div className="flex items-center gap-2">
      {undoBtn}
      {/* Edit Wall (wall mode, always visible, disabled if no wall selected) */}
      {selectedTool === 'wall' && (
          <button onClick={onEditWall} disabled={!selectedWallId}
            className={`h-12 px-5 rounded-full shadow-lg flex items-center justify-center gap-2 transition-colors ${selectedWallId ? 'bg-white hover:bg-gray-50 text-gray-800' : 'bg-gray-200 cursor-not-allowed text-gray-400'}`}
            title={selectedWallId ? 'Edit Wall' : 'Select a wall first'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="text-sm font-semibold whitespace-nowrap">Edit Wall</span>
          </button>
      )}
      {/* Add/Edit + Delete Window (window mode) */}
      {selectedTool === 'window' && (() => {
        const hasWindowSelected = !!selectedWindowId;
        const hasWallSelected = !!selectedWallId;
        const isDisabled = !hasWindowSelected && !hasWallSelected;
        const isAddMode = !hasWindowSelected && hasWallSelected;
        const label = hasWindowSelected ? 'Edit Window' : 'Add Window';
        return (<div className="flex items-center gap-2">
          <button onClick={onAddOrEditWindow} disabled={isDisabled}
            className={`h-12 px-5 rounded-full shadow-lg flex items-center justify-center gap-2 transition-colors ${isDisabled ? 'bg-gray-200 cursor-not-allowed text-gray-400' : isAddMode ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-800'}`}
            title={isDisabled ? 'Select a wall or window' : label}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {hasWindowSelected ? (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>) : (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>)}
            </svg>
            <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
          </button>
        </div>);
      })()}
      {/* Add/Edit + Delete Door */}
      {selectedTool === 'door' && (() => {
        const hasDoorSelected = !!selectedDoorId;
        const hasWallSelected = !!selectedWallId;
        const isDisabled = !hasDoorSelected && !hasWallSelected;
        const isAddMode = !hasDoorSelected && hasWallSelected;
        const label = hasDoorSelected ? 'Edit Door' : 'Add Door';
        return (<div className="flex items-center gap-2">
          <button onClick={onAddOrEditDoor} disabled={isDisabled}
            className={`h-12 px-5 rounded-full shadow-lg flex items-center justify-center gap-2 transition-colors ${isDisabled ? 'bg-gray-200 cursor-not-allowed text-gray-400' : isAddMode ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-800'}`}
            title={isDisabled ? 'Select a wall or door' : label}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {hasDoorSelected ? (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>) : (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>)}
            </svg>
            <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
          </button>
        </div>);
      })()}
      {/* Add/Edit + Delete Passage */}
      {selectedTool === 'passage' && (() => {
        const hasPassageSelected = !!selectedPassageId;
        const hasWallSelected = !!selectedWallId;
        const isDisabled = !hasPassageSelected && !hasWallSelected;
        const isAddMode = !hasPassageSelected && hasWallSelected;
        const label = hasPassageSelected ? 'Edit Passage' : 'Add Passage';
        return (<div className="flex items-center gap-2">
          <button onClick={onAddOrEditPassage} disabled={isDisabled}
            className={`h-12 px-5 rounded-full shadow-lg flex items-center justify-center gap-2 transition-colors ${isDisabled ? 'bg-gray-200 cursor-not-allowed text-gray-400' : isAddMode ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-800'}`}
            title={isDisabled ? 'Select a wall or passage' : label}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {hasPassageSelected ? (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>) : (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>)}
            </svg>
            <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
          </button>
        </div>);
      })()}
      {/* Column buttons (not join mode) */}
      {selectedTool === 'column' && !columnJoinMode && (() => {
        const hasColumnSelected = !!selectedColumnId;
        const hasWallSelected = !!selectedWallId;
        const isAddDisabled = !hasColumnSelected && !hasWallSelected;
        const isAddMode = !hasColumnSelected && hasWallSelected;
        const isMergeDisabled = columnsCount < 2;
        const label = hasColumnSelected ? 'Edit Column' : 'Add Column';
        return (<div className="flex items-center gap-2">
          <button onClick={onAddOrEditColumn} disabled={isAddDisabled}
            className={`h-12 px-5 rounded-full shadow-lg flex items-center justify-center gap-2 transition-colors ${isAddDisabled ? 'bg-gray-200 cursor-not-allowed text-gray-400' : isAddMode ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-800'}`}
            title={hasColumnSelected ? 'Edit Column' : hasWallSelected ? 'Place Column' : 'Select a wall first'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {hasColumnSelected ? (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>) : (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>)}
            </svg>
            <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
          </button>
          <button onClick={onStartColumnJoin} disabled={isMergeDisabled}
            className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center ${isMergeDisabled ? 'bg-gray-200 cursor-not-allowed' : 'bg-white hover:bg-green-50'}`}
            title={isMergeDisabled ? 'Need at least 2 columns' : 'Merge Columns'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isMergeDisabled ? '#9ca3af' : '#22c55e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><line x1="10" y1="6.5" x2="14" y2="6.5" /><line x1="10" y1="17.5" x2="14" y2="17.5" />
            </svg>
          </button>
        </div>);
      })()}
      {/* Column join mode buttons */}
      {selectedTool === 'column' && columnJoinMode && (<div className="flex items-center gap-2">
        <button onClick={onJoinColumns} disabled={columnsToJoinCount < 2}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center ${columnsToJoinCount < 2 ? 'bg-gray-200 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}
          title={columnsToJoinCount < 2 ? 'Select at least 2 columns to merge' : 'Confirm Merge'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </button>
        <button onClick={onCancelColumnJoin}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-white hover:bg-red-50" title="Cancel Merge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>)}
      {redoBtn}
    </div>
  );

  return (
    <>
      {/* ===== BOTTOM CENTER: Undo + Context actions + Redo ===== */}
      <div className={`md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ${guiReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
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
