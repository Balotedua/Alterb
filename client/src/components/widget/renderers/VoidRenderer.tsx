import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Hash, Plus, Sparkles } from 'lucide-react';
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
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function extractHashtags(text: string): string[] {
  return (text.match(/#\w+/g) ?? []).map(t => t.toLowerCase());
}

const COLOR = '#8B7FCF';
const COLOR_DIM = 'rgba(139,127,207,0.35)';

// ─── Tab Bar ──────────────────────────────────────────────
function TabBar({ active, onChange }: { active: number; onChange: (i: number) => void }) {
  const tabs = ['Vuoto', 'Albero'];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {tabs.map((t, i) => (
        <button
          key={t}
          onClick={() => onChange(i)}
          style={{
            background: active === i ? 'rgba(139,127,207,0.12)' : 'transparent',
            border: active === i ? `1px solid ${COLOR_DIM}` : '1px solid transparent',
            borderRadius: 8,
            padding: '5px 14px',
            fontSize: 11,
            fontWeight: active === i ? 600 : 400,
            color: active === i ? COLOR : 'rgba(255,255,255,0.28)',
            cursor: 'pointer',
            letterSpacing: '0.08em',
            transition: 'all 0.2s',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Void Tab: dark textarea + inline save ────────────────
function VoidTab({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [pulse, setPulse] = useState(false);
  const { user } = useAlterStore();
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { taRef.current?.focus(); }, []);

  const tags = extractHashtags(text);

  async function handleSave() {
    if (!text.trim() || !user) return;
    setSaving(true);
    await saveEntry(user.id, 'notes', { text: text.trim(), tags, raw: text, renderType: 'void' });
    setSaving(false);
    setPulse(true);
    setText('');
    setTimeout(() => setPulse(false), 800);
    onSaved();
  }

  function handleKey(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Glow bg */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(139,127,207,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <textarea
        ref={taRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder={"Scrivi un pensiero...\n\n#tag per taggare"}
        rows={7}
        style={{
          width: '100%',
          background: 'rgba(139,127,207,0.04)',
          border: `1px solid rgba(139,127,207,${text.length > 0 ? '0.22' : '0.08'})`,
          borderRadius: 14,
          padding: '16px 18px',
          color: 'rgba(240,238,248,0.88)',
          fontSize: 13,
          lineHeight: 1.7,
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          letterSpacing: '0.02em',
          transition: 'border-color 0.3s',
          boxSizing: 'border-box',
        }}
      />

      {/* Tag preview */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10, padding: '3px 9px', borderRadius: 20,
              background: 'rgba(139,127,207,0.12)',
              border: `1px solid ${COLOR_DIM}`,
              color: COLOR, letterSpacing: '0.06em',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, gap: 8 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.14)', letterSpacing: '0.04em' }}>
          ⌘↵ per salvare
        </span>
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          style={{
            marginLeft: 'auto',
            background: text.trim() ? `rgba(139,127,207,0.18)` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${text.trim() ? COLOR_DIM : 'transparent'}`,
            borderRadius: 8, padding: '6px 16px',
            color: text.trim() ? COLOR : 'rgba(255,255,255,0.18)',
            fontSize: 11, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default',
            letterSpacing: '0.08em', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {pulse ? <Sparkles size={11} /> : <Plus size={11} />}
          {saving ? 'Salvo…' : 'Salva'}
        </button>
      </div>
    </div>
  );
}

// ─── Tree node: collapsible tag group ────────────────────
function TagNode({ tag, entries }: { tag: string; entries: VoidEntry[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 0', width: '100%', textAlign: 'left',
        }}
      >
        <span style={{ color: COLOR_DIM, flexShrink: 0 }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <Hash size={10} style={{ color: COLOR, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: COLOR, letterSpacing: '0.06em', fontWeight: 600 }}>
          {tag.replace('#', '')}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginLeft: 4 }}>
          {entries.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', paddingLeft: 20, borderLeft: `1px solid rgba(139,127,207,0.1)`, marginLeft: 5 }}
          >
            {entries.map(e => (
              <div key={e.id} style={{
                padding: '8px 10px',
                marginTop: 4,
                borderRadius: 8,
                background: 'rgba(139,127,207,0.04)',
                border: '1px solid rgba(139,127,207,0.07)',
              }}>
                <p style={{
                  margin: 0, fontSize: 12, color: 'rgba(240,238,248,0.72)',
                  lineHeight: 1.6, letterSpacing: '0.02em',
                  whiteSpace: 'pre-wrap',
                }}>
                  {e.text}
                </p>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 4, display: 'block', letterSpacing: '0.04em' }}>
                  {formatDate(e.created_at)}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tree Tab ─────────────────────────────────────────────
function TreeTab({ entries }: { entries: VoidEntry[] }) {
  // Group by tags; untagged goes to "senza tag"
  const tagMap = new Map<string, VoidEntry[]>();

  for (const e of entries) {
    if (e.tags.length === 0) {
      const key = '#senza-tag';
      if (!tagMap.has(key)) tagMap.set(key, []);
      tagMap.get(key)!.push(e);
    } else {
      for (const tag of e.tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag)!.push(e);
      }
    }
  }

  if (tagMap.size === 0) {
    return (
      <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12, textAlign: 'center', padding: '24px 0', letterSpacing: '0.05em' }}>
        Nessun pensiero ancora.<br/>
        <span style={{ fontSize: 10, opacity: 0.6 }}>Usa #tag per organizzarli.</span>
      </p>
    );
  }

  // Sort: most entries first, #senza-tag last
  const sorted = [...tagMap.entries()].sort(([a, ae], [b, be]) => {
    if (a === '#senza-tag') return 1;
    if (b === '#senza-tag') return -1;
    return be.length - ae.length;
  });

  return (
    <div>
      {sorted.map(([tag, es]) => (
        <TagNode key={tag} tag={tag} entries={es} />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────
export default function VoidRenderer({ entries }: VoidRendererProps) {
  const [tab, setTab] = useState(0);
  const [localEntries, setLocalEntries] = useState<VoidEntry[]>(() => entries.map(parseVoidEntry));
  const { user } = useAlterStore();

  // Refresh after save
  async function handleSaved() {
    if (!user) return;
    const { getByCategory } = await import('../../../vault/vaultService');
    const fresh = await getByCategory(user.id, 'notes', 100);
    setLocalEntries(fresh.map(parseVoidEntry));
    setTab(1); // jump to tree
  }

  return (
    <div>
      <TabBar active={tab} onChange={setTab} />
      {tab === 0
        ? <VoidTab onSaved={handleSaved} />
        : <TreeTab entries={localEntries} />
      }
    </div>
  );
}
