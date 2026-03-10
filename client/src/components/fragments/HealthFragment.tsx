import { motion } from 'framer-motion';
import { useSleepEntries, useBodyVitals, useWaterLog, WATER_GOAL } from '@/hooks/useHealth';

const fragmentAnim = {
  initial:    { opacity: 0, scale: 0.93, y: 16 },
  animate:    { opacity: 1, scale: 1,    y: 0   },
  exit:       { opacity: 0, scale: 0.96, y: 10  },
  transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

const QUALITY_LABEL = ['', '😴 Pessimo', '😪 Scarso', '😐 Medio', '😊 Buono', '✨ Ottimo'];

export function HealthFragment() {
  const { data: sleep } = useSleepEntries();
  const { data: vitals } = useBodyVitals();
  const { todayGlasses } = useWaterLog();

  const lastSleep = sleep?.[0];
  const lastVital = vitals?.[0];
  const sleepH = lastSleep ? (lastSleep.duration_minutes / 60).toFixed(1) : null;

  return (
    <motion.div className="fragment" {...fragmentAnim}>
      <div className="fragment-header">
        <span className="fragment-icon">💚</span>
        <span className="fragment-title">Salute</span>
      </div>

      <div className="fragment-kpis">
        {lastSleep && (
          <div className="fragment-kpi">
            <span className="fragment-kpi-label">Ultimo sonno</span>
            <span className="fragment-kpi-value">{sleepH}h</span>
            <span className="fragment-kpi-sub">{QUALITY_LABEL[lastSleep.quality]}</span>
          </div>
        )}
        {lastVital?.weight_kg && (
          <div className="fragment-kpi">
            <span className="fragment-kpi-label">Peso</span>
            <span className="fragment-kpi-value">{lastVital.weight_kg} kg</span>
          </div>
        )}
        <div className="fragment-kpi">
          <span className="fragment-kpi-label">Acqua oggi</span>
          <span className="fragment-kpi-value">{todayGlasses} / {WATER_GOAL} 💧</span>
        </div>
      </div>

      {!lastSleep && !lastVital && (
        <p className="fragment-empty">Nessun dato di salute ancora. Inizia a tracciare!</p>
      )}
    </motion.div>
  );
}
