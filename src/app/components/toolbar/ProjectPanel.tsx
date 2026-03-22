import { useState } from 'react';
import type { RoomData } from '../../types';

interface ProjectPanelProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  rooms: RoomData[];
  activeRoomId: string;
  loopClosed: boolean;
  onSwitchRoom: (roomId: string) => void;
  onAddRoom: (name: string) => void;
  onRenameRoom: (roomId: string, name: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onExportDXF: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onClearAll: () => void;
}

export function ProjectPanel({
  panelOpen, onTogglePanel,
  projectName, onProjectNameChange,
  rooms, activeRoomId, loopClosed,
  onSwitchRoom, onAddRoom, onRenameRoom, onDeleteRoom,
  onExportDXF, onSaveProject, onLoadProject, onClearAll,
}: ProjectPanelProps) {
  const [showNewRoomPrompt, setShowNewRoomPrompt] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState('');
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');

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

  const handleStartEditProjectName = () => {
    setEditingProjectName(true);
    setProjectNameDraft(projectName);
  };

  const handleFinishEditProjectName = () => {
    const name = projectNameDraft.trim();
    if (name) onProjectNameChange(name);
    setEditingProjectName(false);
  };

  return (
    <>
      {/* Toggle button — desktop only */}
      <button
        onClick={onTogglePanel}
        className="hidden md:flex fixed top-4 right-4 z-40 w-10 h-10 rounded-lg shadow-lg bg-gray-800 border border-gray-700 items-center justify-center hover:bg-gray-700 transition-colors"
        title={panelOpen ? 'Close Panel' : 'Open Project Panel'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {panelOpen ? (
            <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
          ) : (
            <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></>
          )}
        </svg>
      </button>

      {/* Panel — desktop only */}
      {panelOpen && (
        <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-72 bg-gray-900/95 backdrop-blur border-l border-gray-700 z-30 flex-col overflow-hidden">
          {/* Header */}
          <div className="pt-5 px-4 pb-3 border-b border-gray-700">
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

          {/* Rooms section */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Rooms</span>
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
                      {/* Room icon */}
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

                      {/* Actions (visible on hover) */}
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

                    {/* Room stats */}
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

          {/* Action buttons */}
          <div className="px-3 py-3 border-t border-gray-700 space-y-1.5">
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
            <div className="pt-1.5 border-t border-gray-800">
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
