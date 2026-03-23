import type { LayerType } from '../../types';

interface LayersDropdownProps {
  selectedTool: LayerType;
  layerOpen: boolean;
  loopClosed: boolean;
  onToolChange: (tool: LayerType) => void;
  onToggleOpen: () => void;
  onClose: () => void;
  adjacent?: React.ReactNode;
}

const LAYERS: { key: LayerType; label: string }[] = [
  { key: 'wall', label: 'Walls' },
  { key: 'window', label: 'Windows' },
  { key: 'door', label: 'Doors' },
  { key: 'passage', label: 'Passages' },
  { key: 'column', label: 'Columns' },
];

const TOOL_LABELS: Record<LayerType, string> = {
  wall: 'Walls',
  window: 'Windows',
  door: 'Doors',
  passage: 'Passages',
  column: 'Columns',
};

export function LayersDropdown({
  selectedTool, layerOpen, loopClosed,
  onToolChange, onToggleOpen, onClose,
  adjacent,
}: LayersDropdownProps) {
  return (
    <div className="fixed top-4 left-4 z-40 flex items-center gap-2">
      <button
        onClick={onToggleOpen}
        className="h-10 px-4 rounded-xl bg-white/90 backdrop-blur shadow-lg flex items-center gap-2 text-gray-800 hover:bg-white transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span className="text-sm">{TOOL_LABELS[selectedTool]}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${layerOpen ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {adjacent}

      {layerOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <div className="absolute top-12 left-0 w-48 rounded-xl bg-white/95 backdrop-blur shadow-xl border border-gray-200/60 overflow-hidden z-40">
            <div className="px-3 py-2 border-b border-gray-100">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider">Layers</span>
            </div>
            {LAYERS.map((tool) => {
              const isSelected = tool.key === selectedTool;
              const isDisabled = tool.key !== 'wall' && !loopClosed;
              return (
                <button
                  key={tool.key}
                  onClick={() => { if (!isDisabled) { onToolChange(tool.key); onClose(); } }}
                  disabled={isDisabled}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                    isDisabled ? 'text-gray-300 cursor-not-allowed'
                      : isSelected ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    isDisabled ? 'bg-gray-200'
                      : isSelected ? 'bg-blue-500'
                        : 'bg-gray-300'
                  }`} />
                  {tool.label}
                  {isDisabled && <span className="ml-auto text-[10px] text-gray-300">close loop</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
