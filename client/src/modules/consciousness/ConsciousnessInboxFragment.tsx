import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useEntries, useTags, useAddEntry, useLatestReport, useSaveReport, useDeleteEntry, useDeleteReport, useDeleteTag } from '@/hooks/useConsciousness';
import { tagEntry, generateWeeklyReport } from '@/services/consciousnessService';
import type { Entry, Tag } from '@/types/index';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'void' | 'mind' | 'report';
type ViewMode = 'tree' | 'graph';

interface TagNode {
  id: string;
  tag_name: string;
  entry_count: number;
  x: number;
  y: number;
  r: number;
}

interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getWeekStart(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getLastWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getWeekStart(d);
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${key}`} className="ci-md-list">
        {listBuffer.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      flushList(String(i));
      elements.push(<h2 key={i} className="ci-md-h2">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      flushList(String(i));
      elements.push(<h3 key={i} className="ci-md-h3">{line.slice(4)}</h3>);
    } else if (line.startsWith('- [ ] ')) {
      listBuffer.push(`<span class="ci-md-task-open">☐</span> ${line.slice(6)}`);
    } else if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      listBuffer.push(`<span class="ci-md-task-done">☑</span> ${line.slice(6)}`);
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
    } else if (line === '') {
      flushList(String(i));
      elements.push(<div key={i} className="ci-md-spacer" />);
    } else {
      flushList(String(i));
      elements.push(
        <p key={i} className="ci-md-p" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />,
      );
    }
  });

  flushList('end');
  return elements;
}

// ─── Graph layout ─────────────────────────────────────────────────────────────

const SVG_W = 520;
const SVG_H = 360;
const CX = SVG_W / 2;
const CY = SVG_H / 2;

function buildGraphData(
  tags: (Tag & { entry_count: number })[],
  entries: Entry[],
): { nodes: TagNode[]; edges: GraphEdge[] } {
  if (tags.length === 0) return { nodes: [], edges: [] };

  const maxCount = Math.max(...tags.map((t) => t.entry_count), 1);
  const sorted = [...tags].sort((a, b) => b.entry_count - a.entry_count);

  // Circular layout — first tag at center if alone, else ring
  const nodes: TagNode[] = sorted.map((tag, i) => {
    const r = 10 + (tag.entry_count / maxCount) * 24;
    let x: number, y: number;

    if (sorted.length === 1) {
      x = CX; y = CY;
    } else {
      const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
      const ringR = sorted.length <= 6 ? 120 : i < 6 ? 100 : 170;
      x = CX + ringR * Math.cos(angle);
      y = CY + ringR * Math.sin(angle);
    }

    return { id: tag.id, tag_name: tag.tag_name, entry_count: tag.entry_count, x, y, r };
  });

  // Co-occurrence edges
  const coMap = new Map<string, number>();
  entries.forEach((entry) => {
    const tNames = entry.tags.map((t) => (t as { tag_name: string }).tag_name);
    for (let a = 0; a < tNames.length; a++) {
      for (let b = a + 1; b < tNames.length; b++) {
        const key = [tNames[a], tNames[b]].sort().join('~~');
        coMap.set(key, (coMap.get(key) ?? 0) + 1);
      }
    }
  });

  const maxEdge = Math.max(...Array.from(coMap.values()), 1);
  const edges: GraphEdge[] = [];
  coMap.forEach((weight, key) => {
    const [from, to] = key.split('~~');
    edges.push({ from, to, weight: weight / maxEdge });
  });

  return { nodes, edges };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TheVoidTab() {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string[] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: tags } = useTags();
  const addEntry = useAddEntry();

  const handleSubmit = useCallback(async () => {
    const raw = text.trim();
    if (!raw || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const existingTagNames = tags?.map((t) => t.tag_name) ?? [];
      const tagResult = await tagEntry(raw, existingTagNames);
      await addEntry.mutateAsync({ rawText: raw, tagResult });
      setText('');
      setFeedback(tagResult.tags);
      setTimeout(() => setFeedback(null), 4000);
      textareaRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, tags, addEntry]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="ci-void">
      <div className="ci-void-header">
        <span className="ci-void-title">The Void</span>
        <span className="ci-void-hint">Scrivi qualsiasi cosa. ⌘↵ per archiviare.</span>
      </div>

      <textarea
        ref={textareaRef}
        className="ci-void-textarea"
        placeholder="Cosa ti passa per la mente?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={submitting}
        rows={6}
        autoFocus
      />

      <div className="ci-void-footer">
        <AnimatePresence>
          {feedback && (
            <motion.div
              className="ci-void-feedback"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              ✓ Archiviato come{' '}
              {feedback.length > 0
                ? feedback.map((t) => <span key={t} className="ci-tag-pill">#{t}</span>)
                : <span className="ci-tag-pill ci-tag-pill--none">senza tag</span>}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          className="ci-void-btn"
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
        >
          {submitting ? (
            <span className="ci-void-spinner">
              <span />
              <span />
              <span />
            </span>
          ) : (
            'Archivia →'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Graph View ───────────────────────────────────────────────────────────────

function GraphView({
  tags,
  entries,
  onSelectTag,
}: {
  tags: (Tag & { entry_count: number })[];
  entries: Entry[];
  onSelectTag: (name: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { nodes, edges } = useMemo(() => buildGraphData(tags, entries), [tags, entries]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, TagNode>();
    nodes.forEach((n) => m.set(n.tag_name, n));
    return m;
  }, [nodes]);

  if (nodes.length === 0) {
    return <div className="ci-empty">Nessun tag ancora. Scrivi qualcosa nel Void.</div>;
  }

  return (
    <div className="ci-graph-wrap">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="ci-graph-svg"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const a = nodeMap.get(edge.from);
          const b = nodeMap.get(edge.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              stroke="rgb(167 139 250)"
              strokeOpacity={0.12 + edge.weight * 0.28}
              strokeWidth={1 + edge.weight * 2}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHov = hovered === node.tag_name;
          return (
            <g
              key={node.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(node.tag_name)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectTag(node.tag_name)}
            >
              {/* Glow ring on hover */}
              {isHov && (
                <circle
                  cx={node.x} cy={node.y}
                  r={node.r + 8}
                  fill="rgb(167 139 250 / 0.12)"
                  stroke="rgb(167 139 250 / 0.35)"
                  strokeWidth={1}
                />
              )}
              <circle
                cx={node.x} cy={node.y}
                r={node.r}
                fill={`rgb(167 139 250 / ${isHov ? 0.35 : 0.16})`}
                stroke={`rgb(167 139 250 / ${isHov ? 0.7 : 0.3})`}
                strokeWidth={1.5}
                style={{ transition: 'all 0.2s' }}
              />
              <text
                x={node.x} y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(8, node.r * 0.55)}
                fill={`rgba(255,255,255,${isHov ? 0.95 : 0.7})`}
                style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'monospace' }}
              >
                {node.tag_name.length > 10 ? node.tag_name.slice(0, 9) + '…' : node.tag_name}
              </text>
              <text
                x={node.x} y={node.y + node.r + 12}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(167,139,250,0.6)"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {node.entry_count}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="ci-graph-hint">Clicca un tag per filtrare la vista</p>
    </div>
  );
}

// ─── Tree View ────────────────────────────────────────────────────────────────

function TreeView({
  tags,
  entries,
  selectedTag,
  onSelectTag,
}: {
  tags: (Tag & { entry_count: number })[];
  entries: Entry[];
  selectedTag: string | null;
  onSelectTag: (name: string | null) => void;
}) {
  const deleteEntry = useDeleteEntry();
  const deleteTag = useDeleteTag();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!selectedTag) return entries;
    return entries.filter((e) =>
      e.tags.some((t) => (t as { tag_name: string }).tag_name === selectedTag),
    );
  }, [entries, selectedTag]);

  return (
    <div className="ci-tree">
      {/* Left: tag list */}
      <div className="ci-tree-sidebar">
        <button
          className={['ci-tree-tag', !selectedTag ? 'ci-tree-tag--active' : ''].filter(Boolean).join(' ')}
          onClick={() => onSelectTag(null)}
        >
          <span className="ci-tree-tag-name">Tutti</span>
          <span className="ci-tree-tag-count">{entries.length}</span>
        </button>
        {tags.map((tag) => (
          <div
            key={tag.id}
            className={['ci-tree-tag-row', selectedTag === tag.tag_name ? 'ci-tree-tag-row--active' : ''].filter(Boolean).join(' ')}
          >
            <button
              className="ci-tree-tag"
              onClick={() => onSelectTag(tag.tag_name === selectedTag ? null : tag.tag_name)}
            >
              <span className="ci-tree-tag-name">#{tag.tag_name}</span>
              <span className="ci-tree-tag-count">{tag.entry_count}</span>
            </button>
            {confirmDeleteTag === tag.id ? (
              <div className="ci-tag-del-confirm">
                <button className="ci-entry-confirm-yes" onClick={() => { deleteTag.mutate(tag.id); setConfirmDeleteTag(null); }}>✕</button>
                <button className="ci-entry-confirm-no" onClick={() => setConfirmDeleteTag(null)}>↩</button>
              </div>
            ) : (
              <button
                className="ci-tag-del-btn"
                title="Elimina tag"
                onClick={() => setConfirmDeleteTag(tag.id)}
              >✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Right: entry list */}
      <div className="ci-tree-entries">
        {filtered.length === 0 ? (
          <div className="ci-empty">Nessuna nota in questa cartella.</div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((entry) => (
              <motion.div
                key={entry.id}
                className="ci-entry"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <p className="ci-entry-text">{entry.clean_text || entry.raw_text}</p>
                <div className="ci-entry-meta">
                  <span className="ci-entry-date">{formatDate(entry.created_at)}</span>
                  <div className="ci-entry-tags">
                    {entry.tags.map((t) => (
                      <span
                        key={(t as { id: string }).id}
                        className="ci-tag-pill ci-tag-pill--sm"
                        onClick={() => onSelectTag((t as { tag_name: string }).tag_name)}
                      >
                        #{(t as { tag_name: string }).tag_name}
                      </span>
                    ))}
                  </div>
                  {confirmDelete === entry.id ? (
                    <div className="ci-entry-confirm">
                      <span className="ci-entry-confirm-text">Elimina?</span>
                      <button
                        className="ci-entry-confirm-yes"
                        onClick={() => { deleteEntry.mutate(entry.id); setConfirmDelete(null); }}
                      >Sì</button>
                      <button
                        className="ci-entry-confirm-no"
                        onClick={() => setConfirmDelete(null)}
                      >No</button>
                    </div>
                  ) : (
                    <button
                      className="ci-entry-del-btn"
                      title="Elimina nota"
                      onClick={() => setConfirmDelete(entry.id)}
                    >✕</button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─── The Mind tab ─────────────────────────────────────────────────────────────

function TheMindTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: tags = [], isLoading: tagsLoading } = useTags();
  const { data: entries = [], isLoading: entriesLoading } = useEntries();

  const handleSelectTag = (name: string | null) => {
    setSelectedTag(name);
    if (viewMode === 'graph' && name) setViewMode('tree');
  };

  return (
    <div className="ci-mind">
      {/* Toolbar */}
      <div className="ci-mind-toolbar">
        <span className="ci-mind-label">
          {tags.length} tag · {entries.length} pensieri
        </span>
        <div className="ci-view-toggle">
          <button
            className={['ci-view-btn', viewMode === 'tree' ? 'ci-view-btn--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setViewMode('tree')}
          >
            ▤ Albero
          </button>
          <button
            className={['ci-view-btn', viewMode === 'graph' ? 'ci-view-btn--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setViewMode('graph')}
          >
            ◉ Grafo
          </button>
        </div>
      </div>

      {tagsLoading || entriesLoading ? (
        <div className="ci-empty">Caricamento…</div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'tree' ? (
            <motion.div
              key="tree"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ height: '100%' }}
            >
              <TreeView
                tags={tags}
                entries={entries}
                selectedTag={selectedTag}
                onSelectTag={handleSelectTag}
              />
            </motion.div>
          ) : (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ height: '100%' }}
            >
              <GraphView tags={tags} entries={entries} onSelectTag={handleSelectTag} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Report Tab ───────────────────────────────────────────────────────────────

function ReportTab() {
  const { data: entries = [] } = useEntries();
  const { data: report, isLoading } = useLatestReport();
  const saveReport = useSaveReport();
  const deleteReport = useDeleteReport();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteReport, setConfirmDeleteReport] = useState(false);

  const weekStart = getLastWeekStart();
  const hasThisWeekReport = report?.week_start === weekStart || report?.week_start === getWeekStart();

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const weekEntries = entries.filter(
        (e) => new Date(e.created_at) >= since,
      );

      if (weekEntries.length === 0) {
        setError('Nessuna nota degli ultimi 7 giorni da analizzare.');
        return;
      }

      const content = await generateWeeklyReport(weekEntries);
      await saveReport.mutateAsync({ content, weekStart });
    } catch (e) {
      setError('Errore nella generazione. Riprova.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="ci-report">
      <div className="ci-report-header">
        <div>
          <span className="ci-report-title">Sintesi Settimanale</span>
          {report && (
            <span className="ci-report-date">
              Week del {new Date(report.week_start).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
            </span>
          )}
        </div>
        <div className="ci-report-actions">
          {report && (
            confirmDeleteReport ? (
              <div className="ci-entry-confirm">
                <span className="ci-entry-confirm-text">Elimina report?</span>
                <button
                  className="ci-entry-confirm-yes"
                  onClick={() => { deleteReport.mutate(report.id); setConfirmDeleteReport(false); }}
                >Sì</button>
                <button
                  className="ci-entry-confirm-no"
                  onClick={() => setConfirmDeleteReport(false)}
                >No</button>
              </div>
            ) : (
              <button
                className="ci-report-del-btn"
                title="Elimina report"
                onClick={() => setConfirmDeleteReport(true)}
              >✕</button>
            )
          )}
          <button
            className="ci-report-gen-btn"
            onClick={handleGenerate}
            disabled={generating}
        >
          {generating ? (
            <span className="ci-void-spinner">
              <span /><span /><span />
            </span>
          ) : (
            hasThisWeekReport ? '↺ Rigenera' : '✦ Genera Report'
          )}
        </button>
        </div>
      </div>

      {error && <div className="ci-report-error">{error}</div>}

      {isLoading ? (
        <div className="ci-empty">Caricamento…</div>
      ) : report ? (
        <div className="ci-report-body">
          {renderMarkdown(report.content)}
        </div>
      ) : (
        <div className="ci-report-empty">
          <div className="ci-report-empty-icon">📊</div>
          <p>Nessun report ancora.</p>
          <p className="ci-report-empty-sub">
            Accumula pensieri durante la settimana, poi genera la tua analisi.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Fragment ────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'void',   label: 'The Void',  icon: '◌' },
  { id: 'mind',   label: 'The Mind',  icon: '◎' },
  { id: 'report', label: 'Report',    icon: '◈' },
];

export function ConsciousnessInboxFragment({ params }: { params: Record<string, unknown> }) {
  const initialTab = (params.tab as TabId) ?? 'void';
  const [tab, setTab] = useState<TabId>(initialTab);

  return (
    <NebulaCard title="Consciousness Inbox" variant="default" closable>
      {/* Tab bar */}
      <div className="ci-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={['ci-tab', tab === t.id ? 'ci-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setTab(t.id)}
          >
            <span className="ci-tab-icon">{t.icon}</span>
            <span className="ci-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="ci-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            style={{ height: '100%' }}
          >
            {tab === 'void'   && <TheVoidTab />}
            {tab === 'mind'   && <TheMindTab />}
            {tab === 'report' && <ReportTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </NebulaCard>
  );
}
