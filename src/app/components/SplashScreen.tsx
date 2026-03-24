import { useEffect, useState } from 'react';

export function SplashScreen({ onReady }: { onReady: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onReady, 600);
    }, 1400);
    return () => clearTimeout(timer);
  }, [onReady]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none transition-opacity duration-600 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ paddingBottom: '6rem' }}
    >
      <h1 className="text-xl tracking-[0.35em] text-white/70" style={{ fontWeight: 200 }}>
        PLANIMETRA
      </h1>
    </div>
  );
}
