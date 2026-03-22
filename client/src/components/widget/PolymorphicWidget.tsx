import { useEffect, useState } from 'react';
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
import { getDocumentDownloadUrl } from '../../import/documentStorage';
import type { VaultEntry, WidgetData, RenderType } from '../../types';

// ─── Render type inference ────────────────────────────────────
export function inferRenderType(entries: VaultEntry[], category?: string): RenderType {
  if (category === 'calendar' || (!entries.length && category === 'calendar')) return 'timeline';
  if (!entries.length) {
    if (category === 'finance') return 'finance';
    if (category === 'health') return 'chart';
    if (category === 'psychology') return 'mood';
    return 'list';
  }
  const data = entries[0].data;
  if (data.is_event || (entries[0] as VaultEntry & { category?: string }).category === 'calendar') return 'timeline';
  if (data.type === 'mood') return 'mood';
  if (data.type === 'weight' || data.type === 'sleep' || data.type === 'water') return 'chart';
  // Sport/activity data → workout dashboard
  if (data.type === 'activity') return 'workout';
  // Finance → finance dashboard
  if (typeof data.amount === 'number') return 'finance';
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

// ─── Tab Bar ──────────────────────────────────────────────────
function TabBar({ tabs, active, color, onChange }: {
  tabs: string[]; active: string; color: string; onChange: (t: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
          fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 400,
          background: active === t ? `${color}18` : 'transparent',
          color: active === t ? color : '#3a3f52',
          transition: 'all 0.2s',
        }}>{t}</button>
      ))}
    </div>
  );
}

// ─── Finance Dashboard ────────────────────────────────────────
function FinanceDashboard({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [tab, setTab] = useState<'cashflow' | 'analisi'>('cashflow');

  const expenses = entries.filter(e => e.data.type === 'expense');
  const income   = entries.filter(e => e.data.type === 'income');
  const totalOut = expenses.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
  const totalIn  = income.reduce((s, e)  => s + ((e.data.amount as number) ?? 0), 0);
  const balance  = totalIn - totalOut;
  const savings  = totalIn > 0 ? Math.round((balance / totalIn) * 100) : null;

  // Burn rate: avg spesa giornaliera × 30
  const dayOfMonth = new Date().getDate();
  const burnRate   = dayOfMonth > 0 ? (totalOut / dayOfMonth) * 30 : 0;

  // Dual-line chart data
  const incByDay: Map<string, number> = new Map();
  const outByDay: Map<string, number> = new Map();
  for (const e of [...entries].reverse()) {
    const day = new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    if (e.data.type === 'income')  incByDay.set(day,  (incByDay.get(day)  ?? 0) + ((e.data.amount as number) ?? 0));
    if (e.data.type === 'expense') outByDay.set(day, (outByDay.get(day) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const allDays   = [...new Set([...incByDay.keys(), ...outByDay.keys()])].slice(-20);
  const chartData = allDays.map(date => ({ date, entrate: incByDay.get(date) ?? 0, uscite: outByDay.get(date) ?? 0 }));

  // Pie data
  const labelMap = new Map<string, number>();
  for (const e of expenses) {
    const lbl = (e.data.label as string) || 'altro';
    labelMap.set(lbl, (labelMap.get(lbl) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const pieData = [...labelMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value]) => ({ name, value }));

  const kpis = [
    { label: 'Entrate',   value: `+€${totalIn.toFixed(0)}`,  clr: '#4ade80' },
    { label: 'Uscite',    value: `-€${totalOut.toFixed(0)}`, clr: '#f87171' },
    { label: 'Saldo',     value: `€${balance.toFixed(0)}`,   clr: balance >= 0 ? '#4ade80' : '#f87171' },
    { label: 'Risparmio', value: savings != null ? `${savings}%` : '—', clr: '#f0c040' },
  ];

  return (
    <div>
      <TabBar tabs={['Cashflow', 'Analisi']} active={tab === 'cashflow' ? 'Cashflow' : 'Analisi'}
        color={color} onChange={t => setTab(t === 'Cashflow' ? 'cashflow' : 'analisi')} />

      {tab === 'cashflow' && (
        <div>
          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {kpis.map(k => (
              <div key={k.label} style={{
                flex: 1, padding: '9px 10px', borderRadius: 10,
                background: `${k.clr}08`, border: `1px solid ${k.clr}15`,
              }}>
                <div style={{ fontSize: 8, color: '#4b5268', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>{k.label}</div>
                <div style={{ fontSize: 15, fontWeight: 100, color: k.clr }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Burn rate */}
          {burnRate > 0 && (
            <div style={{
              marginBottom: 12, padding: '7px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.016)', borderLeft: '2px solid rgba(248,113,113,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 10, color: '#4b5268',
            }}>
              <span>Burn rate mensile proiettato</span>
              <span style={{ color: '#f87171', fontWeight: 500 }}>€{burnRate.toFixed(0)}</span>
            </div>
          )}

          {/* Dual-line chart */}
          {chartData.length >= 2 && (
            <div style={{ marginBottom: 14 }}>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(3,3,7,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}
                    labelStyle={{ color: '#6b7280', fontSize: 10 }}
                    formatter={(v: number, name: string) => [`€${v.toFixed(2)}`, name]}
                  />
                  <Line type="monotone" dataKey="entrate" name="Entrate" stroke="#4ade80" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: '#4ade80', strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="uscite"  name="Uscite"  stroke="#f87171" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: '#f87171', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                {[['#4ade80', 'Entrate'], ['#f87171', 'Uscite']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#4b5268' }}>
                    <div style={{ width: 18, height: 1.5, background: c, borderRadius: 1 }} />{l}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto' }}>
            {entries.slice(0, 20).map(e => (
              <EntryRow key={e.id} entry={e} color={color}
                label={(e.data.label as string) ?? '—'}
                value={`${e.data.type === 'income' ? '+' : '-'}€${(e.data.amount as number)?.toFixed(2) ?? '?'}`}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'analisi' && (
        <div>
          {/* Donut + legend */}
          {pieData.length >= 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} fillOpacity={0.88} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'rgba(3,3,7,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 10 }}
                    formatter={(v: number, _: string, entry: { name?: string }) => [`€${v.toFixed(2)}`, entry.name ?? '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: PIE_PALETTE[i % PIE_PALETTE.length], flexShrink: 0 }} />
                    <span style={{ color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span style={{ color: PIE_PALETTE[i % PIE_PALETTE.length], fontWeight: 500 }}>€{d.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category bars */}
          {pieData.length > 0 && totalOut > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {pieData.map((d, i) => {
                const pct = (d.value / totalOut) * 100;
                const c   = PIE_PALETTE[i % PIE_PALETTE.length];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 9, color: '#4b5268', minWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 2, boxShadow: `0 0 6px ${c}50` }} />
                    </div>
                    <span style={{ fontSize: 9, color: c, minWidth: 28, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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

// ─── Workout Dashboard ────────────────────────────────────────
type MuscleId = 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'core' | 'quads_glutes' | 'back';

const MUSCLE_LABELS_WK: Record<MuscleId, string> = {
  chest: 'Petto', shoulders: 'Spalle', biceps: 'Bicipiti',
  triceps: 'Tricipiti', core: 'Core', quads_glutes: 'Gambe', back: 'Schiena',
};

const EXERCISE_TO_MUSCLE: Record<string, MuscleId> = {
  'Panca piana': 'chest', 'Dips': 'chest', 'Push-up': 'chest', 'Cavi alti': 'chest',
  'Shoulder press': 'shoulders', 'Military Press': 'shoulders', 'Alzate Laterali': 'shoulders',
  'Bicipiti curl': 'biceps', 'Hammer curl': 'biceps', 'Flessioni': 'biceps',
  'Tricipiti': 'triceps', 'Pushdown': 'triceps', 'French Press': 'triceps',
  'Plank': 'core', 'Crunches': 'core', 'Russian Twist': 'core', 'Leg Raise': 'core',
  'Squat': 'quads_glutes', 'Leg Press': 'quads_glutes', 'Hip Thrust': 'quads_glutes',
  'Affondi': 'quads_glutes', 'Leg Extension': 'quads_glutes',
  'Stacco': 'back', 'Trazione': 'back', 'Lat Machine': 'back', 'Rematore': 'back',
};

const WK_MUSCLES: MuscleId[] = ['chest', 'shoulders', 'biceps', 'triceps', 'core', 'quads_glutes', 'back'];

function wkDaysDiff(iso: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - new Date(iso).getTime()) / 86_400_000);
}
function wkFill(d: number)   { return d === 0 ? 'rgba(255,34,68,0.28)' : d === 1 ? 'rgba(255,136,0,0.20)' : d === 2 ? 'rgba(255,221,0,0.13)' : 'rgba(255,255,255,0.03)'; }
function wkStroke(d: number) { return d === 0 ? 'rgba(255,34,68,0.90)' : d === 1 ? 'rgba(255,136,0,0.70)' : d === 2 ? 'rgba(255,221,0,0.55)' : 'rgba(255,255,255,0.10)'; }
function wkGlow(d: number)   { return d === 0 ? 'drop-shadow(0 0 8px rgba(255,34,68,0.75))' : d === 1 ? 'drop-shadow(0 0 6px rgba(255,136,0,0.55))' : d === 2 ? 'drop-shadow(0 0 4px rgba(255,221,0,0.4))' : 'none'; }

function BodySilhouette({ fills, strokes, glows, showBack }: {
  fills: Record<MuscleId, string>; strokes: Record<MuscleId, string>;
  glows: Record<MuscleId, string>; showBack: boolean;
}) {
  const sw = 0.7;
  const tr = 'fill 0.9s ease-in-out, stroke 0.9s ease-in-out';
  return (
    <svg viewBox="0 0 120 300" style={{ width: '100%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <path d="M 43,20 C 43,4 77,4 77,20 C 77,36 72,44 60,44 C 48,44 43,36 43,20 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" strokeWidth={sw} />
      <path d="M 55,44 L 65,44 L 64,54 L 56,54 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      {/* Shoulders */}
      <g style={{ filter: glows.shoulders }}>
        <path d="M 44,57 C 38,52 22,59 18,72 C 15,81 21,89 30,88 C 38,87 44,81 44,73 Z" fill={fills.shoulders} stroke={strokes.shoulders} strokeWidth={sw} style={{ transition: tr }} />
        <path d="M 76,57 C 82,52 98,59 102,72 C 105,81 99,89 90,88 C 82,87 76,81 76,73 Z" fill={fills.shoulders} stroke={strokes.shoulders} strokeWidth={sw} style={{ transition: tr }} />
      </g>
      {/* Chest / Back */}
      {!showBack ? (
        <g style={{ filter: glows.chest }}>
          <path d="M 44,57 C 44,75 43,108 46,120 L 60,118 L 60,57 Z" fill={fills.chest} stroke={strokes.chest} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }} />
          <path d="M 76,57 C 76,75 77,108 74,120 L 60,118 L 60,57 Z" fill={fills.chest} stroke={strokes.chest} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }} />
          <line x1="60" y1="59" x2="60" y2="118" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
        </g>
      ) : (
        <g style={{ filter: glows.back }}>
          <path d="M 44,57 C 40,65 38,100 42,122 L 60,120 L 60,57 Z" fill={fills.back} stroke={strokes.back} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }} />
          <path d="M 76,57 C 80,65 82,100 78,122 L 60,120 L 60,57 Z" fill={fills.back} stroke={strokes.back} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }} />
          <line x1="60" y1="57" x2="60" y2="120" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" strokeDasharray="2,1.5" />
        </g>
      )}
      {/* Biceps */}
      <g style={{ filter: glows.biceps }}>
        <path d="M 21,71 C 16,75 14,95 17,105 C 19,111 29,111 35,105 C 38,95 37,75 32,71 Z" fill={fills.biceps} stroke={strokes.biceps} strokeWidth={sw} style={{ transition: tr }} />
        <path d="M 99,71 C 104,75 106,95 103,105 C 101,111 91,111 85,105 C 82,95 83,75 88,71 Z" fill={fills.biceps} stroke={strokes.biceps} strokeWidth={sw} style={{ transition: tr }} />
      </g>
      {/* Triceps */}
      <g style={{ filter: glows.triceps }}>
        <path d="M 17,95 C 14,101 14,119 17,126 C 20,130 29,130 33,126 C 36,119 36,101 35,95 Z" fill={fills.triceps} stroke={strokes.triceps} strokeWidth={sw} style={{ transition: tr }} />
        <path d="M 103,95 C 106,101 106,119 103,126 C 100,130 91,130 87,126 C 84,119 84,101 85,95 Z" fill={fills.triceps} stroke={strokes.triceps} strokeWidth={sw} style={{ transition: tr }} />
      </g>
      {/* Core */}
      <g style={{ filter: glows.core }}>
        <path d="M 46,120 L 74,120 L 74,158 C 74,164 68,168 60,168 C 52,168 46,164 46,158 Z" fill={fills.core} stroke={strokes.core} strokeWidth={sw} style={{ transition: tr }} />
        {[128, 138, 148].map(y => <line key={y} x1="51" y1={y} x2="69" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />)}
        <line x1="60" y1="120" x2="60" y2="158" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
      </g>
      {/* Quads / Glutes */}
      <g style={{ filter: glows.quads_glutes }}>
        <path d="M 46,158 C 44,168 42,200 43,228 C 44,240 52,244 58,244 C 62,244 64,240 64,232 L 60,168 Z" fill={fills.quads_glutes} stroke={strokes.quads_glutes} strokeWidth={sw} style={{ transition: tr }} />
        <path d="M 74,158 C 76,168 78,200 77,228 C 76,240 68,244 62,244 C 58,244 56,240 56,232 L 60,168 Z" fill={fills.quads_glutes} stroke={strokes.quads_glutes} strokeWidth={sw} style={{ transition: tr }} />
      </g>
      {/* Calves (decorative) */}
      <g fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth={sw}>
        <path d="M 43,228 C 41,240 40,265 42,278 C 44,286 52,288 56,284 C 58,272 58,248 58,240 Z" />
        <path d="M 77,228 C 79,240 80,265 78,278 C 76,286 68,288 64,284 C 62,272 62,248 62,240 Z" />
      </g>
    </svg>
  );
}

function TrainingCalendar({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const trainedDays = new Set(entries.map(e => new Date(e.created_at).toISOString().slice(0, 10)));
  const today = new Date();
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (34 - i));
    const iso = d.toISOString().slice(0, 10);
    return { iso, trained: trainedDays.has(iso), label: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) };
  });
  const thisWeek  = days.slice(-7).filter(d => d.trained).length;
  const thisMonth = days.filter(d => d.trained).length;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <Stat label="Questa settimana" value={`${thisWeek}x`} color={color} />
        <Stat label="Ultimi 35 giorni" value={`${thisMonth}x`} color={color} />
      </div>
      <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Calendario</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {days.map((d, i) => (
          <div key={i} title={d.label} style={{
            aspectRatio: '1', borderRadius: 3,
            background: d.trained ? color : 'rgba(255,255,255,0.03)',
            boxShadow: d.trained ? `0 0 5px ${color}50` : 'none',
          }} />
        ))}
      </div>
    </div>
  );
}

function PRSection({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  interface PREntry { value: number; unit: string; history: { date: string; value: number }[] }
  const prMap = new Map<string, PREntry>();
  for (const e of [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const label = (e.data.label as string) ?? '';
    const value = (e.data.value as number) ?? 0;
    if (!label || !value) continue;
    const unit = (e.data.unit as string) ?? 'kg';
    const pt   = { date: new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), value };
    const ex   = prMap.get(label);
    if (!ex) { prMap.set(label, { value, unit, history: [pt] }); }
    else { ex.history.push(pt); if (value > ex.value) ex.value = value; }
  }

  const byMuscle = new Map<MuscleId, Array<{ exercise: string } & PREntry>>();
  for (const [exercise, pr] of prMap.entries()) {
    const muscle = EXERCISE_TO_MUSCLE[exercise];
    if (!muscle) continue;
    if (!byMuscle.has(muscle)) byMuscle.set(muscle, []);
    byMuscle.get(muscle)!.push({ exercise, ...pr });
  }

  if (byMuscle.size === 0) {
    return <p style={{ color: '#3a3f52', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Registra esercizi con un peso per i massimali</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from(byMuscle.entries()).map(([muscle, exercises]) => (
        <div key={muscle}>
          <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            {MUSCLE_LABELS_WK[muscle]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {exercises.map(ex => {
              const isExp = expanded === ex.exercise;
              const pts   = ex.history.slice(-8);
              const W = 220, H = 50, P = 6;
              const vals = pts.map(p => p.value);
              const min  = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
              const xs   = pts.map((_, i) => P + ((W - P * 2) * i) / Math.max(pts.length - 1, 1));
              const ys   = pts.map(p => H - P - ((p.value - min) / range) * (H - P * 2));
              const poly = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
              const gradId = `prg-${ex.exercise.replace(/\s+/g, '')}`;
              return (
                <div key={ex.exercise}>
                  <div onClick={() => setExpanded(isExp ? null : ex.exercise)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    padding: '7px 10px', borderRadius: 8,
                    background: isExp ? `${color}0d` : 'rgba(255,255,255,0.018)',
                    borderLeft: `2px solid ${color}${isExp ? '60' : '25'}`,
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#b0bcd4', fontWeight: 300 }}>{ex.exercise}</span>
                    <span style={{ fontSize: 13, color, fontWeight: 400 }}>{ex.value} {ex.unit}</span>
                  </div>
                  {isExp && pts.length >= 2 && (
                    <div style={{ padding: '6px 10px 4px', background: `${color}05`, borderRadius: '0 0 8px 8px', marginTop: -2 }}>
                      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 50 }} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={`${color}55`} />
                            <stop offset="100%" stopColor={`${color}00`} />
                          </linearGradient>
                        </defs>
                        <polygon points={`${xs[0]},${H} ${poly} ${xs[xs.length - 1]},${H}`} fill={`url(#${gradId})`} />
                        <polyline points={poly} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="2.5" fill={color} />)}
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkoutDashboard({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [tab, setTab]           = useState<'corpo' | 'massimali'>('corpo');
  const [showBack, setShowBack] = useState(false);

  // Last trained per muscle group
  const lastTrained = new Map<MuscleId, string>();
  for (const e of entries) {
    const label  = (e.data.label as string) ?? '';
    const muscle = EXERCISE_TO_MUSCLE[label];
    if (!muscle) continue;
    const prev = lastTrained.get(muscle);
    if (!prev || e.created_at > prev) lastTrained.set(muscle, e.created_at);
  }

  const fills   = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? wkDaysDiff(lastTrained.get(m)!) : 999; return [m, wkFill(d)];   })) as Record<MuscleId, string>;
  const strokes = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? wkDaysDiff(lastTrained.get(m)!) : 999; return [m, wkStroke(d)]; })) as Record<MuscleId, string>;
  const glows   = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? wkDaysDiff(lastTrained.get(m)!) : 999; return [m, wkGlow(d)];   })) as Record<MuscleId, string>;

  return (
    <div>
      <TabBar tabs={['Corpo', 'Massimali']} active={tab === 'corpo' ? 'Corpo' : 'Massimali'}
        color={color} onChange={t => setTab(t === 'Corpo' ? 'corpo' : 'massimali')} />

      {tab === 'corpo' && (
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            {/* Silhouette */}
            <div style={{ position: 'relative', flexShrink: 0, width: 100 }}>
              <BodySilhouette fills={fills} strokes={strokes} glows={glows} showBack={showBack} />
              <button onClick={() => setShowBack(b => !b)} style={{
                position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '3px 10px', cursor: 'pointer',
                fontSize: 8, color: '#4b5268', letterSpacing: '0.08em',
              }}>{showBack ? 'FRONT' : 'BACK'}</button>
            </div>
            {/* Legend + recenti */}
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Recency</div>
              {([['rgba(255,34,68,0.7)', 'Oggi'], ['rgba(255,136,0,0.6)', 'Ieri'], ['rgba(255,221,0,0.5)', '2 giorni fa'], ['rgba(255,255,255,0.12)', 'Non allenato']] as [string, string][]).map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 10, color: '#4b5268' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 8, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Ultimi esercizi</div>
              {entries.slice(0, 5).map(e => (
                <div key={e.id} style={{ fontSize: 10, color: '#4b5268', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{(e.data.label as string) ?? '—'}</span>
                  {e.data.value ? <span style={{ color }}>{String(e.data.value)}{String(e.data.unit ?? 'kg')}</span> : null}
                </div>
              ))}
            </div>
          </div>
          <TrainingCalendar entries={entries} color={color} />
        </div>
      )}

      {tab === 'massimali' && <PRSection entries={entries} color={color} />}
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

// ─── Document Download List ────────────────────────────────────
function DocDownloadList({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleDownload = async (entry: VaultEntry) => {
    const d = entry.data as Record<string, unknown>;
    const path = d.storagePath as string | undefined;
    const filename = d.filename as string | undefined;
    if (!path) return;
    setLoading(prev => ({ ...prev, [entry.id]: true }));
    try {
      const url = await getDocumentDownloadUrl(path, filename);
      if (url) window.open(url, '_blank');
    } finally {
      setLoading(prev => ({ ...prev, [entry.id]: false }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((entry, i) => {
        const d = entry.data as Record<string, unknown>;
        const label    = (d.docTypeLabel as string) ?? (d.docType as string) ?? 'Documento';
        const filename = (d.filename as string) ?? '';
        const date     = new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
        const hasFile  = !!d.storagePath;
        const isLoading = loading[entry.id];

        return (
          <div key={entry.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.055)',
            borderRadius: 8,
          }}>
            <span style={{
              fontSize: 9, color: 'rgba(255,255,255,0.18)',
              fontVariantNumeric: 'tabular-nums', minWidth: 14,
              letterSpacing: '0.04em',
            }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {filename || label}
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', marginTop: 2, letterSpacing: '0.04em' }}>
                {label} · {date}
              </div>
            </div>
            {hasFile && (
              <button
                onClick={() => handleDownload(entry)}
                disabled={isLoading}
                style={{
                  background: isLoading ? 'rgba(255,255,255,0.04)' : `${color}18`,
                  border: `1px solid ${color}30`,
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 10, fontWeight: 600,
                  color: isLoading ? 'rgba(255,255,255,0.2)' : color,
                  cursor: isLoading ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  letterSpacing: '0.06em',
                }}
              >
                {isLoading ? '…' : '↓ Scarica'}
              </button>
            )}
          </div>
        );
      })}
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
          ) : activeWidget.renderType === 'finance'     ? <FinanceDashboard  entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'workout'     ? <WorkoutDashboard  entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'chart'       ? <HealthChart       entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'numeric'     ? <NumericChart      entries={activeWidget.entries} color={activeWidget.color} label={activeWidget.label} />
          : activeWidget.renderType === 'mood'        ? <MoodChart         entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'diary'       ? <DiaryList         entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'timeline'    ? <CalendarTimeline  entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'insight'     ? <NebulaInsight     entries={activeWidget.entries} color={activeWidget.color} />
          : activeWidget.renderType === 'nexus'       ? <NexusView         entries={activeWidget.entries} />
          : activeWidget.renderType === 'doc_download'? <DocDownloadList   entries={activeWidget.entries} color={activeWidget.color} />
          : <GenericList entries={activeWidget.entries} color={activeWidget.color} />}
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
