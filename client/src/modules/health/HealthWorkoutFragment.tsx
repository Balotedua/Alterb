import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, RotateCcw, TrendingUp, TrendingDown, Minus, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { useExerciseMaxes, useAddExerciseMax, useBodyVitals, latestByExercise } from '@/hooks/useHealth';
import { NebulaCard } from '@/components/ui/nebula';
import type { ExerciseUnit, ExerciseMax } from '@/types';

// ─── Shared Types ─────────────────────────────────────────────────────────────

type MuscleId = 'head' | 'chest' | 'shoulders' | 'arms' | 'core' | 'quads_glutes' | 'back';
type MuscleIdPR = 'chest' | 'shoulders' | 'arms' | 'core' | 'quads_glutes' | 'back';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'silhouette' | 'pr';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'silhouette', label: 'Silhouette', icon: '💪' },
  { id: 'pr',         label: 'PR Matrix',  icon: '🏆' },
];

const TAB_ANIM = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.13 } },
};

// ─── SILHOUETTE — Constants ───────────────────────────────────────────────────

const MUSCLE_EXERCISES: Record<MuscleId, Array<{ name: string; unit: ExerciseUnit }>> = {
  head:        [{ name: 'Meditazione', unit: 'seconds' }, { name: 'Respirazione', unit: 'seconds' }],
  chest:       [{ name: 'Panca piana', unit: 'kg' }, { name: 'Dips', unit: 'kg' }, { name: 'Push-up', unit: 'reps' }, { name: 'Cavi alti', unit: 'kg' }],
  shoulders:   [{ name: 'Shoulder press', unit: 'kg' }, { name: 'Military Press', unit: 'kg' }, { name: 'Alzate Laterali', unit: 'kg' }],
  arms:        [{ name: 'Flessioni', unit: 'reps' }, { name: 'Bicipiti curl', unit: 'kg' }, { name: 'Tricipiti', unit: 'kg' }, { name: 'Hammer curl', unit: 'kg' }],
  core:        [{ name: 'Plank', unit: 'seconds' }, { name: 'Crunches', unit: 'reps' }, { name: 'Russian Twist', unit: 'reps' }, { name: 'Leg Raise', unit: 'reps' }],
  quads_glutes:[{ name: 'Squat', unit: 'kg' }, { name: 'Leg Press', unit: 'kg' }, { name: 'Leg Extension', unit: 'kg' }, { name: 'Affondi', unit: 'reps' }, { name: 'Hip Thrust', unit: 'kg' }],
  back:        [{ name: 'Stacco', unit: 'kg' }, { name: 'Trazione', unit: 'reps' }, { name: 'Lat Machine', unit: 'kg' }, { name: 'Rematore', unit: 'kg' }],
};

const MUSCLE_LABELS: Record<MuscleId, string> = {
  head: 'Testa · Stress', chest: 'Petto', shoulders: 'Spalle',
  arms: 'Braccia', core: 'Core', quads_glutes: 'Gambe', back: 'Dorso',
};

const EXERCISE_TO_MUSCLE: Record<string, MuscleId> = {
  'Meditazione': 'head', 'Respirazione': 'head',
  'Panca piana': 'chest', 'Dips': 'chest', 'Push-up': 'chest', 'Cavi alti': 'chest',
  'Shoulder press': 'shoulders', 'Military Press': 'shoulders', 'Alzate Laterali': 'shoulders',
  'Flessioni': 'arms', 'Bicipiti curl': 'arms', 'Tricipiti': 'arms', 'Hammer curl': 'arms',
  'Plank': 'core', 'Crunches': 'core', 'Russian Twist': 'core', 'Leg Raise': 'core',
  'Squat': 'quads_glutes', 'Leg Press': 'quads_glutes', 'Leg Extension': 'quads_glutes',
  'Affondi': 'quads_glutes', 'Hip Thrust': 'quads_glutes',
  'Stacco': 'back', 'Trazione': 'back', 'Lat Machine': 'back', 'Rematore': 'back',
};

const MUSCLE_ORDER: MuscleId[] = ['head', 'shoulders', 'chest', 'arms', 'core', 'quads_glutes', 'back'];

const BIG_THREE = [
  { key: 'Squat',       label: 'SQUAT' },
  { key: 'Panca piana', label: 'BENCH' },
  { key: 'Stacco',      label: 'DEADLIFT' },
];

// ─── SILHOUETTE — Color logic ─────────────────────────────────────────────────

function daysDiff(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

function muscleColor(lastDate: string | null): string {
  if (!lastDate) return 'rgba(255,255,255,0.13)';
  const d = daysDiff(lastDate);
  if (d === 0) return '#ff2244';
  if (d === 1) return '#ff8800';
  if (d === 2) return '#ffdd00';
  return 'rgba(255,255,255,0.16)';
}

function muscleFilter(lastDate: string | null): string {
  if (!lastDate) return 'none';
  const d = daysDiff(lastDate);
  if (d === 0) return 'drop-shadow(0 0 9px #ff224488) drop-shadow(0 0 18px #ff224433)';
  if (d === 1) return 'drop-shadow(0 0 7px #ff880066)';
  if (d === 2) return 'drop-shadow(0 0 5px #ffdd0055)';
  return 'none';
}

function calendarColor(count: number): string {
  if (count === 0) return 'rgba(255,255,255,0.05)';
  if (count === 1) return 'rgba(167,139,250,0.28)';
  if (count <= 3)  return 'rgba(167,139,250,0.55)';
  return 'rgba(167,139,250,0.88)';
}

function formatValue(value: number, unit: ExerciseUnit): string {
  if (unit === 'seconds') {
    if (value >= 60) return `${Math.floor(value / 60)}m ${value % 60}s`;
    return `${value}s`;
  }
  return unit === 'kg' ? `${value} kg` : `${value} rip`;
}

// ─── SILHOUETTE — SVG Body ────────────────────────────────────────────────────

interface SilhouetteProps {
  colors: Record<MuscleId, string>;
  filters: Record<MuscleId, string>;
  selected: MuscleId | null;
  showBack: boolean;
  onClick: (id: MuscleId) => void;
}

function BodySilhouette({ colors, filters, selected, showBack, onClick }: SilhouetteProps) {
  const sel = (id: MuscleId) => selected === id ? 'ht-part--sel' : '';
  return (
    <svg viewBox="0 0 160 400" className="ht-svg" xmlns="http://www.w3.org/2000/svg">
      <g className={`ht-part ${sel('head')}`} style={{ filter: filters.head }} onClick={() => onClick('head')}>
        <ellipse cx="80" cy="35" rx="24" ry="28" fill={colors.head} />
      </g>
      <rect x="73" y="61" width="14" height="13" rx="4" fill="rgba(255,255,255,0.08)" />
      <g className={`ht-part ${sel('shoulders')}`} style={{ filter: filters.shoulders }} onClick={() => onClick('shoulders')}>
        <ellipse cx="44" cy="94" rx="22" ry="18" fill={colors.shoulders} />
        <ellipse cx="116" cy="94" rx="22" ry="18" fill={colors.shoulders} />
      </g>
      {!showBack ? (
        <g className={`ht-part ${sel('chest')}`} style={{ filter: filters.chest }} onClick={() => onClick('chest')}>
          <rect x="54" y="74" width="52" height="62" rx="8" fill={colors.chest} />
        </g>
      ) : (
        <g className={`ht-part ${sel('back')}`} style={{ filter: filters.back }} onClick={() => onClick('back')}>
          <rect x="54" y="74" width="52" height="62" rx="8" fill={colors.back} />
        </g>
      )}
      <g className={`ht-part ${sel('arms')}`} style={{ filter: filters.arms }} onClick={() => onClick('arms')}>
        <rect x="22" y="84" width="19" height="56" rx="9" fill={colors.arms} />
        <rect x="119" y="84" width="19" height="56" rx="9" fill={colors.arms} />
        <rect x="23" y="146" width="17" height="46" rx="8" fill={colors.arms} style={{ opacity: 0.7 }} />
        <rect x="120" y="146" width="17" height="46" rx="8" fill={colors.arms} style={{ opacity: 0.7 }} />
      </g>
      <ellipse cx="31" cy="199" rx="10" ry="7" fill="rgba(255,255,255,0.07)" />
      <ellipse cx="129" cy="199" rx="10" ry="7" fill="rgba(255,255,255,0.07)" />
      <g className={`ht-part ${sel('core')}`} style={{ filter: filters.core }} onClick={() => onClick('core')}>
        <rect x="56" y="136" width="48" height="54" rx="7" fill={colors.core} />
      </g>
      <g className={`ht-part ${sel('quads_glutes')}`} style={{ filter: filters.quads_glutes }} onClick={() => onClick('quads_glutes')}>
        <rect x="56" y="190" width="22" height="88" rx="10" fill={colors.quads_glutes} />
        <rect x="82" y="190" width="22" height="88" rx="10" fill={colors.quads_glutes} />
      </g>
      <rect x="58" y="280" width="18" height="68" rx="8" fill="rgba(255,255,255,0.09)" />
      <rect x="84" y="280" width="18" height="68" rx="8" fill="rgba(255,255,255,0.09)" />
      <ellipse cx="67" cy="354" rx="14" ry="6" fill="rgba(255,255,255,0.07)" />
      <ellipse cx="93" cy="354" rx="14" ry="6" fill="rgba(255,255,255,0.07)" />
    </svg>
  );
}

// ─── PR MATRIX — Constants ────────────────────────────────────────────────────

const MUSCLE_LABELS_PR: Record<MuscleIdPR, string> = {
  chest: 'Petto', shoulders: 'Spalle', arms: 'Braccia',
  core: 'Core', quads_glutes: 'Gambe', back: 'Dorso',
};

const MUSCLE_EXERCISES_PR: Record<MuscleIdPR, string[]> = {
  chest:        ['Panca piana', 'Dips', 'Cavi alti', 'Push-up'],
  shoulders:    ['Shoulder press', 'Military Press', 'Alzate Laterali'],
  arms:         ['Bicipiti curl', 'Tricipiti', 'Hammer curl'],
  core:         ['Plank', 'Crunches', 'Russian Twist', 'Leg Raise'],
  quads_glutes: ['Squat', 'Leg Press', 'Hip Thrust', 'Affondi', 'Leg Extension'],
  back:         ['Stacco', 'Lat Machine', 'Rematore', 'Trazione'],
};

const EXERCISE_TO_MUSCLE_PR: Record<string, MuscleIdPR> = Object.fromEntries(
  Object.entries(MUSCLE_EXERCISES_PR).flatMap(([m, exs]) => exs.map(e => [e, m as MuscleIdPR]))
);

const MUSCLE_ORDER_PR: MuscleIdPR[] = ['chest', 'quads_glutes', 'back', 'shoulders', 'arms', 'core'];

const BW_QUALITY: Record<string, number> = {
  'Panca piana': 1.5, 'Squat': 2.0, 'Stacco': 2.5,
  'Shoulder press': 0.75, 'Military Press': 0.75,
  'Hip Thrust': 2.0, 'Rematore': 1.25,
};
const DEFAULT_BW_QUALITY = 1.0;

const STRENGTH_STANDARDS: Record<string, [number, number, number]> = {
  'Panca piana': [0.5, 0.9, 1.2],
  'Squat':       [0.75, 1.25, 1.75],
  'Stacco':      [0.9, 1.5, 2.0],
  'Shoulder press': [0.3, 0.55, 0.75],
  'Military Press': [0.3, 0.55, 0.75],
};
const DEFAULT_STANDARDS: [number, number, number] = [0.4, 0.7, 1.0];

const ROUND_MILESTONES = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 250];

function brzycki(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight / (1.0278 - 0.0278 * reps);
}

interface Milestone { date: string; text: string; }

function generateMilestones(maxes: ExerciseMax[]): Milestone[] {
  const milestones: Milestone[] = [];
  const best: Record<string, number> = {};
  const sorted = [...maxes].filter(m => m.unit === 'kg').sort((a, b) => a.date.localeCompare(b.date));
  for (const m of sorted) {
    const prev = best[m.exercise] ?? 0;
    if (m.value > prev) {
      if (prev > 0)
        milestones.push({ date: m.date, text: `Nuovo PR su ${m.exercise}: ${m.value.toFixed(1)} kg!` });
      for (const milestone of ROUND_MILESTONES) {
        if (prev < milestone && m.value >= milestone)
          milestones.push({ date: m.date, text: `Hai sfondato il muro dei ${milestone} kg su ${m.exercise}!` });
      }
      best[m.exercise] = m.value;
    }
  }
  return milestones.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
}

// ─── PR MATRIX — MiniLineChart ────────────────────────────────────────────────

function MiniLineChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return <p className="pr-chart-empty">Registra almeno 2 sessioni per vedere il grafico</p>;
  const W = 280, H = 72, P = 10;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const xs = points.map((_, i) => P + ((W - P * 2) * i) / (points.length - 1));
  const ys = points.map(p => H - P - ((p.value - min) / range) * (H - P * 2));
  const poly = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pr-chart-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pr-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(167,139,250,0.35)" />
          <stop offset="100%" stopColor="rgba(167,139,250,0)" />
        </linearGradient>
      </defs>
      <polygon points={`${xs[0]},${H} ${poly} ${lastX},${H}`} fill="url(#pr-fill)" />
      <polyline points={poly} fill="none" stroke="rgba(167,139,250,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="2.5" fill="rgba(167,139,250,1)" />)}
      <text x={P} y={H - 2} fontSize="8" fill="rgba(255,255,255,0.3)">{min.toFixed(0)} kg</text>
      <text x={W - P} y={H - 2} fontSize="8" fill="rgba(255,255,255,0.3)" textAnchor="end">{max.toFixed(0)} kg</text>
      <circle cx={lastX} cy={lastY} r="3.5" fill="#a78bfa" stroke="rgba(18,10,40,0.9)" strokeWidth="1.5" />
    </svg>
  );
}

// ─── PR MATRIX — StrengthBar ──────────────────────────────────────────────────

function StrengthBar({ exercise, oneRM, bodyWeight }: { exercise: string; oneRM: number; bodyWeight: number | null }) {
  if (!bodyWeight) return null;
  const ratio = oneRM / bodyWeight;
  const [nov, inter, adv] = STRENGTH_STANDARDS[exercise] ?? DEFAULT_STANDARDS;
  const elite = adv * 1.38;
  let level = 'Novizio', pct = 0;
  if (ratio >= elite)       { level = 'Elite';       pct = 100; }
  else if (ratio >= adv)    { level = 'Avanzato';    pct = 75 + ((ratio - adv)   / (elite - adv))   * 25; }
  else if (ratio >= inter)  { level = 'Intermedio';  pct = 50 + ((ratio - inter) / (adv - inter))   * 25; }
  else if (ratio >= nov)    { level = 'Novizio';     pct = 25 + ((ratio - nov)   / (inter - nov))   * 25; }
  else                      {                         pct = (ratio / nov) * 25; }
  pct = Math.max(2, Math.min(100, pct));
  const color = level === 'Elite' ? '#ffd700' : level === 'Avanzato' ? '#a78bfa' : level === 'Intermedio' ? '#60a5fa' : '#94a3b8';
  return (
    <div className="pr-strength-wrap">
      <div className="pr-strength-header">
        <span className="pr-strength-label">Strength Standard</span>
        <span className="pr-strength-level" style={{ color }}>{level}</span>
      </div>
      <div className="pr-strength-track">
        <div className="pr-strength-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="pr-strength-ticks">
        {['Novizio', 'Intermedio', 'Avanzato', 'Elite'].map(l => (
          <span key={l} style={{ color: l === level ? color : undefined }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ─── PR MATRIX — PRCard ───────────────────────────────────────────────────────

interface PRCardProps {
  exercise: string; oneRM: number; date: string;
  history: ExerciseMax[]; bodyWeight: number | null;
  expanded: boolean; onToggle: () => void;
}

function PRCard({ exercise, oneRM, date, history, bodyWeight, expanded, onToggle }: PRCardProps) {
  const ago = new Date(); ago.setDate(ago.getDate() - 30);
  const agoStr = ago.toISOString().slice(0, 10);
  const prevBest = history.filter(m => m.date <= agoStr).reduce((mx, m) => Math.max(mx, m.value), 0);
  const trend = prevBest === 0 ? 'new' : oneRM > prevBest * 1.01 ? 'up' : oneRM < prevBest * 0.99 ? 'down' : 'flat';
  const bwThr = BW_QUALITY[exercise] ?? DEFAULT_BW_QUALITY;
  const isElite = bodyWeight ? oneRM >= bodyWeight * bwThr : false;
  const chartPoints = history.filter(m => m.unit === 'kg').sort((a, b) => a.date.localeCompare(b.date)).slice(-10).map(m => ({ date: m.date, value: m.value }));
  return (
    <motion.div className={`pr-card ${isElite ? 'pr-card--elite' : ''}`} layout onClick={onToggle}>
      <div className="pr-card-top">
        <div className="pr-card-meta">
          <span className="pr-card-name">{exercise}</span>
          <span className="pr-card-date">{date}</span>
        </div>
        <div className="pr-card-right">
          <span className="pr-card-value">{oneRM.toFixed(1)}<span className="pr-card-unit"> kg</span></span>
          <span className={`pr-trend pr-trend--${trend}`}>
            {trend === 'up' ? <TrendingUp size={11} /> : trend === 'down' ? <TrendingDown size={11} /> : <Minus size={11} />}
          </span>
          {expanded ? <ChevronUp size={11} className="pr-chevron" /> : <ChevronDown size={11} className="pr-chevron" />}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="pr-card-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            onClick={e => e.stopPropagation()}
          >
            <MiniLineChart points={chartPoints} />
            <StrengthBar exercise={exercise} oneRM={oneRM} bodyWeight={bodyWeight} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Tab Contents ─────────────────────────────────────────────────────────────

interface SilhouetteTabProps {
  maxes: ExerciseMax[];
  addMax: ReturnType<typeof useAddExerciseMax>;
}

function SilhouetteTab({ maxes, addMax }: SilhouetteTabProps) {
  const latest = useMemo(() => latestByExercise(maxes), [maxes]);

  const lastTrained = useMemo<Record<MuscleId, string | null>>(() => {
    const r: Record<MuscleId, string | null> = {
      head: null, chest: null, shoulders: null, arms: null, core: null, quads_glutes: null, back: null,
    };
    for (const ex of maxes) {
      const m = EXERCISE_TO_MUSCLE[ex.exercise];
      if (m && (!r[m] || ex.date > r[m]!)) r[m] = ex.date;
    }
    return r;
  }, [maxes]);

  const colors  = useMemo(() => Object.fromEntries(MUSCLE_ORDER.map(id => [id, muscleColor(lastTrained[id])])) as Record<MuscleId, string>, [lastTrained]);
  const filters = useMemo(() => Object.fromEntries(MUSCLE_ORDER.map(id => [id, muscleFilter(lastTrained[id])])) as Record<MuscleId, string>, [lastTrained]);

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleId | null>(null);
  const [showBack, setShowBack]   = useState(false);
  const [logMuscle, setLogMuscle] = useState<MuscleId | null>(null);
  const [logExercise, setLogExercise] = useState('');
  const [logValue, setLogValue]   = useState('');
  const [logUnit, setLogUnit]     = useState<ExerciseUnit>('kg');
  const [logNote, setLogNote]     = useState('');

  const bigThree = useMemo(() =>
    BIG_THREE.map(({ key, label }) => {
      const ex = latest.find(e => e.exercise === key);
      return { label, value: ex ? `${ex.value} kg` : '—' };
    }),
  [latest]);

  const calDays = useMemo(() => {
    const dayMap: Record<string, number> = {};
    for (const ex of maxes) dayMap[ex.date] = (dayMap[ex.date] ?? 0) + 1;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (41 - i));
      const date = d.toISOString().slice(0, 10);
      return { date, count: dayMap[date] ?? 0 };
    });
  }, [maxes]);

  const popoverExs = useMemo(() => {
    if (!selectedMuscle) return [];
    const names = MUSCLE_EXERCISES[selectedMuscle].map(e => e.name);
    return latest.filter(ex => names.includes(ex.exercise));
  }, [selectedMuscle, latest]);

  function handleLogMuscle(id: MuscleId) {
    setLogMuscle(prev => prev === id ? null : id);
    setLogExercise('');
    setLogUnit('kg');
  }

  function handleLogExerciseChange(name: string) {
    setLogExercise(name);
    if (logMuscle) {
      const p = MUSCLE_EXERCISES[logMuscle].find(e => e.name === name);
      if (p) setLogUnit(p.unit);
    }
  }

  function handleSave() {
    const val = parseFloat(logValue);
    if (!logExercise || isNaN(val) || val <= 0) return;
    addMax.mutate({ exercise: logExercise, value: val, unit: logUnit });
    setLogValue(''); setLogNote(''); setLogExercise(''); setLogMuscle(null);
  }

  const LEGEND = [
    { color: '#ff2244', label: '<24h' },
    { color: '#ff8800', label: '<48h' },
    { color: '#ffdd00', label: '<72h' },
    { color: 'rgba(255,255,255,0.18)', label: 'Recuperato' },
  ];

  return (
    <>
      <div className="ht-body-row">
        <div className="ht-svg-wrap">
          <button
            className="ht-rotate-btn"
            onClick={() => { setShowBack(v => !v); setSelectedMuscle(null); }}
            title={showBack ? 'Vista frontale' : 'Vista dorsale'}
          >
            <RotateCcw size={14} />
            {showBack ? 'Front' : 'Back'}
          </button>
          <BodySilhouette
            colors={colors} filters={filters}
            selected={selectedMuscle} showBack={showBack}
            onClick={id => setSelectedMuscle(prev => prev === id ? null : id)}
          />
          <div className="ht-legend">
            {LEGEND.map(l => (
              <div key={l.label} className="ht-legend-item">
                <span className="ht-legend-dot" style={{ background: l.color }} />
                <span className="ht-legend-label">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {selectedMuscle && (
            <motion.div
              key={selectedMuscle}
              className="ht-popover"
              initial={{ opacity: 0, x: 12, scale: 0.96 }}
              animate={{ opacity: 1, x: 0,  scale: 1    }}
              exit={{    opacity: 0, x: 8,  scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            >
              <div className="ht-popover-header">
                <span className="ht-popover-title">{MUSCLE_LABELS[selectedMuscle]}</span>
                <button className="ht-popover-close" onClick={() => setSelectedMuscle(null)}><X size={12} /></button>
              </div>
              {lastTrained[selectedMuscle] && (
                <p className="ht-popover-date">
                  Ultimo: <strong>{lastTrained[selectedMuscle]}</strong>
                  {' '}({daysDiff(lastTrained[selectedMuscle]!)} gg fa)
                </p>
              )}
              {popoverExs.length > 0 ? (
                <div className="ht-popover-exlist">
                  {popoverExs.map(ex => (
                    <div key={ex.id} className="ht-popover-ex">
                      <span className="ht-popover-ex-name">{ex.exercise}</span>
                      <span className="ht-popover-ex-val">{formatValue(ex.value, ex.unit)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ht-popover-empty">Nessun massimale registrato</p>
              )}
              <button
                className="ht-popover-log-btn"
                onClick={() => { setLogMuscle(selectedMuscle); setSelectedMuscle(null); }}
              >
                + Log allenamento
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ht-big3">
        {bigThree.map(({ label, value }) => (
          <div key={label} className="ht-big3-card">
            <span className="ht-big3-val">{value}</span>
            <span className="ht-big3-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="ht-section">
        <p className="ht-section-label">QUICK LOG</p>
        <div className="ht-chips">
          {MUSCLE_ORDER.map(id => (
            <button
              key={id}
              className={`ht-chip ${logMuscle === id ? 'ht-chip--active' : ''}`}
              onClick={() => handleLogMuscle(id)}
            >
              {MUSCLE_LABELS[id]}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {logMuscle && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="ht-log-form"
            >
              <select
                className="ht-log-select"
                value={logExercise}
                onChange={e => handleLogExerciseChange(e.target.value)}
              >
                <option value="">— Seleziona esercizio —</option>
                {MUSCLE_EXERCISES[logMuscle].map(ex => (
                  <option key={ex.name} value={ex.name}>{ex.name}</option>
                ))}
              </select>
              <div className="ht-log-row">
                <input
                  className="ht-log-input"
                  type="number" min="0"
                  placeholder={logUnit === 'seconds' ? 'Secondi' : logUnit === 'kg' ? 'Kg' : 'Reps'}
                  value={logValue}
                  onChange={e => setLogValue(e.target.value)}
                />
                <select
                  className="ht-log-unit"
                  value={logUnit}
                  onChange={e => setLogUnit(e.target.value as ExerciseUnit)}
                >
                  <option value="kg">Kg</option>
                  <option value="reps">Rip.</option>
                  <option value="seconds">Sec.</option>
                </select>
              </div>
              <textarea
                className="ht-log-note"
                placeholder="Come è andata? (note, sensazioni, infortuni…)"
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                rows={2}
              />
              <button
                className="ht-log-save"
                onClick={handleSave}
                disabled={!logExercise || !logValue || addMax.isPending}
              >
                {addMax.isPending ? 'Salvataggio…' : 'Salva sessione'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ht-section">
        <p className="ht-section-label">TRAINING CALENDAR · ultimi 42 giorni</p>
        <div className="ht-calendar">
          {calDays.map(({ date, count }) => (
            <div
              key={date}
              className="ht-cal-cell"
              style={{ background: calendarColor(count) }}
              title={`${date}${count > 0 ? ` · ${count} esercizi` : ''}`}
            />
          ))}
        </div>
        <div className="ht-cal-legend">
          <span className="ht-cal-legend-text">Meno</span>
          {[0, 1, 2, 4].map(c => (
            <span key={c} className="ht-cal-swatch" style={{ background: calendarColor(c) }} />
          ))}
          <span className="ht-cal-legend-text">Più</span>
        </div>
      </div>
    </>
  );
}

interface PRTabProps {
  maxes: ExerciseMax[];
  addMax: ReturnType<typeof useAddExerciseMax>;
  bodyWeight: number | null;
}

function PRTab({ maxes, addMax, bodyWeight }: PRTabProps) {
  const [formMuscle, setFormMuscle] = useState<MuscleIdPR | null>(null);
  const [formExercise, setFormExercise] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formReps, setFormReps] = useState('1');
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [filterMuscle, setFilterMuscle] = useState<MuscleIdPR | null>(null);

  const computed1RM = useMemo(() => {
    const w = parseFloat(formWeight), r = parseInt(formReps);
    return !isNaN(w) && w > 0 && !isNaN(r) && r >= 1 ? brzycki(w, r) : null;
  }, [formWeight, formReps]);

  const bestByExercise = useMemo(() => {
    const map: Record<string, ExerciseMax> = {};
    for (const m of maxes) {
      if (m.unit !== 'kg') continue;
      if (!map[m.exercise] || m.value > map[m.exercise].value) map[m.exercise] = m;
    }
    return map;
  }, [maxes]);

  const byMuscle = useMemo(() => {
    const r: Record<MuscleIdPR, Array<{ exercise: string; oneRM: number; date: string; history: ExerciseMax[] }>> = {
      chest: [], shoulders: [], arms: [], core: [], quads_glutes: [], back: [],
    };
    for (const [exercise, best] of Object.entries(bestByExercise)) {
      const muscle = EXERCISE_TO_MUSCLE_PR[exercise];
      if (muscle) r[muscle].push({ exercise, oneRM: best.value, date: best.date, history: maxes.filter(m => m.exercise === exercise) });
    }
    return r;
  }, [bestByExercise, maxes]);

  const milestones = useMemo(() => generateMilestones(maxes), [maxes]);
  const visibleMuscles = filterMuscle ? [filterMuscle] : MUSCLE_ORDER_PR.filter(m => byMuscle[m].length > 0);
  const hasPRs = MUSCLE_ORDER_PR.some(m => byMuscle[m].length > 0);

  function handleSave() {
    if (!formExercise || !computed1RM) return;
    addMax.mutate({ exercise: formExercise, value: parseFloat(computed1RM.toFixed(2)), unit: 'kg' }, {
      onSuccess: () => { setFormWeight(''); setFormReps('1'); setFormExercise(''); setFormMuscle(null); },
    });
  }

  return (
    <>
      <div className="pr-add-panel">
        <p className="ht-section-label">QUICK PR ADD</p>
        <div className="ht-chips">
          {MUSCLE_ORDER_PR.map(id => (
            <button
              key={id}
              className={`ht-chip ${formMuscle === id ? 'ht-chip--active' : ''}`}
              onClick={() => { setFormMuscle(p => p === id ? null : id); setFormExercise(''); }}
            >
              {MUSCLE_LABELS_PR[id]}
            </button>
          ))}
        </div>
        {formMuscle && (
          <select className="ht-log-select" value={formExercise} onChange={e => setFormExercise(e.target.value)}>
            <option value="">— Esercizio —</option>
            {MUSCLE_EXERCISES_PR[formMuscle].map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        )}
        <div className="pr-add-row">
          <input
            className="ht-log-input" type="number" placeholder="Peso (kg)" min="0" step="0.5"
            value={formWeight} onChange={e => setFormWeight(e.target.value)}
          />
          <input
            className="ht-log-input pr-reps-input" type="number" placeholder="Reps" min="1" max="30"
            value={formReps} onChange={e => setFormReps(e.target.value)}
          />
        </div>
        {computed1RM !== null && parseInt(formReps) > 1 && (
          <div className="pr-1rm-preview">
            1RM (Brzycki): <strong>{computed1RM.toFixed(1)} kg</strong>
          </div>
        )}
        <button
          className="ht-log-save"
          onClick={handleSave}
          disabled={!formExercise || !formWeight || !computed1RM || addMax.isPending}
        >
          {addMax.isPending ? 'Salvataggio…' : '+ Aggiungi PR'}
        </button>
      </div>

      {hasPRs && (
        <div className="pr-tabs">
          <button className={`pr-tab ${!filterMuscle ? 'pr-tab--active' : ''}`} onClick={() => setFilterMuscle(null)}>
            Tutti
          </button>
          {MUSCLE_ORDER_PR.filter(m => byMuscle[m].length > 0).map(m => (
            <button
              key={m}
              className={`pr-tab ${filterMuscle === m ? 'pr-tab--active' : ''}`}
              onClick={() => setFilterMuscle(p => p === m ? null : m)}
            >
              {MUSCLE_LABELS_PR[m]}
            </button>
          ))}
        </div>
      )}

      {!hasPRs ? (
        <p className="ht-popover-empty" style={{ padding: '18px 0', textAlign: 'center' }}>
          Nessun PR ancora. Inizia ad aggiungere i tuoi massimali!
        </p>
      ) : (
        visibleMuscles.map(muscleId => byMuscle[muscleId].length > 0 && (
          <div key={muscleId} className="pr-muscle-group">
            <p className="pr-muscle-label">{MUSCLE_LABELS_PR[muscleId]}</p>
            <div className="pr-grid">
              {byMuscle[muscleId].map(({ exercise, oneRM, date, history }) => (
                <PRCard
                  key={exercise}
                  exercise={exercise} oneRM={oneRM} date={date} history={history}
                  bodyWeight={bodyWeight}
                  expanded={expandedEx === exercise}
                  onToggle={() => setExpandedEx(p => p === exercise ? null : exercise)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {milestones.length > 0 && (
        <div className="pr-wof">
          <div className="pr-wof-header">
            <Trophy size={12} className="pr-wof-icon" />
            <span className="ht-section-label">WALL OF FAME</span>
          </div>
          <div className="pr-wof-feed">
            {milestones.map((m, i) => (
              <div key={i} className="pr-wof-item">
                <span className="pr-wof-date">{m.date}</span>
                <span className="pr-wof-text">{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Fragment ────────────────────────────────────────────────────────────

export function HealthWorkoutFragment({ params }: { params: Record<string, unknown> }) {
  const { data: maxes = [] } = useExerciseMaxes();
  const { data: vitals = [] } = useBodyVitals();
  const addMax = useAddExerciseMax();
  const bodyWeight = vitals[0]?.weight_kg ?? null;

  const initialTab = (params.tab as TabId) ?? 'silhouette';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <NebulaCard icon={TABS.find(t => t.id === activeTab)?.icon ?? '💪'} title="Workout" variant="health">
      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="pr-tabs" style={{ marginBottom: '16px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`pr-tab ${activeTab === tab.id ? 'pr-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} {...TAB_ANIM}>
          {activeTab === 'silhouette' && (
            <SilhouetteTab maxes={maxes} addMax={addMax} />
          )}
          {activeTab === 'pr' && (
            <PRTab maxes={maxes} addMax={addMax} bodyWeight={bodyWeight} />
          )}
        </motion.div>
      </AnimatePresence>
    </NebulaCard>
  );
}
