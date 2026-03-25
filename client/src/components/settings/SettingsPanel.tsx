import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import type { Theme } from '../../types';
import { getCategorySummaries, deleteCategory, deleteAllUserData, restoreCategory, getDeletedCategories, purgeCategory } from '../../vault/vaultService';
import { updateDisplayName } from '../../social/nexusService';
import type { CategorySummary, DeletedCategorySummary } from '../../vault/vaultService';
import { buildStar, getCategoryMeta } from '../starfield/StarfieldView';
import AdminPopup from '../admin/AdminPopup';
import { supabase } from '../../config/supabase';
import { isGoogleFitConnected, connectGoogleFit, disconnectGoogleFit } from '../../core/wearableSync';

const THEMES: { id: Theme; label: string; desc: string; preview: string[] }[] = [
  {
    id: 'dark',
    label: 'Deep Space',
    desc: 'Il tema originale. Spazio profondo.',
    preview: ['#05070D', '#C8A84B', '#4BC4B8'],
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

  const saveUsername = async () => {
    const trimmed = nameInput.trim();
    setUsername(trimmed);
    if (user?.id && trimmed) updateDisplayName(user.id, trimmed);
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
              <button
                onClick={() => supabase.auth.signOut()}
                style={{
                  marginTop: 10,
                  width: '100%',
                  background: 'none',
                  border: '1px solid rgba(248,113,113,0.18)',
                  borderRadius: 10,
                  padding: '9px 14px',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: 'rgba(248,113,113,0.55)',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,113,113,0.4)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,113,113,0.18)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(248,113,113,0.55)';
                }}
              >
                Esci dall'account
              </button>
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

            {/* Wearables section */}
            <WearableSection />

            {/* Admin section */}
            <AdminSection />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DataSection({ userId }: { userId: string | null }) {
  const [open,           setOpen]           = useState(false);
  const [summaries,      setSummaries]      = useState<CategorySummary[]>([]);
  const [confirmCat,     setConfirmCat]     = useState<string | null>(null);
  const [confirmReset,   setConfirmReset]   = useState(false);
  const [resetStep,      setResetStep]      = useState(0);
  const [busy,           setBusy]           = useState(false);
  const [showRestore,    setShowRestore]    = useState(false);
  const [deletedCats,    setDeletedCats]    = useState<DeletedCategorySummary[]>([]);
  const [restoringCat,   setRestoringCat]   = useState<string | null>(null);
  const [restoredCat,    setRestoredCat]    = useState<string | null>(null);
  const [confirmPurge,   setConfirmPurge]   = useState<string | null>(null);
  const [purgingCat,     setPurgingCat]     = useState<string | null>(null);
  const { upsertStar } = useAlterStore();

  useEffect(() => {
    if (!open || !userId) return;
    getCategorySummaries(userId).then(setSummaries);
  }, [open, userId]);

  useEffect(() => {
    if (!showRestore || !userId) return;
    getDeletedCategories(userId).then(setDeletedCats);
  }, [showRestore, userId]);

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

  async function handlePurge(cat: string) {
    if (!userId) return;
    setPurgingCat(cat);
    await purgeCategory(userId, cat);
    setDeletedCats(prev => prev.filter(d => d.category !== cat));
    setConfirmPurge(null);
    setPurgingCat(null);
  }

  async function handleRestore(cat: string) {
    if (!userId) return;
    setRestoringCat(cat);
    const ok = await restoreCategory(userId, cat);
    if (ok) {
      setDeletedCats(prev => prev.filter(d => d.category !== cat));
      setRestoredCat(cat);
      // Re-add star to galaxy
      const entry = await import('../../vault/vaultService').then(m => m.getByCategory(userId, cat, 1));
      const count = entry.length; // rough — star will refresh on next full load
      const star = buildStar(cat, count, entry[0]?.created_at ?? new Date().toISOString());
      upsertStar(star);
      setTimeout(() => setRestoredCat(null), 2500);
    }
    setRestoringCat(null);
  }

  if (!userId) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: 0, marginBottom: open ? 10 : 0,
        }}
      >
        <div style={{
          fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em',
          color: 'var(--text-dim)',
        }}>
          GESTISCI DATI
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>
          ▾
        </span>
      </button>
      <AnimatePresence initial={false}>
      {open && (
      <motion.div
        key="data-content"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        style={{ overflow: 'hidden' }}
      >
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

      {/* Cestino */}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => setShowRestore(v => !v)}
          style={{
            width: '100%', background: showRestore ? 'rgba(240,80,80,0.06)' : 'none',
            border: '1px solid rgba(240,80,80,0.3)', borderRadius: 10,
            padding: '9px 14px', cursor: 'pointer',
            fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em',
            color: 'rgba(240,80,80,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'background 0.2s',
          }}
        >
          <span>🗑 Cestino</span>
          <span style={{ fontSize: 9.5, opacity: 0.6, fontWeight: 400 }}>eliminati automaticamente dopo 7gg</span>
        </button>
        <AnimatePresence initial={false}>
          {showRestore && (
            <motion.div
              key="restore-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                marginTop: 6,
                background: 'rgba(240,80,80,0.03)',
                border: '1px solid rgba(240,80,80,0.1)',
                borderRadius: 10,
                padding: '10px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                {deletedCats.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 2px', textAlign: 'center' }}>
                    Il cestino è vuoto.
                  </div>
                ) : (
                  deletedCats.map(d => {
                    const meta = getCategoryMeta(d.category);
                    const daysAgo = Math.floor((Date.now() - new Date(d.deletedAt).getTime()) / 86400000);
                    const daysLeft = 7 - daysAgo;
                    const isRestored = restoredCat === d.category;
                    const isPurging = purgingCat === d.category;
                    const isConfirmingPurge = confirmPurge === d.category;
                    return (
                      <div key={d.category} style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(240,80,80,0.1)',
                        borderRadius: 9, padding: '8px 10px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, opacity: 0.65 }}>{meta.icon}</span>
                            <div>
                              <span style={{ fontSize: 12, color: 'var(--text)', textTransform: 'capitalize' }}>
                                {meta.label}
                              </span>
                              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                                {d.count} voci · {daysAgo === 0 ? 'eliminata oggi' : `${daysAgo}g fa`} · scade in {daysLeft}g
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button
                              disabled={restoringCat === d.category || isRestored}
                              onClick={() => handleRestore(d.category)}
                              style={{
                                background: isRestored ? 'rgba(80,200,120,0.15)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${isRestored ? 'rgba(80,200,120,0.35)' : 'rgba(255,255,255,0.12)'}`,
                                borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600,
                                color: isRestored ? '#4ecb71' : 'var(--text-dim)',
                                cursor: restoringCat === d.category ? 'wait' : 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isRestored ? '✓' : restoringCat === d.category ? '...' : 'Ripristina'}
                            </button>
                            <button
                              onClick={() => setConfirmPurge(isConfirmingPurge ? null : d.category)}
                              style={{
                                background: isConfirmingPurge ? 'rgba(240,80,80,0.18)' : 'none',
                                border: '1px solid rgba(240,80,80,0.3)',
                                borderRadius: 7, padding: '4px 8px', fontSize: 10.5,
                                color: 'rgba(240,80,80,0.8)', cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isConfirmingPurge && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.15 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{ paddingTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontSize: 10.5, color: 'rgba(240,80,80,0.7)', flex: 1 }}>
                                  Eliminare definitivamente? Azione irreversibile.
                                </span>
                                <button
                                  disabled={isPurging}
                                  onClick={() => handlePurge(d.category)}
                                  style={{
                                    background: 'rgba(240,80,80,0.15)', border: '1px solid rgba(240,80,80,0.4)',
                                    borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600,
                                    color: '#f08080', cursor: 'pointer', whiteSpace: 'nowrap',
                                  }}
                                >
                                  {isPurging ? '...' : 'Elimina'}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Full reset */}
      <div style={{ marginTop: 8 }}>
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
              ⚠️ Cancellare TUTTI i dati del vault? Potrai recuperarli entro 7 giorni dalla sezione sopra.
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
      </motion.div>
      )}
      </AnimatePresence>
    </div>
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

function WearableSection() {
  const [connected, setConnected] = useState(isGoogleFitConnected());
  const hasClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  function handleConnect() {
    connectGoogleFit();
  }

  function handleDisconnect() {
    disconnectGoogleFit();
    setConnected(false);
  }

  return (
    <Section label="WEARABLES">
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🏃</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              Google Fit
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {connected ? 'Connesso · sync ogni 6h' : hasClientId ? 'Passi, sonno, peso' : 'Configura VITE_GOOGLE_CLIENT_ID'}
            </div>
          </div>
        </div>
        {hasClientId && (
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            style={{
              background: connected ? 'rgba(239,68,68,0.12)' : 'rgba(52,211,153,0.12)',
              border: `1px solid ${connected ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)'}`,
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              color: connected ? '#f87171' : '#34d399',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s',
            }}
          >
            {connected ? 'Disconnetti' : 'Connetti'}
          </button>
        )}
      </div>
    </Section>
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
