interface PassageDialogProps {
  visible: boolean;
  wallId?: string | null;
  wallLength: number;
  editingPassageId: string | null;
  width: string;
  offset: string;
  fromNodeA: boolean;
  interiorSign?: number;
  nodeALabel: 'CW' | 'CCW';
  nodeBLabel: 'CW' | 'CCW';
  validationError: string | null;
  onWidthChange: (v: string) => void;
  onOffsetChange: (v: string) => void;
  onFromNodeAChange: (v: boolean) => void;
  onValidationErrorChange: (v: string | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
  // Delete support
  onDelete?: () => void;
}

export function PassageDialog({
  visible, wallLength, editingPassageId,
  width, offset, fromNodeA,
  interiorSign = -1,
  nodeALabel, nodeBLabel, validationError,
  onWidthChange, onOffsetChange, onFromNodeAChange, onValidationErrorChange,
  onSubmit, onCancel, onDelete,
}: PassageDialogProps) {
  if (!visible) return null;

  const isEditing = !!editingPassageId;

  // Left = CCW node, Right = CW node (from interior perspective)
  const isLeftFromNodeA = nodeALabel === 'CCW';
  const isLeftActive = fromNodeA === isLeftFromNodeA;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-gray-800 p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:max-h-[90vh] md:rounded-lg overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">
            {isEditing ? 'Edit Passage' : `Place Passage on Wall (${wallLength.toFixed(3)}m)`}
          </h3>
        </div>
        
        {/* Dimensions Section */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Width (meters)</label>
            <input type="number" inputMode="decimal" value={width}
              onChange={e => { onWidthChange(e.target.value); onValidationErrorChange(null); }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. 1.2" />
          </div>
        </div>

        {/* Position Section */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-gray-400 text-sm block mb-2">Setback Reference</label>
            <div className="flex gap-2">
              <button onClick={() => onFromNodeAChange(isLeftFromNodeA)}
                className={`flex-1 px-3 py-2 rounded text-sm ${isLeftActive ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Left
              </button>
              <button onClick={() => onFromNodeAChange(!isLeftFromNodeA)}
                className={`flex-1 px-3 py-2 rounded text-sm ${!isLeftActive ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Right
              </button>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Setback (meters)</label>
            <input type="number" inputMode="decimal" value={offset}
              onChange={e => { onOffsetChange(e.target.value); onValidationErrorChange(null); }}
              onKeyDown={e => { if (e.key === 'Enter') onSubmit(); else if (e.key === 'Escape') onCancel(); }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. 0.5" />
          </div>
        </div>

        {validationError && <p className="text-red-400 text-sm mb-4">{validationError}</p>}
        
        {/* Action buttons -- visually separated from form */}
        <div className="border-t border-gray-600/50 mt-6 pt-4 space-y-3">
          <div className="flex gap-2">
            <button onClick={onSubmit} className="flex-1 px-4 py-2.5 bg-cyan-500 text-white rounded hover:bg-cyan-600">
              {isEditing ? 'Apply' : 'Place Passage'}
            </button>
            {isEditing && onDelete && (
              <button onClick={onDelete} className="px-4 py-2.5 bg-gray-700 hover:bg-red-900 text-red-400 rounded">
                Delete
              </button>
            )}
          </div>
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