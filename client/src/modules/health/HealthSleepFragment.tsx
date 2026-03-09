import { useSleepEntries } from '@/hooks/useHealth';
import { NebulaCard, NebulaGraph, NebulaStat } from '@/components/ui/nebula';

interface Props {
  params: Record<string, unknown>;
}

const QUALITY_EMOJI: Record<number, string> = { 1: '😴', 2: '😪', 3: '😐', 4: '😊', 5: '✨' };

export function HealthSleepFragment({ params }: Props) {
  const limit = typeof params.limit === 'number' ? params.limit : 7;
  const { data: sleep } = useSleepEntries();

  const entries = (sleep ?? []).slice(0, limit);
  const chartData = [...entries].reverse().map((e) => e.duration_minutes / 60);

  const avgH = entries.length
    ? (entries.reduce((s, e) => s + e.duration_minutes, 0) / entries.length / 60).toFixed(1)
    : null;

  return (
    <NebulaCard icon="🌙" title={`Sonno · ultimi ${limit} giorni`}>
      {avgH && (
        <div className="fragment-kpis">
          <NebulaStat label="Media" value={`${avgH}h`} color="blue" />
          {entries[0] && (
            <NebulaStat
              label="Ieri"
              value={`${(entries[0].duration_minutes / 60).toFixed(1)}h`}
              color="neutral"
              sub={QUALITY_EMOJI[entries[0].quality]}
            />
          )}
        </div>
      )}
      <NebulaGraph data={chartData} color="#818cf8" height={48} label="ore di sonno" />
      {!entries.length && (
        <p className="fragment-empty">Nessun dato sul sonno ancora.</p>
      )}
    </NebulaCard>
  );
}
