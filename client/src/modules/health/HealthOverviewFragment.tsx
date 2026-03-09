import { useSleepEntries, useBodyVitals, useWaterLog, WATER_GOAL } from '@/hooks/useHealth';
import { NebulaCard, NebulaStat } from '@/components/ui/nebula';

interface Props {
  params: Record<string, unknown>;
}

const QUALITY_LABEL: Record<number, string> = {
  1: 'Pessimo', 2: 'Scarso', 3: 'Medio', 4: 'Buono', 5: 'Ottimo',
};

export function HealthOverviewFragment({ params: _ }: Props) {
  const { data: sleep  } = useSleepEntries();
  const { data: vitals } = useBodyVitals();
  const { todayGlasses } = useWaterLog();

  const lastSleep = sleep?.[0];
  const lastVital = vitals?.[0];
  const sleepH    = lastSleep ? (lastSleep.duration_minutes / 60).toFixed(1) : null;

  const hasData = lastSleep || lastVital;

  return (
    <NebulaCard icon="💚" title="Salute · panoramica">
      {hasData ? (
        <div className="fragment-kpis">
          {sleepH && (
            <NebulaStat
              label="Ultimo sonno"
              value={`${sleepH}h`}
              color="blue"
              sub={QUALITY_LABEL[lastSleep!.quality]}
            />
          )}
          {lastVital?.weight_kg && (
            <NebulaStat label="Peso" value={`${lastVital.weight_kg} kg`} color="neutral" />
          )}
          <NebulaStat
            label="Acqua oggi"
            value={`${todayGlasses} / ${WATER_GOAL}`}
            color={todayGlasses >= WATER_GOAL ? 'green' : 'neutral'}
            sub="bicchieri 💧"
          />
        </div>
      ) : (
        <p className="fragment-empty">Nessun dato di salute ancora. Inizia a tracciare!</p>
      )}
    </NebulaCard>
  );
}
