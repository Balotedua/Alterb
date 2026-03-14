import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, RotateCcw, TrendingUp, TrendingDown, Minus, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { useExerciseMaxes, useAddExerciseMax, useBodyVitals, latestByExercise } from '@/hooks/useHealth';
import { NebulaCard } from '@/components/ui/nebula';
import type { ExerciseUnit, ExerciseMax } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type MuscleId   = 'head' | 'chest' | 'shoulders' | 'arms' | 'core' | 'quads_glutes' | 'back';
type MuscleIdPR = 'chest' | 'shoulders' | 'arms' | 'core' | 'quads_glutes' | 'back';
type TabId      = 'silhouette' | 'pr';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: 'silhouette', label: 'vessel' },
  { id: 'pr',         label: 'forge'  },
];

const TAB_ANIM = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.13 } },
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
  head: 'testa · stress', chest: 'petto', shoulders: 'spalle',
  arms: 'braccia', core: 'core', quads_glutes: 'gambe', back: 'dorso',
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
  { key: 'Squat',       label: 'squat'     },
  { key: 'Panca piana', label: 'bench'     },
  { key: 'Stacco',      label: 'deadlift'  },
];

// ─── Color / Glow logic ───────────────────────────────────────────────────────

function daysDiff(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

function muscleStroke(lastDate: string | null): string {
  if (!lastDate) return 'rgba(255,255,255,0.10)';
  const d = daysDiff(lastDate);
  if (d === 0) return 'rgba(255,34,68,0.9)';
  if (d === 1) return 'rgba(255,136,0,0.7)';
  if (d === 2) return 'rgba(255,221,0,0.55)';
  return 'rgba(255,255,255,0.14)';
}

function muscleFilter(lastDate: string | null): string {
  if (!lastDate) return 'none';
  const d = daysDiff(lastDate);
  if (d === 0) return 'drop-shadow(0 0 10px rgba(255,34,68,0.8)) drop-shadow(0 0 20px rgba(255,0,0,0.35))';
  if (d === 1) return 'drop-shadow(0 0 7px rgba(255,136,0,0.6))';
  if (d === 2) return 'drop-shadow(0 0 5px rgba(255,221,0,0.45))';
  return 'none';
}

function calendarColor(count: number): string {
  if (count === 0) return 'rgba(255,255,255,0.04)';
  if (count === 1) return 'rgba(167,139,250,0.28)';
  if (count <= 3)  return 'rgba(167,139,250,0.55)';
  return 'rgba(167,139,250,0.88)';
}

function formatValue(value: number, unit: ExerciseUnit): string {
  if (unit === 'seconds') {
    if (value >= 60) return `${Math.floor(value / 60)}m ${value % 60}s`;
    return `${value}s`;
  }
  return unit === 'kg' ? `${value}kg` : `${value}r`;
}

// ─── Body Silhouette (Medical Terminal) ───────────────────────────────────────

interface SilhouetteProps {
  strokes: Record<MuscleId, string>;
  filters: Record<MuscleId, string>;
  selected: MuscleId | null;
  showBack: boolean;
  onClick: (id: MuscleId) => void;
}

function BodySilhouette({ strokes, filters, selected, showBack, onClick }: SilhouetteProps) {
  const sel = (id: MuscleId) => selected === id ? 'ht-part--sel' : '';
  const sw = 0.5; // stroke-width: surgical precision

  return (
    <svg viewBox="0 0 280 420" className="ht-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sel-glow">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Scanning line */}
      <rect className="ht-scan-line" x="70" y="0" width="140" height="0.6" />

      {/* ── Muscle groups (stroke-only, no fill) ─── */}

      {/* Head */}
      <g className={`ht-part ${sel('head')}`} style={{ filter: filters.head }} onClick={() => onClick('head')}>
        <ellipse cx="140" cy="35" rx="24" ry="28" fill="none" stroke={strokes.head} strokeWidth={sw} />
      </g>

      {/* Neck */}
      <rect x="133" y="61" width="14" height="13" rx="4" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />

      {/* Shoulders */}
      <g className={`ht-part ${sel('shoulders')}`} style={{ filter: filters.shoulders }} onClick={() => onClick('shoulders')}>
        <ellipse cx="104" cy="94" rx="22" ry="18" fill="none" stroke={strokes.shoulders} strokeWidth={sw} />
        <ellipse cx="176" cy="94" rx="22" ry="18" fill="none" stroke={strokes.shoulders} strokeWidth={sw} />
      </g>

      {/* Chest / Back */}
      {!showBack ? (
        <g className={`ht-part ${sel('chest')}`} style={{ filter: filters.chest }} onClick={() => onClick('chest')}>
          <rect x="114" y="74" width="52" height="62" rx="6" fill="none" stroke={strokes.chest} strokeWidth={sw} />
        </g>
      ) : (
        <g className={`ht-part ${sel('back')}`} style={{ filter: filters.back }} onClick={() => onClick('back')}>
          <rect x="114" y="74" width="52" height="62" rx="6" fill="none" stroke={strokes.back} strokeWidth={sw} />
        </g>
      )}

      {/* Arms */}
      <g className={`ht-part ${sel('arms')}`} style={{ filter: filters.arms }} onClick={() => onClick('arms')}>
        <rect x="82" y="84" width="19" height="56" rx="9" fill="none" stroke={strokes.arms} strokeWidth={sw} />
        <rect x="179" y="84" width="19" height="56" rx="9" fill="none" stroke={strokes.arms} strokeWidth={sw} />
        <rect x="83" y="146" width="17" height="46" rx="8" fill="none" stroke={strokes.arms} strokeWidth={sw} strokeOpacity="0.6" />
        <rect x="180" y="146" width="17" height="46" rx="8" fill="none" stroke={strokes.arms} strokeWidth={sw} strokeOpacity="0.6" />
      </g>

      {/* Wrists */}
      <ellipse cx="91" cy="199" rx="10" ry="7" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
      <ellipse cx="189" cy="199" rx="10" ry="7" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />

      {/* Core */}
      <g className={`ht-part ${sel('core')}`} style={{ filter: filters.core }} onClick={() => onClick('core')}>
        <rect x="116" y="136" width="48" height="54" rx="6" fill="none" stroke={strokes.core} strokeWidth={sw} />
      </g>

      {/* Quads / Glutes */}
      <g className={`ht-part ${sel('quads_glutes')}`} style={{ filter: filters.quads_glutes }} onClick={() => onClick('quads_glutes')}>
        <rect x="116" y="190" width="22" height="88" rx="10" fill="none" stroke={strokes.quads_glutes} strokeWidth={sw} />
        <rect x="142" y="190" width="22" height="88" rx="10" fill="none" stroke={strokes.quads_glutes} strokeWidth={sw} />
      </g>

      {/* Calves */}
      <rect x="118" y="280" width="18" height="68" rx="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
      <rect x="144" y="280" width="18" height="68" rx="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />

      {/* Feet */}
      <ellipse cx="127" cy="354" rx="14" ry="6" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.4" />
      <ellipse cx="153" cy="354" rx="14" ry="6" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.4" />

      {/* ── Leader lines (blueprint — 45° then horizontal) ─────────────── */}
      <g stroke="rgba(255,255,255,0.12)" strokeWidth="0.3" fill="none">
        {/* Left: shoulders */}
        <polyline points="82,90 65,74 10,74" />
        {/* Left: arms */}
        <polyline points="83,130 65,148 10,148" />
        {/* Left: core */}
        <polyline points="116,162 65,178 10,178" />
        {/* Right: head */}
        <polyline points="164,32 202,18 270,18" />
        {/* Right: chest/back */}
        <polyline points="166,102 202,88 270,88" />
        {/* Right: quads */}
        <polyline points="164,232 202,250 270,250" />
      </g>

      {/* ── Leader line labels (monospace, lowercase) ─────────────────── */}
      <g fontFamily="'JetBrains Mono','Roboto Mono',monospace" fontSize="5.5" letterSpacing="0.06em">
        <text x="10" y="72" fill="rgba(255,255,255,0.38)" textAnchor="start">spalle</text>
        <text x="10" y="146" fill="rgba(255,255,255,0.38)" textAnchor="start">braccia</text>
        <text x="10" y="176" fill="rgba(255,255,255,0.38)" textAnchor="start">core</text>
        <text x="270" y="16" fill="rgba(255,255,255,0.38)" textAnchor="end">testa</text>
        <text x="270" y="86" fill="rgba(255,255,255,0.38)" textAnchor="end">{showBack ? 'dorso' : 'petto'}</text>
        <text x="270" y="248" fill="rgba(255,255,255,0.38)" textAnchor="end">gambe</text>
      </g>

      {/* ── Status markers ─────────────────────────────────────────────── */}
      <circle cx="12" cy="408" r="1.5" fill="rgba(0,255,200,0.7)" className="ht-status-dot" />
      <circle cx="20" cy="408" r="1.5" fill="rgba(0,255,200,0.35)" className="ht-status-dot ht-status-dot--delay" />
      <text x="28" y="410" fontFamily="monospace" fontSize="5" fill="rgba(255,255,255,0.18)" letterSpacing="0.06em">scan · active</text>
    </svg>
  );
}

// ─── Neon Pulse Chart (no grid, no labels, pure pulse) ────────────────────────

function NeonPulseChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return (
    <p className="mt-chart-empty">— log · min 2 sessions —</p>
  );
  const W = 280, H = 48, P = 6;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const xs = points.map((_, i) => P + ((W - P * 2) * i) / (points.length - 1));
  const ys = points.map(p => H - P - ((p.value - min) / range) * (H - P * 2));
  const poly = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-chart-svg" preserveAspectRatio="none">
      <defs>
        <filter id="neon-line-glow">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Pure neon pulse — no fill, no grid, no axes, no labels */}
      <polyline
        points={poly}
        fill="none"
        stroke="rgba(0,255,200,0.85)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#neon-line-glow)"
        className="mt-chart-line"
      />
      {/* End pulse dot */}
      <circle cx={lastX} cy={lastY} r="2.5" fill="rgba(0,255,200,1)" className="mt-chart-dot" />
    </svg>
  );
}

// ─── Strength Standard Bar ────────────────────────────────────────────────────

const STRENGTH_STANDARDS: Record<string, [number, number, number]> = {
  'Panca piana':    [0.5, 0.9, 1.2],
  'Squat':          [0.75, 1.25, 1.75],
  'Stacco':         [0.9, 1.5, 2.0],
  'Shoulder press': [0.3, 0.55, 0.75],
  'Military Press': [0.3, 0.55, 0.75],
};
const DEFAULT_STANDARDS: [number, number, number] = [0.4, 0.7, 1.0];

function StrengthBar({ exercise, oneRM, bodyWeight }: { exercise: string; oneRM: number; bodyWeight: number | null }) {
  if (!bodyWeight) return null;
  const ratio = oneRM / bodyWeight;
  const [nov, inter, adv] = STRENGTH_STANDARDS[exercise] ?? DEFAULT_STANDARDS;
  const elite = adv * 1.38;
  let level = 'novizio', pct = 0;
  if (ratio >= elite)      { level = 'elite';       pct = 100; }
  else if (ratio >= adv)   { level = 'avanzato';    pct = 75 + ((ratio - adv)   / (elite - adv))   * 25; }
  else if (ratio >= inter) { level = 'intermedio';  pct = 50 + ((ratio - inter) / (adv - inter))   * 25; }
  else if (ratio >= nov)   { level = 'novizio';     pct = 25 + ((ratio - nov)   / (inter - nov))   * 25; }
  else                     {                         pct = (ratio / nov) * 25; }
  pct = Math.max(2, Math.min(100, pct));
  const color = level === 'elite' ? '#ffd700' : level === 'avanzato' ? 'rgba(0,255,200,0.9)' : level === 'intermedio' ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.3)';
  return (
    <div className="mt-strength-wrap">
      <div className="mt-strength-header">
        <span className="mt-strength-label">strength_standard</span>
        <span className="mt-strength-level" style={{ color }}>{level}</span>
      </div>
      <div className="mt-strength-track">
        <div className="mt-strength-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── PR MATRIX — Constants ────────────────────────────────────────────────────

const MUSCLE_LABELS_PR: Record<MuscleIdPR, string> = {
  chest: 'petto', shoulders: 'spalle', arms: 'braccia',
  core: 'core', quads_glutes: 'gambe', back: 'dorso',
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
      if (prev > 0) milestones.push({ date: m.date, text: `pr · ${m.exercise.toLowerCase()} · ${m.value.toFixed(1)}kg` });
      for (const ms of ROUND_MILESTONES) {
        if (prev < ms && m.value >= ms)
          milestones.push({ date: m.date, text: `wall_broken · ${m.exercise.toLowerCase()} · ${ms}kg` });
      }
      best[m.exercise] = m.value;
    }
  }
  return milestones.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
}

// ─── Tech Log Row (replaces PRCard) ──────────────────────────────────────────

interface TechLogRowProps {
  exercise: string; oneRM: number; date: string;
  history: ExerciseMax[]; bodyWeight: number | null;
  expanded: boolean; onToggle: () => void;
}

function dots(nameLen: number): string {
  const count = Math.max(4, 32 - nameLen);
  return '·'.repeat(count);
}

function TechLogRow({ exercise, oneRM, date, history, bodyWeight, expanded, onToggle }: TechLogRowProps) {
  const ago = new Date(); ago.setDate(ago.getDate() - 30);
  const agoStr = ago.toISOString().slice(0, 10);
  const prevBest = history.filter(m => m.date <= agoStr).reduce((mx, m) => Math.max(mx, m.value), 0);
  const trend = prevBest === 0 ? 'new' : oneRM > prevBest * 1.01 ? 'up' : oneRM < prevBest * 0.99 ? 'down' : 'flat';
  const pctChange = prevBest > 0 ? ((oneRM - prevBest) / prevBest * 100) : null;
  const pctStr = pctChange !== null ? `${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%` : 'new';
  const bwThr = BW_QUALITY[exercise] ?? DEFAULT_BW_QUALITY;
  const isElite = bodyWeight ? oneRM >= bodyWeight * bwThr : false;
  const chartPoints = history.filter(m => m.unit === 'kg').sort((a, b) => a.date.localeCompare(b.date)).slice(-10).map(m => ({ date: m.date, value: m.value }));
  const nameLower = exercise.toLowerCase();
  const _ = date; // date unused in row display but kept for prop contract

  return (
    <motion.div
      className={`mt-log-row ${isElite ? 'mt-log-row--elite' : ''}`}
      layout
      onClick={onToggle}
    >
      <div className="mt-log-main">
        <span className="mt-log-prompt">›</span>
        <span className="mt-log-name">{nameLower}</span>
        <span className="mt-log-dots">{dots(nameLower.length)}</span>
        <span className="mt-log-bracket">[</span>
        <span className="mt-log-value">{oneRM.toFixed(1)}</span>
        <span className="mt-log-unit">kg</span>
        <span className="mt-log-bracket">]</span>
        <span className={`mt-log-delta mt-log-delta--${trend}`}>{pctStr}</span>
        <span className="mt-log-icons">
          {trend === 'up'   ? <TrendingUp  size={10} strokeWidth={1.25} className="mt-trend-icon mt-trend--up" />
          : trend === 'down' ? <TrendingDown size={10} strokeWidth={1.25} className="mt-trend-icon mt-trend--down" />
          :                    <Minus        size={10} strokeWidth={1.25} className="mt-trend-icon mt-trend--flat" />}
          {expanded ? <ChevronUp size={10} strokeWidth={1.25} className="mt-chevron" /> : <ChevronDown size={10} strokeWidth={1.25} className="mt-chevron" />}
        </span>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="mt-log-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            onClick={e => e.stopPropagation()}
          >
            <NeonPulseChart points={chartPoints} />
            <StrengthBar exercise={exercise} oneRM={oneRM} bodyWeight={bodyWeight} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Silhouette Tab ───────────────────────────────────────────────────────────

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

  const strokes = useMemo(
    () => Object.fromEntries(MUSCLE_ORDER.map(id => [id, muscleStroke(lastTrained[id])])) as Record<MuscleId, string>,
    [lastTrained]
  );
  const filters = useMemo(
    () => Object.fromEntries(MUSCLE_ORDER.map(id => [id, muscleFilter(lastTrained[id])])) as Record<MuscleId, string>,
    [lastTrained]
  );

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleId | null>(null);
  const [showBack, setShowBack]   = useState(false);
  const [logMuscle, setLogMuscle] = useState<MuscleId | null>(null);
  const [logExercise, setLogExercise] = useState('');
  const [logValue, setLogValue]   = useState('');
  const [logUnit, setLogUnit]     = useState<ExerciseUnit>('kg');

  const bigThree = useMemo(() =>
    BIG_THREE.map(({ key, label }) => {
      const ex = latest.find(e => e.exercise === key);
      return { label, value: ex ? `${ex.value}kg` : '——' };
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
    setLogValue(''); setLogExercise(''); setLogMuscle(null);
  }

  const THERMAL_LEGEND = [
    { stroke: 'rgba(255,34,68,0.9)',   label: '< 24h' },
    { stroke: 'rgba(255,136,0,0.7)',   label: '< 48h' },
    { stroke: 'rgba(255,221,0,0.55)',  label: '< 72h' },
    { stroke: 'rgba(255,255,255,0.14)', label: 'recovered' },
  ];

  return (
    <>
      <div className="ht-body-row">
        <div className="ht-svg-wrap">
          <button
            className="ht-rotate-btn"
            onClick={() => { setShowBack(v => !v); setSelectedMuscle(null); }}
          >
            <RotateCcw size={12} strokeWidth={1.25} />
            {showBack ? 'front' : 'back'}
          </button>
          <BodySilhouette
            strokes={strokes} filters={filters}
            selected={selectedMuscle} showBack={showBack}
            onClick={id => setSelectedMuscle(prev => prev === id ? null : id)}
          />
          <div className="ht-legend">
            {THERMAL_LEGEND.map(l => (
              <div key={l.label} className="ht-legend-item">
                <span className="ht-legend-swatch" style={{ borderColor: l.stroke, boxShadow: `0 0 4px ${l.stroke}` }} />
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
              initial={{ opacity: 0, x: 10, scale: 0.96 }}
              animate={{ opacity: 1, x: 0,  scale: 1    }}
              exit={{    opacity: 0, x: 6,  scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            >
              <div className="ht-popover-header">
                <span className="ht-popover-title">{MUSCLE_LABELS[selectedMuscle]}</span>
                <button className="ht-popover-close" onClick={() => setSelectedMuscle(null)}>
                  <X size={11} strokeWidth={1.25} />
                </button>
              </div>
              {lastTrained[selectedMuscle] && (
                <p className="ht-popover-date">
                  last · <strong>{lastTrained[selectedMuscle]}</strong>
                  {' '}· {daysDiff(lastTrained[selectedMuscle]!)}d ago
                </p>
              )}
              {popoverExs.length > 0 ? (
                <div className="ht-popover-exlist">
                  {popoverExs.map(ex => (
                    <div key={ex.id} className="ht-popover-ex">
                      <span className="ht-popover-ex-name">{ex.exercise.toLowerCase()}</span>
                      <span className="ht-popover-ex-val">{formatValue(ex.value, ex.unit)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ht-popover-empty">// no data logged</p>
              )}
              <button
                className="ht-popover-log-btn"
                onClick={() => { setLogMuscle(selectedMuscle); setSelectedMuscle(null); }}
              >
                + log session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Big 3 */}
      <div className="ht-big3">
        {bigThree.map(({ label, value }) => (
          <div key={label} className="ht-big3-card">
            <span className="ht-big3-val">{value}</span>
            <span className="ht-big3-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Quick Log */}
      <div className="ht-section">
        <p className="ht-section-label">// quick log</p>
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
              transition={{ duration: 0.2 }}
              className="mt-cmd-form"
            >
              <div className="mt-cmd-row">
                <span className="mt-cmd-prompt">›</span>
                <select
                  className="mt-cmd-select"
                  value={logExercise}
                  onChange={e => handleLogExerciseChange(e.target.value)}
                >
                  <option value="">select exercise_</option>
                  {MUSCLE_EXERCISES[logMuscle].map(ex => (
                    <option key={ex.name} value={ex.name}>{ex.name.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="mt-cmd-row">
                <span className="mt-cmd-prompt">›</span>
                <input
                  className="mt-cmd-input"
                  type="number" min="0"
                  placeholder={logUnit === 'seconds' ? 'seconds_' : logUnit === 'kg' ? 'weight_kg' : 'reps_'}
                  value={logValue}
                  onChange={e => setLogValue(e.target.value)}
                />
                <select
                  className="mt-cmd-unit"
                  value={logUnit}
                  onChange={e => setLogUnit(e.target.value as ExerciseUnit)}
                >
                  <option value="kg">kg</option>
                  <option value="reps">reps</option>
                  <option value="seconds">sec</option>
                </select>
              </div>
              <button
                className="mt-cmd-save"
                onClick={handleSave}
                disabled={!logExercise || !logValue || addMax.isPending}
              >
                {addMax.isPending ? '// saving...' : '// commit session'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Training Calendar */}
      <div className="ht-section">
        <p className="ht-section-label">// training_calendar · last 42d</p>
        <div className="ht-calendar">
          {calDays.map(({ date, count }) => (
            <div
              key={date}
              className="ht-cal-cell"
              style={{ background: calendarColor(count) }}
              title={`${date}${count > 0 ? ` · ${count} ex` : ''}`}
            />
          ))}
        </div>
        <div className="ht-cal-legend">
          <span className="ht-cal-legend-text">low</span>
          {[0, 1, 2, 4].map(c => (
            <span key={c} className="ht-cal-swatch" style={{ background: calendarColor(c) }} />
          ))}
          <span className="ht-cal-legend-text">high</span>
        </div>
      </div>
    </>
  );
}

// ─── Forge (PR) Tab ──────────────────────────────────────────────────────────

interface ForgeTabProps {
  maxes: ExerciseMax[];
  addMax: ReturnType<typeof useAddExerciseMax>;
  bodyWeight: number | null;
}

function ForgeTab({ maxes, addMax, bodyWeight }: ForgeTabProps) {
  const [formMuscle, setFormMuscle]     = useState<MuscleIdPR | null>(null);
  const [formExercise, setFormExercise] = useState('');
  const [formWeight, setFormWeight]     = useState('');
  const [formReps, setFormReps]         = useState('1');
  const [expandedEx, setExpandedEx]     = useState<string | null>(null);
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
      {/* Command-line PR Add */}
      <div className="mt-cmd-wrap">
        <p className="ht-section-label">// quick pr add</p>
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
        <AnimatePresence>
          {formMuscle && (
            <motion.div
              className="mt-cmd-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mt-cmd-row">
                <span className="mt-cmd-prompt">›</span>
                <select className="mt-cmd-select" value={formExercise} onChange={e => setFormExercise(e.target.value)}>
                  <option value="">select exercise_</option>
                  {MUSCLE_EXERCISES_PR[formMuscle].map(ex => (
                    <option key={ex} value={ex}>{ex.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="mt-cmd-row">
                <span className="mt-cmd-prompt">›</span>
                <input
                  className="mt-cmd-input" type="number" placeholder="weight_kg" min="0" step="0.5"
                  value={formWeight} onChange={e => setFormWeight(e.target.value)}
                />
                <span className="mt-cmd-sep">×</span>
                <input
                  className="mt-cmd-input mt-cmd-input--sm" type="number" placeholder="reps" min="1" max="30"
                  value={formReps} onChange={e => setFormReps(e.target.value)}
                />
              </div>
              {computed1RM !== null && parseInt(formReps) > 1 && (
                <div className="mt-cmd-1rm">
                  <span className="mt-cmd-prompt">›</span>
                  <span>1rm_brzycki <strong>{computed1RM.toFixed(1)}</strong>kg</span>
                </div>
              )}
              <button
                className="mt-cmd-save"
                onClick={handleSave}
                disabled={!formExercise || !formWeight || !computed1RM || addMax.isPending}
              >
                {addMax.isPending ? '// saving...' : '// commit pr'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filter tabs */}
      {hasPRs && (
        <div className="mt-filter-tabs">
          <button className={`mt-filter-tab ${!filterMuscle ? 'mt-filter-tab--active' : ''}`} onClick={() => setFilterMuscle(null)}>
            all
          </button>
          {MUSCLE_ORDER_PR.filter(m => byMuscle[m].length > 0).map(m => (
            <button
              key={m}
              className={`mt-filter-tab ${filterMuscle === m ? 'mt-filter-tab--active' : ''}`}
              onClick={() => setFilterMuscle(p => p === m ? null : m)}
            >
              {MUSCLE_LABELS_PR[m]}
            </button>
          ))}
        </div>
      )}

      {/* Technical Log */}
      {!hasPRs ? (
        <p className="ht-popover-empty" style={{ padding: '20px 0', textAlign: 'center' }}>
          // no records · start logging
        </p>
      ) : (
        visibleMuscles.map(muscleId => byMuscle[muscleId].length > 0 && (
          <div key={muscleId} className="mt-muscle-group">
            <p className="mt-muscle-label">// {MUSCLE_LABELS_PR[muscleId]}</p>
            <div className="mt-log-list">
              {byMuscle[muscleId].map(({ exercise, oneRM, date, history }) => (
                <TechLogRow
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

      {/* Wall of Fame — as terminal feed */}
      {milestones.length > 0 && (
        <div className="mt-wof">
          <div className="mt-wof-header">
            <Trophy size={11} strokeWidth={1.25} className="mt-wof-icon" />
            <span className="ht-section-label">// wall_of_fame</span>
          </div>
          <div className="mt-wof-feed">
            {milestones.map((m, i) => (
              <div key={i} className="mt-wof-item">
                <span className="mt-wof-date">{m.date}</span>
                <span className="mt-wof-text">{m.text}</span>
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
    <NebulaCard icon="💪" title="medical terminal" variant="health">
      {/* Tab bar */}
      <div className="mt-tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`mt-tab ${activeTab === tab.id ? 'mt-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <span className="mt-tab-flicker" />
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} {...TAB_ANIM}>
          {activeTab === 'silhouette' && <SilhouetteTab maxes={maxes} addMax={addMax} />}
          {activeTab === 'pr'         && <ForgeTab maxes={maxes} addMax={addMax} bodyWeight={bodyWeight} />}
        </motion.div>
      </AnimatePresence>
    </NebulaCard>
  );
}
