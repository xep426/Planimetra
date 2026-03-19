import { useEffect, useState } from 'react';

export function SplashScreen({ onReady }: { onReady: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onReady, 400);
    }, 1200);
    return () => clearTimeout(timer);
  }, [onReady]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950 transition-opacity duration-400 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <h1
        className="text-xl tracking-[0.35em] text-white/90"
        style={{ fontWeight: 200 }}
      >
        PLANIMETRA
      </h1>
    </div>
  );
}
