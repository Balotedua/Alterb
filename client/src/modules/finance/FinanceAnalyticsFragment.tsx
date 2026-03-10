import { useState, useMemo, useId } from 'react';
import { useTransactions } from '@/hooks/useFinance';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { NebulaGraph } from '@/components/ui/nebula/NebulaGraph';
import { formatCurrency } from '@/utils/formatters';
import type { Transaction } from '@/types';

interface Props { params: Record<string, unknown> }

const DAYS_IT   = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function sumAmt(txs: Transaction[]) { return txs.reduce((s, t) => s + t.amount, 0); }
function byType(txs: Transaction[], type: 'expense' | 'income') {
  return txs.filter((t) => t.type === type);
}

// ── Horizontal pill bar ───────────────────────────────────────────────────────
function HBar({
  label, value, max, color, highlight, delay = 0,
}: {
  label: string; value: number; max: number; color: string; highlight: boolean; delay?: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="hbar-row">
      <span className="hbar-label">{label}</span>
      <div className="hbar-track">
        <div
          className="hbar-fill"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: highlight ? `0 0 10px ${color}70` : 'none',
            animationDelay: `${delay}ms`,
          }}
        />
      </div>
      <span className="hbar-value" style={{ color: highlight ? color : undefined }}>
        {value > 0 ? formatCurrency(value) : '—'}
      </span>
    </div>
  );
}

// ── Dual line SVG (income vs expenses, 6 months) ──────────────────────────────
interface DualLineProps {
  expData: number[];
  incData: number[];
  labels: string[];
}

function smoothBezier(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  const d: string[] = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`];
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const cpX = ((px + cx) / 2).toFixed(1);
    d.push(`C ${cpX} ${py.toFixed(1)}, ${cpX} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`);
  }
  return d.join(' ');
}

function DualLineChart({ expData, incData, labels }: DualLineProps) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, 'x');

  const W = 240; const H = 90;
  const PAD_T = 8; const PAD_B = 22; const PAD_H = 0;
  const chartH = H - PAD_T - PAD_B;
  const chartW = W - PAD_H * 2;
  const n = expData.length;
  const step = n > 1 ? chartW / (n - 1) : chartW;
  const max = Math.max(...expData, ...incData, 1);

  const toPts = (arr: number[]): [number, number][] =>
    arr.map((v, i) => [PAD_H + i * step, PAD_T + chartH - (v / max) * chartH]);

  const expPts = toPts(expData);
  const incPts = toPts(incData);

  const expPath = smoothBezier(expPts);
  const incPath = smoothBezier(incPts);

  const expArea = `${expPath} L ${expPts[n-1][0]} ${H - PAD_B} L ${expPts[0][0]} ${H - PAD_B} Z`;
  const incArea = `${incPath} L ${incPts[n-1][0]} ${H - PAD_B} L ${incPts[0][0]} ${H - PAD_B} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="nebula-graph" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`dl-exp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`dl-inc-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
        <filter id={`dl-glow-r-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id={`dl-glow-g-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <clipPath id={`dl-clip-${uid}`}>
          <rect x="0" y="0" width="0" height={H}>
            <animate attributeName="width" from="0" to={W} dur="0.85s"
              calcMode="spline" keySplines="0.4 0 0.2 1" fill="freeze" />
          </rect>
        </clipPath>
      </defs>

      {/* Grid */}
      {[0.33, 0.66].map((f, i) => (
        <line key={i}
          x1={PAD_H} y1={PAD_T + chartH * (1 - f)}
          x2={W - PAD_H} y2={PAD_T + chartH * (1 - f)}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 5"
        />
      ))}

      {/* Baseline */}
      <line x1={PAD_H} y1={H - PAD_B} x2={W - PAD_H} y2={H - PAD_B}
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      <g clipPath={`url(#dl-clip-${uid})`}>
        <path d={expArea} fill={`url(#dl-exp-${uid})`} />
        <path d={incArea} fill={`url(#dl-inc-${uid})`} />
        <path d={expPath} fill="none" stroke="#f87171" strokeWidth="1.6"
          strokeLinejoin="round" strokeLinecap="round" filter={`url(#dl-glow-r-${uid})`} />
        <path d={incPath} fill="none" stroke="#34d399" strokeWidth="1.6"
          strokeLinejoin="round" strokeLinecap="round" filter={`url(#dl-glow-g-${uid})`} />
      </g>

      {/* Month labels */}
      {labels.map((lbl, i) => (
        <text key={i}
          x={PAD_H + i * step}
          y={H - 5}
          textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          fontSize="7.5" fill="rgba(255,255,255,0.3)"
        >
          {lbl}
        </text>
      ))}

      {/* Dots at last point */}
      {[expPts[n-1], incPts[n-1]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3"
          fill={i === 0 ? '#f87171' : '#34d399'}
          filter={`url(${i === 0 ? `#dl-glow-r-${uid}` : `#dl-glow-g-${uid}`})`}
        >
          <animate attributeName="opacity" from="0" to="1" begin="0.8s" dur="0.2s" fill="freeze" />
        </circle>
      ))}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Tab = '7g' | 'dow' | '6m';

export function FinanceAnalyticsFragment(_: Props) {
  const { data: txs = [] } = useTransactions();
  const [tab, setTab] = useState<Tab>('7g');

  // ── 7-day data ──────────────────────────────────────────────────────────────
  const week7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split('T')[0];
      const label = DAYS_IT[d.getDay()];
      const val = sumAmt(byType(txs.filter((t) => t.date === key), 'expense'));
      return { label, value: val };
    });
  }, [txs]);

  // ── Day-of-week averages ─────────────────────────────────────────────────────
  const dowData = useMemo(() => {
    const totals = Array(7).fill(0);
    const counts = Array(7).fill(0);
    for (const t of byType(txs, 'expense')) {
      const dow = new Date(t.date + 'T00:00:00').getDay();
      totals[dow] += t.amount; counts[dow]++;
    }
    const order = [1,2,3,4,5,6,0]; // Mon→Sun
    return order.map((d) => ({
      label: DAYS_IT[d],
      value: counts[d] > 0 ? totals[d] / counts[d] : 0,
    }));
  }, [txs]);

  // ── 6-month dual line ────────────────────────────────────────────────────────
  const months6 = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i), 1);
      const y = d.getFullYear(); const m = d.getMonth();
      const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthTxs = txs.filter((t) => t.date.startsWith(prefix));
      return {
        label: MONTHS_IT[m],
        exp: sumAmt(byType(monthTxs, 'expense')),
        inc: sumAmt(byType(monthTxs, 'income')),
      };
    });
  }, [txs]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const { totalExp, totalInc, avgDay, savings } = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    const thisMonth = txs.filter((t) => t.date.startsWith(prefix));
    const exp = sumAmt(byType(thisMonth, 'expense'));
    const inc = sumAmt(byType(thisMonth, 'income'));
    const daysIn = new Date().getDate();
    return { totalExp: exp, totalInc: inc, avgDay: daysIn > 0 ? exp / daysIn : 0, savings: inc - exp };
  }, [txs]);

  // ── Insights ────────────────────────────────────────────────────────────────
  const w7Total  = week7.reduce((s, b) => s + b.value, 0);
  const w7Peak   = week7.reduce((a, b) => b.value > a.value ? b : a, week7[0]);
  const dowMax   = dowData.reduce((a, b) => b.value > a.value ? b : a, dowData[0]);
  const dowMin   = dowData.filter((b) => b.value > 0).reduce(
    (a, b) => b.value < a.value ? b : a,
    dowData.find((b) => b.value > 0) ?? dowData[0],
  );
  const dowMaxVal = Math.max(...dowData.map((b) => b.value), 1);

  const TABS: { id: Tab; label: string }[] = [
    { id: '7g',  label: '7 giorni' },
    { id: 'dow', label: 'Settimana' },
    { id: '6m',  label: '6 mesi' },
  ];

  return (
    <NebulaCard title="Analisi spese" variant="finance" closable>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="an-kpi-strip">
        <div className="an-kpi">
          <span className="an-kpi-val" style={{ color: '#f87171' }}>{formatCurrency(totalExp)}</span>
          <span className="an-kpi-lbl">Uscite</span>
        </div>
        <div className="an-kpi-sep" />
        <div className="an-kpi">
          <span className="an-kpi-val" style={{ color: '#34d399' }}>{formatCurrency(totalInc)}</span>
          <span className="an-kpi-lbl">Entrate</span>
        </div>
        <div className="an-kpi-sep" />
        <div className="an-kpi">
          <span className="an-kpi-val" style={{ color: '#818cf8' }}>{formatCurrency(avgDay)}</span>
          <span className="an-kpi-lbl">Media/gg</span>
        </div>
        <div className="an-kpi-sep" />
        <div className="an-kpi">
          <span className="an-kpi-val" style={{ color: savings >= 0 ? '#34d399' : '#f87171' }}>
            {savings >= 0 ? '+' : ''}{formatCurrency(savings)}
          </span>
          <span className="an-kpi-lbl">Risparmio</span>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="an-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`an-tab ${tab === t.id ? 'an-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: 7 giorni ─────────────────────────────────────────────────── */}
      {tab === '7g' && (
        <div className="an-panel">
          <div className="an-insight">
            <span className="an-insight-dot" style={{ background: '#f87171' }} />
            Picco&nbsp;<strong>{w7Peak?.label}</strong>&nbsp;
            <span style={{ color: '#f87171' }}>{formatCurrency(w7Peak?.value ?? 0)}</span>
            <span className="an-insight-sep">·</span>
            7gg&nbsp;<strong style={{ color: '#f0edff' }}>{formatCurrency(w7Total)}</strong>
          </div>
          <NebulaGraph
            data={week7.map((b) => b.value)}
            xLabels={week7.map((b) => b.label)}
            color="#f87171"
            height={80}
            showDots
            showGrid
            animated
          />
        </div>
      )}

      {/* ── Tab: Giorno della settimana ────────────────────────────────────── */}
      {tab === 'dow' && (
        <div className="an-panel">
          <div className="an-insight">
            <span className="an-insight-dot" style={{ background: '#a78bfa' }} />
            Spendi di più il <strong>{dowMax?.label}</strong>
            {dowMin && dowMin.label !== dowMax?.label && (
              <>, di meno il <strong>{dowMin.label}</strong></>
            )}
          </div>
          <div className="hbar-list">
            {dowData.map((b, i) => (
              <HBar
                key={b.label}
                label={b.label}
                value={b.value}
                max={dowMaxVal}
                color="#a78bfa"
                highlight={b.label === dowMax?.label}
                delay={i * 50}
              />
            ))}
          </div>
          <p className="an-note">Media storica spesa per giorno della settimana</p>
        </div>
      )}

      {/* ── Tab: 6 mesi ───────────────────────────────────────────────────── */}
      {tab === '6m' && (
        <div className="an-panel">
          {/* Legend */}
          <div className="an-legend">
            <span className="an-legend-item">
              <span className="an-legend-dot" style={{ background: '#f87171' }} />
              Uscite
            </span>
            <span className="an-legend-item">
              <span className="an-legend-dot" style={{ background: '#34d399' }} />
              Entrate
            </span>
          </div>

          <DualLineChart
            expData={months6.map((m) => m.exp)}
            incData={months6.map((m) => m.inc)}
            labels={months6.map((m) => m.label)}
          />

          {/* Month summary row */}
          <div className="an-month-strip">
            {months6.map((m, i) => (
              <div key={i} className="an-month-cell">
                <span className="an-month-name">{m.label}</span>
                <span className="an-month-exp">{m.exp > 0 ? formatCurrency(m.exp) : '—'}</span>
                <span className="an-month-inc">{m.inc > 0 ? `+${formatCurrency(m.inc)}` : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </NebulaCard>
  );
}
