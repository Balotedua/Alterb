import './Health.css';
import { VitalSigns } from '@/components/health/VitalSigns';
import { BodyChart } from '@/components/health/BodyChart';
import { ExerciseMaxTracker } from '@/components/health/ExerciseMaxTracker';
import { WellnessStats } from '@/components/health/WellnessStats';
import { QuickLog } from '@/components/health/QuickLog';
import { SleepHistory } from '@/components/health/SleepHistory';
import {
  useBodyVitals,
  useAddVital,
  useExerciseMaxes,
  useAddExerciseMax,
  useUpdateExerciseMax,
  useDeleteExerciseMax,
  latestByExercise,
  useSleepEntries,
  useAddSleepEntry,
  useDeleteSleepEntry,
  useWaterLog,
} from '@/hooks/useHealth';

export default function Health() {
  const vitalsQuery   = useBodyVitals();
  const addVital      = useAddVital();

  const maxesQuery    = useExerciseMaxes();
  const addMax        = useAddExerciseMax();
  const updateMax     = useUpdateExerciseMax();
  const deleteMax     = useDeleteExerciseMax();

  const sleepQuery    = useSleepEntries();
  const addSleep      = useAddSleepEntry();
  const deleteSleep   = useDeleteSleepEntry();

  const { todayGlasses, addGlass, removeGlass } = useWaterLog();

  const vitals       = vitalsQuery.data  ?? [];
  const maxes        = maxesQuery.data   ?? [];
  const sleepEntries = sleepQuery.data   ?? [];

  return (
    <div className="h-page">
      <header className="h-header">
        <h1>Salute</h1>
        <p className="h-header-sub">Monitora il tuo benessere fisico, i massimali e il sonno</p>
      </header>

      {/* Row 1 — KPI vitals */}
      <VitalSigns vitals={vitals} sleepEntries={sleepEntries} />

      {/* Row 2 — Bento grid */}
      <div className="h-bento">
        <div className="h-bento--chart">
          <BodyChart vitals={vitals} />
        </div>
        <div className="h-bento--maxes">
          <ExerciseMaxTracker
            maxes={maxes}
            onUpdate={(id, value) => updateMax.mutate({ id, value })}
            onRemove={(id) => deleteMax.mutate(id)}
            onAdd={(input) => addMax.mutate(input)}
            latestByExercise={() => latestByExercise(maxes)}
          />
        </div>
        <div className="h-bento--wellness">
          <WellnessStats
            todayGlasses={todayGlasses}
            onAddGlass={addGlass}
            onRemoveGlass={removeGlass}
            sleepEntries={sleepEntries}
          />
        </div>
      </div>

      {/* Row 3 — Log rapido + storico sonno */}
      <div className="h-bento">
        <div className="h-bento--quicklog">
          <QuickLog
            onAddVital={(input) => addVital.mutate(input)}
            onAddSleep={(input) => addSleep.mutate(input)}
          />
        </div>
        <div className="h-bento--sleep">
          <SleepHistory
            entries={sleepEntries}
            onRemove={(id) => deleteSleep.mutate(id)}
          />
        </div>
      </div>
    </div>
  );
}
