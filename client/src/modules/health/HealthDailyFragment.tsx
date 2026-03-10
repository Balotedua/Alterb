import { useState } from 'react';
import { NebulaCard } from '@/components/ui/nebula';
import { useDailyHealthLogs, useHealthGoals, useLogMetric, getGoalAmount } from '@/hooks/useHealthProfile';
import { useWaterLog } from '@/hooks/useHealth';
import { useSleepEntries } from '@/hooks/useHealth';
import type { HealthLogKey } from '@/types/health';

interface Props {
  params: Record<string, unknown>;
}

const LOG_KEY_LABELS: Record<string, string> = {
  steps:           'passi',
  calories_burned: 'kcal bruciate',
  calories_in:     'kcal assunte',
  water_ml:        'ml acqua',
  sleep_minutes:   'min sonno',
  weight_kg:       'kg peso',
  body_fat_pct:    '% grasso',
};

const METRIC_BAR_COLOR: Record<string, string> = {
  steps:           '#34d399',
  water_ml:        '#60a5fa',
  sleep_minutes:   '#a78bfa',
  calories_burned: '#fb923c',
};

export function HealthDailyFragment({ params }: Props) {
  const logKey    = typeof params.logKey    === 'string' ? params.logKey    : null;
  const logAmount = typeof params.logAmount === 'number' ? params.logAmount : null;

  const { data: logs = [] }  = useDailyHealthLogs();
  const { data: goals = [] } = useHealthGoals();
  const { todayGlasses, addGlass } = useWaterLog();
  const { data: sleepEntries = [] } = useSleepEntries();
  const logMetric = useLogMetric();

  const [ctaDone, setCtaDone] = useState(false);

  const getLog = (key: HealthLogKey) => logs.find((l) => l.key === key)?.value.amount ?? 0;

  const steps          = getLog('steps');
  const caloriesBurned = getLog('calories_burned');

  const stepsTarget    = getGoalAmount(goals, 'steps_target');
  const waterTarget    = getGoalAmount(goals, 'water_ml_target');
  const sleepTarget    = getGoalAmount(goals, 'sleep_minutes_target');
  const calTarget      = getGoalAmount(goals, 'calories_target');

  const waterGlassTarget = Math.round(waterTarget / 250);
  const lastSleep        = sleepEntries[0]?.duration_minutes ?? 0;

  const pct = (val: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0;

  const metrics: {
    label: string;
    value: string;
    target: string;
    pctVal: number;
    color: string;
    done: boolean;
  }[] = [
    {
      label:  '🦶 Passi',
      value:  steps.toLocaleString('it'),
      target: `/ ${stepsTarget.toLocaleString('it')}`,
      pctVal: pct(steps, stepsTarget),
      color:  METRIC_BAR_COLOR.steps,
      done:   steps >= stepsTarget,
    },
    {
      label:  '💧 Acqua',
      value:  `${todayGlasses} bicchieri`,
      target: `/ ${waterGlassTarget}`,
      pctVal: pct(todayGlasses, waterGlassTarget),
      color:  METRIC_BAR_COLOR.water_ml,
      done:   todayGlasses >= waterGlassTarget,
    },
    {
      label:  '🌙 Sonno',
      value:  lastSleep ? `${(lastSleep / 60).toFixed(1)}h` : '—',
      target: `/ ${(sleepTarget / 60).toFixed(1)}h`,
      pctVal: pct(lastSleep, sleepTarget),
      color:  METRIC_BAR_COLOR.sleep_minutes,
      done:   lastSleep >= sleepTarget,
    },
    {
      label:  '🔥 Calorie bruciate',
      value:  caloriesBurned.toLocaleString('it') + ' kcal',
      target: `/ ${calTarget.toLocaleString('it')}`,
      pctVal: pct(caloriesBurned, calTarget),
      color:  METRIC_BAR_COLOR.calories_burned,
      done:   caloriesBurned >= calTarget,
    },
  ];

  const handleCtaLog = async () => {
    if (!logKey || logAmount === null) return;
    const categoryMap: Record<string, 'activity' | 'nutrition' | 'hydration' | 'sleep' | 'biometric'> = {
      steps:           'activity',
      calories_burned: 'nutrition',
      calories_in:     'nutrition',
      water_ml:        'hydration',
      sleep_minutes:   'sleep',
      weight_kg:       'biometric',
      body_fat_pct:    'biometric',
    };
    await logMetric.mutateAsync({
      category: categoryMap[logKey] ?? 'activity',
      key:      logKey as HealthLogKey,
      amount:   logAmount,
      mode:     'add',
    });
    setCtaDone(true);
  };

  return (
    <NebulaCard icon="📊" title="Oggi · riepilogo" variant="health" closable>
      {/* CTA for params-driven quick log */}
      {logKey && logAmount !== null && !ctaDone && (
        <div className="health-daily-cta">
          <span className="health-daily-cta-text">
            Registra {logAmount.toLocaleString('it')} {LOG_KEY_LABELS[logKey] ?? logKey}?
          </span>
          <button
            className="health-daily-cta-btn"
            onClick={handleCtaLog}
            disabled={logMetric.isPending}
          >
            {logMetric.isPending ? '…' : 'Registra'}
          </button>
        </div>
      )}

      {logKey && ctaDone && (
        <div className="health-daily-cta" style={{ justifyContent: 'center' }}>
          <span style={{ color: '#6ee7b7', fontSize: '0.82rem' }}>✓ Registrato!</span>
        </div>
      )}

      {/* Metrics list */}
      <div className="health-daily-metrics">
        {metrics.map((m) => (
          <div key={m.label} className="health-daily-metric">
            <div className="health-daily-metric-row">
              <span className="health-daily-metric-label">{m.label}</span>
              <span>
                <span className="health-daily-metric-value">{m.value}</span>
                <span className="health-daily-metric-target"> {m.target}</span>
                <span style={{ marginLeft: '0.3rem', fontSize: '0.68rem', color: m.done ? '#6ee7b7' : 'rgba(255,255,255,0.3)' }}>
                  {m.done ? '✓' : `${m.pctVal}%`}
                </span>
              </span>
            </div>
            <div className="health-daily-bar-track">
              <div
                className="health-daily-bar-fill"
                style={{ width: `${m.pctVal}%`, background: m.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="health-daily-actions">
        <button
          className="health-daily-action-btn"
          onClick={() =>
            logMetric.mutate({ category: 'activity', key: 'steps', amount: 1000, mode: 'add' })
          }
          disabled={logMetric.isPending}
        >
          ＋ 1.000 passi
        </button>
        <button
          className="health-daily-action-btn"
          onClick={addGlass}
        >
          ＋ Bicchiere
        </button>
        <button
          className="health-daily-action-btn"
          onClick={() =>
            logMetric.mutate({ category: 'nutrition', key: 'calories_burned', amount: 100, mode: 'add' })
          }
          disabled={logMetric.isPending}
        >
          ＋ 100 kcal
        </button>
      </div>
    </NebulaCard>
  );
}
