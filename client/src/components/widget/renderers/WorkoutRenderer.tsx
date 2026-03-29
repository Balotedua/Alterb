import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import type { VaultEntry } from '../../../types';
import { Stat, TabBar } from './shared';

type MuscleId = 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'core' | 'quads_glutes' | 'back';

const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Petto', shoulders: 'Spalle', biceps: 'Bicipiti',
  triceps: 'Tricipiti', core: 'Core', quads_glutes: 'Gambe', back: 'Schiena',
};

const MUSCLE_ICON: Record<MuscleId, string> = {
  chest: '◻', shoulders: '△', biceps: '◑', triceps: '◐',
  core: '▷', quads_glutes: '▽', back: '▣',
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
const MUSCLE_ORDER_PR: MuscleId[] = ['chest', 'quads_glutes', 'back', 'shoulders', 'biceps', 'triceps', 'core'];
const ROUND_MILESTONES = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 250];

// Strength standards: [novizio, intermedio, avanzato] in absolute kg
const STRENGTH_STD: Record<string, [number, number, number]> = {
  'Panca piana':    [40, 70, 100],
  'Squat':          [60, 100, 140],
  'Stacco':         [70, 120, 160],
  'Shoulder press': [25, 50, 75],
  'Military Press': [25, 50, 75],
  'Hip Thrust':     [60, 100, 140],
  'Rematore':       [40, 70, 100],
};
const DEFAULT_STD: [number, number, number] = [30, 60, 90];

function daysDiff(iso: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - new Date(iso).getTime()) / 86_400_000);
}
function wkFill(d: number)   { return d === 0 ? 'rgba(255,34,68,0.28)' : d === 1 ? 'rgba(255,136,0,0.20)' : d === 2 ? 'rgba(255,221,0,0.13)' : 'rgba(255,255,255,0.03)'; }
function wkStroke(d: number) { return d === 0 ? 'rgba(255,34,68,0.90)' : d === 1 ? 'rgba(255,136,0,0.70)' : d === 2 ? 'rgba(255,221,0,0.55)' : 'rgba(255,255,255,0.10)'; }
function wkGlow(d: number)   { return d === 0 ? 'drop-shadow(0 0 8px rgba(255,34,68,0.75)) drop-shadow(0 0 18px rgba(255,0,0,0.3))' : d === 1 ? 'drop-shadow(0 0 6px rgba(255,136,0,0.55))' : d === 2 ? 'drop-shadow(0 0 4px rgba(255,221,0,0.4))' : 'none'; }

// ─── Body Silhouette (120×340, clickable, detailed anatomy) ───────────────────
function BodySilhouette({ fills, strokes, glows, selected, showBack, onClick }: {
  fills: Record<MuscleId, string>; strokes: Record<MuscleId, string>;
  glows: Record<MuscleId, string>; selected: MuscleId | null;
  showBack: boolean; onClick: (id: MuscleId) => void;
}) {
  const sw = 0.7;
  const tr = 'fill 0.9s ease-in-out, stroke 0.9s ease-in-out';
  const selGlow = (id: MuscleId) => selected === id
    ? `${glows[id]} drop-shadow(0 0 5px rgba(255,255,255,0.35))`
    : glows[id];

  return (
    <svg viewBox="0 0 120 340" style={{ width: '100%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg">
      {/* Ghost skeleton anatomy */}
      <g stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" fill="none">
        <line x1="60" y1="48" x2="60" y2="178"/>
        <line x1="44" y1="54" x2="60" y2="46"/><line x1="76" y1="54" x2="60" y2="46"/>
        <path d="M 44,176 Q 60,185 76,176"/>
        <ellipse cx="51" cy="258" rx="6" ry="4"/>
        <ellipse cx="69" cy="258" rx="6" ry="4"/>
      </g>

      {/* HEAD */}
      <g style={{ pointerEvents: 'none' }}>
        <path d="M 43,20 C 43,4 77,4 77,20 C 77,36 72,45 60,45 C 48,45 43,36 43,20 Z"
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" strokeWidth={sw}/>
        <line x1="60" y1="34" x2="60" y2="45" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>
      </g>

      {/* NECK */}
      <path d="M 55,45 L 65,45 L 64,55 L 56,55 Z"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>

      {/* SHOULDERS */}
      <g style={{ filter: selGlow('shoulders'), cursor: 'pointer' }} onClick={() => onClick('shoulders')}>
        <path d="M 44,58 C 38,53 22,60 18,73 C 15,82 21,90 30,89 C 38,88 44,82 44,74 Z"
          fill={fills.shoulders} stroke={strokes.shoulders} strokeWidth={sw} style={{ transition: tr }}/>
        <path d="M 76,58 C 82,53 98,60 102,73 C 105,82 99,90 90,89 C 82,88 76,82 76,74 Z"
          fill={fills.shoulders} stroke={strokes.shoulders} strokeWidth={sw} style={{ transition: tr }}/>
        {selected === 'shoulders' && <rect x="36" y="52" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5"/>}
        {selected === 'shoulders' && <rect x="77" y="52" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5"/>}
      </g>

      {/* CHEST or BACK */}
      {!showBack ? (
        <g style={{ filter: selGlow('chest'), cursor: 'pointer' }} onClick={() => onClick('chest')}>
          <path d="M 44,58 C 44,76 43,110 46,122 L 60,120 L 60,58 Z"
            fill={fills.chest} stroke={strokes.chest} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }}/>
          <path d="M 76,58 C 76,76 77,110 74,122 L 60,120 L 60,58 Z"
            fill={fills.chest} stroke={strokes.chest} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }}/>
          <line x1="60" y1="60" x2="60" y2="120" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4"/>
          <path d="M 46,78 Q 54,82 60,80" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35" fill="none"/>
          <path d="M 74,78 Q 66,82 60,80" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35" fill="none"/>
        </g>
      ) : (
        <g style={{ filter: selGlow('back'), cursor: 'pointer' }} onClick={() => onClick('back')}>
          <path d="M 44,58 C 40,66 38,102 42,124 L 60,122 L 60,58 Z"
            fill={fills.back} stroke={strokes.back} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }}/>
          <path d="M 76,58 C 80,66 82,102 78,124 L 60,122 L 60,58 Z"
            fill={fills.back} stroke={strokes.back} strokeWidth={sw} strokeLinejoin="round" style={{ transition: tr }}/>
          <line x1="60" y1="58" x2="60" y2="124" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" strokeDasharray="2,1.5"/>
          <path d="M 42,82 Q 52,86 60,84" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35" fill="none"/>
          <path d="M 78,82 Q 68,86 60,84" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35" fill="none"/>
        </g>
      )}

      {/* BICEPS */}
      <g style={{ filter: selGlow('biceps'), cursor: 'pointer' }} onClick={() => onClick('biceps')}>
        <path d="M 21,72 C 16,76 14,96 17,106 C 19,112 29,112 35,106 C 38,96 37,76 32,72 Z"
          fill={fills.biceps} stroke={strokes.biceps} strokeWidth={sw} style={{ transition: tr }}/>
        <path d="M 99,72 C 104,76 106,96 103,106 C 101,112 91,112 85,106 C 82,96 83,76 88,72 Z"
          fill={fills.biceps} stroke={strokes.biceps} strokeWidth={sw} style={{ transition: tr }}/>
        <path d="M 18,86 Q 25,83 32,86" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35" fill="none"/>
        <path d="M 102,86 Q 95,83 88,86" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35" fill="none"/>
      </g>

      {/* TRICEPS + FOREARMS */}
      <g style={{ filter: selGlow('triceps'), cursor: 'pointer' }} onClick={() => onClick('triceps')}>
        <path d="M 17,96 C 14,102 14,120 17,127 C 20,131 29,131 33,127 C 36,120 36,102 35,96 Z"
          fill={fills.triceps} stroke={strokes.triceps} strokeWidth={sw} style={{ transition: tr }}/>
        <path d="M 103,96 C 106,102 106,120 103,127 C 100,131 91,131 87,127 C 84,120 84,102 85,96 Z"
          fill={fills.triceps} stroke={strokes.triceps} strokeWidth={sw} style={{ transition: tr }}/>
        {/* Forearms */}
        <path d="M 16,127 C 14,133 15,163 18,169 C 21,173 29,173 33,169 C 36,163 35,133 32,127 Z"
          fill={fills.triceps} stroke={strokes.triceps} strokeWidth={sw} strokeOpacity="0.55" style={{ transition: 'fill 0.9s ease-in-out' }}/>
        <path d="M 104,127 C 106,133 105,163 102,169 C 99,173 91,173 87,169 C 84,163 85,133 88,127 Z"
          fill={fills.triceps} stroke={strokes.triceps} strokeWidth={sw} strokeOpacity="0.55" style={{ transition: 'fill 0.9s ease-in-out' }}/>
      </g>

      {/* HANDS */}
      <ellipse cx="24" cy="175" rx="9" ry="6" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>
      <ellipse cx="96" cy="175" rx="9" ry="6" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>

      {/* CORE */}
      <g style={{ filter: selGlow('core'), cursor: 'pointer' }} onClick={() => onClick('core')}>
        <path d="M 45,120 C 44,128 43,168 46,178 L 74,178 C 77,168 76,128 75,120 Z"
          fill={fills.core} stroke={strokes.core} strokeWidth={sw} style={{ transition: tr }}/>
        <line x1="47" y1="138" x2="73" y2="138" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35"/>
        <line x1="47" y1="155" x2="73" y2="155" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35"/>
        <line x1="60" y1="120" x2="60" y2="178" stroke="rgba(255,255,255,0.05)" strokeWidth="0.35"/>
      </g>

      {/* QUADS / GLUTES */}
      <g style={{ filter: selGlow('quads_glutes'), cursor: 'pointer' }} onClick={() => onClick('quads_glutes')}>
        <path d="M 43,176 Q 60,187 77,176 L 76,183 Q 60,192 44,183 Z"
          fill={fills.quads_glutes} stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" style={{ transition: 'fill 0.9s ease-in-out' }}/>
        <path d="M 44,183 C 42,190 40,244 43,259 C 46,265 55,265 59,259 C 62,250 62,190 60,183 Z"
          fill={fills.quads_glutes} stroke={strokes.quads_glutes} strokeWidth={sw} style={{ transition: tr }}/>
        <path d="M 76,183 C 78,190 80,244 77,259 C 74,265 65,265 61,259 C 58,250 58,190 60,183 Z"
          fill={fills.quads_glutes} stroke={strokes.quads_glutes} strokeWidth={sw} style={{ transition: tr }}/>
        <path d="M 46,212 Q 52,216 58,212" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" fill="none"/>
        <path d="M 74,212 Q 68,216 62,212" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" fill="none"/>
      </g>

      {/* CALVES (decorative) */}
      <path d="M 43,259 C 41,266 42,298 44,308 C 46,313 55,313 57,308 C 59,298 59,266 58,259 Z"
        fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>
      <path d="M 77,259 C 79,266 78,298 76,308 C 74,313 65,313 63,308 C 61,298 61,266 62,259 Z"
        fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>

      {/* FEET */}
      <ellipse cx="48" cy="316" rx="12" ry="5" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>
      <ellipse cx="72" cy="316" rx="12" ry="5" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>

      {/* Status line */}
      <circle cx="8" cy="337" r="1.5" fill="rgba(0,255,200,0.55)"/>
      <text x="14" y="339" fontFamily="monospace" fontSize="4" fill="rgba(255,255,255,0.10)" letterSpacing="0.04em">
        corpo · scanner
      </text>
    </svg>
  );
}

// ─── Training Calendar ─────────────────────────────────────────────────────────
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

// ─── Strength Standards Bar ───────────────────────────────────────────────────
function StrengthBar({ exercise, value, color }: { exercise: string; value: number; color: string }) {
  const [nov, inter, adv] = STRENGTH_STD[exercise] ?? DEFAULT_STD;
  const elite = adv * 1.4;
  let level = 'Novizio', pct = 0;
  if (value >= elite)       { level = 'Elite';       pct = 100; }
  else if (value >= adv)    { level = 'Avanzato';    pct = 75 + ((value - adv)   / (elite - adv))   * 25; }
  else if (value >= inter)  { level = 'Intermedio';  pct = 50 + ((value - inter) / (adv - inter))   * 25; }
  else if (value >= nov)    { level = 'Novizio';     pct = 25 + ((value - nov)   / (inter - nov))   * 25; }
  else                      {                         pct = (value / nov) * 25; }
  pct = Math.max(2, Math.min(100, pct));
  const lColor = level === 'Elite' ? '#ffd700' : level === 'Avanzato' ? '#a78bfa' : level === 'Intermedio' ? '#60a5fa' : '#94a3b8';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Strength Standard</span>
        <span style={{ fontSize: 9, color: lColor, fontWeight: 500, letterSpacing: '0.04em' }}>{level}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: lColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {['Nov', 'Int', 'Adv', 'Elite'].map(l => (
          <span key={l} style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Mini chart for PRs ───────────────────────────────────────────────────────
function MiniLineChart({ points, color }: { points: { date: string; value: number }[]; color: string }) {
  if (points.length < 2) return (
    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', padding: '6px 0', margin: 0 }}>
      Registra ≥2 sessioni per il grafico
    </p>
  );
  const W = 280, H = 60, P = 10;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const xs = points.map((_, i) => P + ((W - P * 2) * i) / (points.length - 1));
  const ys = points.map(p => H - P - ((p.value - min) / range) * (H - P * 2));
  const poly = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1];
  const gradId = `prg-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={`${color}55`} />
          <stop offset="100%" stopColor={`${color}00`} />
        </linearGradient>
      </defs>
      <polygon points={`${xs[0]},${H} ${poly} ${lastX},${H}`} fill={`url(#${gradId})`}/>
      <polyline points={poly} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="2.5" fill={color}/>)}
      <text x={P} y={H - 2} fontSize="8" fill="rgba(255,255,255,0.28)">{min.toFixed(0)} kg</text>
      <text x={W - P} y={H - 2} fontSize="8" fill="rgba(255,255,255,0.28)" textAnchor="end">{max.toFixed(0)} kg</text>
      <circle cx={lastX} cy={lastY} r="3.5" fill={color} stroke="rgba(10,10,20,0.9)" strokeWidth="1.5"/>
    </svg>
  );
}

// ─── PR Section ───────────────────────────────────────────────────────────────
function PRSection({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterMuscle, setFilterMuscle] = useState<MuscleId | null>(null);

  interface PREntry { value: number; unit: string; history: { date: string; value: number }[]; lastDate: string; }
  const prMap = useMemo(() => {
    const m = new Map<string, PREntry>();
    for (const e of [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const label = (e.data.label as string) ?? '';
      const value = (e.data.value as number) ?? 0;
      if (!label || !value) continue;
      const unit = (e.data.unit as string) ?? 'kg';
      const pt   = { date: e.created_at.slice(0, 10), value };
      const ex   = m.get(label);
      if (!ex) { m.set(label, { value, unit, history: [pt], lastDate: pt.date }); }
      else { ex.history.push(pt); if (value > ex.value) ex.value = value; ex.lastDate = pt.date; }
    }
    return m;
  }, [entries]);

  const byMuscle = useMemo(() => {
    const r = new Map<MuscleId, Array<{ exercise: string } & PREntry>>();
    for (const [exercise, pr] of prMap.entries()) {
      const muscle = EXERCISE_TO_MUSCLE[exercise];
      if (!muscle) continue;
      if (!r.has(muscle)) r.set(muscle, []);
      r.get(muscle)!.push({ exercise, ...pr });
    }
    return r;
  }, [prMap]);

  // Big Three
  const bench    = prMap.get('Panca piana')?.value ?? 0;
  const squat    = prMap.get('Squat')?.value ?? 0;
  const deadlift = prMap.get('Stacco')?.value ?? 0;
  const bigThree = bench + squat + deadlift;

  // Wall of Fame milestones
  const milestones = useMemo(() => {
    const ms: { date: string; text: string }[] = [];
    const best: Record<string, number> = {};
    const sorted = [...entries]
      .filter(e => (e.data.unit as string) === 'kg' || !e.data.unit)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const e of sorted) {
      const label = (e.data.label as string) ?? '';
      const val   = (e.data.value as number) ?? 0;
      if (!label || !val) continue;
      const prev = best[label] ?? 0;
      if (val > prev) {
        if (prev > 0) ms.push({ date: e.created_at.slice(0, 10), text: `Nuovo PR su ${label}: ${val} kg!` });
        for (const m of ROUND_MILESTONES) {
          if (prev < m && val >= m) ms.push({ date: e.created_at.slice(0, 10), text: `Hai sfondato i ${m} kg su ${label}!` });
        }
        best[label] = val;
      }
    }
    return ms.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  }, [entries]);

  const hasPRs = MUSCLE_ORDER_PR.some(m => (byMuscle.get(m)?.length ?? 0) > 0);
  const visibleMuscles = filterMuscle ? [filterMuscle] : MUSCLE_ORDER_PR.filter(m => (byMuscle.get(m)?.length ?? 0) > 0);

  if (!hasPRs) {
    return (
      <p style={{ color: '#3a3f52', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
        Registra esercizi con un peso per vedere i massimali
      </p>
    );
  }

  return (
    <div>
      {/* Big Three */}
      {bigThree > 0 && (
        <div style={{ padding: '16px 18px 14px', borderRadius: 14, marginBottom: 16, background: `${color}07`, border: `1px solid ${color}15` }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
            Big Three Total
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 36, fontWeight: 200, color, letterSpacing: '-0.04em', fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>
              {bigThree}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', paddingBottom: 4 }}>kg</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[['Squat', squat], ['Bench', bench], ['Dead', deadlift]].map(([lbl, val]) => (
              <div key={lbl as string} style={{ flex: 1 }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>{lbl}</div>
                <div style={{ fontSize: 13, fontWeight: 200, color: (val as number) > 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.18)', fontFamily: "'Space Mono', monospace" }}>
                  {(val as number) > 0 ? `${val}kg` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Muscle filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
        <button onClick={() => setFilterMuscle(null)} style={{
          padding: '4px 11px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 9,
          background: !filterMuscle ? `${color}20` : 'rgba(255,255,255,0.04)',
          color: !filterMuscle ? color : 'rgba(255,255,255,0.28)', transition: 'all 0.15s',
        }}>Tutti</button>
        {MUSCLE_ORDER_PR.filter(m => (byMuscle.get(m)?.length ?? 0) > 0).map(m => (
          <button key={m} onClick={() => setFilterMuscle(p => p === m ? null : m)} style={{
            padding: '4px 11px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 9,
            background: filterMuscle === m ? `${color}20` : 'rgba(255,255,255,0.04)',
            color: filterMuscle === m ? color : 'rgba(255,255,255,0.28)', transition: 'all 0.15s',
          }}>
            <span style={{ marginRight: 4 }}>{MUSCLE_ICON[m]}</span>{MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* PR List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visibleMuscles.map(muscleId => {
          const exercises = byMuscle.get(muscleId);
          if (!exercises?.length) return null;
          return (
            <div key={muscleId}>
              <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{MUSCLE_ICON[muscleId]}</span>{MUSCLE_LABELS[muscleId]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {exercises.map(ex => {
                  const isExp = expanded === ex.exercise;
                  const pts = ex.history.slice(-10);
                  // 30-day trend
                  const ago30 = new Date(); ago30.setDate(ago30.getDate() - 30);
                  const ago30str = ago30.toISOString().slice(0, 10);
                  const prevBest = ex.history.filter(h => h.date <= ago30str).reduce((mx, h) => Math.max(mx, h.value), 0);
                  const trend = prevBest === 0 ? 'new' : ex.value > prevBest * 1.01 ? 'up' : ex.value < prevBest * 0.99 ? 'down' : 'flat';

                  return (
                    <motion.div key={ex.exercise} layout>
                      <div
                        onClick={() => setExpanded(isExp ? null : ex.exercise)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                          padding: '8px 10px', borderRadius: 8,
                          background: isExp ? `${color}0e` : 'rgba(255,255,255,0.018)',
                          borderLeft: `2px solid ${color}${isExp ? '70' : '28'}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ flex: 1, fontSize: 11, color: '#b0bcd4', fontWeight: 300 }}>{ex.exercise}</span>
                        {/* Trend icon */}
                        <span style={{ color: trend === 'up' ? '#3aad80' : trend === 'down' ? '#c96f6f' : 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                          {trend === 'up' ? <TrendingUp size={10}/> : trend === 'down' ? <TrendingDown size={10}/> : <Minus size={10}/>}
                        </span>
                        <span style={{ fontSize: 13, color, fontWeight: 400, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>
                          {ex.value} {ex.unit}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>
                          {isExp ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                        </span>
                      </div>

                      <AnimatePresence initial={false}>
                        {isExp && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ padding: '8px 10px 6px', background: `${color}05`, borderRadius: '0 0 8px 8px', marginTop: -2 }}>
                              <MiniLineChart points={pts} color={color} />
                              {ex.unit === 'kg' && <StrengthBar exercise={ex.exercise} value={ex.value} color={color} />}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Wall of Fame */}
      {milestones.length > 0 && (
        <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,200,0,0.03)', border: '1px solid rgba(255,200,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Trophy size={11} style={{ color: '#b89630' }}/>
            <span style={{ fontSize: 8, color: '#b89630', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Wall of Fame</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {milestones.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', flexShrink: 0, paddingTop: 1, fontFamily: "'Space Mono', monospace" }}>{m.date}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WorkoutRenderer({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [tab, setTab]           = useState<'corpo' | 'massimali'>('corpo');
  const [showBack, setShowBack] = useState(false);
  const [selected, setSelected] = useState<MuscleId | null>(null);

  const lastTrained = useMemo(() => {
    const m = new Map<MuscleId, string>();
    for (const e of entries) {
      const label  = (e.data.label as string) ?? '';
      const muscle = EXERCISE_TO_MUSCLE[label];
      if (!muscle) continue;
      const prev = m.get(muscle);
      if (!prev || e.created_at > prev) m.set(muscle, e.created_at);
    }
    return m;
  }, [entries]);

  const fills   = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? daysDiff(lastTrained.get(m)!) : 999; return [m, wkFill(d)];   })) as Record<MuscleId, string>;
  const strokes = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? daysDiff(lastTrained.get(m)!) : 999; return [m, wkStroke(d)]; })) as Record<MuscleId, string>;
  const glows   = Object.fromEntries(WK_MUSCLES.map(m => { const d = lastTrained.has(m) ? daysDiff(lastTrained.get(m)!) : 999; return [m, wkGlow(d)];   })) as Record<MuscleId, string>;

  // Last 5 exercises for selected muscle (or all if none selected)
  const recentExercises = useMemo(() => {
    if (!selected) return entries.slice(0, 5);
    return entries
      .filter(e => EXERCISE_TO_MUSCLE[(e.data.label as string) ?? ''] === selected)
      .slice(0, 5);
  }, [entries, selected]);

  return (
    <div>
      <TabBar tabs={['Corpo', 'Massimali']} active={tab === 'corpo' ? 'Corpo' : 'Massimali'}
        color={color} onChange={t => setTab(t === 'Corpo' ? 'corpo' : 'massimali')} />

      {tab === 'corpo' && (
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            {/* Silhouette */}
            <div style={{ position: 'relative', flexShrink: 0, width: 108 }}>
              <BodySilhouette
                fills={fills} strokes={strokes} glows={glows}
                selected={selected} showBack={showBack}
                onClick={id => setSelected(p => p === id ? null : id)}
              />
              <button onClick={() => setShowBack(b => !b)} style={{
                position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '3px 10px', cursor: 'pointer',
                fontSize: 8, color: '#4b5268', letterSpacing: '0.08em',
              }}>{showBack ? 'FRONT' : 'BACK'}</button>
            </div>

            {/* Right panel */}
            <div style={{ flex: 1, paddingTop: 4 }}>
              {/* Selected muscle badge */}
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div key={selected}
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      marginBottom: 10, padding: '6px 12px', borderRadius: 8,
                      background: `${color}12`, border: `1px solid ${color}25`,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{MUSCLE_ICON[selected]}</span>
                    <span style={{ fontSize: 11, color, letterSpacing: '0.06em' }}>{MUSCLE_LABELS[selected]}</span>
                    <button onClick={() => setSelected(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>✕</button>
                  </motion.div>
                ) : (
                  <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Recency</div>
                    {([
                      ['rgba(255,34,68,0.7)', 'Oggi'],
                      ['rgba(255,136,0,0.6)', 'Ieri'],
                      ['rgba(255,221,0,0.5)', '2 giorni fa'],
                      ['rgba(255,255,255,0.12)', 'Non allenato'],
                    ] as [string, string][]).map(([c, l]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 10, color: '#4b5268' }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: c }}/>{l}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recent exercises */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 8, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {selected ? `Ultimi ${MUSCLE_LABELS[selected]}` : 'Ultimi esercizi'}
                </div>
                {recentExercises.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#3a3f52' }}>Nessun dato</div>
                ) : (
                  recentExercises.map(e => (
                    <div key={e.id} style={{ fontSize: 10, color: '#4b5268', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {(e.data.label as string) ?? '—'}
                      </span>
                      {e.data.value ? (
                        <span style={{ color, flexShrink: 0, marginLeft: 6, fontFamily: "'Space Mono', monospace", fontSize: 10 }}>
                          {String(e.data.value)}{String(e.data.unit ?? 'kg')}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <TrainingCalendar entries={entries} color={color} />
        </div>
      )}

      {tab === 'massimali' && <PRSection entries={entries} color={color} />}
    </div>
  );
}
