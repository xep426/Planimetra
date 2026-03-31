import { useEffect, useRef } from 'react';
import { useIsDark } from '../../contexts/ThemeContext';

interface WallLengthDialogProps {
  visible: boolean;
  lengthInput: string;
  validationError: string | null;
  onLengthChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function WallLengthDialog({
  visible, lengthInput, validationError,
  onLengthChange, onSubmit, onCancel,
}: WallLengthDialogProps) {
  const isDark = useIsDark();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 shadow-xl w-full h-full md:w-96 md:h-auto md:rounded-lg overflow-y-auto`}>
        <h3 className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-semibold mb-4`}>Wall Length (meters)</h3>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="0.01"
          value={lengthInput}
          onChange={e => onLengthChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); else if (e.key === 'Escape') onCancel(); }}
          className={`w-full px-4 py-2 ${isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} rounded border focus:outline-none focus:border-cyan-500`}
          placeholder="e.g. 3.15" />
        {validationError && <p className="text-red-400 text-sm mt-2">{validationError}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onSubmit} className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600">Create Wall</button>
          <button onClick={onCancel} className={`flex-1 px-4 py-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'} rounded transition-colors`}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
