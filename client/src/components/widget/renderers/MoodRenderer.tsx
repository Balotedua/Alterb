import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { VaultEntry } from '../../../types';
import { EntryRow } from './shared';

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

export function MoodChart({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const scores = entries.map(e => (e.data.score as number) ?? 5);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
  const best = scores.length ? Math.max(...scores) : null;
  const worst = scores.length ? Math.min(...scores) : null;
  const streak7 = [...entries].reverse().slice(-7).filter(e => ((e.data.score as number) ?? 0) >= 6).length;

  // Top day of week
  const dayTotals = Array(7).fill(0) as number[];
  const dayCounts = Array(7).fill(0) as number[];
  for (const e of entries) {
    const d = new Date(e.created_at).getDay();
    dayTotals[d] += (e.data.score as number) ?? 5;
    dayCounts[d]++;
  }
  const dayAvgs = dayTotals.map((t, i) => dayCounts[i] ? t / dayCounts[i] : 0);
  const bestDay = dayAvgs.indexOf(Math.max(...dayAvgs));

  const chartData = [...entries].reverse().slice(-14).map((e) => ({
    date: new Date(e.created_at).toLocaleDateString('it-IT', { month: '2-digit', day: '2-digit' }),
    score: (e.data.score as number) ?? 5,
  }));

  return (
    <div>
      {/* KPI chips row */}
      {scores.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Media', value: `${avg}/10`, accent: color },
            { label: 'Best', value: `${best}/10`, accent: '#3aad80' },
            { label: 'Worst', value: `${worst}/10`, accent: '#c96f6f' },
            { label: 'Buoni 7g', value: `${streak7}`, accent: color },
            ...(dayCounts[bestDay] > 0 ? [{ label: 'Giorno top', value: DAYS_IT[bestDay], accent: '#b89630' }] : []),
          ].map(k => (
            <div key={k.label} style={{
              flex: '1 1 60px',
              padding: '8px 10px', borderRadius: 10,
              background: `${k.accent}10`,
              border: `1px solid ${k.accent}20`,
            }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 15, fontWeight: 200, color: k.accent, fontFamily: "'Space Mono', monospace", letterSpacing: '-0.01em' }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={chartData} barSize={8}>
          <XAxis dataKey="date" tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 10]} tick={{ fill: '#3a3f52', fontSize: 9 }} axisLine={false} tickLine={false} width={20} />
          <Tooltip
            contentStyle={{ background: 'rgba(3,3,7,0.95)', border: `1px solid ${color}20`, borderRadius: 10, backdropFilter: 'blur(20px)' }}
            labelStyle={{ color: '#6b7280', fontSize: 10 }}
            itemStyle={{ color }}
            formatter={(v: number) => [`${v}/10`, 'Umore']}
          />
          <Bar dataKey="score" fill={color} radius={[3, 3, 0, 0]} fillOpacity={0.75}
            style={{ filter: `drop-shadow(0 0 3px ${color}60)` }} />
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

export function DiaryList({ entries, color }: { entries: VaultEntry[]; color: string }) {
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
