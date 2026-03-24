import { useState } from 'react';
import type { VaultEntry } from '../../../types';
import { Stat, TabBar } from './shared';

type MuscleId = 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'core' | 'quads_glutes' | 'back';

const MUSCLE_LABELS_WK: Record<MuscleId, string> = {
  chest: 'Petto', shoulders: 'Spalle', biceps: 'Bicipiti',
  triceps: 'Tricipiti', core: 'Core', quads_glutes: 'Gambe', back: 'Schiena',
};

const EXERCISE_TO_MUSCLE: Record<string, MuscleId> = {
  'Panca piana': 'chest', 'Dips': 'chest', 'Push-up': 'chest', 'Cavi alti': 'chest',
  'Shoulder press': 'shoulders', 'Military Press': 'shoulders', 'Alzate Laterali': 'shoulders',
  'Bicipiti curl': 'biceps', 'Hammer curl': 'biceps', 'Flessioni': 'biceps',
  'Tricipiti': 'triceps', 'Pushdown': 'triceps', 'French Press': 'triceps',
  'Plank': 'core', 'Crunches': 'core', 'Russian Twist': 'core', 'Leg Raise': 'core',
  'Squat': 'quads_glutes', 'Leg Press': 'quads_glutes', 'Hip Thrust': 'quads_glutes',
  'Affondi': 'quads_glutes', 'Leg Extension': 'quads_glutes',
  'Stacco': 'back', 'Trazione': 'back', 'Lat Machine': 'back', 'Rematore': 'back',
};

const WK_MUSCLES: MuscleId[] = ['chest', 'shoulders', 'biceps', 'triceps', 'core', 'quads_glutes', 'back'];

function wkDaysDiff(iso: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - new Date(iso).getTime()) / 86_400_000);
}
function wkFill(d: number)   { return d === 0 ? 'rgba(255,34,68,0.28)' : d === 1 ? 'rgba(255,136,0,0.20)' : d === 2 ? 'rgba(255,221,0,0.13)' : 'rgba(255,255,255,0.03)'; }
function wkStroke(d: number) { return d === 0 ? 'rgba(255,34,68,0.90)' : d === 1 ? 'rgba(255,136,0,0.70)' : d === 2 ? 'rgba(255,221,0,0.55)' : 'rgba(255,255,255,0.10)'; }
function wkGlow(d: number)   { return d === 0 ? 'drop-shadow(0 0 8px rgba(255,34,68,0.75))' : d === 1 ? 'drop-shadow(0 0 6px rgba(255,136,0,0.55))' : d === 2 ? 'drop-shadow(0 0 4px rgba(255,221,0,0.4))' : 'none'; }

function BodySilhouette({ fills, strokes, glows, showBack }: {
  fills: Record<MuscleId, string>; strokes: Record<MuscleId, string>;
  glows: Record<MuscleId, string>; showBack: boolean;
}) {
  const sw = 0.7;
  const tr = 'fill 0.9s ease-in-out, stroke 0.9s ease-in-out';
  return (
    <svg viewBox="0 0 120 300" style={{ width: '100%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg">
      <path d="M 43,20 C 43,4 77,4 77,20 C 77,36 72,44 60,44 C 48,44 43,36 43,20 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" strokeWidth={sw} />
      <path d="M 55,44 L 65,44 L 64,54 L 56,54 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      <g style={{ filter: glows.shoulders }}>
        <path d="M 44,57 C 38,52 22,59 18,72 C 15,81 21,89 30,88 C 38,87 44,81 44,73 Z" fill={fills.shoulders} stroke={strokes.shoulders} strokeWidth={sw} style={{ transition: tr }} />
        <path d="M 76,57 C 82,52 98,59 102,72 C 105,81 99,89 90,88 C 82,87 76,81 76,73 Z" fill={fills.shoulders} stroke={strokes.shoulders} strokeWidth={sw} style={{ transition: tr }} />
      </g>
      {!showBack ? (
        <g style={{ filter: glows.chest }}>
          <path d="M 44,57 C 44,75 43,108 46,120 L 60,118 L 60,57 Z" fill={fills.chest} stroke={strokes.chest} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }} />
          <path d="M 76,57 C 76,75 77,108 74,120 L 60,118 L 60,57 Z" fill={fills.chest} stroke={strokes.chest} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }} />
          <line x1="60" y1="59" x2="60" y2="118" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
        </g>
      ) : (
        <g style={{ filter: glows.back }}>
          <path d="M 44,57 C 40,65 38,100 42,122 L 60,120 L 60,57 Z" fill={fills.back} stroke={strokes.back} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }} />
          <path d="M 76,57 C 80,65 82,100 78,122 L 60,120 L 60,57 Z" fill={fills.back} stroke={strokes.back} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }} />
          <line x1="60" y1="57" x2="60" y2="120" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" strokeDasharray="2,1.5" />
        </g>
      )}
      <g style={{ filter: glows.biceps }}>
        <path d="M 21,71 C 16,75 14,95 17,105 C 19,111 29,111 35,105 C 38,95 37,75 32,71 Z" fill={fills.biceps} stroke={strokes.biceps} strokeWidth={sw} style={{ transition: tr }} />
        <path d="M 99,71 C 104,75 106,95 103,105 C 101,111 91,111 85,105 C 82,95 83,75 88,71 Z" fill={fills.biceps} stroke={strokes.biceps} strokeWidth={sw} style={{ transition: tr }} />
      </g>
      <g style={{ filter: glows.triceps }}>
        <path d="M 17,95 C 14,101 14,119 17,126 C 20,130 29,130 33,126 C 36,119 36,101 35,95 Z" fill={fills.triceps} stroke={strokes.triceps} strokeWidth={sw} style={{ transition: tr }} />
        <path d="M 103,95 C 106,101 106,119 103,126 C 100,130 91,130 87,126 C 84,119 84,101 85,95 Z" fill={fills.triceps} stroke={strokes.triceps} strokeWidth={sw} style={{ transition: tr }} />
      </g>
      <g style={{ filter: glows.core }}>
        <path d="M 46,120 L 74,120 L 74,158 C 74,164 68,168 60,168 C 52,168 46,164 46,158 Z" fill={fills.core} stroke={strokes.core} strokeWidth={sw} style={{ transition: tr }} />
        {[128, 138, 148].map(y => <line key={y} x1="51" y1={y} x2="69" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />)}
        <line x1="60" y1="120" x2="60" y2="158" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
      </g>
      <g style={{ filter: glows.quads_glutes }}>
        <path d="M 46,158 C 44,168 42,200 43,228 C 44,240 52,244 58,244 C 62,244 64,240 64,232 L 60,168 Z" fill={fills.quads_glutes} stroke={strokes.quads_glutes} strokeWidth={sw} style={{ transition: tr }} />
        <path d="M 74,158 C 76,168 78,200 77,228 C 76,240 68,244 62,244 C 58,244 56,240 56,232 L 60,168 Z" fill={fills.quads_glutes} stroke={strokes.quads_glutes} strokeWidth={sw} style={{ transition: tr }} />
      </g>
      <g fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth={sw}>
        <path d="M 43,228 C 41,240 40,265 42,278 C 44,286 52,288 56,284 C 58,272 58,248 58,240 Z" />
        <path d="M 77,228 C 79,240 80,265 78,278 C 76,286 68,288 64,284 C 62,272 62,248 62,240 Z" />
      </g>
    </svg>
  );
}

function TrainingCalendar({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const trainedDays = new Set(entries.map(e => new Date(e.created_at).toISOString().slice(0, 10)));
  const today = new Date();
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (34 - i));
    const iso = d.toISOString().slice(0, 10);
    return { iso, trained: trainedDays.has(iso), label: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) };
  });
  const thisWeek  = days.slice(-7).filter(d => d.trained).length;
  const thisMonth = days.filter(d => d.trained).length;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <Stat label="Questa settimana" value={`${thisWeek}x`} color={color} />
        <Stat label="Ultimi 35 giorni" value={`${thisMonth}x`} color={color} />
      </div>
      <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Calendario</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {days.map((d, i) => (
          <div key={i} title={d.label} style={{
            aspectRatio: '1', borderRadius: 3,
            background: d.trained ? color : 'rgba(255,255,255,0.03)',
            boxShadow: d.trained ? `0 0 5px ${color}50` : 'none',
          }} />
        ))}
      </div>
    </div>
  );
}

function PRSection({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  interface PREntry { value: number; unit: string; history: { date: string; value: number }[] }
  const prMap = new Map<string, PREntry>();
  for (const e of [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const label = (e.data.label as string) ?? '';
    const value = (e.data.value as number) ?? 0;
    if (!label || !value) continue;
    const unit = (e.data.unit as string) ?? 'kg';
    const pt   = { date: new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), value };
    const ex   = prMap.get(label);
    if (!ex) { prMap.set(label, { value, unit, history: [pt] }); }
    else { ex.history.push(pt); if (value > ex.value) ex.value = value; }
  }
  const byMuscle = new Map<MuscleId, Array<{ exercise: string } & PREntry>>();
  for (const [exercise, pr] of prMap.entries()) {
    const muscle = EXERCISE_TO_MUSCLE[exercise];
    if (!muscle) continue;
    if (!byMuscle.has(muscle)) byMuscle.set(muscle, []);
    byMuscle.get(muscle)!.push({ exercise, ...pr });
  }
  if (byMuscle.size === 0) {
    return <p style={{ color: '#3a3f52', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Registra esercizi con un peso per i massimali</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from(byMuscle.entries()).map(([muscle, exercises]) => (
        <div key={muscle}>
          <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            {MUSCLE_LABELS_WK[muscle]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {exercises.map(ex => {
              const isExp = expanded === ex.exercise;
              const pts   = ex.history.slice(-8);
              const W = 220, H = 50, P = 6;
              const vals = pts.map(p => p.value);
              const min  = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
              const xs   = pts.map((_, i) => P + ((W - P * 2) * i) / Math.max(pts.length - 1, 1));
              const ys   = pts.map(p => H - P - ((p.value - min) / range) * (H - P * 2));
              const poly = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
              const gradId = `prg-${ex.exercise.replace(/\s+/g, '')}`;
              return (
                <div key={ex.exercise}>
                  <div onClick={() => setExpanded(isExp ? null : ex.exercise)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    padding: '7px 10px', borderRadius: 8,
                    background: isExp ? `${color}0d` : 'rgba(255,255,255,0.018)',
                    borderLeft: `2px solid ${color}${isExp ? '60' : '25'}`, transition: 'all 0.15s',
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#b0bcd4', fontWeight: 300 }}>{ex.exercise}</span>
                    <span style={{ fontSize: 13, color, fontWeight: 400 }}>{ex.value} {ex.unit}</span>
                  </div>
                  {isExp && pts.length >= 2 && (
                    <div style={{ padding: '6px 10px 4px', background: `${color}05`, borderRadius: '0 0 8px 8px', marginTop: -2 }}>
                      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 50 }} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={`${color}55`} />
                            <stop offset="100%" stopColor={`${color}00`} />
                          </linearGradient>
                        </defs>
                        <polygon points={`${xs[0]},${H} ${poly} ${xs[xs.length - 1]},${H}`} fill={`url(#${gradId})`} />
                        <polyline points={poly} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="2.5" fill={color} />)}
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorkoutRenderer({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [tab, setTab]           = useState<'corpo' | 'massimali'>('corpo');
  const [showBack, setShowBack] = useState(false);

  const lastTrained = new Map<MuscleId, string>();
  for (const e of entries) {
    const label  = (e.data.label as string) ?? '';
    const muscle = EXERCISE_TO_MUSCLE[label];
    if (!muscle) continue;
    const prev = lastTrained.get(muscle);
    if (!prev || e.created_at > prev) lastTrained.set(muscle, e.created_at);
  }

  const fills   = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? wkDaysDiff(lastTrained.get(m)!) : 999; return [m, wkFill(d)];   })) as Record<MuscleId, string>;
  const strokes = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? wkDaysDiff(lastTrained.get(m)!) : 999; return [m, wkStroke(d)]; })) as Record<MuscleId, string>;
  const glows   = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? wkDaysDiff(lastTrained.get(m)!) : 999; return [m, wkGlow(d)];   })) as Record<MuscleId, string>;

  return (
    <div>
      <TabBar tabs={['Corpo', 'Massimali']} active={tab === 'corpo' ? 'Corpo' : 'Massimali'}
        color={color} onChange={t => setTab(t === 'Corpo' ? 'corpo' : 'massimali')} />
      {tab === 'corpo' && (
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0, width: 100 }}>
              <BodySilhouette fills={fills} strokes={strokes} glows={glows} showBack={showBack} />
              <button onClick={() => setShowBack(b => !b)} style={{
                position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '3px 10px', cursor: 'pointer',
                fontSize: 8, color: '#4b5268', letterSpacing: '0.08em',
              }}>{showBack ? 'FRONT' : 'BACK'}</button>
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Recency</div>
              {([['rgba(255,34,68,0.7)', 'Oggi'], ['rgba(255,136,0,0.6)', 'Ieri'], ['rgba(255,221,0,0.5)', '2 giorni fa'], ['rgba(255,255,255,0.12)', 'Non allenato']] as [string, string][]).map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 10, color: '#4b5268' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 8, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Ultimi esercizi</div>
              {entries.slice(0, 5).map(e => (
                <div key={e.id} style={{ fontSize: 10, color: '#4b5268', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{(e.data.label as string) ?? '—'}</span>
                  {e.data.value ? <span style={{ color }}>{String(e.data.value)}{String(e.data.unit ?? 'kg')}</span> : null}
                </div>
              ))}
            </div>
          </div>
          <TrainingCalendar entries={entries} color={color} />
        </div>
      )}
      {tab === 'massimali' && <PRSection entries={entries} color={color} />}
    </div>
  );
}
