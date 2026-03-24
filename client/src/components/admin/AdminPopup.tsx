import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminStats, getLastActiveUsers } from '../../vault/vaultService';
import type { AdminStats, ActiveUser } from '../../vault/vaultService';
import { supabase } from '../../config/supabase';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface HistoryEntry {
  type: 'msg_user' | 'msg_ai' | 'fragment';
  content: string;
  timestamp?: string;
}

interface BugTicket {
  id: string;
  created_at: string;
  user_description: string;
  page_path?: string;
  type: 'bug' | 'improvement';
  status: BugStatus;
  priority: BugPriority;
  complexity?: BugComplexity;
  interaction_history?: HistoryEntry[];
}

interface DbStat {
  table: string;
  label: string;
  rows: number;
  sizeMB: number;
}

/* ─── Config ────────────────────────────────────────────────────────────── */

const ADMIN_PASSWORD = 'provaqwerty';

type BugStatus    = 'pending_review' | 'open' | 'in_progress' | 'resolved' | 'wont_fix';
type BugPriority  = 'high' | 'medium' | 'low';
type BugComplexity = 'high' | 'medium' | 'low';

const STATUS_CFG: Record<BugStatus, { label: string; color: string; bg: string }> = {
  pending_review: { label: 'In attesa',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  open:           { label: 'Aperto',     color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  in_progress:    { label: 'In corso',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  resolved:       { label: 'Risolto',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  wont_fix:       { label: 'No fix',     color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

const STATUS_ORDER: BugStatus[] = ['open', 'in_progress', 'resolved', 'wont_fix'];

const PRIORITY_CFG: Record<BugPriority, { label: string; color: string; bg: string }> = {
  high:   { label: 'Alta',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  medium: { label: 'Media',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  low:    { label: 'Bassa',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
};

const COMPLEXITY_CFG: Record<BugComplexity, { label: string; color: string; bg: string }> = {
  low:    { label: 'Facile',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)'   },
  medium: { label: 'Medio',     color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'   },
  high:   { label: 'Difficile', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'   },
};

const FILTER_TABS = [
  { id: 'all'         as const, label: 'Tutti'    },
  { id: 'open'        as const, label: 'Aperti'   },
  { id: 'in_progress' as const, label: 'In corso' },
  { id: 'resolved'    as const, label: 'Risolti'  },
  { id: 'wont_fix'    as const, label: 'No fix'   },
];
type FilterId = typeof FILTER_TABS[number]['id'];

function priorityScore(p: BugPriority): number {
  return p === 'high' ? 2 : p === 'medium' ? 1 : 0;
}

/* ─── Export PDF ────────────────────────────────────────────────────────── */

function exportPDF(tickets: BugTicket[], filterLabel: string) {
  const rows = tickets.map(t => {
    const d    = new Date(t.created_at).toLocaleString('it-IT');
    const st   = STATUS_CFG[t.status]?.label ?? t.status;
    const pr   = PRIORITY_CFG[t.priority]?.label ?? '—';
    const type = t.type === 'improvement' ? '💡 Idea' : '⚠️ Bug';
    const desc = t.user_description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<tr><td>${d}</td><td>${type}</td><td>${st}</td><td>${pr}</td><td>${t.page_path ?? '—'}</td><td>${desc}</td></tr>`;
  }).join('');
  const dateLabel = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>Ticket — ${dateLabel}</title>
<style>body{font-family:monospace;font-size:11px;padding:24px}h1{font-size:15px;margin:0 0 4px}
p.meta{font-size:10px;color:#666;margin:0 0 16px}table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;vertical-align:top;word-break:break-word}
th{background:#f0f0f0;font-weight:bold}@media print{body{padding:0}}</style></head><body>
<h1>Bug Report — ${dateLabel}</h1>
<p class="meta">Filtro: ${filterLabel} · ${tickets.length} ticket</p>
<table><thead><tr><th>Data</th><th>Tipo</th><th>Stato</th><th>Priorità</th><th>Pagina</th><th>Descrizione</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */

export default function AdminPopup({ onClose }: { onClose: () => void }) {
  const [pwInput,   setPwInput  ] = useState('');
  const [unlocked,  setUnlocked ] = useState(false);
  const [pwError,   setPwError  ] = useState(false);
  const [loading,   setLoading  ] = useState(false);
  const [tab,       setTab      ] = useState<'tickets' | 'db' | 'accessi'>('tickets');

  const [pendingBugs,  setPendingBugs ] = useState<BugTicket[]>([]);
  const [approvedBugs, setApprovedBugs] = useState<BugTicket[]>([]);
  const [reviewIdx,    setReviewIdx   ] = useState(0);
  const [stats,        setStats       ] = useState<AdminStats | null>(null);
  const [dbStats,      setDbStats     ] = useState<DbStat[]>([]);
  const [users,        setUsers       ] = useState<ActiveUser[]>([]);

  useEffect(() => { if (unlocked) void loadAll(); }, [unlocked]);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, u, { data: bugData }, { data: bugSizeData }] = await Promise.all([
        getAdminStats(),
        getLastActiveUsers(),
        supabase
          .from('bug_reports')
          .select('id, created_at, user_description, page_path, type, status, priority, complexity, interaction_history')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase.from('bug_reports').select('user_description, interaction_history'),
      ]);

      setStats(s);
      setUsers(u);

      let bugBytes = 0;
      for (const row of bugSizeData ?? []) bugBytes += new Blob([JSON.stringify(row)]).size;

      setDbStats([
        { table: 'vault',       label: 'Vault',       rows: s.totalEntries,          sizeMB: s.totalSizeMB },
        { table: 'bug_reports', label: 'Bug Reports', rows: (bugSizeData ?? []).length, sizeMB: bugBytes / (1024 * 1024) },
      ]);

      const bugs = (bugData ?? []) as BugTicket[];
      setPendingBugs(bugs.filter(b => b.status === 'pending_review'));
      setApprovedBugs(bugs.filter(b => b.status !== 'pending_review'));
      setReviewIdx(0);
    } finally {
      setLoading(false);
    }
  }

  function tryUnlock() {
    if (pwInput === ADMIN_PASSWORD) { setUnlocked(true); setPwError(false); }
    else { setPwError(true); setTimeout(() => setPwError(false), 1200); }
  }

  async function handleApprove(bug: BugTicket) {
    await supabase.from('bug_reports').update({ status: 'open' }).eq('id', bug.id);
    setPendingBugs(prev => prev.filter(b => b.id !== bug.id));
    setApprovedBugs(prev => [{ ...bug, status: 'open' as BugStatus }, ...prev]);
    setReviewIdx(i => Math.min(i, pendingBugs.length - 2));
  }

  async function handleDiscard(bugId: string) {
    await supabase.from('bug_reports').delete().eq('id', bugId);
    setPendingBugs(prev => prev.filter(b => b.id !== bugId));
    setReviewIdx(i => Math.min(i, pendingBugs.length - 2));
  }

  async function updateBug(id: string, field: string, value: string) {
    await supabase.from('bug_reports').update({ [field]: value }).eq('id', id);
    setApprovedBugs(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  }

  async function deleteBug(id: string) {
    await supabase.from('bug_reports').delete().eq('id', id);
    setApprovedBugs(prev => prev.filter(b => b.id !== id));
  }

  function copyBug(id: string) {
    const src = approvedBugs.find(b => b.id === id);
    if (!src) return;
    navigator.clipboard.writeText(src.user_description);
  }

  async function deleteResolved() {
    const ids = approvedBugs.filter(b => b.status === 'resolved').map(b => b.id);
    if (!ids.length || !window.confirm(`Eliminare ${ids.length} ticket risolti?`)) return;
    setApprovedBugs(prev => prev.filter(b => b.status !== 'resolved'));
    await supabase.from('bug_reports').delete().in('id', ids);
  }

  const TABS = [
    { key: 'tickets'  as const, label: `⡿ Segnalazioni${pendingBugs.length > 0 ? ` (${pendingBugs.length})` : ''}` },
    { key: 'db'       as const, label: '⬡ DB & AI' },
    { key: 'accessi'  as const, label: '◉ Accessi' },
  ];

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        key="admin-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)',
        }}
      />

      {/* Panel */}
      <motion.div
        key="admin-panel"
        initial={{ opacity: 0, scale: 0.93, x: '-50%', y: 'calc(-50% + 24px)' }}
        animate={{ opacity: 1, scale: 1,    x: '-50%', y: '-50%' }}
        exit={{ opacity: 0, scale: 0.93,    x: '-50%', y: 'calc(-50% + 24px)' }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          width: 'min(580px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 56px)',
          display: 'flex', flexDirection: 'column',
          zIndex: 810,
          background: 'rgba(6,6,14,0.98)',
          border: '1px solid rgba(167,139,250,0.22)',
          borderRadius: 22,
          boxShadow: '0 32px 100px rgba(0,0,0,0.85), 0 0 60px rgba(167,139,250,0.07)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, color: '#a78bfa' }}>⬡</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(167,139,250,0.9)' }}>
              ADMIN PANEL
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', fontSize: 20, lineHeight: 1,
            padding: '0 4px', borderRadius: 6, transition: 'color 0.15s',
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', overscrollBehavior: 'contain' }}>
          {!unlocked ? (
            /* ── Password ── */
            <div style={{ padding: '28px 0 16px' }}>
              <div style={{ fontSize: 10.5, color: 'rgba(167,139,250,0.55)', marginBottom: 16, letterSpacing: '0.14em', textAlign: 'center' }}>
                INSERISCI PASSWORD
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  value={pwInput}
                  onChange={e => setPwInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && tryUnlock()}
                  placeholder="••••••••"
                  autoFocus
                  style={{
                    flex: 1,
                    background: pwError ? 'rgba(240,80,80,0.08)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${pwError ? 'rgba(240,80,80,0.45)' : 'rgba(167,139,250,0.22)'}`,
                    borderRadius: 10, padding: '10px 14px', fontSize: 15,
                    color: 'var(--text)', outline: 'none', letterSpacing: '0.22em',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                />
                <button onClick={tryUnlock} style={{
                  background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
                  borderRadius: 10, padding: '10px 20px', fontSize: 12,
                  color: '#a78bfa', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.08em',
                }}>Entra</button>
              </div>
              <AnimatePresence>
                {pwError && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ marginTop: 10, fontSize: 11, color: '#f08080', textAlign: 'center' }}>
                    ⚠ Password errata
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : loading ? (
            <div style={{ padding: '32px', textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
              Caricamento dati…
            </div>
          ) : (
            <div>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                {TABS.map(({ key, label }) => (
                  <button key={key} onClick={() => setTab(key)} style={{
                    flex: 1, padding: '6px 4px', fontSize: 9.5, fontWeight: 700,
                    borderRadius: 8, border: '1px solid', cursor: 'pointer',
                    background: tab === key ? 'rgba(167,139,250,0.12)' : 'transparent',
                    borderColor: tab === key ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.07)',
                    color: tab === key ? '#a78bfa' : 'var(--text-dim)',
                    letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.18s',
                  }}>{label}</button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  {tab === 'tickets' && (
                    <TicketsTab
                      pendingBugs={pendingBugs}
                      approvedBugs={approvedBugs}
                      reviewIdx={reviewIdx}
                      setReviewIdx={setReviewIdx}
                      onApprove={handleApprove}
                      onDiscard={handleDiscard}
                      onUpdate={updateBug}
                      onDelete={deleteBug}
                      onCopy={copyBug}
                      onDeleteResolved={deleteResolved}
                    />
                  )}
                  {tab === 'db'      && <DbTab stats={stats} dbStats={dbStats} />}
                  {tab === 'accessi' && <AccessiTab users={users} />}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 1 — Segnalazioni
═══════════════════════════════════════════════════════════ */

function TicketsTab({
  pendingBugs, approvedBugs, reviewIdx, setReviewIdx,
  onApprove, onDiscard, onUpdate, onDelete, onCopy, onDeleteResolved,
}: {
  pendingBugs:      BugTicket[];
  approvedBugs:     BugTicket[];
  reviewIdx:        number;
  setReviewIdx:     (fn: (i: number) => number) => void;
  onApprove:        (b: BugTicket) => void;
  onDiscard:        (id: string) => void;
  onUpdate:         (id: string, field: string, value: string) => void;
  onDelete:         (id: string) => void;
  onCopy:           (id: string) => void;
  onDeleteResolved: () => void;
}) {
  const [filter, setFilter] = useState<FilterId>('all');

  // Approved sorted: priority desc, then date desc
  const sorted = approvedBugs.slice().sort((a, b) => {
    const pd = priorityScore(b.priority ?? 'low') - priorityScore(a.priority ?? 'low');
    if (pd !== 0) return pd;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filtered = filter === 'all' ? sorted : sorted.filter(b => b.status === filter);

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = approvedBugs.filter(b => b.status === s).length;
    return acc;
  }, {});

  const highCount     = approvedBugs.filter(b => b.priority === 'high').length;
  const resolvedCount = counts['resolved'] ?? 0;
  const filterLabel   = FILTER_TABS.find(t => t.id === filter)?.label ?? 'Tutti';
  const currentReview = pendingBugs[reviewIdx];

  return (
    <div>
      {/* ── Revisione pending ── */}
      <AnimatePresence initial={false}>
        {pendingBugs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden', marginBottom: 20 }}
          >
            <div style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em',
              color: 'rgba(240,192,64,0.7)', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              NUOVE SEGNALAZIONI
              <span style={{
                padding: '1px 7px', borderRadius: 10, fontSize: 9,
                background: 'rgba(240,192,64,0.12)', color: '#f0c040',
              }}>{pendingBugs.length}</span>
              <span style={{ opacity: 0.4, fontWeight: 400 }}>← scarta · tieni →</span>
              {pendingBugs.length > 1 && (
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button onClick={() => setReviewIdx(i => Math.max(0, i - 1))} disabled={reviewIdx === 0}
                    style={navBtnStyle(reviewIdx === 0)}>←</button>
                  <button onClick={() => setReviewIdx(i => Math.min(pendingBugs.length - 1, i + 1))} disabled={reviewIdx >= pendingBugs.length - 1}
                    style={navBtnStyle(reviewIdx >= pendingBugs.length - 1)}>→</button>
                </span>
              )}
            </div>
            {currentReview && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentReview.id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.18 }}
                >
                  <SwipeCard
                    bug={currentReview}
                    index={reviewIdx}
                    total={pendingBugs.length}
                    onApprove={() => onApprove(currentReview)}
                    onDiscard={() => onDiscard(currentReview.id)}
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header elenco ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(167,139,250,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
          ELENCO · {approvedBugs.length} ticket
          {highCount > 0 && (
            <span style={{ color: '#f87171', fontSize: 9 }}>⚠ {highCount} alta</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => exportPDF(filtered, filterLabel)} disabled={filtered.length === 0}
            style={actionBtnStyle(false)}>
            ↓ Esporta
          </button>
          {resolvedCount > 0 && (
            <button onClick={onDeleteResolved} style={actionBtnStyle(true)}>
              🗑 Risolti ({resolvedCount})
            </button>
          )}
        </div>
      </div>

      {/* KPI chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {STATUS_ORDER.map(s => {
          const c = STATUS_CFG[s];
          return (
            <span key={s} style={{ fontSize: 9, color: c.color, padding: '2px 8px', borderRadius: 8, background: c.bg }}>
              {counts[s] ?? 0} {c.label.toLowerCase()}
            </span>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(t => {
          const active = filter === t.id;
          const cnt = t.id !== 'all' ? (counts[t.id] ?? 0) : undefined;
          return (
            <button key={t.id} onClick={() => setFilter(t.id)} style={{
              fontSize: 9.5, padding: '3px 10px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid',
              borderColor: active ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)',
              background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
              color: active ? '#a78bfa' : 'var(--text-dim)',
              display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
            }}>
              {t.label}
              {cnt !== undefined && (
                <span style={{
                  fontSize: 8.5, padding: '0 5px', borderRadius: 6,
                  background: active ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)',
                  color: active ? '#a78bfa' : 'var(--text-dim)',
                }}>{cnt}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '12px 0', textAlign: 'center' }}>
          {filter === 'all' ? '✓ Nessun ticket approvato.' : 'Nessun ticket per questo stato.'}
        </div>
      ) : (
        <div>
          {filtered.map(bug => (
            <TicketRow
              key={bug.id}
              bug={bug}
              onUpdate={(field, val) => onUpdate(bug.id, field, val)}
              onDelete={() => onDelete(bug.id)}
              onCopy={() => onCopy(bug.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Swipe card ── */
function SwipeCard({ bug, index, total, onApprove, onDiscard }: {
  bug: BugTicket; index: number; total: number;
  onApprove: () => void; onDiscard: () => void;
}) {
  const [dragX,   setDragX  ] = useState(0);
  const [dragging,setDragging] = useState(false);
  const [exiting, setExiting ] = useState<'left' | 'right' | null>(null);

  const isRight = dragX > 55;
  const isLeft  = dragX < -55;

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if      (info.offset.x >  100) { setExiting('right'); setTimeout(onApprove, 320); }
    else if (info.offset.x < -100) { setExiting('left');  setTimeout(onDiscard, 320); }
    else setDragX(0);
    setDragging(false);
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: -260, right: 260 }}
      dragElastic={0.15}
      dragMomentum={false}
      onDragStart={() => setDragging(true)}
      onDrag={(_, info) => setDragX(info.offset.x)}
      onDragEnd={handleDragEnd}
      animate={
        exiting === 'right' ? { x: 520, opacity: 0, rotate: 22,  transition: { duration: 0.32 } } :
        exiting === 'left'  ? { x: -520, opacity: 0, rotate: -22, transition: { duration: 0.32 } } :
        { rotate: dragX * 0.055 }
      }
      style={{
        cursor: dragging ? 'grabbing' : 'grab',
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${isRight ? 'rgba(74,222,128,0.55)' : isLeft ? 'rgba(240,80,80,0.55)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14, padding: '14px 16px', position: 'relative', userSelect: 'none',
        boxShadow: isRight ? '0 0 24px rgba(74,222,128,0.14)' : isLeft ? '0 0 24px rgba(240,80,80,0.14)' : 'none',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        touchAction: 'pan-y',
      }}
    >
      <AnimatePresence>
        {isRight && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', top: 10, left: 12, fontSize: 9.5, fontWeight: 700, color: '#4ade80', letterSpacing: '0.12em', background: 'rgba(74,222,128,0.12)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(74,222,128,0.3)' }}>
            ✓ APPROVA
          </motion.div>
        )}
        {isLeft && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', top: 10, right: 12, fontSize: 9.5, fontWeight: 700, color: '#f08080', letterSpacing: '0.12em', background: 'rgba(240,80,80,0.12)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(240,80,80,0.3)' }}>
            ✗ SCARTA
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ marginTop: isRight || isLeft ? 26 : 0, transition: 'margin 0.12s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: bug.type === 'bug' ? '#f0c040' : '#40e0d0' }}>
            {bug.type === 'bug' ? '⚠ BUG' : '✦ IDEA'}
          </span>
          {bug.priority && (
            <span style={{ fontSize: 9, color: PRIORITY_CFG[bug.priority].color, background: PRIORITY_CFG[bug.priority].bg, padding: '1px 6px', borderRadius: 5 }}>
              {PRIORITY_CFG[bug.priority].label}
            </span>
          )}
          <span style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>{fmtDate(bug.created_at)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-dim)', opacity: 0.5 }}>{index + 1}/{total}</span>
        </div>
        {bug.page_path && (
          <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 5, opacity: 0.6 }}>{bug.page_path}</div>
        )}
        <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55, opacity: 0.88 }}>
          {bug.user_description.slice(0, 220)}{bug.user_description.length > 220 ? '…' : ''}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', opacity: 0.45, letterSpacing: '0.06em' }}>
        ← scarta · trascina · approva →
      </div>
    </motion.div>
  );
}

/* ── Ticket row in list ── */
function TicketRow({ bug, onUpdate, onDelete, onCopy }: {
  bug: BugTicket;
  onUpdate: (field: string, value: string) => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(bug.user_description);

  const sCfg = STATUS_CFG[bug.status] ?? STATUS_CFG.open;
  const pCfg = PRIORITY_CFG[bug.priority ?? 'low'];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, marginBottom: 6, overflow: 'hidden',
    }}>
      {/* Header row */}
      <button onClick={() => setExpanded(e => !e)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px',
        textAlign: 'left', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: bug.type === 'bug' ? '#f0c040' : '#40e0d0', flexShrink: 0 }}>
          {bug.type === 'bug' ? '⚠' : '✦'}
        </span>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 5, flexShrink: 0, background: pCfg.bg, color: pCfg.color }}>
          {pCfg.label}
        </span>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 5, flexShrink: 0, background: sCfg.bg, color: sCfg.color }}>
          {sCfg.label}
        </span>
        <span style={{ fontSize: 9.5, color: 'var(--text-dim)', flexShrink: 0 }}>{fmtDate(bug.created_at)}</span>
        {bug.page_path && <span style={{ fontSize: 9, color: 'var(--text-dim)', opacity: 0.5, flexShrink: 0 }}>{bug.page_path}</span>}
        <span style={{ flex: 1, fontSize: 11, color: 'var(--text)', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bug.user_description.slice(0, 60)}{bug.user_description.length > 60 ? '…' : ''}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', opacity: 0.4, flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 12px 12px' }}>
              {/* Description */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>DESCRIZIONE</span>
                {!editingDesc ? (
                  <button onClick={() => { setDescDraft(bug.user_description); setEditingDesc(true); }} style={{
                    fontSize: 9, padding: '1px 7px', borderRadius: 5, cursor: 'pointer',
                    background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa',
                  }}>✎ Modifica</button>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { onUpdate('user_description', descDraft); setEditingDesc(false); }} style={{
                      fontSize: 9, padding: '1px 7px', borderRadius: 5, cursor: 'pointer',
                      background: 'rgba(64,224,208,0.08)', border: '1px solid rgba(64,224,208,0.25)', color: '#40e0d0',
                    }}>✓ Salva</button>
                    <button onClick={() => setEditingDesc(false)} style={{
                      fontSize: 9, padding: '1px 7px', borderRadius: 5, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)',
                    }}>✕</button>
                  </div>
                )}
              </div>
              {editingDesc ? (
                <textarea
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  style={{
                    width: '100%', fontSize: 12, color: 'var(--text)', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, padding: '6px 8px',
                    lineHeight: 1.55, resize: 'vertical', minHeight: 70, outline: 'none',
                    fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box',
                  }}
                />
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text)', opacity: 0.82, lineHeight: 1.55, margin: '0 0 12px' }}>
                  {bug.user_description}
                </p>
              )}

              {/* History */}
              {bug.interaction_history && bug.interaction_history.length > 0 && (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                    CRONOLOGIA
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    {bug.interaction_history.map((entry, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 6, padding: '3px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        alignItems: 'flex-start',
                      }}>
                        <span style={{ fontSize: 9, color: entry.type === 'msg_user' ? '#a78bfa' : '#40e0d0', flexShrink: 0, marginTop: 1 }}>
                          {entry.type === 'msg_user' ? '→' : entry.type === 'msg_ai' ? '←' : '◦'}
                        </span>
                        <span style={{ fontSize: 10.5, color: 'var(--text)', opacity: 0.65, flex: 1, lineHeight: 1.4 }}>
                          {entry.content.length > 100 ? entry.content.slice(0, 100) + '…' : entry.content}
                        </span>
                        {entry.timestamp && (
                          <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>
                            {new Date(entry.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Priority */}
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                PRIORITÀ
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {(['high', 'medium', 'low'] as BugPriority[]).map(p => {
                  const c = PRIORITY_CFG[p];
                  const active = (bug.priority ?? 'low') === p;
                  return (
                    <button key={p} onClick={() => onUpdate('priority', p)} style={{
                      fontSize: 9.5, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                      border: `1px solid ${active ? c.color + '55' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? c.bg : 'transparent', color: active ? c.color : 'var(--text-dim)',
                      transition: 'all 0.15s',
                    }}>{c.label}</button>
                  );
                })}
              </div>

              {/* Complexity */}
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                COMPLESSITÀ
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {(['low', 'medium', 'high'] as BugComplexity[]).map(c => {
                  const cx = COMPLEXITY_CFG[c];
                  const active = bug.complexity === c;
                  return (
                    <button key={c} onClick={() => onUpdate('complexity', c)} style={{
                      fontSize: 9.5, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                      border: `1px solid ${active ? cx.color + '55' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? cx.bg : 'transparent', color: active ? cx.color : 'var(--text-dim)',
                      transition: 'all 0.15s',
                    }}>{cx.label}</button>
                  );
                })}
              </div>

              {/* Status */}
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                STATO
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {STATUS_ORDER.map(s => {
                  const c = STATUS_CFG[s];
                  const active = bug.status === s;
                  return (
                    <button key={s} onClick={() => onUpdate('status', s)} style={{
                      fontSize: 9.5, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                      border: `1px solid ${active ? c.color + '55' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? c.bg : 'transparent', color: active ? c.color : 'var(--text-dim)',
                      transition: 'all 0.15s',
                    }}>{c.label}</button>
                  );
                })}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button onClick={onCopy} style={{
                  fontSize: 9.5, padding: '4px 12px', borderRadius: 7, cursor: 'pointer',
                  background: 'rgba(240,192,64,0.07)', border: '1px solid rgba(240,192,64,0.25)',
                  color: '#f0c040', display: 'flex', alignItems: 'center', gap: 4,
                }}>⎘ Copia</button>
                <button onClick={onDelete} style={{
                  fontSize: 9.5, padding: '4px 12px', borderRadius: 7, cursor: 'pointer',
                  background: 'rgba(240,80,80,0.07)', border: '1px solid rgba(240,80,80,0.25)',
                  color: '#f08080', display: 'flex', alignItems: 'center', gap: 4,
                }}>⊗ Elimina</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Shared button styles ─────────────────────────────────────────────── */

function actionBtnStyle(danger: boolean): React.CSSProperties {
  return {
    fontSize: 9.5, fontWeight: 600, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
    background: danger ? 'rgba(240,80,80,0.07)' : 'rgba(167,139,250,0.08)',
    border: `1px solid ${danger ? 'rgba(240,80,80,0.28)' : 'rgba(167,139,250,0.28)'}`,
    color: danger ? '#f08080' : '#a78bfa',
    display: 'flex', alignItems: 'center', gap: 4,
  };
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
    color: disabled ? 'rgba(255,255,255,0.15)' : 'var(--text-dim)',
  };
}

/* ═══════════════════════════════════════════════════════════
   TAB 2 — DB & AI
═══════════════════════════════════════════════════════════ */

function DbTab({ stats, dbStats }: { stats: AdminStats | null; dbStats: DbStat[] }) {
  const maxSize = Math.max(...dbStats.map(d => d.sizeMB), 0.001);
  const aiCalls    = stats?.aiCalls    ?? 0;
  const tokIn      = stats?.aiTokensIn  ?? 0;
  const tokOut     = stats?.aiTokensOut ?? 0;
  const costUSD    = stats?.estimatedCostUSD ?? 0;
  const totalRows  = dbStats.reduce((s, d) => s + d.rows, 0);
  const totalSizeMB = dbStats.reduce((s, d) => s + d.sizeMB, 0);

  return (
    <div>
      {/* ── AI Calls ── */}
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(64,224,208,0.7)', marginBottom: 10 }}>
        DEEPSEEK L2
      </div>
      <div style={{
        background: 'rgba(64,224,208,0.05)', border: '1px solid rgba(64,224,208,0.18)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 20,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#40e0d0', fontVariantNumeric: 'tabular-nums' }}>
            {aiCalls.toLocaleString('it-IT')}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 2 }}>chiamate</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
            {(tokIn + tokOut).toLocaleString('it-IT')}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 2 }}>token totali</div>
          <div style={{ fontSize: 8.5, color: 'var(--text-dim)', opacity: 0.6 }}>↑{tokIn.toLocaleString()} ↓{tokOut.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f0c040', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
            ${costUSD < 0.001 ? '<0.001' : costUSD.toFixed(4)}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 2 }}>costo stimato</div>
          <div style={{ fontSize: 8.5, color: 'var(--text-dim)', opacity: 0.6 }}>$0.14/M in · $0.28/M out</div>
        </div>
      </div>

      {/* ── DB Tables ── */}
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.6)', marginBottom: 10 }}>
        TABELLE DB
      </div>

      {dbStats.map(stat => (
        <div key={stat.table} style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginRight: 8 }}>{stat.label}</span>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-dim)' }}>{stat.table}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', fontVariantNumeric: 'tabular-nums' }}>
                {stat.rows.toLocaleString('it-IT')}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>record</div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 5 }}>
              <span>Peso JSON</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#40e0d0' }}>
                {stat.sizeMB < 0.0005 ? '<0.001 MB' : stat.sizeMB < 1 ? `${(stat.sizeMB * 1024).toFixed(1)} KB` : `${stat.sizeMB.toFixed(3)} MB`}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(stat.sizeMB / maxSize) * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #a78bfa, #40e0d0)', borderRadius: 2 }}
              />
            </div>
          </div>
        </div>
      ))}

      {/* ── Totale generale ── */}
      {dbStats.length > 0 && (
        <div style={{
          background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em' }}>TOTALE</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', fontVariantNumeric: 'tabular-nums' }}>
              {totalRows.toLocaleString('it-IT')}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--text-dim)', marginLeft: 6 }}>record</span>
            <span style={{ fontSize: 9.5, color: '#40e0d0', marginLeft: 10, fontVariantNumeric: 'tabular-nums' }}>
              {totalSizeMB < 1 ? `${(totalSizeMB * 1024).toFixed(1)} KB` : `${totalSizeMB.toFixed(3)} MB`}
            </span>
          </div>
        </div>
      )}

      {/* ── Vault per categoria ── */}
      {stats && stats.byCategory.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.6)', marginBottom: 10 }}>
            VAULT · PER CATEGORIA
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
            {stats.byCategory.slice(0, 12).map(({ category, count }) => {
              const pct = (count / stats.totalEntries) * 100;
              return (
                <div key={category} style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text)', opacity: 0.78 }}>{category}</span>
                    <span style={{ fontSize: 11, color: '#a78bfa', fontVariantNumeric: 'tabular-nums' }}>
                      {count} <span style={{ color: 'var(--text-dim)', fontSize: 9.5 }}>({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#a78bfa', borderRadius: 1, opacity: 0.55 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dbStats.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 0' }}>
          Nessun dato (RLS attivo o nessun record)
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 3 — Ultimi Accessi
═══════════════════════════════════════════════════════════ */

function AccessiTab({ users }: { users: ActiveUser[] }) {
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.6)', marginBottom: 10 }}>
        ULTIMI ACCESSI · {users.length} utenti
      </div>

      {users.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 0' }}>
          Nessun dato disponibile (RLS attivo)
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
          {users.map((u, i) => (
            <div key={u.userId} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr auto auto', gap: 10,
              padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center',
            }}>
              <span style={{ fontSize: 9.5, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', opacity: 0.5 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text)', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.email || u.userId.slice(0, 14) + '…'}
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', opacity: 0.5 }}>
                reg. {fmtTime(u.createdAt)}
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', opacity: 0.7 }}>
                {u.lastSignIn ? fmtTime(u.lastSignIn) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
