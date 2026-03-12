import { useState } from 'react';
import { AlertTriangle, Send, CheckCircle2, Lightbulb, Clock, MessageSquare, Layers } from 'lucide-react';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { useNebulaStore, type InteractionEntry } from '@/store/nebulaStore';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function entryIcon(type: InteractionEntry['type']) {
  if (type === 'msg_user')  return <MessageSquare size={11} />;
  if (type === 'msg_ai')    return <span style={{ fontSize: 11 }}>✦</span>;
  return <Layers size={11} />;
}

function entryLabel(entry: InteractionEntry) {
  if (entry.type === 'fragment') {
    const name = entry.content.replace(/([A-Z])/g, ' $1').trim();
    return `Aperto: ${name}${entry.module ? ` (${entry.module})` : ''}`;
  }
  const prefix = entry.type === 'msg_user' ? 'Tu: ' : 'Nebula: ';
  const text = entry.content.length > 80 ? entry.content.slice(0, 80) + '…' : entry.content;
  return prefix + text;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type TabId = 'bug' | 'improvement';

const TAB_CONFIG = {
  bug: {
    icon: <AlertTriangle size={15} />,
    tabIcon: <AlertTriangle size={11} />,
    title: 'Segnala bug',
    label: 'Descrivi il problema',
    placeholder: 'Es. "Ho premuto aggiungi e nulla è successo…"',
    successText: 'Grazie! Il bug è stato registrato.',
    submitLabel: 'Invia segnalazione',
  },
  improvement: {
    icon: <Lightbulb size={15} />,
    tabIcon: <Lightbulb size={11} />,
    title: 'Proponi miglioria',
    label: 'Descrivi la tua idea',
    placeholder: 'Es. "Sarebbe utile poter esportare i dati in PDF…"',
    successText: 'Grazie! La tua miglioria è stata inviata.',
    submitLabel: 'Invia miglioria',
  },
} as const;

// ── Component ──────────────────────────────────────────────────────────────────

export function BugReportFragment({ params }: { params?: Record<string, unknown> }) {
  const { interactionHistory, clearFragment } = useNebulaStore();
  const { user } = useAuth();

  const initialTab: TabId = params?.tab === 'improvement' ? 'improvement' : 'bug';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const cfg = TAB_CONFIG[activeTab];

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
      const { error: dbErr } = await supabase.from('bug_reports').insert({
        user_id:             user?.id ?? null,
        interaction_history: activeTab === 'bug' ? interactionHistory : [],
        user_description:    description.trim(),
        page_path:           window.location.pathname,
        type:                activeTab,
        status:              'pending_review',
      });
      if (dbErr) throw dbErr;
      setSubmitted(true);
      setTimeout(() => clearFragment(), 2200);
    } catch (e) {
      console.error('[BugReport] submit error:', e);
      setError('Invio fallito. Riprova tra poco.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <NebulaCard icon={cfg.icon} title={cfg.title} closable>
        <div className="bug-success">
          <CheckCircle2 size={36} className="bug-success-icon" />
          <p className="bug-success-text">{cfg.successText}</p>
        </div>
      </NebulaCard>
    );
  }

  return (
    <NebulaCard icon={cfg.icon} title={cfg.title} closable>

      {/* Tab bar */}
      <div className="bug-tabbar">
        {(['bug', 'improvement'] as TabId[]).map((tab) => (
          <button
            key={tab}
            className={['bug-tab', activeTab === tab ? 'bug-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => switchTab(tab)}
          >
            {TAB_CONFIG[tab].tabIcon}
            {tab === 'bug' ? 'Segnala Bug' : 'Proponi Miglioria'}
          </button>
        ))}
      </div>

      {/* Interaction history — solo per i bug */}
      {activeTab === 'bug' && (
        <>
          <div className="bug-section-label">Cosa stava succedendo</div>
          {interactionHistory.length === 0 ? (
            <p className="bug-empty">Nessuna interazione recente registrata.</p>
          ) : (
            <ul className="bug-history-list">
              {interactionHistory.map((entry, i) => (
                <li key={i} className={`bug-history-item bug-history-item--${entry.type}`}>
                  <span className="bug-history-icon">{entryIcon(entry.type)}</span>
                  <span className="bug-history-content">{entryLabel(entry)}</span>
                  <span className="bug-history-time">
                    <Clock size={9} />
                    {formatTime(entry.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Description */}
      <div className="bug-section-label" style={activeTab === 'bug' ? { marginTop: '0.9rem' } : {}}>
        {cfg.label}
      </div>
      <textarea
        className="bug-textarea"
        placeholder={cfg.placeholder}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={activeTab === 'improvement' ? 5 : 3}
        maxLength={600}
        disabled={submitting}
      />
      <div className="bug-char-count">{description.length}/600</div>

      {error && <p className="bug-error">{error}</p>}

      <button
        className="bug-submit-btn"
        onClick={handleSubmit}
        disabled={submitting || !description.trim()}
      >
        {submitting ? (
          <span className="bug-spinner" />
        ) : (
          <>
            <Send size={13} />
            {cfg.submitLabel}
          </>
        )}
      </button>
    </NebulaCard>
  );
}
