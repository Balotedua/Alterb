import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Lightbulb, Send, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { useAlterStore } from '@/store/alterStore';

type TabId = 'bug' | 'improvement';

export default function BugReportPanel() {
  const { showBugReport, setShowBugReport, messages, user } = useAlterStore();
  const [activeTab, setActiveTab]     = useState<TabId>('bug');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  function close() {
    setShowBugReport(false);
    setDescription('');
    setError(null);
    setSubmitted(false);
    setActiveTab('bug');
  }

  function switchTab(tab: TabId) {
    setActiveTab(tab);
    setDescription('');
    setError(null);
  }

  async function handleSubmit() {
    if (!description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const history = messages.slice(-5).map(m => ({
        type: m.role === 'user' ? 'msg_user' : 'msg_nebula',
        content: m.text,
        timestamp: m.ts,
      }));
      const { error: dbErr } = await supabase.from('bug_reports').insert({
        user_id:             user?.id ?? null,
        interaction_history: activeTab === 'bug' ? history : [],
        user_description:    description.trim(),
        page_path:           window.location.pathname,
        type:                activeTab,
        status:              'pending_review',
      });
      if (dbErr) throw dbErr;
      setSubmitted(true);
      setTimeout(() => close(), 2200);
    } catch (e) {
      console.error('[BugReport]', e);
      setError('Invio fallito. Riprova tra poco.');
    } finally {
      setSubmitting(false);
    }
  }

  const accentColor = activeTab === 'bug' ? '#f0c040' : '#40e0d0';
  const accentAlpha = activeTab === 'bug' ? 'rgba(240,192,64,' : 'rgba(64,224,208,';

  return (
    <AnimatePresence>
      {showBugReport && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bug-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            style={{
              position: 'fixed', inset: 0, zIndex: 700,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Panel wrapper — centering container */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 701,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
          <motion.div
            key="bug-panel"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              pointerEvents: 'auto',
              width: 'min(420px, 92vw)',
              background: 'rgba(10,10,18,0.97)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 18,
              padding: '22px 20px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeTab === 'bug'
                  ? <AlertTriangle size={15} color="#f0c040" />
                  : <Lightbulb size={15} color="#40e0d0" />
                }
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)' }}>
                  {activeTab === 'bug' ? 'Segnala Bug' : 'Proponi Miglioria'}
                </span>
              </div>
              <button
                onClick={close}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {(['bug', 'improvement'] as TabId[]).map(tab => {
                const active = activeTab === tab;
                const c = tab === 'bug' ? 'rgba(240,192,64,' : 'rgba(64,224,208,';
                const tc = tab === 'bug' ? '#f0c040' : '#40e0d0';
                return (
                  <button
                    key={tab}
                    onClick={() => switchTab(tab)}
                    style={{
                      flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600,
                      borderRadius: 8, border: '1px solid',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: active ? `${c}0.1)` : 'transparent',
                      borderColor: active ? `${c}0.3)` : 'rgba(255,255,255,0.07)',
                      color: active ? tc : 'var(--text-dim)',
                    }}
                  >
                    {tab === 'bug' ? '⚠ Bug' : '✦ Miglioria'}
                  </button>
                );
              })}
            </div>

            {submitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircle2 size={32} color="#40e0d0" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
                  {activeTab === 'bug' ? 'Bug registrato, grazie!' : 'Miglioria inviata, grazie!'}
                </p>
              </div>
            ) : (
              <>
                {/* Interaction history — solo bug */}
                {activeTab === 'bug' && messages.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.6)', marginBottom: 6 }}>
                      CONTESTO RECENTE
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 8, padding: '6px 10px',
                      maxHeight: 90, overflowY: 'auto',
                    }}>
                      {messages.slice(-5).map((m, i) => (
                        <div key={i} style={{ fontSize: 10.5, color: 'var(--text-dim)', padding: '2px 0', display: 'flex', gap: 6 }}>
                          <span style={{ color: m.role === 'user' ? '#f0c040' : '#a78bfa', flexShrink: 0 }}>
                            {m.role === 'user' ? 'Tu' : 'AI'}:
                          </span>
                          <span style={{ opacity: 0.75 }}>
                            {m.text.slice(0, 80)}{m.text.length > 80 ? '…' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.6)', marginBottom: 6 }}>
                  {activeTab === 'bug' ? 'DESCRIVI IL PROBLEMA' : 'DESCRIVI LA TUA IDEA'}
                </div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={activeTab === 'bug'
                    ? 'Es. "Ho premuto invia e nulla è successo…"'
                    : 'Es. "Sarebbe utile poter esportare in PDF…"'
                  }
                  rows={activeTab === 'improvement' ? 5 : 3}
                  disabled={submitting}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, padding: '10px 12px',
                    fontSize: 13, color: 'var(--text)',
                    resize: 'none', outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'right', marginTop: 4, marginBottom: 10 }}>
                  {description.length} caratteri
                </div>

                {error && <p style={{ fontSize: 11, color: '#f08080', marginBottom: 8, margin: '0 0 8px' }}>{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !description.trim()}
                  style={{
                    width: '100%', padding: '10px',
                    borderRadius: 10, border: 'none',
                    background: description.trim() ? `${accentAlpha}0.12)` : 'rgba(255,255,255,0.04)',
                    color: description.trim() ? accentColor : 'var(--text-dim)',
                    fontSize: 12, fontWeight: 600,
                    cursor: description.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'all 0.15s',
                  }}
                >
                  {submitting
                    ? '...'
                    : <><Send size={12} /> {activeTab === 'bug' ? 'Invia Segnalazione' : 'Invia Miglioria'}</>
                  }
                </button>
              </>
            )}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
