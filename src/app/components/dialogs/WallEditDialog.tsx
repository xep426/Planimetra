interface WallEditDialogProps {
  visible: boolean;
  wallEditType: 'inner' | 'external';
  wallEditThickness: number;
  wallEditLength: string;
  onTypeChange: (v: 'inner' | 'external') => void;
  onThicknessChange: (v: number) => void;
  onLengthChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  // Delete wall support
  onDelete?: () => void;
  canDelete?: boolean;
  deleteDisabledReason?: string | null;
}

import { useState, useLayoutEffect } from 'react';
import { useIsDark } from '../../contexts/ThemeContext';

export function WallEditDialog({
  visible,
  wallEditType, wallEditThickness, wallEditLength,
  onTypeChange, onThicknessChange, onLengthChange,
  onSubmit, onCancel,
  onDelete, canDelete, deleteDisabledReason,
}: WallEditDialogProps) {
  const isDark = useIsDark();
  const [orig, setOrig] = useState({ wallEditType, wallEditThickness, wallEditLength });
  const [applied, setApplied] = useState(false);
  useLayoutEffect(() => {
    if (visible) { setOrig({ wallEditType, wallEditThickness, wallEditLength }); setApplied(false); }
  }, [visible]);
  const dirty = wallEditType !== orig.wallEditType ||
    wallEditThickness !== orig.wallEditThickness ||
    wallEditLength !== orig.wallEditLength;
  const handleApply = () => { setApplied(true); setTimeout(onSubmit, 400); };
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:max-h-[90vh] md:rounded-lg overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-semibold`}>
            Edit Wall
          </h3>
        </div>

        {/* Configuration Section */}
        <div className="space-y-4 mb-4">
          <div>
            <label className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm block mb-2`}>Length (meters)</label>
            <input
              type="text"
              inputMode="decimal"
              value={wallEditLength}
              onChange={e => onLengthChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
              className={`w-full px-3 py-2 ${isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} rounded text-sm border focus:outline-none focus:ring-2 focus:ring-cyan-500`}
              placeholder="e.g. 3.50"
            />
          </div>

          <div>
            <label className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm block mb-2`}>Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => onTypeChange('inner')}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  wallEditType === 'inner'
                    ? 'bg-gray-500 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}>
                Interior
              </button>
              <button
                onClick={() => onTypeChange('external')}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  wallEditType === 'external'
                    ? 'bg-gray-500 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}>
                Exterior
              </button>
            </div>
          </div>

          <div>
            <label className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm block mb-2`}>Thickness (cm)</label>
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 20, 25, 30, 40].map(thickness => (
                <button
                  key={thickness}
                  onClick={() => onThicknessChange(thickness)}
                  className={`px-3 py-2 rounded text-sm ${
                    wallEditThickness === thickness
                      ? 'bg-gray-500 text-white'
                      : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {thickness}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons -- visually separated from form */}
        <div className={`border-t ${isDark ? 'border-gray-600/50' : 'border-gray-200'} mt-6 pt-4 space-y-3`}>
          <div className="flex gap-2">
            <button
              onClick={handleApply} disabled={!dirty}
              className={`flex-1 px-4 py-2.5 rounded transition-colors ${applied ? 'bg-green-600 text-white' : dirty ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : isDark ? 'bg-cyan-900/60 text-cyan-400/50 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>
              {applied ? '✓ Applied' : 'Apply'}
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={!canDelete}
                className={`px-4 py-2.5 rounded ${
                  canDelete
                    ? isDark ? 'bg-gray-700 hover:bg-red-900 text-red-400' : 'bg-gray-100 hover:bg-red-100 text-red-600'
                    : isDark ? 'bg-gray-700 text-gray-600 cursor-not-allowed' : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                }`}
                title={!canDelete ? (deleteDisabledReason || 'Cannot delete this wall') : 'Delete this wall'}>
                Delete
              </button>
            )}
          </div>
          {!canDelete && deleteDisabledReason && (
            <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs italic`}>{deleteDisabledReason}</p>
          )}
          <button
            onClick={onCancel}
            className={`w-full px-4 py-3 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'} rounded transition-colors`}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
