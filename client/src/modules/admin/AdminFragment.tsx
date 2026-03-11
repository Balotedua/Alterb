import { useState, useEffect, useRef } from 'react';
import {
  Lock, ShieldCheck, RefreshCw, ChevronDown, ChevronUp,
  Clock, MessageSquare, Layers, AlertTriangle, Bug,
  BarChart2, Settings2, TrendingUp, Zap, Trash2, Download,
  Flag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { supabase } from '@/services/supabase';
import type { InteractionEntry } from '@/store/nebulaStore';

// ── Types ──────────────────────────────────────────────────────────────────────

type BugStatus   = 'open' | 'in_progress' | 'resolved' | 'wont_fix';
type BugType     = 'bug' | 'improvement';
type BugPriority = 'low' | 'medium' | 'high';

interface BugReport {
  id: string;
  created_at: string;
  user_id: string | null;
  interaction_history: InteractionEntry[];
  user_description: string;
  page_path: string;
  status: BugStatus;
  severity: string | null;
  notes: string | null;
  type: BugType;
  priority: BugPriority;
}

// ── Auth ───────────────────────────────────────────────────────────────────────
let _sessionAuth = false;
const ADMIN_PASSWORD = 'provaqwerty';

// ── Tabs ───────────────────────────────────────────────────────────────────────
type TabId = 'bugs' | 'stats' | 'consumi' | 'sistema';

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'bugs',     icon: <Bug size={12} />,      label: 'Ticket'      },
  { id: 'stats',    icon: <BarChart2 size={12} />, label: 'Statistiche' },
  { id: 'consumi',  icon: <Zap size={12} />,       label: 'Consumi'     },
  { id: 'sistema',  icon: <Settings2 size={12} />, label: 'Sistema'     },
];

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BugStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Aperto',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  in_progress: { label: 'In corso', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  resolved:    { label: 'Risolto',  color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  wont_fix:    { label: 'No fix',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};
const STATUS_ORDER: BugStatus[] = ['open', 'in_progress', 'resolved', 'wont_fix'];

const FILTER_TABS = [
  { id: 'all',         label: 'Tutti'     },
  { id: 'open',        label: 'Aperti'    },
  { id: 'in_progress', label: 'In corso'  },
  { id: 'resolved',    label: 'Risolti'   },
  { id: 'wont_fix',    label: 'No fix'    },
] as const;
type FilterId = typeof FILTER_TABS[number]['id'];

// ── Priority config ────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<BugPriority, { label: string; color: string; bg: string; dot: string }> = {
  low:    { label: 'Bassa',  color: '#34d399', bg: 'rgba(52,211,153,0.12)',  dot: '●' },
  medium: { label: 'Media',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  dot: '●' },
  high:   { label: 'Alta',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', dot: '●' },
};
const PRIORITY_ORDER: BugPriority[] = ['high', 'medium', 'low'];

// ── Table colors ───────────────────────────────────────────────────────────────

const TABLE_COLORS: Record<string, string> = {
  transactions:  '#818cf8',
  bug_reports:   '#f87171',
  profiles:      '#34d399',
  body_vitals:   '#fbbf24',
  sleep_logs:    '#a78bfa',
  water_logs:    '#38bdf8',
  health_goals:  '#fb923c',
  mood_entries:  '#f472b6',
  ai_usage_logs: '#22d3ee',
  page_views:    '#86efac',
};

const DB_TABLES = Object.keys(TABLE_COLORS);

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function entryIcon(type: InteractionEntry['type']) {
  if (type === 'msg_user') return <MessageSquare size={10} />;
  if (type === 'msg_ai')   return <span style={{ fontSize: 10 }}>✦</span>;
  return <Layers size={10} />;
}

function entryLabel(entry: InteractionEntry) {
  if (entry.type === 'fragment') return `Fragment: ${entry.content.replace(/([A-Z])/g, ' $1').trim()}`;
  const prefix = entry.type === 'msg_user' ? '→ ' : '← ';
  return prefix + (entry.content.length > 90 ? entry.content.slice(0, 90) + '…' : entry.content);
}

// Ordina ticket: priority DESC (high > medium > low), poi created_at DESC
function prioritySortScore(p: BugPriority): number {
  return p === 'high' ? 2 : p === 'medium' ? 1 : 0;
}

// ── Export PDF ─────────────────────────────────────────────────────────────────

function exportTicketsPDF(reports: BugReport[], filterLabel: string) {
  const rows = reports.map(r => {
    const d        = new Date(r.created_at).toLocaleString('it-IT');
    const status   = STATUS_CONFIG[r.status]?.label ?? r.status;
    const type     = r.type === 'improvement' ? '💡 Miglioria' : '🐛 Bug';
    const priority = PRIORITY_CONFIG[r.priority ?? 'low']?.label ?? '—';
    const desc     = r.user_description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<tr>
      <td>${d}</td>
      <td>${type}</td>
      <td>${status}</td>
      <td>${priority}</td>
      <td>${r.page_path}</td>
      <td>${desc}</td>
    </tr>`;
  }).join('');

  const dateLabel = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Ticket — ${dateLabel}</title>
<style>
  body { font-family: monospace; font-size: 11px; padding: 24px; color: #111; }
  h1   { font-size: 15px; margin: 0 0 4px; }
  p.meta { font-size: 10px; color: #666; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; vertical-align: top; word-break: break-word; }
  th { background: #f0f0f0; font-weight: bold; }
  td:nth-child(6) { max-width: 240px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>Bug Report — ${dateLabel}</h1>
<p class="meta">Filtro: ${filterLabel} · ${reports.length} ticket · Generato da Nebula Admin</p>
<table>
  <thead><tr><th>Data</th><th>Tipo</th><th>Stato</th><th>Priorità</th><th>Pagina</th><th>Descrizione</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ── Lock screen ────────────────────────────────────────────────────────────────

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pwd, setPwd]     = useState('');
  const [shake, setShake] = useState(false);
  const [show, setShow]   = useState(false);
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function attempt() {
    if (pwd.trim() === ADMIN_PASSWORD) {
      _sessionAuth = true;
      onUnlock();
    } else {
      setShake(true);
      setPwd('');
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div className="admin-lock">
      <div className={['admin-lock-icon', shake ? 'admin-lock-icon--shake' : ''].filter(Boolean).join(' ')}>
        <Lock size={28} />
      </div>
      <p className="admin-lock-title">Area Sviluppatore</p>
      <p className="admin-lock-sub">Inserisci la password per continuare</p>
      <div className="admin-pwd-wrap">
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          className="admin-pwd-input"
          placeholder="Password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && attempt()}
        />
        <button className="admin-pwd-toggle" onClick={() => setShow(v => !v)} type="button">
          {show ? '🙈' : '👁'}
        </button>
      </div>
      <button className="admin-unlock-btn" onClick={attempt} disabled={!pwd}>Accedi</button>
    </div>
  );
}

// ── Ticket row ─────────────────────────────────────────────────────────────────

function TicketRow({ report, onStatusChange, onPriorityChange, onDelete }: {
  report: BugReport;
  onStatusChange: (id: string, status: BugStatus) => void;
  onPriorityChange: (id: string, priority: BugPriority) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg  = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.open;
  const pCfg = PRIORITY_CONFIG[report.priority ?? 'low'];

  return (
    <div className="admin-ticket">
      <button className="admin-ticket-header" onClick={() => setExpanded(v => !v)}>
        <span className="admin-ticket-type-badge" style={{
          color: report.type === 'improvement' ? '#fbbf24' : '#f87171',
        }}>
          {report.type === 'improvement' ? '💡' : '🐛'}
        </span>
        <span className="admin-priority-badge" style={{ color: pCfg.color, background: pCfg.bg }}>
          <Flag size={8} />{pCfg.label}
        </span>
        <span className="admin-ticket-status" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
        <span className="admin-ticket-date"><Clock size={10} />{formatDate(report.created_at)}</span>
        <span className="admin-ticket-path">{report.page_path}</span>
        <span className="admin-ticket-desc-preview">
          {report.user_description.slice(0, 50)}{report.user_description.length > 50 ? '…' : ''}
        </span>
        <span className="admin-ticket-chevron">{expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}</span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="admin-ticket-body">
              <p className="admin-body-label">Descrizione</p>
              <p className="admin-body-desc">{report.user_description}</p>

              {report.interaction_history?.length > 0 && (
                <>
                  <p className="admin-body-label" style={{ marginTop: '0.7rem' }}>Cronologia</p>
                  <ul className="admin-history-list">
                    {report.interaction_history.map((entry, i) => (
                      <li key={i} className={`admin-history-item admin-history-item--${entry.type}`}>
                        <span className="admin-history-icon">{entryIcon(entry.type)}</span>
                        <span className="admin-history-content">{entryLabel(entry)}</span>
                        {entry.timestamp && (
                          <span className="admin-history-time">
                            {new Date(entry.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Priorità */}
              <p className="admin-body-label" style={{ marginTop: '0.7rem' }}>Priorità</p>
              <div className="admin-priority-btns">
                {PRIORITY_ORDER.map(p => {
                  const c = PRIORITY_CONFIG[p];
                  const active = (report.priority ?? 'low') === p;
                  return (
                    <button
                      key={p}
                      className={['admin-priority-btn', active ? 'admin-priority-btn--active' : ''].filter(Boolean).join(' ')}
                      style={active ? { color: c.color, borderColor: c.color, background: c.bg } : {}}
                      onClick={() => onPriorityChange(report.id, p)}
                    >
                      <Flag size={9} />{c.label}
                    </button>
                  );
                })}
              </div>

              {/* Stato */}
              <p className="admin-body-label" style={{ marginTop: '0.7rem' }}>Cambia stato</p>
              <div className="admin-status-btns">
                {STATUS_ORDER.map(s => {
                  const c = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      className={['admin-status-btn', report.status === s ? 'admin-status-btn--active' : ''].filter(Boolean).join(' ')}
                      style={report.status === s ? { color: c.color, borderColor: c.color, background: c.bg } : {}}
                      onClick={() => onStatusChange(report.id, s)}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: '0.7rem', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button
                  className="admin-delete-btn"
                  onClick={() => onDelete(report.id)}
                  title="Elimina ticket"
                >
                  <Trash2 size={12} /> Elimina
                </button>
              </div>

              {report.user_id && <p className="admin-uid">UID: {report.user_id}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab: Ticket ────────────────────────────────────────────────────────────────

function TabTickets() {
  const [reports, setReports]   = useState<BugReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<FilterId>('all');
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (err) setError('Errore: ' + err.message);
    else setReports((data as BugReport[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function handleStatusChange(id: string, status: BugStatus) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    const { error: err } = await supabase.from('bug_reports').update({ status }).eq('id', id);
    if (err) { console.error(err); void load(); }
  }

  async function handlePriorityChange(id: string, priority: BugPriority) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, priority } : r));
    const { error: err } = await supabase.from('bug_reports').update({ priority }).eq('id', id);
    if (err) { console.error(err); void load(); }
  }

  async function handleDelete(id: string) {
    setReports(prev => prev.filter(r => r.id !== id));
    const { error: err } = await supabase.from('bug_reports').delete().eq('id', id);
    if (err) { console.error(err); void load(); }
  }

  async function deleteResolved() {
    const resolvedIds = reports.filter(r => r.status === 'resolved').map(r => r.id);
    if (resolvedIds.length === 0) return;
    if (!window.confirm(`Eliminare ${resolvedIds.length} ticket risolti?`)) return;
    setDeleting(true);
    setReports(prev => prev.filter(r => r.status !== 'resolved'));
    const { error: err } = await supabase.from('bug_reports').delete().in('id', resolvedIds);
    if (err) { console.error(err); void load(); }
    setDeleting(false);
  }

  // Ordina: priority DESC, poi created_at DESC
  const filtered = (filter === 'all' ? reports : reports.filter(r => r.status === filter))
    .slice()
    .sort((a, b) => {
      const pd = prioritySortScore(b.priority ?? 'low') - prioritySortScore(a.priority ?? 'low');
      if (pd !== 0) return pd;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = reports.filter(r => r.status === s).length;
    return acc;
  }, {});
  const highCount    = reports.filter(r => (r.priority ?? 'low') === 'high').length;
  const resolvedCount = counts['resolved'] ?? 0;
  const filterLabel  = FILTER_TABS.find(t => t.id === filter)?.label ?? 'Tutti';

  return (
    <>
      <div className="admin-dash-header">
        <div className="admin-dash-title">
          <ShieldCheck size={13} />{reports.length} ticket totali
          {highCount > 0 && (
            <span style={{ color: '#f87171', fontSize: '0.6rem', marginLeft: 6, fontWeight: 600 }}>
              ⚠ {highCount} alta priorità
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <button
            className="admin-action-btn"
            onClick={() => exportTicketsPDF(filtered, filterLabel)}
            disabled={loading || filtered.length === 0}
            title="Esporta e stampa ticket"
          >
            <Download size={12} /> Esporta
          </button>
          {resolvedCount > 0 && (
            <button
              className="admin-action-btn admin-action-btn--danger"
              onClick={deleteResolved}
              disabled={deleting}
              title="Elimina tutti i ticket risolti"
            >
              <Trash2 size={12} /> Risolti ({resolvedCount})
            </button>
          )}
          <button className="admin-refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'admin-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="admin-kpi-row">
        {STATUS_ORDER.map(s => {
          const c = STATUS_CONFIG[s];
          return (
            <span key={s} className="admin-kpi-chip" style={{ color: c.color }}>
              {counts[s] ?? 0} {c.label.toLowerCase()}
            </span>
          );
        })}
      </div>

      <div className="admin-filter-tabs">
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            className={['admin-filter-tab', filter === t.id ? 'admin-filter-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
            {t.id !== 'all' && <span className="admin-filter-count">{counts[t.id] ?? 0}</span>}
          </button>
        ))}
      </div>

      {error && <div className="admin-error"><AlertTriangle size={13}/>{error}</div>}
      {loading && !error && <div className="admin-loading"><RefreshCw size={16} className="admin-spin" /><span>Caricamento…</span></div>}
      {!loading && !error && filtered.length === 0 && (
        <p className="admin-empty">{filter === 'all' ? 'Nessun ticket.' : 'Nessun ticket per questo stato.'}</p>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="admin-ticket-list">
          {filtered.map(r => (
            <TicketRow
              key={r.id}
              report={r}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── Tab: Statistiche ───────────────────────────────────────────────────────────

function TabStats() {
  const [reports, setReports]   = useState<Pick<BugReport, 'id' | 'status' | 'created_at' | 'page_path' | 'type'>[]>([]);
  const [pageViews, setPageViews] = useState<{ fragment_name: string; count: number }[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const [reportRes, viewRes] = await Promise.all([
        supabase
          .from('bug_reports')
          .select('id, status, created_at, page_path, type')
          .order('created_at', { ascending: false }),
        supabase
          .from('page_views')
          .select('fragment_name')
          .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
      ]);
      setReports((reportRes.data ?? []) as typeof reports);

      const raw = (viewRes.data ?? []) as { fragment_name: string }[];
      const agg = raw.reduce<Record<string, number>>((acc, v) => {
        acc[v.fragment_name] = (acc[v.fragment_name] ?? 0) + 1;
        return acc;
      }, {});
      setPageViews(Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([fragment_name, count]) => ({ fragment_name, count })));
      setLoading(false);
    }
    void load();
  }, []);

  const now   = Date.now();
  const day   = 86_400_000;
  const last7 = reports.filter(r => now - new Date(r.created_at).getTime() < 7 * day).length;
  const prev7 = reports.filter(r => {
    const d = now - new Date(r.created_at).getTime();
    return d >= 7 * day && d < 14 * day;
  }).length;
  const trend = prev7 === 0 ? null : Math.round(((last7 - prev7) / prev7) * 100);

  const byDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * day);
    const label = d.toLocaleDateString('it-IT', { weekday: 'short' });
    const count = reports.filter(r => {
      const rd = new Date(r.created_at);
      return rd.toDateString() === d.toDateString();
    }).length;
    return { label, count };
  });
  const maxDay = Math.max(...byDay.map(d => d.count), 1);

  const pathCounts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.page_path] = (acc[r.page_path] ?? 0) + 1;
    return acc;
  }, {});
  const topPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const openCount = reports.filter(r => r.status === 'open').length;
  const openRate  = reports.length > 0 ? Math.round((openCount / reports.length) * 100) : 0;
  const bugCount  = reports.filter(r => r.type === 'bug').length;
  const impCount  = reports.filter(r => r.type === 'improvement').length;
  const maxViews  = Math.max(...pageViews.map(v => v.count), 1);

  if (loading) return <div className="admin-loading"><RefreshCw size={16} className="admin-spin" /><span>Caricamento…</span></div>;

  return (
    <div className="admin-stats">

      {/* KPI row */}
      <div className="astat-kpi-row">
        <div className="astat-kpi">
          <span className="astat-kpi-val">{reports.length}</span>
          <span className="astat-kpi-label">Totale</span>
        </div>
        <div className="astat-kpi">
          <span className="astat-kpi-val" style={{ color: '#f87171' }}>{openCount}</span>
          <span className="astat-kpi-label">Aperti</span>
        </div>
        <div className="astat-kpi">
          <span className="astat-kpi-val" style={{ color: '#fbbf24' }}>{last7}</span>
          <span className="astat-kpi-label">Ultimi 7gg</span>
        </div>
        <div className="astat-kpi">
          <span className="astat-kpi-val" style={{ color: openRate > 50 ? '#f87171' : '#34d399' }}>
            {openRate}%
          </span>
          <span className="astat-kpi-label">Open rate</span>
        </div>
      </div>

      {/* Bug vs Improvement */}
      <div className="astat-kpi-row" style={{ marginTop: '-4px' }}>
        <div className="astat-kpi">
          <span className="astat-kpi-val" style={{ color: '#f87171' }}>🐛 {bugCount}</span>
          <span className="astat-kpi-label">Bug</span>
        </div>
        <div className="astat-kpi">
          <span className="astat-kpi-val" style={{ color: '#fbbf24' }}>💡 {impCount}</span>
          <span className="astat-kpi-label">Migliorie</span>
        </div>
      </div>

      {/* Trend */}
      {trend !== null && (
        <div className="astat-trend">
          <TrendingUp size={11} />
          <span>
            {last7} ticket questa settimana
            {trend > 0 ? ` (+${trend}% vs scorsa)` : trend < 0 ? ` (${trend}% vs scorsa)` : ' (= scorsa)'}
          </span>
        </div>
      )}

      {/* Submissions per day */}
      <p className="astat-section-label">Ultimi 7 giorni</p>
      <div className="astat-barchart">
        {byDay.map(({ label, count }) => (
          <div key={label} className="astat-bar-col">
            <span className="astat-bar-val">{count > 0 ? count : ''}</span>
            <div className="astat-bar-track">
              <motion.div
                className="astat-bar-fill"
                initial={{ height: 0 }}
                animate={{ height: `${(count / maxDay) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
              />
            </div>
            <span className="astat-bar-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <p className="astat-section-label" style={{ marginTop: '0.9rem' }}>Per stato</p>
      <div className="astat-status-list">
        {STATUS_ORDER.map(s => {
          const c   = STATUS_CONFIG[s];
          const n   = reports.filter(r => r.status === s).length;
          const pct = reports.length > 0 ? Math.round((n / reports.length) * 100) : 0;
          return (
            <div key={s} className="astat-status-row">
              <span className="astat-status-dot" style={{ background: c.color }} />
              <span className="astat-status-label">{c.label}</span>
              <div className="astat-status-bar-track">
                <motion.div
                  className="astat-status-bar-fill"
                  style={{ background: c.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                />
              </div>
              <span className="astat-status-count">{n}</span>
            </div>
          );
        })}
      </div>

      {/* Top paths */}
      {topPaths.length > 0 && (
        <>
          <p className="astat-section-label" style={{ marginTop: '0.9rem' }}>Pagine con più ticket</p>
          <div className="astat-paths">
            {topPaths.map(([path, count]) => (
              <div key={path} className="astat-path-row">
                <span className="astat-path-name">{path}</span>
                <span className="astat-path-count">{count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Traffic — top fragments (last 30d) */}
      <p className="astat-section-label" style={{ marginTop: '0.9rem' }}>Sezioni più visitate (30gg)</p>
      {pageViews.length === 0 ? (
        <p className="admin-empty" style={{ fontSize: '0.65rem' }}>
          Nessun dato. Il tracking si attiva alla prima apertura di un fragment.
        </p>
      ) : (
        <div className="astat-status-list">
          {pageViews.map(({ fragment_name, count }) => {
            const pct = Math.round((count / maxViews) * 100);
            return (
              <div key={fragment_name} className="astat-status-row">
                <span className="astat-status-dot" style={{ background: '#818cf8' }} />
                <span className="astat-status-label" style={{ width: 90 }}>{fragment_name}</span>
                <div className="astat-status-bar-track">
                  <motion.div
                    className="astat-status-bar-fill"
                    style={{ background: '#818cf8' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                  />
                </div>
                <span className="astat-status-count">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Consumi ───────────────────────────────────────────────────────────────

const DEEPSEEK_PROMPT_PRICE     = 0.14 / 1_000_000;
const DEEPSEEK_COMPLETION_PRICE = 0.28 / 1_000_000;

interface PeriodUsage { calls: number; tokens: number; cost: number }

interface TableSizeRow { table_name: string; row_count: number; size_bytes: number }

function TabConsumi() {
  const [dbStats, setDbStats]     = useState<TableSizeRow[]>([]);
  const [dbFallback, setDbFallback] = useState(false); // true = RPC non disponibile
  const [aiPeriods, setAiPeriods] = useState<{ oggi: PeriodUsage; mese: PeriodUsage; anno: PeriodUsage } | null>(null);
  const [aiError, setAiError]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      // ── DB sizes via RPC ──────────────────────────────────────────────────
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_table_sizes');

      if (!rpcErr && rpcData) {
        const rows = (rpcData as TableSizeRow[]).sort((a, b) => b.size_bytes - a.size_bytes);
        setDbStats(rows);
        setDbFallback(false);
      } else {
        // Fallback: solo conteggio righe (RPC non ancora installato)
        setDbFallback(true);
        const counts = await Promise.all(
          DB_TABLES.map(async (t) => {
            const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
            return { table_name: t, row_count: count ?? 0, size_bytes: 0 } as TableSizeRow;
          }),
        );
        setDbStats(counts.sort((a, b) => b.row_count - a.row_count));
      }

      // ── AI usage ─────────────────────────────────────────────────────────
      const now        = new Date();
      const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data: rows, error: aiErr } = await supabase
        .from('ai_usage_logs')
        .select('created_at, prompt_tokens, completion_tokens')
        .gte('created_at', yearStart);

      if (aiErr) {
        setAiError('Tabella ai_usage_logs non trovata. Esegui sql/ai_usage_schema.sql in Supabase.');
      } else if (!rows || rows.length === 0) {
        setAiError(null);
        setAiPeriods(null); // tabella esiste ma vuota
      } else {
        setAiError(null);
        function agg(from: string): PeriodUsage {
          const r = (rows as { created_at: string; prompt_tokens: number; completion_tokens: number }[])
            .filter(x => x.created_at >= from);
          const pt = r.reduce((s, x) => s + (x.prompt_tokens ?? 0), 0);
          const ct = r.reduce((s, x) => s + (x.completion_tokens ?? 0), 0);
          return { calls: r.length, tokens: pt + ct, cost: pt * DEEPSEEK_PROMPT_PRICE + ct * DEEPSEEK_COMPLETION_PRICE };
        }
        setAiPeriods({ oggi: agg(todayStart), mese: agg(monthStart), anno: agg(yearStart) });
      }

      setLoading(false);
    }
    void load();
  }, []);

  if (loading) return <div className="admin-loading"><RefreshCw size={16} className="admin-spin" /><span>Caricamento…</span></div>;

  const maxSize = Math.max(...dbStats.map(r => r.size_bytes), 1);
  const maxRows = Math.max(...dbStats.map(r => r.row_count), 1);

  const periods: { label: string; key: keyof NonNullable<typeof aiPeriods> }[] = [
    { label: 'Oggi',         key: 'oggi' },
    { label: 'Questo mese', key: 'mese' },
    { label: 'Questo anno', key: 'anno' },
  ];

  return (
    <div className="admin-consumi">

      {/* ── AI Usage ─────────────────────────────────────────────────────── */}
      <p className="astat-section-label">Consumi DeepSeek AI</p>

      {aiError ? (
        <div className="admin-error" style={{ fontSize: '0.62rem', gap: 6 }}>
          <AlertTriangle size={12} />{aiError}
        </div>
      ) : aiPeriods ? (
        <div className="consumi-ai-grid">
          {periods.map(({ label, key }) => {
            const d = aiPeriods[key];
            return (
              <div key={key} className="consumi-ai-card">
                <span className="consumi-ai-period">{label}</span>
                <span className="consumi-ai-calls">{d.calls} chiamate</span>
                <span className="consumi-ai-tokens">{d.tokens.toLocaleString('it-IT')} tok</span>
                <span className="consumi-ai-cost">${d.cost.toFixed(4)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="admin-empty" style={{ fontSize: '0.65rem' }}>
          Nessuna chiamata AI registrata ancora.
        </p>
      )}

      <p className="astat-section-label" style={{ marginTop: '0.5rem', fontSize: '0.55rem', opacity: 0.45 }}>
        Prezzi: $0.14/1M prompt tok · $0.28/1M completion tok (deepseek-chat)
      </p>

      {/* ── DB Stats ─────────────────────────────────────────────────────── */}
      <p className="astat-section-label" style={{ marginTop: '1rem' }}>
        Tabelle database
        {dbFallback && (
          <span style={{ color: '#fbbf24', fontSize: '0.55rem', marginLeft: 6 }}>
            · Installa get_table_sizes() per vedere le dimensioni
          </span>
        )}
      </p>

      <div className="consumi-db-table-list">
        {dbStats.map(({ table_name, row_count, size_bytes }) => {
          const color   = TABLE_COLORS[table_name] ?? '#818cf8';
          const fillPct = dbFallback
            ? (maxRows > 0 ? (row_count / maxRows) * 100 : 0)
            : (maxSize > 0 ? (size_bytes / maxSize) * 100 : 0);
          return (
            <div key={table_name} className="consumi-db-table-row">
              <span className="consumi-db-table-dot" style={{ background: color }} />
              <span className="consumi-db-table-name">{table_name}</span>
              <span className="consumi-db-table-rows">{row_count.toLocaleString('it-IT')} righe</span>
              {!dbFallback && (
                <span className="consumi-db-table-size">{formatBytes(size_bytes)}</span>
              )}
              <div className="consumi-db-size-bar">
                <motion.div
                  className="consumi-db-size-bar-fill"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Sistema ───────────────────────────────────────────────────────────────

function TabSistema() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string ?? '';
  const hasDeepSeek = !!(import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined);
  const isDev       = import.meta.env.DEV as boolean;

  const sysRows: { label: string; value: string; ok?: boolean }[] = [
    { label: 'Ambiente',       value: isDev ? 'Development' : 'Production',           ok: true },
    { label: 'Supabase',       value: supabaseUrl ? supabaseUrl.replace(/https?:\/\//, '').split('.')[0] + '.supabase.co' : '—', ok: !!supabaseUrl },
    { label: 'DeepSeek AI',    value: hasDeepSeek ? 'Configurato' : 'Non configurato', ok: hasDeepSeek },
    { label: 'Data/ora',       value: new Date().toLocaleString('it-IT') },
    { label: 'User Agent',     value: navigator.userAgent.split(' ').slice(-1)[0] },
    { label: 'Piattaforma',    value: navigator.platform },
    { label: 'Lingua browser', value: navigator.language },
  ];

  return (
    <div className="admin-sistema">
      <div className="sistema-rows">
        {sysRows.map(({ label, value, ok }) => (
          <div key={label} className="sistema-row">
            <span className="sistema-label">{label}</span>
            <span className={['sistema-value', ok === false ? 'sistema-value--err' : ok === true ? 'sistema-value--ok' : ''].filter(Boolean).join(' ')}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <p className="astat-section-label" style={{ marginTop: '1rem' }}>Tabelle DB</p>
      <div className="sistema-tables">
        {DB_TABLES.map(t => (
          <span key={t} className="sistema-table-chip">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard (authenticated) ──────────────────────────────────────────────────

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('bugs');

  return (
    <>
      <div className="admin-tabbar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={['admin-tab', activeTab === t.id ? 'admin-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'bugs'    && <TabTickets />}
          {activeTab === 'stats'   && <TabStats />}
          {activeTab === 'consumi' && <TabConsumi />}
          {activeTab === 'sistema' && <TabSistema />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export function AdminFragment(_: { params?: Record<string, unknown> }) {
  const [authed, setAuthed] = useState(_sessionAuth);

  return (
    <NebulaCard icon={<ShieldCheck size={15} />} title="Sviluppatore" closable>
      {authed ? <AdminDashboard /> : <LockScreen onUnlock={() => setAuthed(true)} />}
    </NebulaCard>
  );
}
