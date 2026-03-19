/**
 * Register the service worker and inject PWA meta tags into <head>.
 * Call once from App.tsx on mount.
 */
export function registerPWA() {
  // Inject manifest link
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);
  }

  // Inject theme-color meta
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#111827';
    document.head.appendChild(meta);
  }

  // Inject apple-mobile-web-app meta tags for iOS
  const appleMetas: [string, string][] = [
    ['apple-mobile-web-app-capable', 'yes'],
    ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
    ['apple-mobile-web-app-title', 'FloorPlan'],
  ];
  for (const [name, content] of appleMetas) {
    if (!document.querySelector(`meta[name="${name}"]`)) {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    }
  }

  // Inject apple-touch-icon
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = '/icon-192.png';
    document.head.appendChild(link);
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('SW registered, scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('SW registration failed:', err);
        });
    });
  }
}
