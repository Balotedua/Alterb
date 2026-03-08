import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';
import type { BodyVital } from '@/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface BodyChartProps {
  vitals: BodyVital[];
}

export function BodyChart({ vitals }: BodyChartProps) {
  const weightData = useMemo(
    () =>
      [...vitals]
        .filter((v) => v.weight_kg !== undefined)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30),
    [vitals]
  );

  const labels = weightData.map((v) => {
    const d = new Date(v.date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const weights = weightData.map((v) => v.weight_kg as number);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Peso (kg)',
        data: weights,
        borderColor: 'var(--accent)',
        backgroundColor: 'rgba(0, 102, 255, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: 'var(--accent)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        titleColor: '#fff',
        bodyColor: 'rgba(255,255,255,0.8)',
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx) => `${(ctx.parsed.y ?? 0).toFixed(1)} kg`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: 'var(--text-muted)' as string,
          font: { size: 11 },
          maxTicksLimit: 8,
        },
      },
      y: {
        grid: {
          color: 'rgba(128,128,128,0.1)',
          lineWidth: 1,
        },
        border: { display: false, dash: [4, 4] },
        ticks: {
          color: 'var(--text-muted)' as string,
          font: { size: 11 },
          maxTicksLimit: 5,
          callback: (val) => `${val} kg`,
        },
      },
    },
    interaction: { mode: 'index', intersect: false },
  };

  const isEmpty = weightData.length < 2;

  return (
    <motion.div
      className="h-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
    >
      <div className="h-card-header">
        <div className="h-card-header-left">
          <TrendingUp size={16} className="h-card-icon" />
          <span className="h-card-title">Andamento Peso</span>
        </div>
        <span className="h-card-meta">
          {weightData.length > 0 ? `${weightData.length} misurazioni` : 'Nessun dato'}
        </span>
      </div>

      {isEmpty ? (
        <div className="h-chart-empty">
          <p>Registra almeno 2 pesate per vedere il grafico</p>
        </div>
      ) : (
        <div className="h-chart-wrap">
          <Line data={chartData} options={options} />
        </div>
      )}
    </motion.div>
  );
}
