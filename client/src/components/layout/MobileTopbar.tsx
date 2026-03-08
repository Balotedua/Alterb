import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/finance', label: 'Finanze', icon: '💰' },
  { to: '/psychology', label: 'Psicologia', icon: '🧠' },
  { to: '/health', label: 'Salute', icon: '💪' },
  { to: '/consciousness', label: 'Coscienza', icon: '📝' },
  { to: '/badges', label: 'Badge', icon: '🏆' },
  { to: '/settings', label: 'Impostazioni', icon: '⚙️' },
] as const;

export function MobileTopbar() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const close = () => setOpen(false);

  return (
    <>
      {/* hamburger button fisso in alto a sinistra */}
      <button
        className="mob-hamburger"
        onClick={() => setOpen(true)}
        aria-label="Apri menu"
        aria-expanded={open}
      >
        <span /><span /><span />
      </button>

      {/* drawer overlay */}
      {open && (
        <div className="mob-drawer" role="dialog" aria-modal="true" aria-label="Menu di navigazione">
          <div className="mob-drawer__overlay" onClick={close} />

          <aside className="mob-drawer__panel">
            <div className="mob-drawer__header">
              <div className="mob-drawer__logo">
                <span className="mob-drawer__logo-icon">✦</span>
                <span className="mob-drawer__logo-text">Alter</span>
              </div>
              <button className="mob-drawer__close" onClick={close} aria-label="Chiudi menu">✕</button>
            </div>

            <nav className="mob-drawer__nav">
              {NAV_ITEMS.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    ['mob-drawer__link', isActive ? 'mob-drawer__link--active' : '']
                      .filter(Boolean).join(' ')
                  }
                  onClick={close}
                >
                  <span className="mob-drawer__link-icon">{icon}</span>
                  {label}
                </NavLink>
              ))}
            </nav>

            <button className="mob-drawer__logout" onClick={() => { logout(); close(); }}>
              <span>↩</span> Esci
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
