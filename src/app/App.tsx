import { useCallback, useEffect, useState } from 'react';
import { Canvas2D } from './components/Canvas2D';
import { SplashScreen } from './components/SplashScreen';
import { registerPWA } from './utils/pwaRegister';

export default function App() {
  const hasSeenSplash = localStorage.getItem('planimetra_seen') === '1';
  const [ready, setReady] = useState(hasSeenSplash);
  const handleReady = useCallback(() => {
    localStorage.setItem('planimetra_seen', '1');
    setReady(true);
  }, []);

  useEffect(() => {
    registerPWA();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gray-900">
      {!ready && <SplashScreen onReady={handleReady} />}
      <Canvas2D />
    </div>
  );
}