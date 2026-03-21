import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAlterStore } from '../../store/alterStore';
import { deleteEntry } from '../../vault/vaultService';
import type { VaultEntry, WidgetData, RenderType } from '../../types';

// ─── Render type inference ────────────────────────────────────
export function inferRenderType(entries: VaultEntry[], category?: string): RenderType {
  if (category === 'calendar' || (!entries.length && category === 'calendar')) return 'timeline';
  if (!entries.length) return 'list';
  const data = entries[0].data;
  if (data.is_event || (entries[0] as VaultEntry & { category?: string }).category === 'calendar') return 'timeline';
  if (data.type === 'mood') return 'mood';
  if (data.type === 'weight' || data.type === 'sleep' || data.type === 'water') return 'chart';
  // Sport/activity data → bar chart
  if (data.type === 'activity') return 'activity';
  // Finance → pie if many distinct labels, otherwise stats
  if (typeof data.amount === 'number') {
    const labels = new Set(entries.map(e => e.data.label as string).filter(Boolean));
    return labels.size >= 4 ? 'pie' : 'stats';
  }
  // Custom categories with numeric value → trend chart
  if (typeof data.value === 'number') return 'numeric';
  if (typeof data.note === 'string' && !data.score) return 'diary';
  return 'list';
}

// ─── Surgical Insight ─────────────────────────────────────────
function SurgicalInsight({ values, unit, category, color }: {
  values: number[]; unit: string; category?: string; color: string;
}) {
  if (values.length < 3) return null;
  const half     = Math.floor(values.length / 2);
  const firstAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const lastAvg  = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
  const pct      = firstAvg === 0 ? 0 : ((lastAvg - firstAvg) / firstAvg) * 100;
  const arrow    = pct > 2 ? '↑' : pct < -2 ? '↓' : '→';
  const trendClr = pct > 2 ? '#f87171' : pct < -2 ? '#4ade80' : '#6b7280';

  const recent   = values.slice(-3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const now      = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const projection = recentAvg * daysLeft;

  return (
    <div style={{
      marginTop: 10, padding: '7px 12px', borderRadius: 8,
      background: 'rgba(255,255,255,0.016)',
      borderLeft: `2px solid ${trendClr}35`,
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 10, letterSpacing: '0.04em',
    }}>
      <span style={{ color: trendClr, fontWeight: 500 }}>
        {arrow} {pct > 0 ? '+' : ''}{pct.toFixed(1)}% vs media precedente
      </span>
      {daysLeft > 0 && category === 'finance' && projection > 0 && (
        <span style={{ color: '#3a3f52' }}>
          · Proiezione fine mese: {unit}{projection.toFixed(0)}
        </span>
      )}
      {daysLeft > 0 && category !== 'finance' && (
        <span style={{ color: color, opacity: 0.4 }}>
          · Media attuale: {unit}{recentAvg.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: 1, padding: '12px 14px', borderRadius: 12,
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${color}12`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)`,
    }}>
      <div style={{
        fontSize: 9, color: '#4b5268',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7,
        fontWeight: 400,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 100, color,
        textShadow: `0 0 20px ${color}50`,
        letterSpacing: '0.01em',
      }}>
        {value}
      </div>
    </div>
  );
}

function EntryRow({ entry, color, label, value }: {
  entry: VaultEntry; color: string; label: string; value: string
}) {
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
      padding: '7px 10px 7px 12px',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.018)',
      borderLeft: `2px solid ${color}35`,
      transition: 'background 0.15s',
    }}>
      <div style={{
        flex: 1, fontSize: 12, color: '#b0bcd4',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontWeight: 300,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, color,
        fontWeight: 400, whiteSpace: 'nowrap',
        textShadow: `0 0 10px ${color}40`,
      }}>
        {value}
      </div>
      <button
        onClick={handleDelete}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#3a3f52', padding: 2, opacity: 0.6, fontSize: 9,
          transition: 'color 0.2s, opacity 0.2s',
          lineHeight: 1,
        }}
        onMouseEnter={e => { (e.target as HTMLElement).style.color = '#f87171'; (e.target as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.color = '#3a3f52'; (e.target as HTMLElement).style.opacity = '0.6'; }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Sub-renderers ────────────────────────────────────────────
const PIE_PALETTE = ['#f87171','#fb923c','#fbbf24','#a78bfa','#60a5fa','#34d399','#f472b6','#a3e635'];

function FinanceStats({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const expenses = entries.filter(e => e.data.type === 'expense');
  const income   = entries.filter(e => e.data.type === 'income');
  const totalOut = expenses.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
  const totalIn  = income.reduce((s, e)   => s + ((e.data.amount as number) ?? 0), 0);

  // Group expenses by day for area chart
  const dayMap = new Map<string, number>();
  for (const e of [...expenses].reverse()) {
    const day = new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    dayMap.set(day, (dayMap.get(day) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const chartData = Array.from(dayMap.entries()).map(([date, v]) => ({ date, v })).slice(-20);
  const values    = chartData.map(d => d.v);

  // Pie: expense breakdown by label
  const labelMap = new Map<string, number>();
  for (const e of expenses) {
    const lbl = (e.data.label as string) || 'altro';
    labelMap.set(lbl, (labelMap.get(lbl) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const pieData = [...labelMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([name, value]) => ({ name, value }));

  return (
    <div>
      {/* Area chart over time */}
      {chartData.length >= 2 && (
        <div style={{ marginBottom: 14 }}>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fingrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f87171" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ background: 'rgba(3,3,7,0.97)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, backdropFilter: 'blur(20px)' }}
                labelStyle={{ color: '#6b7280', fontSize: 10 }}
                itemStyle={{ color: '#f87171' }}
                formatter={(v: number) => [`€${v.toFixed(2)}`, 'Spese']}
              />
              <Area type="monotone" dataKey="v" stroke="#f87171" strokeWidth={1.5} fill="url(#fingrad)"
                dot={{ fill: '#f87171', r: 2, strokeWidth: 0 }} activeDot={{ r: 4, fill: '#f87171', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
          <SurgicalInsight values={values} unit="€" category="finance" color="#f87171" />
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Stat label="Uscite"  value={`-€${totalOut.toFixed(2)}`} color="#f87171" />
        <Stat label="Entrate" value={`+€${totalIn.toFixed(2)}`}  color="#4ade80" />
        <Stat label="Netto"   value={`€${(totalIn - totalOut).toFixed(2)}`} color={color} />
      </div>

      {/* Pie breakdown (only when enough labels) */}
      {pieData.length >= 3 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Distribuzione spese
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} fillOpacity={0.85} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(3,3,7,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 10 }}
                  formatter={(v: number, _: string, entry: { name?: string }) => [`€${v.toFixed(2)}`, entry.name ?? '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pieData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: PIE_PALETTE[i % PIE_PALETTE.length], flexShrink: 0 }} />
                  <span style={{ color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span style={{ color: PIE_PALETTE[i % PIE_PALETTE.length], fontWeight: 500 }}>€{d.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Entry list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 140, overflowY: 'auto' }}>
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
  const type     = entries[0]?.data.type as string;
  const valueKey = type === 'sleep' ? 'hours' : type === 'water' ? 'liters' : 'value';
  const unit     = type === 'sleep' ? 'h' : type === 'water' ? 'L' : 'kg';
  const gradId   = `hgrad-${type}`;

  const chartData = [...entries].reverse().slice(-20).map((e) => ({
    date: new Date(e.created_at).toLocaleDateString('it-IT', { month: '2-digit', day: '2-digit' }),
    v:    (e.data[valueKey] as number) ?? 0,
  }));
  const values = chartData.map(d => d.v);

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{
              background: 'rgba(3,3,7,0.97)', border: `1px solid ${color}25`,
              borderRadius: 10, backdropFilter: 'blur(20px)',
            }}
            labelStyle={{ color: '#6b7280', fontSize: 10 }}
            itemStyle={{ color }}
            formatter={(v: number) => [`${v}${unit}`, '']}
          />
          <Area
            type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={{ fill: color, r: 2.5, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            style={{ filter: `drop-shadow(0 0 5px ${color}90)` }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <SurgicalInsight values={values} unit={unit} category="health" color={color} />
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 100, overflowY: 'auto' }}>
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

// ─── Activity / Sport Chart ───────────────────────────────────
function ActivityChart({ entries, color }: { entries: VaultEntry[]; color: string }) {
  // Count by activity label
  const typeMap = new Map<string, { count: number; total: number }>();
  for (const e of entries) {
    const lbl = (e.data.label as string)?.replace(/\d+([.,]\d+)?\s*(km|m|min|h)?\s*/gi, '').trim() || 'attività';
    const key = lbl.slice(0, 20);
    const prev = typeMap.get(key) ?? { count: 0, total: 0 };
    typeMap.set(key, { count: prev.count + 1, total: prev.total + ((e.data.value as number) ?? 0) });
  }
  const typeData = [...typeMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, { count }]) => ({ name, count }));

  // Timeline if has numeric values (km, min, etc.)
  const hasNumeric = entries.some(e => typeof e.data.value === 'number' && (e.data.value as number) > 0);
  const timelineData = hasNumeric
    ? [...entries].reverse().slice(-20).map(e => ({
        date: new Date(e.created_at).toLocaleDateString('it-IT', { month: '2-digit', day: '2-digit' }),
        v: (e.data.value as number) ?? 1,
      }))
    : [];

  const unit = (entries[0]?.data.label as string ?? '').match(/\d+(km|m|min|h)/i)?.[1] ?? '';

  return (
    <div>
      {/* Trend over time (if numeric) */}
      {timelineData.length >= 3 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Progressione nel tempo
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="actgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: 'rgba(3,3,7,0.97)', border: `1px solid ${color}25`, borderRadius: 10 }}
                labelStyle={{ color: '#6b7280', fontSize: 10 }}
                itemStyle={{ color }}
                formatter={(v: number) => [`${v}${unit}`, '']}
              />
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#actgrad)"
                dot={{ fill: color, r: 2, strokeWidth: 0 }} activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bar chart by activity type */}
      {typeData.length >= 2 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Frequenza per attività
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={typeData} layout="vertical" barSize={8}>
              <XAxis type="number" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ background: 'rgba(3,3,7,0.97)', border: `1px solid ${color}25`, borderRadius: 8 }}
                labelStyle={{ color: '#6b7280', fontSize: 10 }}
                itemStyle={{ color }}
                formatter={(v: number) => [`${v}x`, 'sessioni']}
              />
              <Bar dataKey="count" fill={color} radius={[0, 3, 3, 0]} fillOpacity={0.75}
                style={{ filter: `drop-shadow(0 0 3px ${color}60)` }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 110, overflowY: 'auto' }}>
        {entries.slice(0, 15).map((e) => (
          <EntryRow key={e.id} entry={e} color={color}
            label={(e.data.label as string) || 'attività'}
            value={e.data.value ? `${e.data.value}${unit}` : new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Generic Numeric Chart ─────────────────────────────────────
function NumericChart({ entries, color, label: catLabel }: { entries: VaultEntry[]; color: string; label: string }) {
  const unit = (entries[0]?.data.unit as string) ?? '';
  const chartData = [...entries].reverse().slice(-25).map(e => ({
    date: new Date(e.created_at).toLocaleDateString('it-IT', { month: '2-digit', day: '2-digit' }),
    v: (e.data.value as number) ?? 0,
    note: (e.data.label as string) ?? (e.data.raw as string) ?? '',
  }));
  const values = chartData.map(d => d.v);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;

  return (
    <div>
      {chartData.length >= 2 ? (
        <div style={{ marginBottom: 14 }}>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="numgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ background: 'rgba(3,3,7,0.97)', border: `1px solid ${color}25`, borderRadius: 10 }}
                labelStyle={{ color: '#6b7280', fontSize: 10 }}
                itemStyle={{ color }}
                formatter={(v: number, _: string, entry: { payload?: { note?: string } }) => [`${v}${unit}`, entry.payload?.note || catLabel]}
              />
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#numgrad)"
                dot={{ fill: color, r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                style={{ filter: `drop-shadow(0 0 5px ${color}90)` }} />
            </AreaChart>
          </ResponsiveContainer>
          <SurgicalInsight values={values} unit={unit} category={catLabel} color={color} />
        </div>
      ) : null}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <Stat label="Media"  value={`${avg.toFixed(1)}${unit}`}  color={color} />
        <Stat label="Massimo" value={`${max}${unit}`}            color={color} />
        <Stat label="Minimo"  value={`${min}${unit}`}            color={color} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 110, overflowY: 'auto' }}>
        {entries.slice(0, 20).map((e) => (
          <EntryRow key={e.id} entry={e} color={color}
            label={(e.data.label as string) ?? (e.data.raw as string) ?? catLabel}
            value={`${e.data.value ?? '?'}${unit}`}
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
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={chartData} barSize={8}>
          <XAxis dataKey="date" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 10]} tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} width={20} />
          <Tooltip
            contentStyle={{
              background: 'rgba(3,3,7,0.95)', border: `1px solid ${color}20`,
              borderRadius: 10, backdropFilter: 'blur(20px)',
            }}
            labelStyle={{ color: '#6b7280', fontSize: 10 }}
            itemStyle={{ color }}
            formatter={(v: number) => [`${v}/10`, 'Umore']}
          />
          <Bar
            dataKey="score" fill={color} radius={[3, 3, 0, 0]}
            fillOpacity={0.75}
            style={{ filter: `drop-shadow(0 0 3px ${color}60)` }}
          />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
      {entries.slice(0, 25).map((e) => {
        const val = e.data.value ?? e.data.amount ?? e.data.score ?? '';
        const lbl = e.data.label ?? e.data.raw ?? e.data.note ?? e.category;
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

// ─── Generic Pie Renderer (Finance with many labels) ──────────
function PieRenderer({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const expenses = entries.filter(e => e.data.type === 'expense');
  const income   = entries.filter(e => e.data.type === 'income');
  const totalOut = expenses.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
  const totalIn  = income.reduce((s, e)   => s + ((e.data.amount as number) ?? 0), 0);

  const labelMap = new Map<string, number>();
  for (const e of expenses) {
    const lbl = (e.data.label as string) || 'altro';
    labelMap.set(lbl, (labelMap.get(lbl) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const pieData = [...labelMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Stat label="Uscite"  value={`-€${totalOut.toFixed(2)}`} color="#f87171" />
        <Stat label="Entrate" value={`+€${totalIn.toFixed(2)}`}  color="#4ade80" />
        <Stat label="Netto"   value={`€${(totalIn - totalOut).toFixed(2)}`} color={color} />
      </div>
      <div style={{ fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        Distribuzione spese
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={60} dataKey="value" strokeWidth={0}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} fillOpacity={0.88} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'rgba(3,3,7,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 10 }}
              formatter={(v: number, _: string, entry: { name?: string }) => [`€${v.toFixed(2)}`, entry.name ?? '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {pieData.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: PIE_PALETTE[i % PIE_PALETTE.length], flexShrink: 0 }} />
              <span style={{ color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              <span style={{ color: PIE_PALETTE[i % PIE_PALETTE.length], fontWeight: 500, fontSize: 11 }}>€{d.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
        {entries.slice(0, 25).map((e) => (
          <EntryRow key={e.id} entry={e} color={color}
            label={(e.data.label as string) ?? '—'}
            value={`${e.data.type === 'income' ? '+' : '-'}€${(e.data.amount as number)?.toFixed(2) ?? '?'}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Calendar Timeline ────────────────────────────────────────
function CalendarTimeline({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const sorted = [...entries].sort((a, b) => {
    const sa = (a.data.scheduled_at as string) ?? a.created_at;
    const sb = (b.data.scheduled_at as string) ?? b.created_at;
    return new Date(sa).getTime() - new Date(sb).getTime();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
      {sorted.length === 0 && (
        <p style={{ color: '#2e3347', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
          Nessun evento in agenda.
        </p>
      )}
      {sorted.map((e) => {
        const raw = (e.data.scheduled_at as string) ?? e.created_at;
        const dt  = new Date(raw);
        const dateStr = dt.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
        const timeStr = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const title   = (e.data.title as string) ?? (e.data.raw as string) ?? '—';
        const isPast  = dt < new Date();
        return (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 12px', borderRadius: 10,
            background: isPast ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.028)',
            borderLeft: `2px solid ${isPast ? color + '25' : color + '60'}`,
            opacity: isPast ? 0.45 : 1,
          }}>
            {/* Timeline dot */}
            <div style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              minWidth: 52,
            }}>
              <span style={{ fontSize: 9, color: color, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {dateStr}
              </span>
              <span style={{ fontSize: 11, color: isPast ? '#4b5268' : color, fontWeight: 400 }}>
                {timeStr}
              </span>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: isPast ? '#4b5268' : '#b0bcd4', fontWeight: 300,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
            <button
              onClick={async (ev) => {
                ev.stopPropagation();
                await deleteEntry(e.id);
                useAlterStore.getState().setActiveWidget(
                  useAlterStore.getState().activeWidget
                    ? { ...useAlterStore.getState().activeWidget!, entries: useAlterStore.getState().activeWidget!.entries.filter(x => x.id !== e.id) }
                    : null
                );
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3f52', padding: 2, opacity: 0.6, fontSize: 9 }}
              onMouseEnter={e2 => { (e2.target as HTMLElement).style.color = '#f87171'; (e2.target as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={e2 => { (e2.target as HTMLElement).style.color = '#3a3f52'; (e2.target as HTMLElement).style.opacity = '0.6'; }}
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Nebula Insight ───────────────────────────────────────────
function NebulaInsight({ entries, color }: { entries: VaultEntry[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 2,
      }}>
        Scoperte autonome · mentre non eri qui
      </div>
      {entries.slice(0, 5).map((entry, i) => {
        const title = (entry.data.title as string) ?? 'Insight';
        const text  = (entry.data.insight as string) ?? '';
        const cats  = (entry.data.categories as string[]) ?? [];
        const date  = new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
        return (
          <div key={i} style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.022)',
            borderLeft: `2px solid ${color}40`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 11, color, fontWeight: 500 }}>{title}</span>
              <span style={{ fontSize: 9, color: '#3a3f52' }}>{date}</span>
            </div>
            <div style={{ fontSize: 12, color: '#b0bcd4', lineHeight: 1.65, fontWeight: 300 }}>
              {text}
            </div>
            {cats.length > 0 && (
              <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cats.map(c => (
                  <span key={c} style={{
                    fontSize: 9, color, opacity: 0.55, letterSpacing: '0.08em',
                  }}>
                    #{c}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Nexus Correlation View ───────────────────────────────────
function NexusView({ entries }: { entries: VaultEntry[] }) {
  const d = entries[0]?.data ?? {};
  const catALabel  = (d.catALabel  as string) ?? 'A';
  const catBLabel  = (d.catBLabel  as string) ?? 'B';
  const colorA     = (d.colorA     as string) ?? '#f0c040';
  const colorB     = (d.colorB     as string) ?? '#a78bfa';
  const correlation = (d.correlation as number) ?? 0;
  const chartData  = (d.chartData  as Array<Record<string, unknown>>) ?? [];
  const catA       = (d.catA as string) ?? 'a';
  const catB       = (d.catB as string) ?? 'b';

  const corrAbs  = Math.abs(correlation);
  const corrPct  = (corrAbs * 100).toFixed(0);
  const corrSign = correlation > 0.25 ? 'positiva' : correlation < -0.25 ? 'inversa' : 'debole';
  const corrClr  = corrAbs > 0.5 ? '#a78bfa' : corrAbs > 0.25 ? '#f0c040' : '#4b5268';

  return (
    <div>
      {/* Correlation badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        padding: '10px 14px', borderRadius: 10,
        background: `linear-gradient(135deg, ${colorA}08, ${colorB}08)`,
        border: `1px solid ${corrClr}20`,
      }}>
        <span style={{ fontSize: 11, color: colorA, fontWeight: 500 }}>{catALabel}</span>
        <span style={{ fontSize: 10, color: '#3a3f52', flex: 1, textAlign: 'center' }}>↔</span>
        <span style={{ fontSize: 11, color: colorB, fontWeight: 500 }}>{catBLabel}</span>
        <div style={{
          marginLeft: 'auto', padding: '3px 10px', borderRadius: 20,
          background: `${corrClr}18`, border: `1px solid ${corrClr}30`,
          fontSize: 10, color: corrClr, letterSpacing: '0.05em',
        }}>
          {corrSign} {corrPct}%
        </div>
      </div>

      {/* Dual normalized chart */}
      {chartData.length >= 2 && (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="ngA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colorA} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colorA} stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="ngB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colorB} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colorB} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} width={28} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: 'rgba(3,3,7,0.97)', border: `1px solid rgba(255,255,255,0.07)`,
                borderRadius: 10, backdropFilter: 'blur(20px)',
              }}
              labelStyle={{ color: '#6b7280', fontSize: 10 }}
              formatter={(v: number, name: string) => [`${v.toFixed(0)}%`, name]}
            />
            <Area type="monotone" dataKey={catA} name={catALabel} stroke={colorA} strokeWidth={1.5} fill="url(#ngA)" dot={false} />
            <Area type="monotone" dataKey={catB} name={catBLabel} stroke={colorB} strokeWidth={1.5} fill="url(#ngB)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Insight text */}
      <div style={{
        marginTop: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.018)',
        borderLeft: `2px solid ${corrClr}40`,
        fontSize: 10, color: '#6b7280', lineHeight: 1.6,
      }}>
        {corrAbs > 0.5
          ? `Correlazione forte: quando ${catALabel} aumenta, ${catBLabel} tende ${correlation > 0 ? 'ad aumentare' : 'a diminuire'} nello stesso periodo.`
          : corrAbs > 0.2
            ? `Correlazione moderata rilevata. Monitora entrambe le variabili per confermare il pattern.`
            : `Nessuna correlazione significativa trovata. Le due variabili sembrano indipendenti.`
        }
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────
export default function PolymorphicWidget() {
  const { activeWidget, setActiveWidget } = useAlterStore();

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveWidget(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveWidget]);

  return (
    <>
      {/* Backdrop */}
      {activeWidget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setActiveWidget(null)}
        />
      )}

      <AnimatePresence>
        {activeWidget && (
        <motion.div
          key="widget"
          initial={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0, x: '-50%', y: '-50%' }}
          animate={{ clipPath: 'circle(150% at 50% 50%)', opacity: 1, x: '-50%', y: '-50%' }}
          exit={{   clipPath: 'circle(0% at 50% 50%)', opacity: 0, x: '-50%', y: '-50%' }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            width: 'min(500px, calc(100vw - 16px))',
            maxHeight: 'min(72vh, calc(100svh - 80px))',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch' as never,
            background: 'rgba(6,6,8,0.92)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 4,
            padding: '20px 20px 16px',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            zIndex: 100,
            boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 10 }}>
            {/* Color indicator */}
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: 'rgba(255,255,255,0.5)',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              {activeWidget.label}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.05em' }}>
              {activeWidget.entries.length}
            </span>
            <button
              onClick={() => setActiveWidget(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#2e3347', padding: 4,
                transition: 'color 0.2s',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#6b7280')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#2e3347')}
            >
              <X size={13} />
            </button>
          </div>

          {/* Body — polymorphic */}
          {activeWidget.entries.length === 0 ? (
            <p style={{
              color: '#2e3347', fontSize: 12, textAlign: 'center',
              padding: '24px 0', letterSpacing: '0.05em',
            }}>
              Nessun dato ancora.
            </p>
          ) : activeWidget.renderType === 'stats'    ? <FinanceStats      entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'pie'      ? <PieRenderer       entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'chart'    ? <HealthChart       entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'activity' ? <ActivityChart     entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'numeric'  ? <NumericChart      entries={activeWidget.entries} color={activeWidget.color} label={activeWidget.label} />
          : activeWidget.renderType === 'mood'     ? <MoodChart         entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'diary'    ? <DiaryList         entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'timeline' ? <CalendarTimeline  entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'insight'  ? <NebulaInsight     entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'nexus'    ? <NexusView         entries={activeWidget.entries} />
          : <GenericList entries={activeWidget.entries} color={activeWidget.color} />}
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
