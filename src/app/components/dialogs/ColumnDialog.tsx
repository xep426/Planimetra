import type { ColumnObj } from '../../types';

interface ColumnDialogProps {
  visible: boolean;
  wallId?: string | null;
  wallLength: number;
  editingColumnId: string | null;
  editingColumn: ColumnObj | null;
  columnWidth: string;
  columnDepth: string;
  columnInset: string;
  distanceType: 'cw' | 'ccw';
  distanceToCW: string;
  distanceToCCW: string;
  interiorSign?: number;
  nodeALabel: 'CW' | 'CCW';
  nodeBLabel: 'CW' | 'CCW';
  validationError: string | null;
  onWidthChange: (v: string) => void;
  onDepthChange: (v: string) => void;
  onInsetChange: (v: string) => void;
  onDistanceTypeChange: (v: 'cw' | 'ccw') => void;
  onDistanceToCWChange: (v: string) => void;
  onDistanceToCCWChange: (v: string) => void;
  onValidationErrorChange: (v: string | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
  // Delete support
  onDelete?: () => void;
}

import { useState, useLayoutEffect } from 'react';

export function ColumnDialog({
  visible, wallLength, editingColumnId, editingColumn,
  columnWidth, columnDepth, columnInset, distanceType, distanceToCW, distanceToCCW,
  interiorSign = -1,
  nodeALabel, nodeBLabel, validationError,
  onWidthChange, onDepthChange, onInsetChange, onDistanceTypeChange,
  onDistanceToCWChange, onDistanceToCCWChange, onValidationErrorChange,
  onSubmit, onCancel, onDelete,
}: ColumnDialogProps) {
  const [orig, setOrig] = useState({ columnWidth, columnDepth, columnInset, distanceType, distanceToCW, distanceToCCW });
  const [applied, setApplied] = useState(false);
  useLayoutEffect(() => {
    if (visible) { setOrig({ columnWidth, columnDepth, columnInset, distanceType, distanceToCW, distanceToCCW }); setApplied(false); }
  }, [visible]);
  const dirty = columnWidth !== orig.columnWidth || columnDepth !== orig.columnDepth ||
    columnInset !== orig.columnInset || distanceType !== orig.distanceType ||
    distanceToCW !== orig.distanceToCW || distanceToCCW !== orig.distanceToCCW;
  const handleApply = () => { setApplied(true); setTimeout(onSubmit, 400); };
  if (!visible) return null;

  const isEditing = !!editingColumnId;
  const isMergedColumn = editingColumn?.mergedShapes && editingColumn.mergedShapes.length > 0;

  // Left = CCW node, Right = CW node
  // 'cw' distance type = from nodeA. If nodeA is CCW, then 'cw' = Left.
  const leftType: 'cw' | 'ccw' = nodeALabel === 'CCW' ? 'cw' : 'ccw';
  const rightType: 'cw' | 'ccw' = nodeALabel === 'CCW' ? 'ccw' : 'cw';
  const isLeftActive = distanceType === leftType;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-gray-800 p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:max-h-[90vh] md:rounded-lg overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">
            {isEditing ? 'Edit Column' : `Place Column on Wall (${wallLength.toFixed(3)}m)`}
          </h3>
        </div>
        
        {isMergedColumn && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded">
            <p className="text-yellow-400 text-sm">
              This is a merged column. Dimensions cannot be edited. To modify, unmerge by deleting and recreating individual columns.
            </p>
          </div>
        )}
        
        {/* Dimensions Section */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Width (meters)</label>
            <input type="number" inputMode="decimal" value={columnWidth}
              onChange={e => { onWidthChange(e.target.value); onValidationErrorChange(null); }}
              disabled={!!isMergedColumn}
              className={`w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500 ${isMergedColumn ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="e.g. 0.3" />
            <p className="text-gray-500 text-xs mt-1">Along wall length</p>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Depth (meters)</label>
            <input type="number" inputMode="decimal" value={columnDepth}
              onChange={e => { onDepthChange(e.target.value); onValidationErrorChange(null); }}
              disabled={!!isMergedColumn}
              className={`w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500 ${isMergedColumn ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="e.g. 0.3" />
            <p className="text-gray-500 text-xs mt-1">Perpendicular to wall</p>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Inset (meters)</label>
            <input type="number" inputMode="decimal" value={columnInset}
              onChange={e => { onInsetChange(e.target.value); onValidationErrorChange(null); }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. 0.1" />
            <p className="text-gray-500 text-xs mt-1">Distance from wall into room (0 = flush)</p>
          </div>
        </div>

        {/* Position Section */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-gray-400 text-sm block mb-2">Setback Reference</label>
            <div className="flex gap-2">
              <button onClick={() => onDistanceTypeChange(leftType)}
                className={`flex-1 px-3 py-2 rounded text-sm ${isLeftActive ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Left
              </button>
              <button onClick={() => onDistanceTypeChange(rightType)}
                className={`flex-1 px-3 py-2 rounded text-sm ${!isLeftActive ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Right
              </button>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">
              Setback (meters)
            </label>
            <input type="number" inputMode="decimal" 
              value={distanceType === 'cw' ? distanceToCW : distanceToCCW}
              onChange={e => { 
                if (distanceType === 'cw') {
                  onDistanceToCWChange(e.target.value);
                } else {
                  onDistanceToCCWChange(e.target.value);
                }
                onValidationErrorChange(null); 
              }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. 0.5" />
          </div>
        </div>

        {validationError && <p className="text-red-400 text-sm mb-4">{validationError}</p>}
        
        {/* Action buttons -- visually separated from form */}
        <div className="border-t border-gray-600/50 mt-6 pt-4 space-y-3">
          <div className="flex gap-2">
            <button onClick={handleApply} disabled={!dirty}
              className={`flex-1 px-4 py-2.5 rounded transition-colors ${applied ? 'bg-green-600 text-white' : dirty ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'bg-cyan-900/60 text-cyan-400/50 cursor-not-allowed'}`}>
              {applied ? '✓ Applied' : isEditing ? 'Apply' : 'Place Column'}
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