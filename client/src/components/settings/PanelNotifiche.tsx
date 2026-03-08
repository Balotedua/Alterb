import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// ─── Toggle component ─────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      type="button"
      className={`st-toggle__track ${checked ? 'st-toggle__track--on' : ''}`}
    >
      <span className={`st-toggle__thumb ${checked ? 'st-toggle__thumb--on' : ''}`} />
    </button>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

interface ToggleRowProps {
  icon: string;
  label: string;
  sublabel: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ icon, label, sublabel, checked, onChange }: ToggleRowProps) {
  return (
    <div className="st-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
          {icon}
        </span>
        <div>
          <p className="st-label" style={{ margin: 0 }}>
            {label}
          </p>
          <p className="st-sublabel" style={{ margin: '2px 0 0' }}>
            {sublabel}
          </p>
        </div>
      </div>
      <div className="st-toggle">
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

// ─── PanelNotifiche ───────────────────────────────────────────────────────────

export function PanelNotifiche() {
  const [pushEnabled, setPushEnabled] = useLocalStorage<boolean>('alter_notif_push', false);
  const [emailEnabled, setEmailEnabled] = useLocalStorage<boolean>('alter_notif_email', false);

  const [financeEnabled, setFinanceEnabled] = useLocalStorage<boolean>(
    'alter_notif_finance',
    true,
  );
  const [healthEnabled, setHealthEnabled] = useLocalStorage<boolean>('alter_notif_health', true);
  const [psychoEnabled, setPsychoEnabled] = useLocalStorage<boolean>('alter_notif_psycho', true);
  const [consciousEnabled, setConsciousEnabled] = useLocalStorage<boolean>(
    'alter_notif_conscious',
    true,
  );

  const anyChannelActive = pushEnabled || emailEnabled;

  const handlePushChange = useCallback(
    (v: boolean) => setPushEnabled(v),
    [setPushEnabled],
  );
  const handleEmailChange = useCallback(
    (v: boolean) => setEmailEnabled(v),
    [setEmailEnabled],
  );
  const handleFinanceChange = useCallback(
    (v: boolean) => setFinanceEnabled(v),
    [setFinanceEnabled],
  );
  const handleHealthChange = useCallback(
    (v: boolean) => setHealthEnabled(v),
    [setHealthEnabled],
  );
  const handlePsychoChange = useCallback(
    (v: boolean) => setPsychoEnabled(v),
    [setPsychoEnabled],
  );
  const handleConsciousChange = useCallback(
    (v: boolean) => setConsciousEnabled(v),
    [setConsciousEnabled],
  );

  return (
    <div className="st-panel">
      {/* Canali */}
      <div className="st-section">
        <p className="st-section__title">Canali</p>
        <div className="st-section__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ToggleRow
            icon="🔔"
            label="Push Notifiche"
            sublabel="Ricevi notifiche push sul browser o dispositivo"
            checked={pushEnabled}
            onChange={handlePushChange}
          />
          <ToggleRow
            icon="✉️"
            label="Email Notifiche"
            sublabel="Ricevi aggiornamenti e riepiloghi via email"
            checked={emailEnabled}
            onChange={handleEmailChange}
          />
        </div>
      </div>

      {/* Per sezione — visibile solo se almeno un canale è attivo */}
      {anyChannelActive ? (
        <div className="st-section">
          <p className="st-section__title">Per sezione</p>
          <div className="st-section__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ToggleRow
              icon="💰"
              label="Finanze"
              sublabel="Avvisi su transazioni e obiettivi finanziari"
              checked={financeEnabled}
              onChange={handleFinanceChange}
            />
            <ToggleRow
              icon="❤️"
              label="Salute"
              sublabel="Promemoria per attività fisica e sonno"
              checked={healthEnabled}
              onChange={handleHealthChange}
            />
            <ToggleRow
              icon="🧠"
              label="Psicologia"
              sublabel="Promemoria per il tracciamento dell'umore"
              checked={psychoEnabled}
              onChange={handlePsychoChange}
            />
            <ToggleRow
              icon="✍️"
              label="Coscienza"
              sublabel="Promemoria per journaling e note"
              checked={consciousEnabled}
              onChange={handleConsciousChange}
            />
          </div>
        </div>
      ) : (
        <div className="st-section">
          <p
            className="st-sublabel"
            style={{ textAlign: 'center', padding: '8px 0' }}
          >
            Attiva almeno un canale per configurare le preferenze.
          </p>
        </div>
      )}
    </div>
  );
}
