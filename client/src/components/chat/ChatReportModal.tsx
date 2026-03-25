import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../config/supabase';
import { useAlterStore } from '../../store/alterStore';

export default function ChatReportModal({ onClose }: { onClose: () => void }) {
  const { messages, user } = useAlterStore();
  const [rating, setRating]           = useState<number | null>(null);
  const [hoveredRating, setHovered]   = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      const history = messages.slice(-7).map(m => ({
        type:      m.role === 'user' ? 'msg_user' : 'msg_nebula',
        content:   m.text,
        timestamp: m.ts,
      }));
      const descText = `Imprecisione: ${rating}/5${description.trim() ? ` — ${description.trim()}` : ''}`;
      const { error: dbErr } = await supabase.from('bug_reports').insert({
        user_id:             user?.id ?? null,
        interaction_history: history,
        user_description:    descText,
        page_path:           window.location.pathname,
        type:                'bug',
        status:              'pending_review',
      });
      if (dbErr) throw dbErr;
      setSubmitted(true);
      setTimeout(() => onClose(), 2000);
    } catch (e) {
      console.error('[ChatReport]', e);
      setError('Invio fallito. Riprova.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoveredRating ?? rating;
  const ratingLabels  = ['', 'Molto impreciso', 'Abbastanza', 'Mediocre', 'Quasi corretto', 'Leggermente off'];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="chat-report-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 700,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 701,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <motion.div
          key="chat-report-panel"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            width: 'min(380px, 92vw)',
            background: 'rgba(10,10,18,0.97)',
            border: '1px solid rgba(240,192,64,0.15)',
            borderRadius: 18,
            padding: '22px 20px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0c040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)' }}>
                Segnala risposta imprecisa
              </span>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 4, display: 'flex',
              fontSize: 18, lineHeight: 1,
            }}>×</button>
          </div>

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#40e0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px', display: 'block' }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Segnalazione inviata, grazie!</p>
            </div>
          ) : (
            <>
              {/* Rating */}
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(240,192,64,0.6)', marginBottom: 10 }}>
                QUANTO È STATA IMPRECISA? <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>(obbligatorio)</span>
              </div>

              {/* Bar */}
              <div
                style={{ display: 'flex', gap: 5, marginBottom: 6, cursor: 'pointer' }}
                onMouseLeave={() => setHovered(null)}
              >
                {[1, 2, 3, 4, 5].map(i => (
                  <button
                    key={i}
                    onMouseEnter={() => setHovered(i)}
                    onClick={() => setRating(i)}
                    style={{
                      flex: 1, height: 8, borderRadius: 4, border: 'none',
                      cursor: 'pointer', padding: 0,
                      background: i <= (displayRating ?? 0)
                        ? `rgba(240,192,64,${0.35 + i * 0.13})`
                        : 'rgba(255,255,255,0.08)',
                      transition: 'background 0.12s',
                      boxShadow: i <= (displayRating ?? 0) ? `0 0 6px rgba(240,192,64,0.3)` : 'none',
                    }}
                  />
                ))}
              </div>
              <div style={{
                fontSize: 10, color: 'rgba(240,192,64,0.55)',
                minHeight: 16, marginBottom: 16,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{displayRating ? ratingLabels[displayRating] : ''}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>{displayRating ? `${displayRating}/5` : '1 → 5'}</span>
              </div>

              {/* Optional description */}
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.6)', marginBottom: 6 }}>
                LASCIA UN COMMENTO <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>(opzionale)</span>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder='Es. "Ha confuso la categoria finanze con salute…"'
                rows={3}
                disabled={submitting}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 12px',
                  fontSize: 13, color: 'var(--text)',
                  resize: 'none', outline: 'none', fontFamily: 'inherit',
                  marginBottom: 10,
                }}
              />

              {error && <p style={{ fontSize: 11, color: '#f08080', margin: '0 0 8px' }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '9px',
                    borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent', color: 'var(--text-dim)',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !rating}
                  style={{
                    flex: 2, padding: '9px',
                    borderRadius: 10, border: 'none',
                    background: rating ? 'rgba(240,192,64,0.12)' : 'rgba(255,255,255,0.04)',
                    color: rating ? '#f0c040' : 'var(--text-dim)',
                    fontSize: 12, fontWeight: 600,
                    cursor: rating ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'all 0.15s',
                  }}
                >
                  {submitting ? '...' : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Invia segnalazione
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </>
  );
}
