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

  return (
    <header className="mobile-topbar">
      <div className="mobile-topbar__inner">
        <span className="mobile-topbar__logo">✦ Alter</span>
        <button
          className="mobile-topbar__menu-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>
      {open ? (
        <nav className="mobile-topbar__drawer" aria-label="Navigazione mobile">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                ['mobile-topbar__link', isActive ? 'mobile-topbar__link--active' : '']
                  .filter(Boolean)
                  .join(' ')
              }
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true">{icon}</span> {label}
            </NavLink>
          ))}
          <button className="mobile-topbar__logout" onClick={logout}>
            ↩ Esci
          </button>
        </nav>
      ) : null}
    </header>
  );
}
