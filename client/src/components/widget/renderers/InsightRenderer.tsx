import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { VaultEntry } from '../../../types';

export function NebulaInsight({ entries, color }: { entries: VaultEntry[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
        Scoperte autonome · mentre non eri qui
      </div>
      {entries.slice(0, 5).map((entry, i) => {
        const title = (entry.data.title as string) ?? 'Insight';
        const text  = (entry.data.insight as string) ?? '';
        const cats  = (entry.data.categories as string[]) ?? [];
        const date  = new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
        return (
          <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.022)', borderLeft: `2px solid ${color}40` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color, fontWeight: 500 }}>{title}</span>
              <span style={{ fontSize: 9, color: '#3a3f52' }}>{date}</span>
            </div>
            <div style={{ fontSize: 12, color: '#b0bcd4', lineHeight: 1.65, fontWeight: 300 }}>{text}</div>
            {cats.length > 0 && (
              <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cats.map(c => (
                  <span key={c} style={{ fontSize: 9, color, opacity: 0.55, letterSpacing: '0.08em' }}>#{c}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NexusView({ entries }: { entries: VaultEntry[] }) {
  const d = entries[0]?.data ?? {};
  const catALabel   = (d.catALabel   as string) ?? 'A';
  const catBLabel   = (d.catBLabel   as string) ?? 'B';
  const colorA      = (d.colorA      as string) ?? '#f0c040';
  const colorB      = (d.colorB      as string) ?? '#a78bfa';
  const correlation = (d.correlation as number) ?? 0;
  const chartData   = (d.chartData   as Array<Record<string, unknown>>) ?? [];
  const catA        = (d.catA as string) ?? 'a';
  const catB        = (d.catB as string) ?? 'b';

  const corrAbs  = Math.abs(correlation);
  const corrPct  = (corrAbs * 100).toFixed(0);
  const corrSign = correlation > 0.25 ? 'positiva' : correlation < -0.25 ? 'inversa' : 'debole';
  const corrClr  = corrAbs > 0.5 ? '#a78bfa' : corrAbs > 0.25 ? '#f0c040' : '#4b5268';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        padding: '10px 14px', borderRadius: 10,
        background: `linear-gradient(135deg, ${colorA}08, ${colorB}08)`,
        border: `1px solid ${corrClr}20`,
      }}>
        <span style={{ fontSize: 11, color: colorA, fontWeight: 500 }}>{catALabel}</span>
        <span style={{ fontSize: 10, color: '#3a3f52', flex: 1, textAlign: 'center' }}>↔</span>
        <span style={{ fontSize: 11, color: colorB, fontWeight: 500 }}>{catBLabel}</span>
        <div style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 20, background: `${corrClr}18`, border: `1px solid ${corrClr}30`, fontSize: 10, color: corrClr, letterSpacing: '0.05em' }}>
          {corrSign} {corrPct}%
        </div>
      </div>
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
              contentStyle={{ background: 'rgba(3,3,7,0.97)', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 10, backdropFilter: 'blur(20px)' }}
              labelStyle={{ color: '#6b7280', fontSize: 10 }}
              formatter={(v: number, name: string) => [`${v.toFixed(0)}%`, name]}
            />
            <Area type="monotone" dataKey={catA} name={catALabel} stroke={colorA} strokeWidth={1.5} fill="url(#ngA)" dot={false} />
            <Area type="monotone" dataKey={catB} name={catBLabel} stroke={colorB} strokeWidth={1.5} fill="url(#ngB)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.018)', borderLeft: `2px solid ${corrClr}40`, fontSize: 10, color: '#6b7280', lineHeight: 1.6 }}>
        {corrAbs > 0.5
          ? `Correlazione forte: quando ${catALabel} aumenta, ${catBLabel} tende ${correlation > 0 ? 'ad aumentare' : 'a diminuire'} nello stesso periodo.`
          : corrAbs > 0.2
            ? `Correlazione moderata rilevata. Monitora entrambe le variabili per confermare il pattern.`
            : `Nessuna correlazione significativa trovata. Le due variabili sembrano indipendenti.`}
      </div>
    </div>
  );
}
