import { useState } from 'react';
import type { RoomData } from '../../types';

interface AppMenuProps {
  menuOpen: boolean;
  loopClosed: boolean;
  historyIndex: number;
  historyLength: number;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onUndo: () => void;
  onRedo: () => void;
  undoLabel: string;
  redoLabel: string;
  onExportDXF: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onClearAll: () => void;
  // Project management
  projectName: string;
  onProjectNameChange: (name: string) => void;
  rooms: RoomData[];
  activeRoomId: string;
  onSwitchRoom: (roomId: string) => void;
  onAddRoom: (name: string) => void;
  onRenameRoom: (roomId: string, name: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

export function AppMenu({
  menuOpen, loopClosed,
  historyIndex, historyLength,
  onToggleMenu, onCloseMenu,
  onUndo, onRedo, undoLabel, redoLabel,
  onExportDXF, onSaveProject, onLoadProject, onClearAll,
  projectName, onProjectNameChange,
  rooms, activeRoomId,
  onSwitchRoom, onAddRoom, onRenameRoom, onDeleteRoom,
}: AppMenuProps) {
  // Project name editing
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

  // Room CRUD
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
      {/* ===== TOP-RIGHT: Mobile — burger menu ===== */}
      <button onClick={onToggleMenu}
        className="md:hidden fixed top-4 right-4 z-50 h-10 w-10 flex items-center justify-center" title="Menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {menuOpen
            ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
          }
        </svg>
      </button>
      {menuOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={onCloseMenu} />
          <div className="md:hidden fixed top-0 right-0 bottom-0 w-[85vw] bg-gray-900 shadow-2xl z-50 flex flex-col">
            {/* Header area with close button */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-gray-700">
              <span className="text-sm text-gray-300 uppercase tracking-wider">Planimetra</span>
              <button onClick={onCloseMenu} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

              {/* ═══ PROJECT SECTION ═══ */}
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Project</span>
                {/* Project name */}
                <div className="mt-2 mb-3">
                  {editingProjectName ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={projectNameDraft}
                        onChange={e => setProjectNameDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleFinishEditProjectName(); if (e.key === 'Escape') setEditingProjectName(false); }}
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-cyan-500"
                      />
                      <button onClick={handleFinishEditProjectName} className="text-cyan-400 hover:text-cyan-300 text-sm px-2">OK</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={handleStartEditProjectName}>
                      <h2 className="text-sm text-white truncate flex-1">{projectName}</h2>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
                        className="flex-1 px-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors">
                        Create
                      </button>
                      <button onClick={() => setShowNewRoomPrompt(false)}
                        className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors">
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
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button
                                onClick={e => { e.stopPropagation(); handleStartRename(room); }}
                                className="p-1 hover:text-cyan-400 text-gray-500 rounded"
                                title="Rename"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                  className="p-1 hover:text-red-400 text-gray-500 rounded"
                                  title="Delete Room"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-700" />

              {/* ═══ ACTIONS SECTION ═══ */}
              <div className="space-y-2">
                {/* Undo / Redo — hidden on mobile, shown on desktop (mobile uses ActionBar) */}
                <div className="hidden md:block space-y-2">
                  <button onClick={() => { onUndo(); }} disabled={historyIndex <= 0}
                    className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 ${historyIndex <= 0 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                    </svg>
                    <span className="flex-1 text-left">Undo</span>
                    {undoLabel && <span className="text-xs text-gray-400">{undoLabel}</span>}
                  </button>
                  <button onClick={() => { onRedo(); }} disabled={historyIndex >= historyLength - 1}
                    className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 ${historyIndex >= historyLength - 1 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                    </svg>
                    <span className="flex-1 text-left">Redo</span>
                    {redoLabel && <span className="text-xs text-gray-400">{redoLabel}</span>}
                  </button>
                </div>
                <button onClick={() => { onExportDXF(); onCloseMenu(); }} disabled={!loopClosed}
                  className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 ${!loopClosed ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export DXF
                </button>
                <button onClick={() => { onSaveProject(); onCloseMenu(); }}
                  className="w-full px-4 py-3 rounded-lg flex items-center gap-3 bg-gray-800 text-white hover:bg-gray-700">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save Project
                </button>
                <button onClick={() => { onLoadProject(); onCloseMenu(); }}
                  className="w-full px-4 py-3 rounded-lg flex items-center gap-3 bg-gray-800 text-white hover:bg-gray-700">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><polyline points="9 14 12 11 15 14" />
                  </svg>
                  Load Project
                </button>
                <div className="pt-2 border-t border-gray-700">
                  <button onClick={() => { onClearAll(); onCloseMenu(); }}
                    className="w-full px-4 py-3 rounded-lg flex items-center gap-3 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    New Project
                  </button>
                </div>
              </div>
            </div>

            {/* Footer watermark */}
            <div className="px-4 py-2 border-t border-gray-700/50 text-center">
              <div className="text-[10px] text-gray-400">PLANIMETRA</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                © {new Date().getFullYear()} · <a href="mailto:mail@planimetra.com" className="text-cyan-600 hover:text-cyan-400 transition-colors">mail@planimetra.com</a>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
