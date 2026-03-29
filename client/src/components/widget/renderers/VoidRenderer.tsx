import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveEntry } from '../../../vault/vaultService';
import { useAlterStore } from '../../../store/alterStore';
import type { VaultEntry } from '../../../types';

// ─── Types ────────────────────────────────────────────────
interface VoidEntry {
  id: string;
  text: string;
  tags: string[];
  created_at: string;
}

interface VoidRendererProps {
  entries: VaultEntry[];
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────
function parseVoidEntry(e: VaultEntry): VoidEntry {
  const d = e.data as Record<string, unknown>;
  return {
    id: e.id,
    text: (d.text as string) ?? (d.note as string) ?? (d.raw as string) ?? '',
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    created_at: e.created_at,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function extractHashtags(text: string): string[] {
  return (text.match(/#\w+/g) ?? []).map(t => t.toLowerCase());
}

const C = '#8B7FCF';
const C_DIM = 'rgba(139,127,207,0.35)';
const C_BG  = 'rgba(139,127,207,0.08)';

// ─── Graph data ───────────────────────────────────────────
interface TagNode { tag: string; count: number; x: number; y: number; r: number; }
interface TagEdge { from: string; to: string; weight: number; }

function buildGraph(entries: VoidEntry[]): { nodes: TagNode[]; edges: TagEdge[] } {
  const countMap = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.tags) countMap.set(t, (countMap.get(t) ?? 0) + 1);
  }
  if (countMap.size === 0) return { nodes: [], edges: [] };

  const tags = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxCount = tags[0][1];
  const W = 520, H = 340, CX = W / 2, CY = H / 2;

  const nodes: TagNode[] = tags.map(([tag, count], i) => {
    const r = 10 + (count / maxCount) * 22;
    let x = CX, y = CY;
    if (tags.length > 1) {
      const angle = (i / tags.length) * Math.PI * 2 - Math.PI / 2;
      const ring = tags.length <= 6 ? 110 : i < 6 ? 95 : 165;
      x = CX + ring * Math.cos(angle);
      y = CY + ring * Math.sin(angle);
    }
    return { tag, count, x, y, r };
  });

  const coMap = new Map<string, number>();
  for (const e of entries) {
    const ts = e.tags;
    for (let a = 0; a < ts.length; a++) {
      for (let b = a + 1; b < ts.length; b++) {
        const key = [ts[a], ts[b]].sort().join('~~');
        coMap.set(key, (coMap.get(key) ?? 0) + 1);
      }
    }
  }

  const maxEdge = Math.max(...Array.from(coMap.values()), 1);
  const edges: TagEdge[] = [];
  coMap.forEach((w, key) => {
    const [from, to] = key.split('~~');
    edges.push({ from, to, weight: w / maxEdge });
  });

  return { nodes, edges };
}

// ─── SVG Graph View ───────────────────────────────────────
function GraphView({ entries, onSelectTag }: { entries: VoidEntry[]; onSelectTag: (t: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { nodes, edges } = useMemo(() => buildGraph(entries), [entries]);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.tag, n])), [nodes]);

  if (nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
        Nessun tag ancora. Scrivi qualcosa nel Void.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 520 340" style={{ width: '100%', height: 'auto' }}>
        {edges.map((edge, i) => {
          const a = nodeMap.get(edge.from), b = nodeMap.get(edge.to);
          if (!a || !b) return null;
          return (
            <line key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={C}
              strokeOpacity={0.10 + edge.weight * 0.25}
              strokeWidth={1 + edge.weight * 2}
            />
          );
        })}
        {nodes.map(node => {
          const isHov = hovered === node.tag;
          return (
            <g key={node.tag} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(node.tag)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectTag(node.tag)}
            >
              {isHov && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="rgba(139,127,207,0.10)" stroke="rgba(139,127,207,0.30)" strokeWidth={1} />
              )}
              <circle cx={node.x} cy={node.y} r={node.r}
                fill={`rgba(139,127,207,${isHov ? 0.30 : 0.14})`}
                stroke={`rgba(139,127,207,${isHov ? 0.65 : 0.28})`}
                strokeWidth={1.5}
                style={{ transition: 'all 0.2s' }}
              />
              <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(8, node.r * 0.55)}
                fill={`rgba(255,255,255,${isHov ? 0.95 : 0.70})`}
                style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'monospace' }}
              >
                {node.tag.length > 10 ? node.tag.slice(0, 9) + '…' : node.tag}
              </text>
              <text x={node.x} y={node.y + node.r + 12} textAnchor="middle"
                fontSize={9} fill="rgba(139,127,207,0.55)"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {node.count}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.06em', marginTop: -4 }}>
        clicca un tag per filtrare
      </div>
    </div>
  );
}

// ─── Tree View (sidebar + entries) ───────────────────────
function TreeView({ entries, selectedTag, onSelectTag }: {
  entries: VoidEntry[];
  selectedTag: string | null;
  onSelectTag: (t: string | null) => void;
}) {
  const tagMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [entries]);

  const sorted = useMemo(() =>
    [...tagMap.entries()].sort((a, b) => b[1] - a[1]),
  [tagMap]);

  const filtered = useMemo(() =>
    selectedTag ? entries.filter(e => e.tags.includes(selectedTag)) : entries,
  [entries, selectedTag]);

  return (
    <div style={{ display: 'flex', gap: 12, height: 280 }}>
      {/* Sidebar */}
      <div style={{ width: 110, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={() => onSelectTag(null)}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: !selectedTag ? C_BG : 'transparent',
            color: !selectedTag ? C : 'rgba(255,255,255,0.35)',
            fontSize: 10, textAlign: 'left', transition: 'all 0.15s',
          }}
        >
          <span>Tutti</span>
          <span style={{ fontSize: 9, opacity: 0.6 }}>{entries.length}</span>
        </button>
        {sorted.map(([tag, count]) => (
          <button key={tag}
            onClick={() => onSelectTag(tag === selectedTag ? null : tag)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: selectedTag === tag ? C_BG : 'transparent',
              color: selectedTag === tag ? C : 'rgba(255,255,255,0.35)',
              fontSize: 10, textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{tag}</span>
            <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: 'rgba(139,127,207,0.10)', flexShrink: 0 }} />

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', padding: '20px 0', textAlign: 'center' }}>
            Nessuna nota.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map(e => (
              <motion.div key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                style={{
                  padding: '9px 11px', borderRadius: 9,
                  background: 'rgba(139,127,207,0.04)',
                  border: '1px solid rgba(139,127,207,0.07)',
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(240,238,248,0.75)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {e.text}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {e.tags.map(t => (
                      <span key={t}
                        onClick={() => onSelectTag(t)}
                        style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 20, cursor: 'pointer',
                          background: 'rgba(139,127,207,0.10)', color: C, letterSpacing: '0.05em',
                        }}
                      >#{t}</span>
                    ))}
                  </div>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.03em', flexShrink: 0, marginLeft: 8 }}>
                    {formatDate(e.created_at)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─── The Mind tab ─────────────────────────────────────────
function TheMind({ entries }: { entries: VoidEntry[] }) {
  const [view, setView] = useState<'tree' | 'graph'>('tree');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const tagCount = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) e.tags.forEach(t => s.add(t));
    return s.size;
  }, [entries]);

  function handleSelectTag(t: string) {
    setSelectedTag(t);
    if (view === 'graph') setView('tree');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em' }}>
          {tagCount} tag · {entries.length} pensieri
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['tree', 'graph'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '4px 11px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: view === v ? C_BG : 'transparent',
              color: view === v ? C : 'rgba(255,255,255,0.28)',
              fontSize: 9, letterSpacing: '0.08em', transition: 'all 0.15s',
            }}>
              {v === 'tree' ? '▤ Albero' : '◉ Grafo'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'tree' ? (
          <motion.div key="tree"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <TreeView entries={entries} selectedTag={selectedTag} onSelectTag={t => setSelectedTag(t)} />
          </motion.div>
        ) : (
          <motion.div key="graph"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <GraphView entries={entries} onSelectTag={handleSelectTag} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── The Void tab ─────────────────────────────────────────
function TheVoid({ onSaved }: { onSaved: (tags: string[]) => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string[] | null>(null);
  const { user } = useAlterStore();
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { taRef.current?.focus(); }, []);

  const tags = extractHashtags(text);

  async function handleSave() {
    if (!text.trim() || !user || saving) return;
    setSaving(true);
    await saveEntry(user.id, 'notes', { text: text.trim(), tags, raw: text, renderType: 'void' });
    setSaving(false);
    setFeedback(tags);
    setText('');
    onSaved(tags);
    setTimeout(() => setFeedback(null), 4000);
    taRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 300, color: C, letterSpacing: '0.12em' }}>The Void</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 3, letterSpacing: '0.04em' }}>
          Cosa ti passa per la mente?
        </div>
      </div>

      {/* Textarea with glow */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(139,127,207,0.07) 0%, transparent 70%)',
        }} />
        <textarea
          ref={taRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={"Scrivi un pensiero…\n\n#tag per organizzare"}
          rows={6}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(139,127,207,0.03)',
            border: `1px solid rgba(139,127,207,${text.length > 0 ? '0.22' : '0.08'})`,
            borderRadius: 14, padding: '14px 16px',
            color: 'rgba(240,238,248,0.88)', fontSize: 13, lineHeight: 1.7,
            resize: 'none', outline: 'none', fontFamily: 'inherit',
            letterSpacing: '0.02em', transition: 'border-color 0.3s',
          }}
        />
      </div>

      {/* Tag preview */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10, padding: '3px 9px', borderRadius: 20,
              background: 'rgba(139,127,207,0.12)', border: `1px solid ${C_DIM}`,
              color: C, letterSpacing: '0.06em',
            }}>{tag}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, gap: 8, minHeight: 36 }}>
        <AnimatePresence>
          {feedback !== null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ color: '#3aad80' }}>✓</span>
              <span>Archiviato{feedback.length > 0 ? ' come' : ''}</span>
              {feedback.length > 0
                ? feedback.map(t => (
                    <span key={t} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: 'rgba(139,127,207,0.12)', color: C,
                    }}>{t}</span>
                  ))
                : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>senza tag</span>
              }
            </motion.div>
          )}
        </AnimatePresence>

        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.04em', marginLeft: feedback !== null ? 'auto' : undefined }}>
          ⌘↵
        </span>
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          style={{
            marginLeft: 'auto',
            background: text.trim() ? 'rgba(139,127,207,0.16)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${text.trim() ? C_DIM : 'transparent'}`,
            borderRadius: 8, padding: '7px 16px',
            color: text.trim() ? C : 'rgba(255,255,255,0.16)',
            fontSize: 11, fontWeight: 500, cursor: text.trim() ? 'pointer' : 'default',
            letterSpacing: '0.08em', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {saving
            ? <span style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 4, height: 4, borderRadius: '50%', background: C,
                    animation: `pulse 1s ${i * 0.2}s infinite`,
                    display: 'inline-block',
                  }} />
                ))}
              </span>
            : 'Archivia →'
          }
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────
export default function VoidRenderer({ entries }: VoidRendererProps) {
  const [tab, setTab] = useState<0 | 1>(0);
  const [localEntries, setLocalEntries] = useState<VoidEntry[]>(() => entries.map(parseVoidEntry));
  const { user } = useAlterStore();

  async function handleSaved(_tags: string[]) {
    if (!user) return;
    const { getByCategory } = await import('../../../vault/vaultService');
    const fresh = await getByCategory(user.id, 'notes', 100);
    setLocalEntries(fresh.map(parseVoidEntry));
    setTab(1);
  }

  const TABS = [
    { label: '◌ The Void', i: 0 as const },
    { label: '◎ The Mind', i: 1 as const },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 22 }}>
        {TABS.map(t => (
          <button key={t.i} onClick={() => setTab(t.i)} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t.i ? 'rgba(139,127,207,0.12)' : 'transparent',
            color: tab === t.i ? C : 'rgba(255,255,255,0.28)',
            fontSize: 11, letterSpacing: '0.08em', transition: 'all 0.2s',
            fontWeight: tab === t.i ? 500 : 300,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === 0
            ? <TheVoid onSaved={handleSaved} />
            : <TheMind entries={localEntries} />
          }
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
