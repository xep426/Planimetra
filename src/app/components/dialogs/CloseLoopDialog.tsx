interface CloseLoopDialogProps {
  visible: boolean;
  closeLoopLength: string;
  validationError: string | null;
  onLengthChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

import { useEffect, useRef } from 'react';

export function CloseLoopDialog({
  visible, closeLoopLength, validationError,
  onLengthChange, onSubmit, onCancel,
}: CloseLoopDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (visible && inputRef.current) inputRef.current.focus();
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-gray-800 p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:rounded-lg overflow-y-auto">
        <h3 className="text-white text-lg font-semibold mb-2">Close Loop</h3>
        <p className="text-gray-400 text-sm mb-4">Closing wall length (meters):</p>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="0.01"
          value={closeLoopLength}
          onChange={e => onLengthChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); else if (e.key === 'Escape') onCancel(); }}
          className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
          placeholder="e.g. 3.15" />
        {validationError && <p className="text-red-400 text-sm mt-2">{validationError}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onSubmit} className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600">Create Wall</button>
          <button onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}