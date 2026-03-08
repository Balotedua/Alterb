import { useMonthlyStats } from '@/hooks/useFinance';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export function FinanceChart() {
  const { monthlyData } = useMonthlyStats();

  const labels = monthlyData.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Entrate',
        data: monthlyData.map(d => d.income),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.08)',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
      {
        label: 'Uscite',
        data: monthlyData.map(d => d.expenses),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.08)',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` €${ctx.parsed.y.toFixed(2)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#6b7280',
          font: { size: 11 },
          callback: (v: any) => `€${v}`,
        },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#6b7280',
          font: { size: 11 },
          maxTicksLimit: 8,
        },
        border: { display: false },
      },
    },
  };

  return (
    <div className="fin-card">
      <div className="fin-card-title">
        Andamento 30 giorni
        <div className="fin-chart-legend">
          <span className="fin-legend-label">
            <span className="fin-legend-dot" style={{ background: '#22c55e' }} />
            Entrate
          </span>
          <span className="fin-legend-label">
            <span className="fin-legend-dot" style={{ background: '#ef4444' }} />
            Uscite
          </span>
        </div>
      </div>
      <div className="fin-chart-wrap">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
