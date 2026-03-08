import { useState } from 'react';
import { PanelProfilo } from '@/components/settings/PanelProfilo';
import { PanelAccount } from '@/components/settings/PanelAccount';
import { PanelPreferenze } from '@/components/settings/PanelPreferenze';
import { PanelNotifiche } from '@/components/settings/PanelNotifiche';
import { PanelPrivacy } from '@/components/settings/PanelPrivacy';
import './Settings.css';

type PanelId = 'profilo' | 'account' | 'preferenze' | 'notifiche' | 'privacy';

const PANELS: { id: PanelId; label: string; icon: string; sub: string }[] = [
  { id: 'profilo',     label: 'Profilo',       icon: '◉', sub: 'Nome, avatar, bio' },
  { id: 'account',    label: 'Account',        icon: '⚿', sub: 'Password, sessioni' },
  { id: 'preferenze', label: 'Preferenze',     icon: '◈', sub: 'Tema, lingua, layout' },
  { id: 'notifiche',  label: 'Notifiche',      icon: '◎', sub: 'Push, email' },
  { id: 'privacy',    label: 'Privacy & Dati', icon: '⊞', sub: 'Export, danger zone' },
];

export default function Settings() {
  const [active, setActive] = useState<PanelId>('profilo');

  const panel = {
    profilo:     <PanelProfilo />,
    account:     <PanelAccount />,
    preferenze:  <PanelPreferenze />,
    notifiche:   <PanelNotifiche />,
    privacy:     <PanelPrivacy />,
  }[active];

  return (
    <div className="st-root">
      <aside className="st-sidebar">
        <div className="st-sidebar__header">
          <h1 className="st-sidebar__title">Impostazioni</h1>
        </div>
        <nav className="st-sidebar__nav" aria-label="Sezioni impostazioni">
          {PANELS.map(({ id, label, icon, sub }) => (
            <button
              key={id}
              type="button"
              className={`st-nav-item ${active === id ? 'st-nav-item--active' : ''}`}
              onClick={() => setActive(id)}
              aria-current={active === id ? 'page' : undefined}
            >
              <span className="st-nav-item__icon">{icon}</span>
              <span className="st-nav-item__text">
                <span className="st-nav-item__label">{label}</span>
                <span className="st-nav-item__sub">{sub}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="st-content" key={active}>
        {panel}
      </main>
    </div>
  );
}
