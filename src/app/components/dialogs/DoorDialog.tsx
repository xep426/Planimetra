interface DoorDialogProps {
  visible: boolean;
  wallId?: string | null;
  wallLength: number;
  editingDoorId: string | null;
  opening: 'inward' | 'outward';
  hinge: 'left' | 'right';
  width: string;
  height: string;
  setback: string;
  fromNodeA: boolean;
  interiorSign?: number;
  nodeALabel: 'CW' | 'CCW';
  nodeBLabel: 'CW' | 'CCW';
  validationError: string | null;
  onOpeningChange: (v: 'inward' | 'outward') => void;
  onHingeChange: (v: 'left' | 'right') => void;
  onWidthChange: (v: string) => void;
  onHeightChange: (v: string) => void;
  onSetbackChange: (v: string) => void;
  onFromNodeAChange: (v: boolean) => void;
  onValidationErrorChange: (v: string | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
  // Delete support
  onDelete?: () => void;
}

import { useState, useLayoutEffect, useRef } from 'react';

export function DoorDialog({
  visible, wallLength, editingDoorId,
  opening, hinge, width, height, setback, fromNodeA,
  interiorSign = -1,
  nodeALabel, nodeBLabel, validationError,
  onOpeningChange, onHingeChange, onWidthChange, onHeightChange,
  onSetbackChange, onFromNodeAChange, onValidationErrorChange,
  onSubmit, onCancel, onDelete,
}: DoorDialogProps) {
  const origRef = useRef({ opening, hinge, width, height, setback, fromNodeA });
  const [applied, setApplied] = useState(false);
  useLayoutEffect(() => {
    if (visible) { origRef.current = { opening, hinge, width, height, setback, fromNodeA }; setApplied(false); }
  }, [visible]);
  const dirty = opening !== origRef.current.opening || hinge !== origRef.current.hinge ||
    fromNodeA !== origRef.current.fromNodeA || width !== origRef.current.width ||
    height !== origRef.current.height || setback !== origRef.current.setback;
  const handleApply = () => { setApplied(true); setTimeout(onSubmit, 400); };
  if (!visible) return null;

  const isEditing = !!editingDoorId;

  // Left = CCW node, Right = CW node (from interior perspective)
  const isLeftFromNodeA = nodeALabel === 'CCW';
  const isLeftActive = fromNodeA === isLeftFromNodeA;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-gray-800 p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:max-h-[90vh] md:rounded-lg overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">
            {isEditing ? 'Edit Door' : `Place Door on Wall (${wallLength.toFixed(3)}m)`}
          </h3>
        </div>
        
        {/* Configuration Section */}
        <div className="space-y-4 mb-4">
          <div>
            <label className="text-gray-400 text-sm block mb-2">Opening</label>
            <div className="flex gap-2">
              <button onClick={() => onOpeningChange('inward')}
                className={`flex-1 px-3 py-2 rounded text-sm ${opening === 'inward' ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Inward
              </button>
              <button onClick={() => onOpeningChange('outward')}
                className={`flex-1 px-3 py-2 rounded text-sm ${opening === 'outward' ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Outward
              </button>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-2">Hinge Side</label>
            <div className="flex gap-2">
              <button onClick={() => onHingeChange('left')}
                className={`flex-1 px-3 py-2 rounded text-sm ${hinge === 'left' ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Left
              </button>
              <button onClick={() => onHingeChange('right')}
                className={`flex-1 px-3 py-2 rounded text-sm ${hinge === 'right' ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Right
              </button>
            </div>
          </div>
        </div>

        {/* Dimensions Section */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Width (meters)</label>
            <input type="number" inputMode="decimal" value={width}
              onChange={e => { onWidthChange(e.target.value); onValidationErrorChange(null); }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. 0.9" />
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Height (meters)</label>
            <input type="number" inputMode="decimal" value={height}
              onChange={e => { onHeightChange(e.target.value); onValidationErrorChange(null); }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. 2.1" />
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
            <input type="number" inputMode="decimal" value={setback}
              onChange={e => { onSetbackChange(e.target.value); onValidationErrorChange(null); }}
              onKeyDown={e => { if (e.key === 'Enter') onSubmit(); else if (e.key === 'Escape') onCancel(); }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. 0.5" />
          </div>
        </div>

        {validationError && <p className="text-red-400 text-sm mb-4">{validationError}</p>}
        
        {/* Action buttons -- visually separated from form */}
        <div className="border-t border-gray-600/50 mt-6 pt-4 space-y-3">
          <div className="flex gap-2">
            <button onClick={handleApply}
              className={`flex-1 px-4 py-2.5 rounded transition-colors ${applied ? 'bg-green-600 text-white' : dirty ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'bg-cyan-900/60 text-cyan-400/50'}`}>
              {applied ? '✓ Applied' : isEditing ? 'Apply' : 'Place Door'}
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