import { motion } from 'framer-motion';
import { Weight, Ruler, Activity, Moon } from 'lucide-react';
import type { BodyVital, SleepEntry } from '@/types';

interface VitalSignsProps {
  vitals: BodyVital[];
  sleepEntries: SleepEntry[];
}

function computeBMI(weight?: number, height?: number): number | null {
  if (!weight || !height || height === 0) return null;
  return weight / Math.pow(height / 100, 2);
}

function avgSleepHours(entries: SleepEntry[]): number | null {
  const last7 = entries.slice(0, 7);
  if (last7.length === 0) return null;
  const total = last7.reduce((s, e) => s + e.duration_minutes, 0);
  return total / last7.length / 60;
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: { value: string; positive: boolean } | null;
  delay: number;
  accent?: string;
}

function KpiCard({ icon, label, value, sub, trend, delay, accent }: KpiCardProps) {
  return (
    <motion.div
      className="h-kpi-card"
      style={{ '--h-kpi-accent': accent } as React.CSSProperties}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      <div className="h-kpi-icon">{icon}</div>
      <div className="h-kpi-label">{label}</div>
      <div className="h-kpi-value">{value}</div>
      {sub && <div className="h-kpi-sub">{sub}</div>}
      {trend && (
        <span className={`h-kpi-badge ${trend.positive ? 'positive' : 'negative'}`}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </span>
      )}
    </motion.div>
  );
}

export function VitalSigns({ vitals, sleepEntries }: VitalSignsProps) {
  const latest = vitals[0];
  const previous = vitals[1];

  const weight = latest?.weight_kg;
  const prevWeight = previous?.weight_kg;
  const weightTrend =
    weight && prevWeight
      ? {
          value: `${Math.abs(weight - prevWeight).toFixed(1)} kg`,
          positive: weight < prevWeight,
        }
      : null;

  // Find latest height (may not be in every entry)
  const latestHeight = vitals.find((v) => v.height_cm)?.height_cm;
  const bmi = computeBMI(weight, latestHeight);

  const sleepAvg = avgSleepHours(sleepEntries);

  function bmiBadge(): { label: string; ok: boolean } | null {
    if (!bmi) return null;
    if (bmi < 18.5) return { label: 'Sottopeso', ok: false };
    if (bmi < 25) return { label: 'Normale', ok: true };
    if (bmi < 30) return { label: 'Sovrappeso', ok: false };
    return { label: 'Obeso', ok: false };
  }

  const bmiInfo = bmiBadge();

  return (
    <div className="h-vitals-row">
      <KpiCard
        icon={<Weight size={20} />}
        label="Peso"
        value={weight ? `${weight.toFixed(1)} kg` : '—'}
        sub={latest?.date ? `Aggiornato ${latest.date}` : 'Nessun dato'}
        trend={weightTrend}
        delay={0}
        accent="var(--accent)"
      />
      <KpiCard
        icon={<Ruler size={20} />}
        label="Altezza"
        value={latestHeight ? `${latestHeight} cm` : '—'}
        sub="Parametro corporeo"
        delay={0.06}
        accent="#8b5cf6"
      />
      <KpiCard
        icon={<Activity size={20} />}
        label="BMI"
        value={bmi ? bmi.toFixed(1) : '—'}
        sub={bmiInfo?.label ?? 'Inserisci peso e altezza'}
        trend={
          bmiInfo
            ? { value: bmiInfo.label, positive: bmiInfo.ok }
            : null
        }
        delay={0.12}
        accent={bmiInfo?.ok ? '#22c55e' : '#f59e0b'}
      />
      <KpiCard
        icon={<Moon size={20} />}
        label="Sonno medio"
        value={sleepAvg ? `${sleepAvg.toFixed(1)}h` : '—'}
        sub="Ultimi 7 giorni"
        trend={
          sleepAvg
            ? { value: sleepAvg >= 7 ? 'Ottimo' : 'Scarso', positive: sleepAvg >= 7 }
            : null
        }
        delay={0.18}
        accent="#06b6d4"
      />
    </div>
  );
}
