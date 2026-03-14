import { useMemo, useId } from 'react';
import { useVisibleTransactions } from '@/hooks/useFinance';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { formatCurrency } from '@/utils/formatters';
import type { Transaction } from '@/types';

interface Props { params: Record<string, unknown> }

export const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function sumAmt(txs: Transaction[]) { return txs.reduce((s, t) => s + t.amount, 0); }

// ── SVG grouped bar chart: 6 mesi, entrate + uscite ───────────────────────────
interface BarChartProps {
  months: { label: string; inc: number; exp: number; isCurrent: boolean }[];
}

export function GroupedBarChart({ months }: BarChartProps) {
  const uid = useId().replace(/:/g, 'x');

  const W = 280; const H = 120;
  const PAD_T = 24; const PAD_B = 28; const PAD_L = 0; const PAD_R = 0;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const n = months.length;
  const colW = chartW / n;
  const barW = Math.min(14, colW * 0.28);
  const gap = 3;

  const maxVal = Math.max(...months.flatMap(m => [m.inc, m.exp]), 1);

  const toH = (v: number) => (v / maxVal) * chartH;
  const baseY = PAD_T + chartH;

  // Y-axis grid lines at 25%, 50%, 75%
  const gridVals = [0.25, 0.5, 0.75, 1].map(f => ({ f, val: maxVal * f }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="nebula-graph" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`inc-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`exp-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f87171" stopOpacity="0.4" />
        </linearGradient>
        <filter id={`glow-g-${uid}`}>
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id={`glow-r-${uid}`}>
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Grid lines */}
      {gridVals.map(({ f, val }) => {
        const y = baseY - toH(maxVal * f);
        return (
          <g key={f}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 5" />
            <text x={PAD_L} y={y - 3} fontSize="7" fill="rgba(255,255,255,0.2)" textAnchor="start">
              {val >= 1000 ? `${(val/1000).toFixed(0)}k` : val.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Baseline */}
      <line x1={PAD_L} y1={baseY} x2={W - PAD_R} y2={baseY}
        stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Bars */}
      {months.map((m, i) => {
        const cx = PAD_L + i * colW + colW / 2;
        const incX = cx - barW - gap / 2;
        const expX = cx + gap / 2;
        const incH = toH(m.inc);
        const expH = toH(m.exp);
        const net = m.inc - m.exp;

        return (
          <g key={i}>
            {/* Highlight current month */}
            {m.isCurrent && (
              <rect
                x={cx - barW - gap / 2 - 4}
                y={PAD_T - 4}
                width={barW * 2 + gap + 8}
                height={chartH + 8}
                rx="6" fill="rgba(255,255,255,0.03)"
                stroke="rgba(255,255,255,0.08)" strokeWidth="1"
              />
            )}

            {/* Income bar */}
            {m.inc > 0 && (
              <g>
                <rect
                  x={incX} y={baseY - incH} width={barW} height={incH}
                  rx="3"
                  fill={m.isCurrent ? `url(#inc-grad-${uid})` : '#34d39940'}
                  filter={m.isCurrent ? `url(#glow-g-${uid})` : undefined}
                />
                {/* Amount label above bar */}
                <text
                  x={incX + barW / 2} y={baseY - incH - 4}
                  textAnchor="middle" fontSize="7.5"
                  fill={m.isCurrent ? '#34d399' : 'rgba(52,211,153,0.6)'}
                  fontWeight={m.isCurrent ? '700' : '400'}
                >
                  {m.inc >= 1000 ? `${(m.inc/1000).toFixed(1)}k` : m.inc.toFixed(0)}
                </text>
              </g>
            )}

            {/* Expense bar */}
            {m.exp > 0 && (
              <g>
                <rect
                  x={expX} y={baseY - expH} width={barW} height={expH}
                  rx="3"
                  fill={m.isCurrent ? `url(#exp-grad-${uid})` : '#f8717140'}
                  filter={m.isCurrent ? `url(#glow-r-${uid})` : undefined}
                />
                <text
                  x={expX + barW / 2} y={baseY - expH - 4}
                  textAnchor="middle" fontSize="7.5"
                  fill={m.isCurrent ? '#f87171' : 'rgba(248,113,113,0.6)'}
                  fontWeight={m.isCurrent ? '700' : '400'}
                >
                  {m.exp >= 1000 ? `${(m.exp/1000).toFixed(1)}k` : m.exp.toFixed(0)}
                </text>
              </g>
            )}

            {/* Net badge on current month */}
            {m.isCurrent && (m.inc > 0 || m.exp > 0) && (
              <text
                x={cx} y={PAD_T - 8}
                textAnchor="middle" fontSize="8"
                fill={net >= 0 ? '#34d399' : '#f87171'}
                fontWeight="700"
              >
                {net >= 0 ? '+' : ''}{net >= 1000 || net <= -1000
                  ? `${(net/1000).toFixed(1)}k`
                  : net.toFixed(0)}
              </text>
            )}

            {/* Month label */}
            <text
              x={cx} y={H - 5}
              textAnchor="middle" fontSize="9"
              fill={m.isCurrent ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)'}
              fontWeight={m.isCurrent ? '700' : '400'}
            >
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function FinanceChartFragment(_: Props) {
  const txs = useVisibleTransactions();

  const { months, currentMonth } = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear(); const m = d.getMonth();
      const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthTxs = txs.filter(t => t.date.startsWith(prefix));
      return {
        label: MONTHS_IT[m],
        prefix,
        inc: sumAmt(monthTxs.filter(t => t.type === 'income')),
        exp: sumAmt(monthTxs.filter(t => t.type === 'expense')),
        isCurrent: prefix === currentKey,
      };
    });

    const current = months.find(m => m.isCurrent) ?? months[months.length - 1];
    return { months, currentMonth: current };
  }, [txs]);

  // Trend vs mese precedente
  const prevMonth = months[months.length - 2];
  const expDiff = prevMonth && prevMonth.exp > 0
    ? ((currentMonth.exp - prevMonth.exp) / prevMonth.exp) * 100
    : null;

  const savingsRate = currentMonth.inc > 0
    ? Math.round(((currentMonth.inc - currentMonth.exp) / currentMonth.inc) * 100)
    : null;

  return (
    <NebulaCard title="Cashflow · 6 mesi" variant="finance" closable>

      {/* KPI row */}
      <div className="fc-kpi-row">
        <div className="fc-kpi">
          <span className="fc-kpi-label">Entrate</span>
          <span className="fc-kpi-value" style={{ color: '#34d399' }}>
            {formatCurrency(currentMonth.inc)}
          </span>
        </div>
        <div className="fc-kpi-divider" />
        <div className="fc-kpi">
          <span className="fc-kpi-label">Uscite</span>
          <span className="fc-kpi-value" style={{ color: '#f87171' }}>
            {formatCurrency(currentMonth.exp)}
          </span>
        </div>
        <div className="fc-kpi-divider" />
        <div className="fc-kpi">
          <span className="fc-kpi-label">Saldo</span>
          <span className="fc-kpi-value" style={{ color: currentMonth.inc - currentMonth.exp >= 0 ? '#34d399' : '#f87171' }}>
            {formatCurrency(currentMonth.inc - currentMonth.exp)}
          </span>
        </div>
        {savingsRate !== null && (
          <>
            <div className="fc-kpi-divider" />
            <div className="fc-kpi">
              <span className="fc-kpi-label">Risparmio</span>
              <span className="fc-kpi-value" style={{ color: savingsRate >= 0 ? '#34d399' : '#f87171' }}>
                {savingsRate}%
              </span>
            </div>
          </>
        )}
      </div>

      {/* Trend badge */}
      {expDiff !== null && (
        <div className="fc-trend">
          <span className="fc-trend-badge" style={{ color: expDiff > 0 ? '#f87171' : '#34d399' }}>
            {expDiff > 0 ? '↑' : '↓'} {Math.abs(expDiff).toFixed(0)}% uscite
          </span>
          <span className="fc-trend-label">vs {prevMonth.label}</span>
        </div>
      )}

      {/* Legend */}
      <div className="fc-legend">
        <span className="fc-legend-item">
          <span className="fc-legend-dot" style={{ background: '#34d399' }} />
          Entrate
        </span>
        <span className="fc-legend-item">
          <span className="fc-legend-dot" style={{ background: '#f87171' }} />
          Uscite
        </span>
        <span className="fc-legend-note">mese evidenziato = corrente</span>
      </div>

      {/* Chart */}
      <div className="fc-chart-wrap" style={{ marginTop: '0.5rem' }}>
        <GroupedBarChart months={months} />
      </div>

    </NebulaCard>
  );
}
