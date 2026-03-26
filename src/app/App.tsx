import { useCallback, useEffect, useState } from 'react';
import { Canvas2D } from './components/Canvas2D';
import { SplashScreen } from './components/SplashScreen';
import { Toaster } from './components/ui/sonner';
import { registerPWA } from './utils/pwaRegister';

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
  const handleReady = useCallback(() => setReady(true), []);
  const handleNewProject = useCallback(() => setReady(false), []);

  useEffect(() => {
    registerPWA();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gray-900">
      {!ready && <SplashScreen onReady={handleReady} />}
      <Canvas2D guiReady={ready} onNewProject={handleNewProject} />
      <Toaster />
    </div>
  );
}
