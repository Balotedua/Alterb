import { useMemo } from 'react';
import { useMonthlyStats, useTransactions } from '@/hooks/useFinance';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { NebulaGraph } from '@/components/ui/nebula/NebulaGraph';
import { formatCurrency } from '@/utils/formatters';
import type { Transaction } from '@/types';

interface Props {
  params: Record<string, unknown>;
}

function sum(txs: Transaction[]) {
  return txs.reduce((s, t) => s + t.amount, 0);
}

export function FinanceChartFragment({ params }: Props) {
  const days   = typeof params.days === 'number' ? Math.min(params.days, 30) : 14;
  const metric = (params.metric as string) || 'expenses';
  const { income, expenses, balance } = useMonthlyStats();
  const { data: txs = [] } = useTransactions();

  const { chartData, xLabels, trend } = useMemo(() => {
    const today = new Date();
    const slots = Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().split('T')[0];
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const dayTxs = txs.filter((t) => t.date === key);
      const inc = sum(dayTxs.filter((t) => t.type === 'income'));
      const exp = sum(dayTxs.filter((t) => t.type === 'expense'));
      return { key, label, inc, exp };
    });

    const data = slots.map((s) =>
      metric === 'income' ? s.inc : metric === 'both' ? s.inc - s.exp : s.exp
    );
    const labels = slots.map((s) => s.label);

    // Trend: compare last half vs first half
    const half = Math.floor(days / 2);
    const firstHalf = data.slice(0, half).reduce((a, b) => a + b, 0);
    const secondHalf = data.slice(half).reduce((a, b) => a + b, 0);
    const trendPct =
      firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    return { chartData: data, xLabels: labels, trend: trendPct };
  }, [txs, days, metric]);

  const color =
    metric === 'income' ? '#34d399' : metric === 'both' ? '#818cf8' : '#f87171';
  const label =
    metric === 'income' ? 'Entrate' : metric === 'both' ? 'Flusso netto' : 'Uscite';

  const trendUp = trend >= 0;
  const trendIcon = metric === 'expenses'
    ? (trendUp ? '↑' : '↓')   // for expenses: up = bad, down = good
    : (trendUp ? '↑' : '↓');
  const trendColor =
    metric === 'expenses'
      ? trendUp ? '#f87171' : '#34d399'
      : trendUp ? '#34d399' : '#f87171';

  return (
    <NebulaCard title={`${label} · ultimi ${days}gg`} variant="finance" closable>
      {/* KPI row */}
      <div className="fc-kpi-row">
        <div className="fc-kpi">
          <span className="fc-kpi-label">Entrate mese</span>
          <span className="fc-kpi-value" style={{ color: '#34d399' }}>
            {formatCurrency(income)}
          </span>
        </div>
        <div className="fc-kpi-divider" />
        <div className="fc-kpi">
          <span className="fc-kpi-label">Uscite mese</span>
          <span className="fc-kpi-value" style={{ color: '#f87171' }}>
            {formatCurrency(expenses)}
          </span>
        </div>
        <div className="fc-kpi-divider" />
        <div className="fc-kpi">
          <span className="fc-kpi-label">Saldo</span>
          <span className="fc-kpi-value" style={{ color: balance >= 0 ? '#34d399' : '#f87171' }}>
            {formatCurrency(balance)}
          </span>
        </div>
      </div>

      {/* Trend badge */}
      <div className="fc-trend">
        <span className="fc-trend-badge" style={{ color: trendColor }}>
          {trendIcon} {Math.abs(trend).toFixed(1)}%
        </span>
        <span className="fc-trend-label">vs periodo precedente</span>
      </div>

      {/* Chart */}
      <div className="fc-chart-wrap">
        <NebulaGraph
          data={chartData}
          color={color}
          height={72}
          showDots
          showGrid
          animated
          xLabels={xLabels}
        />
      </div>
    </NebulaCard>
  );
}
