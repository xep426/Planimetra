interface WallDeleteConfirmDialogProps {
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

import { useIsDark } from '../../contexts/ThemeContext';

export function WallDeleteConfirmDialog({
  visible, message, onConfirm, onCancel,
}: WallDeleteConfirmDialogProps) {
  const isDark = useIsDark();
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:max-h-[90vh] md:rounded-lg overflow-y-auto flex flex-col justify-center md:justify-start`}>
        <h3 className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-semibold mb-3`}>Delete Wall?</h3>

        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-sm mb-2`}>
          Are you sure you want to delete this wall?
        </p>

        {message && (
          <div className="bg-yellow-900/40 border border-yellow-600/50 rounded px-3 py-2 mb-4">
            <p className="text-yellow-300 text-sm flex items-start gap-2">
              <span className="shrink-0 mt-0.5">{'\u26A0\uFE0F'}</span>
              <span>{message}</span>
            </p>
          </div>
        )}

        <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mb-4`}>
          Orphaned nodes will also be cleaned up.
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
