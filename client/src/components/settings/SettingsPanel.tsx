import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import type { Theme } from '../../types';
import { getCategorySummaries, deleteCategory, deleteAllUserData } from '../../vault/vaultService';
import type { CategorySummary } from '../../vault/vaultService';
import AdminPopup from '../admin/AdminPopup';

const THEMES: { id: Theme; label: string; desc: string; preview: string[] }[] = [
  {
    id: 'dark',
    label: 'Deep Space',
    desc: 'Il tema originale. Spazio profondo.',
    preview: ['#03030a', '#f0c040', '#40e0d0'],
  },
  {
    id: 'matrix',
    label: 'Matrix',
    desc: 'Neon verde, scanlines, glitch.',
    preview: ['#000800', '#00ff41', '#003300'],
  },
  {
    id: 'nebula',
    label: 'Nebula',
    desc: 'Viola cosmico, profondo e misterioso.',
    preview: ['#06000f', '#a78bfa', '#c084fc'],
  },
  {
    id: 'light',
    label: 'Aurora',
    desc: 'Tema chiaro, minimalista.',
    preview: ['#f0f2ff', '#5b21b6', '#0ea5e9'],
  },
];

export default function SettingsPanel() {
  const { showSettings, setShowSettings, theme, setTheme, username, setUsername, user } = useAlterStore();
  const [nameInput, setNameInput] = useState(username);
  const [nameSaved, setNameSaved] = useState(false);

  const saveUsername = () => {
    setUsername(nameInput.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1800);
  };

  return (
    <AnimatePresence>
      {showSettings && (
        <>
          {/* Backdrop */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowSettings(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 600,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="settings-panel"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{
              position: 'fixed',
              bottom: 60,
              left: 0,
              right: 0,
              marginLeft: 'auto',
              marginRight: 'auto',
              width: 'min(420px, calc(100vw - 24px))',
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
              zIndex: 700,
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '24px 20px 20px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text)', opacity: 0.9 }}>
                IMPOSTAZIONI
              </span>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', fontSize: 18, lineHeight: 1,
                  padding: '2px 6px', borderRadius: 6,
                }}
              >
                ×
              </button>
            </div>

            {/* Profile section */}
            <Section label="PROFILO">
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
                {user?.email}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveUsername()}
                  placeholder="Il tuo nome..."
                  maxLength={32}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '9px 14px',
                    fontSize: 13,
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={saveUsername}
                  style={{
                    background: nameSaved ? 'rgba(80,200,120,0.15)' : 'rgba(255,255,255,0.07)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '9px 16px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: nameSaved ? '#4ecb71' : 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    letterSpacing: '0.05em',
                  }}
                >
                  {nameSaved ? '✓' : 'Salva'}
                </button>
              </div>
            </Section>

            {/* Theme section */}
            <Section label="TEMA">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {THEMES.map(t => (
                  <ThemeCard
                    key={t.id}
                    theme={t}
                    active={theme === t.id}
                    onSelect={() => setTheme(t.id)}
                  />
                ))}
              </div>
            </Section>

            {/* Data management section */}
            <DataSection userId={user?.id ?? null} />

            {/* Placeholder for future features */}
            <Section label="PROSSIMAMENTE">
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                🔔 Notifiche Sentinel<br />
                🎵 Suoni ambientali<br />
                🌍 Lingua interfaccia<br />
                📤 Esporta dati vault
              </div>
            </Section>

            {/* Admin section */}
            <AdminSection />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DataSection({ userId }: { userId: string | null }) {
  const [summaries,    setSummaries]    = useState<CategorySummary[]>([]);
  const [confirmCat,   setConfirmCat]   = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetStep,    setResetStep]    = useState(0); // 0 = idle, 1 = first confirm, 2 = done
  const [busy,         setBusy]         = useState(false);

  useEffect(() => {
    if (!userId) return;
    getCategorySummaries(userId).then(setSummaries);
  }, [userId]);

  async function handleDeleteCategory(cat: string) {
    if (!userId) return;
    setBusy(true);
    await deleteCategory(userId, cat);
    setSummaries(prev => prev.filter(s => s.category !== cat));
    setConfirmCat(null);
    setBusy(false);
  }

  async function handleResetAll() {
    if (!userId) return;
    setBusy(true);
    await deleteAllUserData(userId);
    setSummaries([]);
    setResetStep(2);
    setBusy(false);
    setTimeout(() => { setResetStep(0); setConfirmReset(false); }, 3000);
  }

  if (!userId) return null;

  return (
    <Section label="GESTISCI DATI">
      {summaries.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Nessun dato nel vault.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {summaries.map(s => (
            <div key={s.category} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 12px',
            }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text)', textTransform: 'capitalize' }}>{s.category}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>{s.count} voci</span>
              </div>
              {confirmCat === s.category ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={busy}
                    onClick={() => handleDeleteCategory(s.category)}
                    style={{
                      background: 'rgba(240,80,80,0.15)', border: '1px solid rgba(240,80,80,0.35)',
                      borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600,
                      color: '#f08080', cursor: 'pointer',
                    }}
                  >
                    Sì
                  </button>
                  <button
                    onClick={() => setConfirmCat(null)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 7, padding: '4px 10px', fontSize: 10.5,
                      color: 'var(--text-dim)', cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmCat(s.category)}
                  style={{
                    background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 7, padding: '4px 10px', fontSize: 10.5,
                    color: 'rgba(240,80,80,0.6)', cursor: 'pointer',
                  }}
                >
                  Cancella
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full reset */}
      <div style={{ marginTop: 12 }}>
        {resetStep === 2 ? (
          <div style={{ fontSize: 11.5, color: '#4ecb71', textAlign: 'center', padding: '8px 0' }}>
            ✓ Vault azzerato.
          </div>
        ) : confirmReset ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(20,8,8,0.95)', border: '1px solid rgba(240,80,80,0.28)',
              borderRadius: 10, padding: '12px',
            }}
          >
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginBottom: 10, lineHeight: 1.5 }}>
              ⚠️ Cancellare TUTTI i dati del vault? Questa azione è irreversibile.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={busy}
                onClick={handleResetAll}
                style={{
                  flex: 1, background: 'rgba(240,80,80,0.15)', border: '1px solid rgba(240,80,80,0.35)',
                  borderRadius: 9, padding: '8px', fontSize: 11.5, fontWeight: 600,
                  color: '#f08080', cursor: 'pointer',
                }}
              >
                {busy ? '...' : 'Sì, cancella tutto'}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 9, padding: '8px 14px', fontSize: 11.5,
                  color: 'var(--text-dim)', cursor: 'pointer',
                }}
              >
                Annulla
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            style={{
              width: '100%', background: 'none',
              border: '1px solid rgba(240,80,80,0.15)', borderRadius: 10,
              padding: '9px 14px', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em',
              color: 'rgba(240,80,80,0.5)', transition: 'border-color 0.2s, color 0.2s',
            }}
          >
            ⚠ Reset completo profilo
          </button>
        )}
      </div>
    </Section>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.14em',
        color: 'var(--text-dim)',
        marginBottom: 10,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ThemeCard({ theme, active, onSelect }: {
  theme: typeof THEMES[number];
  active: boolean;
  onSelect: () => void;
}) {
  const [bg, accent, accent2] = theme.preview;

  return (
    <button
      onClick={onSelect}
      style={{
        background: 'none',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '10px 12px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: active ? `0 0 16px rgba(${hexToRgbStr(accent)},0.25)` : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Mini preview swatch */}
      <div style={{
        width: '100%',
        height: 32,
        borderRadius: 7,
        background: bg,
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Stars preview */}
        <div style={{
          position: 'absolute',
          width: 5, height: 5,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 8px ${accent}`,
          top: 8, left: '30%',
        }} />
        <div style={{
          position: 'absolute',
          width: 3, height: 3,
          borderRadius: '50%',
          background: accent2,
          boxShadow: `0 0 6px ${accent2}`,
          top: 14, left: '60%',
        }} />
        <div style={{
          position: 'absolute',
          width: 2, height: 2,
          borderRadius: '50%',
          background: accent,
          opacity: 0.6,
          top: 6, left: '75%',
        }} />
        {/* Semantic line preview */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <line
            x1="30%" y1="10" x2="60%" y2="16"
            stroke={accent}
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />
        </svg>
        {active && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 30% 40%, ${accent}22 0%, transparent 70%)`,
          }} />
        )}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
        {theme.label}
        {active && <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 10 }}>●</span>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
        {theme.desc}
      </div>
    </button>
  );
}

function AdminSection() {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <div style={{ marginTop: 4 }}>
      <button
        onClick={() => setShowPopup(true)}
        style={{
          width: '100%',
          background: 'none',
          border: '1px solid rgba(167,139,250,0.15)',
          borderRadius: 10,
          padding: '9px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'rgba(167,139,250,0.5)',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.14em',
          transition: 'border-color 0.2s, color 0.2s',
        }}
      >
        <span>⬡ ADMIN</span>
        <span style={{ fontSize: 11, opacity: 0.55 }}>→</span>
      </button>
      <AnimatePresence>
        {showPopup && <AdminPopup onClose={() => setShowPopup(false)} />}
      </AnimatePresence>
    </div>
  );
}

function hexToRgbStr(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
