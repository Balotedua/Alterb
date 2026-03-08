import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/chatbot', label: 'Chatbot', icon: '✦' },
  { to: '/finance', label: 'Finanze', icon: '💰' },
  { to: '/psychology', label: 'Psicologia', icon: '🧠' },
  { to: '/health', label: 'Salute', icon: '💪' },
  { to: '/consciousness', label: 'Coscienza', icon: '📝' },
  { to: '/routine', label: 'Routine', icon: '⏱️' },
  { to: '/news', label: 'News', icon: '📰' },
  { to: '/career', label: 'Carriera', icon: '🚀' },
  { to: '/badges', label: 'Badge', icon: '🏆' },
  { to: '/settings', label: 'Impostazioni', icon: '⚙️' },
] as const;

export function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-icon">✦</span>
        <span className="sidebar__logo-text">Alter</span>
      </div>
      <nav className="sidebar__nav" aria-label="Navigazione principale">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              ['sidebar__link', isActive ? 'sidebar__link--active' : ''].filter(Boolean).join(' ')
            }
          >
            <span className="sidebar__link-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="sidebar__link-label">{label}</span>
          </NavLink>
        ))}
      </nav>
      <button className="sidebar__logout" onClick={logout}>
        <span aria-hidden="true">↩</span> Esci
      </button>
    </aside>
  );
}
