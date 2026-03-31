import { useCallback, useEffect, useState } from 'react';
import { Canvas2D } from './components/Canvas2D';
import { SplashScreen } from './components/SplashScreen';
import { ThemeToggle } from './components/ThemeToggle';
import { Toaster } from './components/ui/sonner';
import { registerPWA } from './utils/pwaRegister';
import { ThemeContext } from './contexts/ThemeContext';

function loadTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('planimetraTheme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

function hasExistingData(): boolean {
  try {
    const saved = localStorage.getItem('planimetraProject');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.rooms)) {
        return parsed.rooms.some((r: any) => r.walls?.length > 0);
      }
    }
    const legacy = localStorage.getItem('planimetraAppState');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      return parsed.walls?.length > 0;
    }
  } catch {}
  return false;
}

export default function App() {
  const [ready, setReady] = useState(hasExistingData);
  const [isDark, setIsDark] = useState<boolean>(() => loadTheme() === 'dark');
  const handleReady = useCallback(() => setReady(true), []);
  const handleNewProject = useCallback(() => setReady(false), []);
  const handleToggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      try { localStorage.setItem('planimetraTheme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    registerPWA();
  }, []);

  return (
    <ThemeContext.Provider value={isDark}>
      <div className={`fixed inset-0 overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        {!ready && <SplashScreen onReady={handleReady} />}
        <Canvas2D guiReady={ready} onNewProject={handleNewProject} isDark={isDark} />
        <ThemeToggle guiReady={ready} isDark={isDark} onToggle={handleToggleTheme} />
        <Toaster />
      </div>
    </ThemeContext.Provider>
  );
}
