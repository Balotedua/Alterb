import { useWaterLog, WATER_GOAL } from '@/hooks/useHealth';
import { NebulaCard, NebulaStat } from '@/components/ui/nebula';

interface Props {
  params: Record<string, unknown>;
}

export function HealthWaterFragment({ params: _ }: Props) {
  const { todayGlasses, addGlass } = useWaterLog();
  const pct = Math.round((todayGlasses / WATER_GOAL) * 100);
  const done = todayGlasses >= WATER_GOAL;

  return (
    <NebulaCard icon="💧" title="Idratazione oggi">
      <div className="fragment-kpis">
        <NebulaStat
          label="Bicchieri"
          value={`${todayGlasses} / ${WATER_GOAL}`}
          color={done ? 'green' : 'blue'}
          sub={done ? 'Obiettivo raggiunto! 🎉' : `${pct}% completato`}
        />
      </div>

      <div className="nebula-water-bar">
        <div
          className="nebula-water-fill"
          style={{ width: `${Math.min(pct, 100)}%`, background: done ? '#6ee7b7' : '#818cf8' }}
        />
      </div>

      <button
        className="nebula-water-btn"
        onClick={() => addGlass()}
        disabled={done}
      >
        {done ? '✓ Obiettivo raggiunto' : '+ Aggiungi bicchiere'}
      </button>
    </NebulaCard>
  );
}
