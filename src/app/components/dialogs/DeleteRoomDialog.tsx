interface DeleteRoomDialogProps {
  roomName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

import { useIsDark } from '../../contexts/ThemeContext';

export function DeleteRoomDialog({ roomName, onConfirm, onCancel }: DeleteRoomDialogProps) {
  const isDark = useIsDark();
  if (roomName === null) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:rounded-lg flex flex-col justify-center md:justify-start`}>
        <h3 className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-semibold mb-3`}>Delete Room?</h3>
        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-sm mb-6`}>
          Delete <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>"{roomName}"</span>? This will remove all walls, doors, windows, and passages in this room.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className={`flex-1 py-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'} rounded text-sm transition-colors`}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
