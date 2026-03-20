import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAlterStore } from '../../store/alterStore';
import { deleteEntry } from '../../vault/vaultService';
import type { VaultEntry, WidgetData, RenderType } from '../../types';

// ─── Render type inference ────────────────────────────────────
export function inferRenderType(entries: VaultEntry[]): RenderType {
  if (!entries.length) return 'list';
  const data = entries[0].data;
  if (data.type === 'mood')   return 'mood';
  if (data.type === 'weight' || data.type === 'sleep' || data.type === 'water') return 'chart';
  if (typeof data.amount === 'number') return 'stats';
  if (typeof data.note === 'string' && !data.score) return 'diary';
  return 'list';
}

// ─── Sub-renderers ────────────────────────────────────────────
function FinanceStats({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const expenses = entries.filter(e => e.data.type === 'expense');
  const income   = entries.filter(e => e.data.type === 'income');
  const totalOut = expenses.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
  const totalIn  = income.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Stat label="Uscite" value={`-€${totalOut.toFixed(2)}`} color="#f87171" />
        <Stat label="Entrate" value={`+€${totalIn.toFixed(2)}`} color="#4ade80" />
        <Stat label="Netto" value={`€${(totalIn - totalOut).toFixed(2)}`} color={color} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {entries.slice(0, 30).map((e) => (
          <EntryRow key={e.id} entry={e} color={color}
            label={(e.data.label as string) ?? '—'}
            value={`${e.data.type === 'income' ? '+' : '-'}€${(e.data.amount as number)?.toFixed(2) ?? '?'}`}
          />
        ))}
      </div>
    </div>
  );
}

function HealthChart({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const type = entries[0]?.data.type as string;
  const valueKey = type === 'sleep' ? 'hours' : type === 'water' ? 'liters' : 'value';
  const unit     = type === 'sleep' ? 'h' : type === 'water' ? 'L' : 'kg';

  const chartData = [...entries].reverse().slice(-20).map((e) => ({
    date: new Date(e.created_at).toLocaleDateString('it-IT', { month: '2-digit', day: '2-digit' }),
    v:    (e.data[valueKey] as number) ?? 0,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fill: '#8892b0', fontSize: 10 }} />
          <YAxis tick={{ fill: '#8892b0', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#0d0d14', border: `1px solid ${color}22`, borderRadius: 8 }}
            labelStyle={{ color: '#ccd6f6' }}
            formatter={(v: number) => [`${v}${unit}`, '']}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
        {entries.slice(0, 15).map((e) => (
          <EntryRow key={e.id} entry={e} color={color}
            label={type.charAt(0).toUpperCase() + type.slice(1)}
            value={`${(e.data[valueKey] as number) ?? '?'}${unit}`}
          />
        ))}
      </div>
    </div>
  );
}

function MoodChart({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const chartData = [...entries].reverse().slice(-14).map((e) => ({
    date: new Date(e.created_at).toLocaleDateString('it-IT', { month: '2-digit', day: '2-digit' }),
    score: (e.data.score as number) ?? 5,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData}>
          <XAxis dataKey="date" tick={{ fill: '#8892b0', fontSize: 10 }} />
          <YAxis domain={[0, 10]} tick={{ fill: '#8892b0', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#0d0d14', border: `1px solid ${color}22`, borderRadius: 8 }}
            formatter={(v: number) => [`${v}/10`, 'Umore']}
          />
          <Bar dataKey="score" fill={color} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
        {entries.slice(0, 10).map((e) => (
          <EntryRow key={e.id} entry={e} color={color}
            label={(e.data.note as string) ?? '—'}
            value={e.data.score ? `${e.data.score}/10` : '—'}
          />
        ))}
      </div>
    </div>
  );
}

function DiaryList({ entries, color }: { entries: VaultEntry[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
      {entries.slice(0, 20).map((e) => (
        <EntryRow key={e.id} entry={e} color={color}
          label={(e.data.note as string) ?? (e.data.raw as string) ?? '—'}
          value={new Date(e.created_at).toLocaleDateString('it-IT')}
        />
      ))}
    </div>
  );
}

function GenericList({ entries, color }: { entries: VaultEntry[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
      {entries.slice(0, 25).map((e) => {
        const val  = e.data.value ?? e.data.amount ?? e.data.score ?? '';
        const lbl  = e.data.label ?? e.data.raw ?? e.data.note ?? e.category;
        return (
          <EntryRow key={e.id} entry={e} color={color}
            label={String(lbl)}
            value={String(val)}
          />
        );
      })}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 300, color }}>{value}</div>
    </div>
  );
}

function EntryRow({ entry, color, label, value }: { entry: VaultEntry; color: string; label: string; value: string }) {
  const { setActiveWidget, activeWidget } = useAlterStore();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteEntry(entry.id);
    if (activeWidget) {
      setActiveWidget({
        ...activeWidget,
        entries: activeWidget.entries.filter(en => en.id !== entry.id),
      });
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 8,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ flex: 1, fontSize: 13, color: '#ccd6f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 13, color, fontWeight: 400, whiteSpace: 'nowrap' }}>{value}</div>
      <button
        onClick={handleDelete}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0', padding: 2, opacity: 0.5, fontSize: 10 }}
      >✕</button>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────
export default function PolymorphicWidget() {
  const { activeWidget, setActiveWidget } = useAlterStore();

  return (
    <AnimatePresence>
      {activeWidget && (
        <motion.div
          key="widget"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            bottom: 120,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(480px, 94vw)',
            maxHeight: '60vh',
            overflowY: 'auto',
            background: 'rgba(10,10,18,0.92)',
            border: `1px solid ${activeWidget.color}22`,
            borderRadius: 20,
            padding: '20px 20px 16px',
            backdropFilter: 'blur(24px)',
            zIndex: 100,
            boxShadow: `0 0 60px ${activeWidget.color}18, 0 20px 40px rgba(0,0,0,0.6)`,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: activeWidget.color,
              boxShadow: `0 0 12px ${activeWidget.color}`,
            }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#ccd6f6', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {activeWidget.label}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8892b0' }}>
              {activeWidget.entries.length} voci
            </span>
            <button
              onClick={() => setActiveWidget(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0', padding: 4 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Body — polymorphic */}
          {activeWidget.entries.length === 0 ? (
            <p style={{ color: '#8892b0', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Nessun dato ancora.
            </p>
          ) : activeWidget.renderType === 'stats'  ? <FinanceStats entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'chart'   ? <HealthChart  entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'mood'    ? <MoodChart    entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'diary'   ? <DiaryList    entries={activeWidget.entries} color={activeWidget.color} />
          : <GenericList entries={activeWidget.entries} color={activeWidget.color} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
