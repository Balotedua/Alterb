import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { VaultEntry } from '../../../types';
import { SurgicalInsight, Stat, EntryRow } from './shared';

export function HealthChart({ entries, color }: { entries: VaultEntry[]; color: string }) {
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
            contentStyle={{ background: 'rgba(3,3,7,0.97)', border: `1px solid ${color}25`, borderRadius: 10, backdropFilter: 'blur(20px)' }}
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

export function NumericChart({ entries, color, label: catLabel }: { entries: VaultEntry[]; color: string; label: string }) {
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <Stat label="Media"   value={`${avg.toFixed(1)}${unit}`} color={color} />
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
