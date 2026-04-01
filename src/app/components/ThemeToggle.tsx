interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  guiReady?: boolean;
}

export function ThemeToggle({ isDark, onToggle, guiReady = true }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`hidden md:flex fixed bottom-4 left-4 z-50 w-11 h-11 rounded-full shadow-lg items-center justify-center transition-all active:scale-90
        ${isDark
          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
          : 'bg-white/90 hover:bg-white text-gray-700 backdrop-blur'}
        ${guiReady ? 'duration-500 translate-y-0 opacity-100' : 'duration-0 translate-y-4 opacity-0'}`}
    >
      {isDark ? (
        // Sun — click to go light
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        // Moon — click to go dark
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
