import { useEffect, useState } from 'react';
import './InstallBanner.css';

type Platform = 'ios' | 'android' | null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = localStorage.getItem('alter_install_dismissed');
    if (dismissed) return;

    const p = detectPlatform();
    if (!p) return;

    setPlatform(p);
    setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('alter_install_dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="install-banner" role="banner">
      <div className="install-banner__icon">✦</div>

      <div className="install-banner__body">
        <p className="install-banner__title">Installa Alter come app</p>
        {platform === 'ios' ? (
          <p className="install-banner__steps">
            Tocca <span className="install-banner__key">Condividi</span>{' '}
            <span className="install-banner__share-icon">⎙</span> poi{' '}
            <span className="install-banner__key">Aggiungi a Home</span>
          </p>
        ) : (
          <p className="install-banner__steps">
            Menu del browser <span className="install-banner__key">⋮</span> poi{' '}
            <span className="install-banner__key">Aggiungi a schermata Home</span>
          </p>
        )}
      </div>

      <button className="install-banner__close" onClick={dismiss} aria-label="Chiudi">
        ✕
      </button>
    </div>
  );
}
