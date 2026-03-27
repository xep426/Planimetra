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

export function WallEditDialog({
  visible,
  wallEditType, wallEditThickness, wallEditLength,
  onTypeChange, onThicknessChange, onLengthChange,
  onSubmit, onCancel,
  onDelete, canDelete, deleteDisabledReason,
}: WallEditDialogProps) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-gray-800 p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:max-h-[90vh] md:rounded-lg overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">
            Edit Wall
          </h3>
        </div>
        
        {/* Configuration Section */}
        <div className="space-y-4 mb-4">
          <div>
            <label className="text-gray-400 text-sm block mb-2">Length (meters)</label>
            <input
              type="text"
              inputMode="decimal"
              value={wallEditLength}
              onChange={e => onLengthChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="e.g. 3.50"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-2">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => onTypeChange('inner')}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  wallEditType === 'inner' 
                    ? 'bg-gray-500 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}>
                Interior
              </button>
              <button
                onClick={() => onTypeChange('external')}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  wallEditType === 'external' 
                    ? 'bg-gray-500 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}>
                Exterior
              </button>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-2">Thickness (cm)</label>
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 20, 25, 30, 40].map(thickness => (
                <button
                  key={thickness}
                  onClick={() => onThicknessChange(thickness)}
                  className={`px-3 py-2 rounded text-sm ${
                    wallEditThickness === thickness
                      ? 'bg-gray-500 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                  {thickness}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Action buttons -- visually separated from form */}
        <div className="border-t border-gray-600/50 mt-6 pt-4 space-y-3">
          <div className="flex gap-2">
            <button 
              onClick={onSubmit} 
              className="flex-1 px-4 py-2.5 bg-cyan-500 text-white rounded hover:bg-cyan-600">
              Apply
            </button>
            {onDelete && (
              <button 
                onClick={onDelete}
                disabled={!canDelete}
                className={`px-4 py-2.5 rounded ${
                  canDelete
                    ? 'bg-gray-700 hover:bg-red-900 text-red-400'
                    : 'bg-gray-700 text-gray-600 cursor-not-allowed'
                }`}
                title={!canDelete ? (deleteDisabledReason || 'Cannot delete this wall') : 'Delete this wall'}>
                Delete
              </button>
            )}
          </div>
          {!canDelete && deleteDisabledReason && (
            <p className="text-gray-500 text-xs italic">{deleteDisabledReason}</p>
          )}
          <button 
            onClick={onCancel} 
            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}