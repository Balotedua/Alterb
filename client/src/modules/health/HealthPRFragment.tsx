import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { useExerciseMaxes, useAddExerciseMax, useBodyVitals } from '@/hooks/useHealth';
import { NebulaCard } from '@/components/ui/nebula';
import type { ExerciseMax } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type MuscleId = 'chest' | 'shoulders' | 'arms' | 'core' | 'quads_glutes' | 'back';

// ─── Constants ───────────────────────────────────────────────────────────────

const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Petto', shoulders: 'Spalle', arms: 'Braccia',
  core: 'Core', quads_glutes: 'Gambe', back: 'Dorso',
};

const MUSCLE_EXERCISES: Record<MuscleId, string[]> = {
  chest:        ['Panca piana', 'Dips', 'Cavi alti', 'Push-up'],
  shoulders:    ['Shoulder press', 'Military Press', 'Alzate Laterali'],
  arms:         ['Bicipiti curl', 'Tricipiti', 'Hammer curl'],
  core:         ['Plank', 'Crunches', 'Russian Twist', 'Leg Raise'],
  quads_glutes: ['Squat', 'Leg Press', 'Hip Thrust', 'Affondi', 'Leg Extension'],
  back:         ['Stacco', 'Lat Machine', 'Rematore', 'Trazione'],
};

const EXERCISE_TO_MUSCLE: Record<string, MuscleId> = Object.fromEntries(
  Object.entries(MUSCLE_EXERCISES).flatMap(([m, exs]) => exs.map(e => [e, m as MuscleId]))
);

const MUSCLE_ORDER: MuscleId[] = ['chest', 'quads_glutes', 'back', 'shoulders', 'arms', 'core'];

// BW quality thresholds (1RM as multiple of body weight → golden aura)
const BW_QUALITY: Record<string, number> = {
  'Panca piana': 1.5, 'Squat': 2.0, 'Stacco': 2.5,
  'Shoulder press': 0.75, 'Military Press': 0.75,
  'Hip Thrust': 2.0, 'Rematore': 1.25,
};
const DEFAULT_BW_QUALITY = 1.0;

// Strength standards: [novizio, intermedio, avanzato] as BW multiples
const STRENGTH_STANDARDS: Record<string, [number, number, number]> = {
  'Panca piana': [0.5, 0.9, 1.2],
  'Squat':       [0.75, 1.25, 1.75],
  'Stacco':      [0.9, 1.5, 2.0],
  'Shoulder press': [0.3, 0.55, 0.75],
  'Military Press': [0.3, 0.55, 0.75],
};
const DEFAULT_STANDARDS: [number, number, number] = [0.4, 0.7, 1.0];

const ROUND_MILESTONES = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 250];

// ─── Brzycki 1RM ─────────────────────────────────────────────────────────────

function brzycki(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight / (1.0278 - 0.0278 * reps);
}

// ─── Milestone Generator ─────────────────────────────────────────────────────

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

// ─── Mini Line Chart ─────────────────────────────────────────────────────────

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

// ─── Strength Standards Bar ───────────────────────────────────────────────────

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

// ─── PR Card ─────────────────────────────────────────────────────────────────

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

// ─── Main Fragment ────────────────────────────────────────────────────────────

export function HealthPRFragment({ params: _ }: { params: Record<string, unknown> }) {
  const { data: maxes = [] } = useExerciseMaxes();
  const { data: vitals = [] } = useBodyVitals();
  const addMax = useAddExerciseMax();
  const bodyWeight = vitals[0]?.weight_kg ?? null;

  const [formMuscle, setFormMuscle] = useState<MuscleId | null>(null);
  const [formExercise, setFormExercise] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formReps, setFormReps] = useState('1');
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [filterMuscle, setFilterMuscle] = useState<MuscleId | null>(null);

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
    const r: Record<MuscleId, Array<{ exercise: string; oneRM: number; date: string; history: ExerciseMax[] }>> = {
      chest: [], shoulders: [], arms: [], core: [], quads_glutes: [], back: [],
    };
    for (const [exercise, best] of Object.entries(bestByExercise)) {
      const muscle = EXERCISE_TO_MUSCLE[exercise];
      if (muscle) r[muscle].push({ exercise, oneRM: best.value, date: best.date, history: maxes.filter(m => m.exercise === exercise) });
    }
    return r;
  }, [bestByExercise, maxes]);

  const milestones = useMemo(() => generateMilestones(maxes), [maxes]);
  const visibleMuscles = filterMuscle ? [filterMuscle] : MUSCLE_ORDER.filter(m => byMuscle[m].length > 0);
  const hasPRs = MUSCLE_ORDER.some(m => byMuscle[m].length > 0);

  function handleSave() {
    if (!formExercise || !computed1RM) return;
    addMax.mutate({ exercise: formExercise, value: parseFloat(computed1RM.toFixed(2)), unit: 'kg' }, {
      onSuccess: () => { setFormWeight(''); setFormReps('1'); setFormExercise(''); setFormMuscle(null); },
    });
  }

  return (
    <NebulaCard icon="🏆" title="PR Matrix · Personal Records" variant="health">

      {/* ── Quick PR Add ─────────────────────────────────────────────── */}
      <div className="pr-add-panel">
        <p className="ht-section-label">QUICK PR ADD</p>
        <div className="ht-chips">
          {MUSCLE_ORDER.map(id => (
            <button
              key={id}
              className={`ht-chip ${formMuscle === id ? 'ht-chip--active' : ''}`}
              onClick={() => { setFormMuscle(p => p === id ? null : id); setFormExercise(''); }}
            >
              {MUSCLE_LABELS[id]}
            </button>
          ))}
        </div>
        {formMuscle && (
          <select className="ht-log-select" value={formExercise} onChange={e => setFormExercise(e.target.value)}>
            <option value="">— Esercizio —</option>
            {MUSCLE_EXERCISES[formMuscle].map(ex => <option key={ex} value={ex}>{ex}</option>)}
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

      {/* ── Muscle filter tabs ───────────────────────────────────────── */}
      {hasPRs && (
        <div className="pr-tabs">
          <button className={`pr-tab ${!filterMuscle ? 'pr-tab--active' : ''}`} onClick={() => setFilterMuscle(null)}>
            Tutti
          </button>
          {MUSCLE_ORDER.filter(m => byMuscle[m].length > 0).map(m => (
            <button
              key={m}
              className={`pr-tab ${filterMuscle === m ? 'pr-tab--active' : ''}`}
              onClick={() => setFilterMuscle(p => p === m ? null : m)}
            >
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      {/* ── PR Matrix ───────────────────────────────────────────────── */}
      {!hasPRs ? (
        <p className="ht-popover-empty" style={{ padding: '18px 0', textAlign: 'center' }}>
          Nessun PR ancora. Inizia ad aggiungere i tuoi massimali!
        </p>
      ) : (
        visibleMuscles.map(muscleId => byMuscle[muscleId].length > 0 && (
          <div key={muscleId} className="pr-muscle-group">
            <p className="pr-muscle-label">{MUSCLE_LABELS[muscleId]}</p>
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

      {/* ── Wall of Fame ─────────────────────────────────────────────── */}
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

    </NebulaCard>
  );
}
