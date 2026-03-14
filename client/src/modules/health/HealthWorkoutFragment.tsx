import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, TrendingUp, TrendingDown, Minus, Trophy,
  ChevronDown, ChevronUp, Plus, RotateCcw,
} from 'lucide-react';
import {
  useExerciseMaxes, useAddExerciseMax, useBodyVitals, latestByExercise,
  useWorkoutSessions, useAddWorkoutSession,
  useCustomExercises, useAddCustomExercise,
  type CustomExercise,
} from '@/hooks/useHealth';
import { NebulaCard } from '@/components/ui/nebula';
import type { ExerciseUnit, ExerciseMax, WorkoutSession } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type MuscleId   = 'head' | 'chest' | 'shoulders' | 'arms' | 'core' | 'quads_glutes' | 'back';
type MuscleIdPR = 'chest' | 'shoulders' | 'arms' | 'core' | 'quads_glutes' | 'back';
type TabId      = 'vessel' | 'forge';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: 'vessel', label: 'Corpo'     },
  { id: 'forge',  label: 'Massimali' },
];

const TAB_ANIM = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.13 } },
};

const MUSCLE_LABELS: Record<MuscleId, string> = {
  head: 'Testa', chest: 'Petto', shoulders: 'Spalle',
  arms: 'Braccia', core: 'Core', quads_glutes: 'Gambe', back: 'Dorso',
};

const MUSCLE_EXERCISES: Record<MuscleId, Array<{ name: string; unit: ExerciseUnit }>> = {
  head:         [{ name: 'Meditazione', unit: 'seconds' }, { name: 'Respirazione', unit: 'seconds' }],
  chest:        [{ name: 'Panca piana', unit: 'kg' }, { name: 'Dips', unit: 'kg' }, { name: 'Push-up', unit: 'reps' }, { name: 'Cavi alti', unit: 'kg' }],
  shoulders:    [{ name: 'Shoulder press', unit: 'kg' }, { name: 'Military Press', unit: 'kg' }, { name: 'Alzate Laterali', unit: 'kg' }],
  arms:         [{ name: 'Flessioni', unit: 'reps' }, { name: 'Bicipiti curl', unit: 'kg' }, { name: 'Tricipiti', unit: 'kg' }, { name: 'Hammer curl', unit: 'kg' }],
  core:         [{ name: 'Plank', unit: 'seconds' }, { name: 'Crunches', unit: 'reps' }, { name: 'Russian Twist', unit: 'reps' }, { name: 'Leg Raise', unit: 'reps' }],
  quads_glutes: [{ name: 'Squat', unit: 'kg' }, { name: 'Leg Press', unit: 'kg' }, { name: 'Leg Extension', unit: 'kg' }, { name: 'Affondi', unit: 'reps' }, { name: 'Hip Thrust', unit: 'kg' }],
  back:         [{ name: 'Stacco', unit: 'kg' }, { name: 'Trazione', unit: 'reps' }, { name: 'Lat Machine', unit: 'kg' }, { name: 'Rematore', unit: 'kg' }],
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
const LOG_MUSCLES: MuscleId[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'quads_glutes'];

const BIG_THREE = [
  { key: 'Squat',       label: 'Squat'    },
  { key: 'Panca piana', label: 'Bench'    },
  { key: 'Stacco',      label: 'Deadlift' },
];

const MUSCLE_LABELS_PR: Record<MuscleIdPR, string> = {
  chest: 'Petto', shoulders: 'Spalle', arms: 'Braccia',
  core: 'Core', quads_glutes: 'Gambe', back: 'Dorso',
};

const MUSCLE_ICON_PR: Record<MuscleIdPR, string> = {
  chest: '◻', shoulders: '△', arms: '○', core: '▷', quads_glutes: '▽', back: '▣',
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
const ROUND_MILESTONES = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 250];

const STRENGTH_STANDARDS: Record<string, [number, number, number]> = {
  'Panca piana':    [0.5, 0.9, 1.2],
  'Squat':          [0.75, 1.25, 1.75],
  'Stacco':         [0.9, 1.5, 2.0],
  'Shoulder press': [0.3, 0.55, 0.75],
  'Military Press': [0.3, 0.55, 0.75],
};
const DEFAULT_STANDARDS: [number, number, number] = [0.4, 0.7, 1.0];

const BW_QUALITY: Record<string, number> = {
  'Panca piana': 1.5, 'Squat': 2.0, 'Stacco': 2.5,
  'Shoulder press': 0.75, 'Military Press': 0.75,
  'Hip Thrust': 2.0, 'Rematore': 1.25,
};
const DEFAULT_BW_QUALITY = 1.0;

const RPE_LABELS: Record<number, string> = {
  1: 'Riscaldamento', 2: 'Facile', 3: 'Leggero', 4: 'Moderato', 5: 'Medio',
  6: 'Impegnativo', 7: 'Pesante', 8: 'Molto pesante', 9: 'Quasi al limite', 10: 'Massimo',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysDiff(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

function muscleFill(lastDate: string | null): string {
  if (!lastDate) return 'rgba(255,255,255,0.03)';
  const d = daysDiff(lastDate);
  if (d === 0) return 'rgba(255,34,68,0.28)';
  if (d === 1) return 'rgba(255,136,0,0.20)';
  if (d === 2) return 'rgba(255,221,0,0.13)';
  return 'rgba(255,255,255,0.03)';
}

function muscleStroke(lastDate: string | null): string {
  if (!lastDate) return 'rgba(255,255,255,0.10)';
  const d = daysDiff(lastDate);
  if (d === 0) return 'rgba(255,34,68,0.90)';
  if (d === 1) return 'rgba(255,136,0,0.70)';
  if (d === 2) return 'rgba(255,221,0,0.55)';
  return 'rgba(255,255,255,0.14)';
}

function muscleGlow(lastDate: string | null): string {
  if (!lastDate) return 'none';
  const d = daysDiff(lastDate);
  if (d === 0) return 'drop-shadow(0 0 8px rgba(255,34,68,0.75)) drop-shadow(0 0 18px rgba(255,0,0,0.3))';
  if (d === 1) return 'drop-shadow(0 0 6px rgba(255,136,0,0.55))';
  if (d === 2) return 'drop-shadow(0 0 4px rgba(255,221,0,0.4))';
  return 'none';
}

function rpeColor(rpe: number | null): string {
  if (!rpe) return 'rgba(255,255,255,0.06)';
  if (rpe >= 9) return 'rgba(255,34,68,0.65)';
  if (rpe >= 7) return 'rgba(255,136,0,0.55)';
  if (rpe >= 5) return 'rgba(167,139,250,0.50)';
  return 'rgba(167,139,250,0.25)';
}

function brzycki(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight / (1.0278 - 0.0278 * reps);
}

function formatValue(value: number, unit: ExerciseUnit): string {
  if (unit === 'seconds') {
    if (value >= 60) return `${Math.floor(value / 60)}m${value % 60}s`;
    return `${value}s`;
  }
  return unit === 'kg' ? `${value}kg` : `${value}r`;
}

// ─── Body Silhouette SVG ──────────────────────────────────────────────────────

interface SilhouetteProps {
  fills:   Record<MuscleId, string>;
  strokes: Record<MuscleId, string>;
  glows:   Record<MuscleId, string>;
  pulsing: Record<MuscleId, boolean>;
  selected: MuscleId | null;
  showBack: boolean;
  onClick: (id: MuscleId) => void;
}

function BodySilhouette({ fills, strokes, glows, pulsing, selected, showBack, onClick }: SilhouetteProps) {
  const cls = (id: MuscleId) =>
    `vs-muscle${selected === id ? ' vs-muscle--sel' : ''}${pulsing[id] ? ' vs-muscle--pulse' : ''}`;
  const sw = 0.6;
  const tr = 'fill 0.9s ease-in-out, stroke 0.9s ease-in-out';

  return (
    <svg viewBox="0 0 120 333" className="vs-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vs-scan-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="rgba(0,255,200,0)"   />
          <stop offset="50%"  stopColor="rgba(0,255,200,0.55)"/>
          <stop offset="100%" stopColor="rgba(0,255,200,0)"   />
        </linearGradient>
      </defs>

      {/* Ghost anatomy (non-interactive) */}
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="0.35" fill="none">
        <rect x="54" y="44" width="12" height="13" rx="3" />
        <ellipse cx="22" cy="167" rx="7" ry="5" />
        <ellipse cx="98" cy="167" rx="7" ry="5" />
        <rect x="45" y="260" width="13" height="58" rx="6" />
        <rect x="62" y="260" width="13" height="58" rx="6" />
        <ellipse cx="51" cy="323" rx="11" ry="5" />
        <ellipse cx="69" cy="323" rx="11" ry="5" />
      </g>

      {/* Head */}
      <g className={cls('head')} style={{ filter: glows.head }} onClick={() => onClick('head')}>
        <ellipse cx="60" cy="22" rx="17" ry="20"
          fill={fills.head} stroke={strokes.head} strokeWidth={sw}
          style={{ transition: tr }} />
      </g>

      {/* Shoulders */}
      <g className={cls('shoulders')} style={{ filter: glows.shoulders }} onClick={() => onClick('shoulders')}>
        <ellipse cx="32" cy="72" rx="15" ry="12"
          fill={fills.shoulders} stroke={strokes.shoulders} strokeWidth={sw}
          style={{ transition: tr }} />
        <ellipse cx="88" cy="72" rx="15" ry="12"
          fill={fills.shoulders} stroke={strokes.shoulders} strokeWidth={sw}
          style={{ transition: tr }} />
      </g>

      {/* Chest / Back */}
      {!showBack ? (
        <g className={cls('chest')} style={{ filter: glows.chest }} onClick={() => onClick('chest')}>
          <path d="M44,64 L60,64 L60,122 L46,122 Z"
            fill={fills.chest} stroke={strokes.chest} strokeWidth={sw} strokeLinejoin="round"
            style={{ transition: tr }} />
          <path d="M60,64 L76,64 L74,122 L60,122 Z"
            fill={fills.chest} stroke={strokes.chest} strokeWidth={sw} strokeLinejoin="round"
            style={{ transition: tr }} />
          <line x1="60" y1="66" x2="60" y2="121" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
        </g>
      ) : (
        <g className={cls('back')} style={{ filter: glows.back }} onClick={() => onClick('back')}>
          <path d="M42,64 L78,64 L76,126 L44,126 Z"
            fill={fills.back} stroke={strokes.back} strokeWidth={sw} strokeLinejoin="round"
            style={{ transition: tr }} />
          <line x1="60" y1="66" x2="60" y2="125" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" strokeDasharray="2,2" />
        </g>
      )}

      {/* Arms */}
      <g className={cls('arms')} style={{ filter: glows.arms }} onClick={() => onClick('arms')}>
        <rect x="22" y="72" width="13" height="48" rx="6"
          fill={fills.arms} stroke={strokes.arms} strokeWidth={sw} style={{ transition: tr }} />
        <rect x="85" y="72" width="13" height="48" rx="6"
          fill={fills.arms} stroke={strokes.arms} strokeWidth={sw} style={{ transition: tr }} />
        <rect x="21" y="124" width="12" height="42" rx="5"
          fill={fills.arms} stroke={strokes.arms} strokeWidth={sw} strokeOpacity="0.6"
          style={{ transition: 'fill 0.9s ease-in-out' }} />
        <rect x="87" y="124" width="12" height="42" rx="5"
          fill={fills.arms} stroke={strokes.arms} strokeWidth={sw} strokeOpacity="0.6"
          style={{ transition: 'fill 0.9s ease-in-out' }} />
      </g>

      {/* Core */}
      <g className={cls('core')} style={{ filter: glows.core }} onClick={() => onClick('core')}>
        <rect x="45" y="124" width="30" height="54" rx="4"
          fill={fills.core} stroke={strokes.core} strokeWidth={sw} style={{ transition: tr }} />
        <line x1="45" y1="142" x2="75" y2="142" stroke="rgba(255,255,255,0.03)" strokeWidth="0.35" />
        <line x1="45" y1="160" x2="75" y2="160" stroke="rgba(255,255,255,0.03)" strokeWidth="0.35" />
        <line x1="60" y1="124" x2="60" y2="178" stroke="rgba(255,255,255,0.03)" strokeWidth="0.35" />
      </g>

      {/* Quads / Glutes */}
      <g className={cls('quads_glutes')} style={{ filter: glows.quads_glutes }} onClick={() => onClick('quads_glutes')}>
        <rect x="44" y="176" width="30" height="6" rx="2"
          fill={fills.quads_glutes} stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"
          style={{ transition: 'fill 0.9s ease-in-out' }} />
        <rect x="44" y="182" width="14" height="76" rx="8"
          fill={fills.quads_glutes} stroke={strokes.quads_glutes} strokeWidth={sw} style={{ transition: tr }} />
        <rect x="62" y="182" width="14" height="76" rx="8"
          fill={fills.quads_glutes} stroke={strokes.quads_glutes} strokeWidth={sw} style={{ transition: tr }} />
      </g>

      {/* Scan line */}
      <rect className="vs-scan-line" x="20" y="0" width="80" height="2"
        fill="url(#vs-scan-grad)" opacity="0.8" />

      {/* Status */}
      <circle cx="8" cy="350" r="1.5" fill="rgba(0,255,200,0.7)" className="ht-status-dot" />
      <text x="14" y="352" fontFamily="monospace" fontSize="4.5"
        fill="rgba(255,255,255,0.15)" letterSpacing="0.04em">corpo · scanner</text>
    </svg>
  );
}

// ─── Workout Log Modal ────────────────────────────────────────────────────────

interface WorkoutModalProps {
  onClose: () => void;
  onSave: (muscles: MuscleId[], rpe: number, notes: string) => void;
  isPending: boolean;
}

function WorkoutModal({ onClose, onSave, isPending }: WorkoutModalProps) {
  const [muscles, setMuscles] = useState<MuscleId[]>([]);
  const [rpe, setRpe]         = useState(7);
  const [notes, setNotes]     = useState('');

  function toggle(id: MuscleId) {
    setMuscles(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);
  }

  return (
    <div className="vs-modal-backdrop" onClick={onClose}>
      <motion.div
        className="vs-modal"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
        onClick={e => e.stopPropagation()}
      >
        <div className="vs-modal-header">
          <span className="vs-modal-title">Registra allenamento</span>
          <button className="vs-modal-close" onClick={onClose}><X size={13} strokeWidth={1.5} /></button>
        </div>

        <div className="vs-modal-section">
          <p className="vs-modal-label">Muscoli coinvolti</p>
          <div className="vs-modal-chips">
            {LOG_MUSCLES.map(id => (
              <button
                key={id}
                className={`vs-modal-chip ${muscles.includes(id) ? 'vs-modal-chip--active' : ''}`}
                onClick={() => toggle(id)}
              >
                {MUSCLE_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="vs-modal-section">
          <div className="vs-modal-rpe-header">
            <p className="vs-modal-label">Intensità</p>
            <span className="vs-modal-rpe-val" style={{ color: rpeColor(rpe) }}>
              {rpe} · {RPE_LABELS[rpe]}
            </span>
          </div>
          <input
            type="range" min={1} max={10} step={1}
            value={rpe}
            onChange={e => setRpe(Number(e.target.value))}
            className="vs-rpe-slider"
          />
          <div className="vs-rpe-ticks">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <span key={n} className={rpe === n ? 'vs-rpe-tick--active' : ''}>{n}</span>
            ))}
          </div>
        </div>

        <div className="vs-modal-section">
          <p className="vs-modal-label">Note (opzionale)</p>
          <textarea
            className="vs-modal-notes"
            placeholder="Come ti sei sentito, record personali..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <button
          className="vs-modal-save"
          disabled={muscles.length === 0 || isPending}
          onClick={() => onSave(muscles, rpe, notes)}
        >
          {isPending ? 'Salvataggio...' : 'Salva allenamento'}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Week Chart ───────────────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<MuscleId, string> = {
  head:         'rgba(167,139,250,0.85)',
  chest:        'rgba(255,34,68,0.85)',
  shoulders:    'rgba(255,136,0,0.85)',
  arms:         'rgba(0,200,255,0.85)',
  core:         'rgba(0,255,180,0.85)',
  quads_glutes: 'rgba(255,221,0,0.85)',
  back:         'rgba(180,100,255,0.85)',
};

function WeekChart({ sessions }: { sessions: WorkoutSession[] }) {
  const [selDay, setSelDay] = useState<string | null>(null);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3).toUpperCase(),
        num: d.getDate(),
      };
    }), []);

  const sessionMap = useMemo(() => {
    const m: Record<string, WorkoutSession> = {};
    for (const s of sessions) m[s.date] = s;
    return m;
  }, [sessions]);

  const selSession = selDay ? sessionMap[selDay] : null;

  return (
    <div className="vs-week-wrap">
      <p className="ht-section-label">Ultimi 7 giorni</p>
      <div className="vs-week-grid">
        {days.map(({ date, label, num }) => {
          const s = sessionMap[date];
          const isToday = date === new Date().toISOString().slice(0, 10);
          const isSel = selDay === date;
          return (
            <div
              key={date}
              className={`vs-week-col${s ? ' vs-week-col--active' : ''}${isSel ? ' vs-week-col--sel' : ''}${isToday ? ' vs-week-col--today' : ''}`}
              onClick={() => setSelDay(p => (p === date && s) ? null : (s ? date : p))}
            >
              <div className="vs-week-bars">
                {s ? (
                  s.muscles.slice(0, 4).map((m, idx) => (
                    <div
                      key={m + idx}
                      className="vs-week-bar"
                      style={{ background: MUSCLE_COLORS[m as MuscleId] ?? 'rgba(255,255,255,0.4)' }}
                    />
                  ))
                ) : (
                  <div className="vs-week-bar vs-week-bar--empty" />
                )}
              </div>
              <span className="vs-week-num">{num}</span>
              <span className={`vs-week-label${isToday ? ' vs-week-label--today' : ''}`}>{label}</span>
              {s && s.rpe && (
                <span className="vs-week-rpe" style={{ background: rpeColor(s.rpe) }} />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {selSession && (
          <motion.div
            className="vs-week-detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="vs-week-detail-row">
              <span className="vs-cal-detail-date">{selSession.date}</span>
              {selSession.rpe && (
                <span className="vs-cal-detail-rpe" style={{ color: rpeColor(selSession.rpe) }}>
                  RPE {selSession.rpe} · {RPE_LABELS[selSession.rpe]}
                </span>
              )}
              {selSession.duration_m && (
                <span className="vs-week-dur">{selSession.duration_m}min</span>
              )}
            </div>
            {selSession.muscles.length > 0 && (
              <div className="vs-week-muscle-tags">
                {selSession.muscles.map(m => (
                  <span
                    key={m}
                    className="vs-week-mtag"
                    style={{ borderColor: MUSCLE_COLORS[m as MuscleId] ?? 'rgba(255,255,255,0.15)', color: MUSCLE_COLORS[m as MuscleId] ?? 'rgba(255,255,255,0.45)' }}
                  >
                    {MUSCLE_LABELS[m as MuscleId] ?? m}
                  </span>
                ))}
              </div>
            )}
            {selSession.notes && <p className="vs-cal-detail-notes">{selSession.notes}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

function CalendarGrid({ sessions }: { sessions: WorkoutSession[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const sessionMap = useMemo(() => {
    const m: Record<string, WorkoutSession> = {};
    for (const s of sessions) m[s.date] = s;
    return m;
  }, [sessions]);

  const days = useMemo(() =>
    Array.from({ length: 91 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (90 - i));
      return { date: d.toISOString().slice(0, 10), day: d.getDate() };
    }),
  []);

  const sel = selected ? sessionMap[selected] : null;

  return (
    <div className="vs-cal-wrap">
      <p className="ht-section-label">Storico allenamenti — ultimi 91 giorni</p>
      <div className="vs-cal-grid">
        {days.map(({ date, day }) => {
          const s = sessionMap[date];
          const isActive = !!s;
          const isSel = selected === date && isActive;
          return (
            <div
              key={date}
              className={`vs-cal-cell${isActive ? ' vs-cal-cell--active' : ''}${isSel ? ' vs-cal-cell--sel' : ''}`}
              style={s ? { background: rpeColor(s.rpe) } : undefined}
              onClick={() => setSelected(p => (p === date && isActive) ? null : (isActive ? date : p))}
              title={date}
            >
              <span className="vs-cal-day">{day}</span>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {sel && (
          <motion.div
            className="vs-cal-detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="vs-cal-detail-row">
              <span className="vs-cal-detail-date">{sel.date}</span>
              {sel.rpe && (
                <span className="vs-cal-detail-rpe" style={{ color: rpeColor(sel.rpe) }}>
                  Intensità {sel.rpe} · {RPE_LABELS[sel.rpe]}
                </span>
              )}
            </div>
            {sel.muscles.length > 0 && (
              <div className="vs-cal-detail-muscles">
                {sel.muscles.map(m => (
                  <span key={m} className="vs-cal-detail-tag">
                    {MUSCLE_LABELS[m as MuscleId] ?? m}
                  </span>
                ))}
              </div>
            )}
            {sel.notes && <p className="vs-cal-detail-notes">{sel.notes}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="vs-cal-legend">
        {[1,4,7,10].map(r => (
          <span key={r} className="vs-cal-legend-dot" style={{ background: rpeColor(r) }} />
        ))}
        <span className="vs-cal-legend-label">Low → Max</span>
      </div>
    </div>
  );
}

// ─── Vessel Tab ───────────────────────────────────────────────────────────────

interface VesselTabProps {
  maxes:      ExerciseMax[];
  sessions:   WorkoutSession[];
  addSession: ReturnType<typeof useAddWorkoutSession>;
}

function VesselTab({ maxes, sessions, addSession }: VesselTabProps) {
  const [showBack,      setShowBack]      = useState(false);
  const [selectedMuscle, setSelMuscle]   = useState<MuscleId | null>(null);
  const [showModal,     setShowModal]     = useState(false);

  const latest = useMemo(() => latestByExercise(maxes), [maxes]);

  const lastTrained = useMemo<Record<MuscleId, string | null>>(() => {
    const r: Record<MuscleId, string | null> = {
      head: null, chest: null, shoulders: null, arms: null, core: null, quads_glutes: null, back: null,
    };
    for (const ex of maxes) {
      const m = EXERCISE_TO_MUSCLE[ex.exercise];
      if (m && (!r[m] || ex.date > r[m]!)) r[m] = ex.date;
    }
    // Sessions also count as training evidence
    for (const s of sessions) {
      for (const muscle of s.muscles) {
        const m = muscle as MuscleId;
        if (m in r && (!r[m] || s.date > r[m]!)) r[m] = s.date;
      }
    }
    return r;
  }, [maxes, sessions]);

  const fills   = useMemo(() => Object.fromEntries(MUSCLE_ORDER.map(id => [id, muscleFill(lastTrained[id])])) as Record<MuscleId, string>, [lastTrained]);
  const strokes = useMemo(() => Object.fromEntries(MUSCLE_ORDER.map(id => [id, muscleStroke(lastTrained[id])])) as Record<MuscleId, string>, [lastTrained]);
  const glows   = useMemo(() => Object.fromEntries(MUSCLE_ORDER.map(id => [id, muscleGlow(lastTrained[id])])) as Record<MuscleId, string>, [lastTrained]);
  const pulsing = useMemo(() => Object.fromEntries(MUSCLE_ORDER.map(id => [id, !!lastTrained[id] && daysDiff(lastTrained[id]!) === 0])) as Record<MuscleId, boolean>, [lastTrained]);

  const popoverExs = useMemo(() => {
    if (!selectedMuscle) return [];
    const names = MUSCLE_EXERCISES[selectedMuscle].map(e => e.name);
    return latest.filter(ex => names.includes(ex.exercise));
  }, [selectedMuscle, latest]);

  const bigThree = useMemo(() =>
    BIG_THREE.map(({ key, label }) => {
      const ex = latest.find(e => e.exercise === key);
      return { label, value: ex ? `${ex.value}kg` : '——' };
    }),
  [latest]);

  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

  function handleSave(muscles: MuscleId[], rpe: number, notes: string) {
    const date = new Date().toISOString().slice(0, 10);
    addSession.mutate(
      { date, muscles: muscles as string[], rpe, notes: notes || undefined },
      { onSuccess: () => setShowModal(false) },
    );
  }

  return (
    <>
      {/* Header — centered with dividers */}
      <div className="vs-header-divider">
        <span className="vs-divider-line" />
        <span className="vs-divider-title">Il mio corpo</span>
        <span className="vs-divider-line" />
      </div>

      {/* Log Workout CTA — above silhouette */}
      <button className="vs-log-cta" onClick={() => setShowModal(true)}>
        <Plus size={15} strokeWidth={2} className="vs-log-cta-icon" />
        <span className="vs-log-cta-label">Registra allenamento</span>
        <span className="vs-log-cta-date">{today}</span>
      </button>

      {/* Silhouette */}
      <div className="vs-body-wrap">
        <button className="ht-rotate-btn vs-rotate-btn"
          onClick={() => { setShowBack(v => !v); setSelMuscle(null); }}>
          <RotateCcw size={11} strokeWidth={1.25} />
          {showBack ? 'Anteriore' : 'Posteriore'}
        </button>

        <div className="vs-svg-center">
          <BodySilhouette
            fills={fills} strokes={strokes} glows={glows} pulsing={pulsing}
            selected={selectedMuscle} showBack={showBack}
            onClick={id => setSelMuscle(p => p === id ? null : id)}
          />
        </div>

        <div className="vs-legend">
          {[
            { fill: 'rgba(255,34,68,0.55)',  label: '< 24h' },
            { fill: 'rgba(255,136,0,0.45)',  label: '24–48h' },
            { fill: 'rgba(255,221,0,0.35)',  label: '48–72h' },
          ].map(l => (
            <div key={l.label} className="vs-legend-item">
              <span className="vs-legend-swatch" style={{ background: l.fill }} />
              <span className="vs-legend-label">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Muscle Popover */}
      <AnimatePresence>
        {selectedMuscle && (
          <motion.div
            key={selectedMuscle}
            className="ht-popover"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 4,  scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
          >
            <div className="ht-popover-header">
              <span className="ht-popover-title">{MUSCLE_LABELS[selectedMuscle]}</span>
              <button className="ht-popover-close" onClick={() => setSelMuscle(null)}>
                <X size={11} strokeWidth={1.25} />
              </button>
            </div>
            {lastTrained[selectedMuscle] ? (
              <p className="ht-popover-date">
                ultima volta · <strong>{lastTrained[selectedMuscle]}</strong> · {daysDiff(lastTrained[selectedMuscle]!)} giorni fa
              </p>
            ) : (
              <p className="ht-popover-date">Mai allenato</p>
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
              <p className="ht-popover-empty">Nessun record</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Big 3 */}
      <div className="ht-big3">
        {bigThree.map(({ label, value }) => (
          <div key={label} className="ht-big3-card">
            <span className="ht-big3-val">{value}</span>
            <span className="ht-big3-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Week Chart */}
      <WeekChart sessions={sessions} />

      {/* Calendar */}
      <CalendarGrid sessions={sessions} />

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <WorkoutModal
            onClose={() => setShowModal(false)}
            onSave={handleSave}
            isPending={addSession.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Forge — helper components ────────────────────────────────────────────────

function NeonPulseChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return <p className="mt-chart-empty">— Aggiungi almeno 2 sessioni —</p>;
  const W = 260, H = 46, P = 5;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const xs = points.map((_, i) => P + ((W - P * 2) * i) / (points.length - 1));
  const ys = points.map(p => H - P - ((p.value - min) / range) * (H - P * 2));
  const poly = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const lx = xs[xs.length - 1], ly = ys[ys.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-chart-svg" preserveAspectRatio="none">
      <defs>
        <filter id="fg-neon">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <polyline points={poly} fill="none" stroke="rgba(0,255,200,0.85)" strokeWidth="1"
        strokeLinecap="round" strokeLinejoin="round" filter="url(#fg-neon)" />
      <circle cx={lx} cy={ly} r="2.5" fill="rgba(0,255,200,1)" className="mt-chart-dot" />
    </svg>
  );
}

function StrengthBar({ exercise, oneRM, bodyWeight }: { exercise: string; oneRM: number; bodyWeight: number | null }) {
  if (!bodyWeight) return null;
  const ratio = oneRM / bodyWeight;
  const [nov, inter, adv] = STRENGTH_STANDARDS[exercise] ?? DEFAULT_STANDARDS;
  const elite = adv * 1.38;
  let level = 'Novizio', pct = 0;
  if (ratio >= elite)      { level = 'Elite';      pct = 100; }
  else if (ratio >= adv)   { level = 'Avanzato';   pct = 75 + ((ratio - adv)   / (elite - adv))   * 25; }
  else if (ratio >= inter) { level = 'Intermedio'; pct = 50 + ((ratio - inter) / (adv - inter))   * 25; }
  else if (ratio >= nov)   { level = 'Novizio';    pct = 25 + ((ratio - nov)   / (inter - nov))   * 25; }
  else                     {                        pct = (ratio / nov) * 25; }
  pct = Math.max(2, Math.min(100, pct));
  const color = level === 'Elite' ? '#ffd700' : level === 'Avanzato' ? 'rgba(0,255,200,0.9)' : level === 'Intermedio' ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.3)';
  return (
    <div className="mt-strength-wrap">
      <div className="mt-strength-header">
        <span className="mt-strength-label">Livello di forza</span>
        <span className="mt-strength-level" style={{ color }}>{level}</span>
      </div>
      <div className="mt-strength-track">
        <div className="mt-strength-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── PR Badge ─────────────────────────────────────────────────────────────────

interface PRBadgeProps {
  exercise: string; oneRM: number; date: string;
  history: ExerciseMax[]; bodyWeight: number | null;
  expanded: boolean; onToggle: () => void;
}

function PRBadge({ exercise, oneRM, date, history, bodyWeight, expanded, onToggle }: PRBadgeProps) {
  const dOld   = daysDiff(date);
  const isGhost = dOld > 30;
  const isElite = bodyWeight ? oneRM >= bodyWeight * (BW_QUALITY[exercise] ?? DEFAULT_BW_QUALITY) : false;
  const ago = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const prev = history.filter(m => m.date <= ago).reduce((mx, m) => Math.max(mx, m.value), 0);
  const trend = prev === 0 ? 'new' : oneRM > prev * 1.01 ? 'up' : oneRM < prev * 0.99 ? 'down' : 'flat';
  const chartPts = history.filter(m => m.unit === 'kg').sort((a, b) => a.date.localeCompare(b.date)).slice(-10).map(m => ({ date: m.date, value: m.value }));

  return (
    <motion.div
      className={`fg-badge${isElite ? ' fg-badge--elite' : ''}${isGhost ? ' fg-badge--ghost' : ''}${expanded ? ' fg-badge--open' : ''}`}
      layout
      onClick={onToggle}
    >
      {isGhost && <span className="fg-badge-ghost">👻</span>}
      <div className="fg-badge-top">
        <span className="fg-badge-name">{exercise}</span>
        <div className="fg-badge-right">
          <span className="fg-badge-value">
            {oneRM.toFixed(1)}<span className="fg-badge-unit">kg</span>
          </span>
          <span className={`fg-badge-trend fg-badge-trend--${trend}`}>
            {trend === 'up'   ? <TrendingUp   size={10} strokeWidth={1.25} />
            : trend === 'down' ? <TrendingDown size={10} strokeWidth={1.25} />
            :                    <Minus        size={10} strokeWidth={1.25} />}
          </span>
          {expanded
            ? <ChevronUp   size={10} strokeWidth={1.25} className="fg-badge-chevron" />
            : <ChevronDown size={10} strokeWidth={1.25} className="fg-badge-chevron" />}
        </div>
      </div>
      <span className="fg-badge-date">{date} · {dOld} giorni fa</span>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="fg-badge-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
          >
            <NeonPulseChart points={chartPts} />
            <StrengthBar exercise={exercise} oneRM={oneRM} bodyWeight={bodyWeight} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Forge Tab ────────────────────────────────────────────────────────────────

interface ForgeTabProps {
  maxes: ExerciseMax[];
  addMax: ReturnType<typeof useAddExerciseMax>;
  bodyWeight: number | null;
  customExercises: CustomExercise[];
  addCustomEx: ReturnType<typeof useAddCustomExercise>;
}

function ForgeTab({ maxes, addMax, bodyWeight, customExercises, addCustomEx }: ForgeTabProps) {
  const [formMuscle,       setFormMuscle]       = useState<MuscleIdPR | null>(null);
  const [formExercise,     setFormExercise]     = useState('');
  const [formWeight,       setFormWeight]       = useState('');
  const [formReps,         setFormReps]         = useState('1');
  const [expandedEx,       setExpandedEx]       = useState<string | null>(null);
  const [filterMuscle,     setFilterMuscle]     = useState<MuscleIdPR | null>(null);
  const [showAddForm,      setShowAddForm]      = useState(false);
  const [showCustomForm,   setShowCustomForm]   = useState(false);
  const [customName,       setCustomName]       = useState('');
  const [customUnit,       setCustomUnit]       = useState<ExerciseUnit>('kg');

  const computed1RM = useMemo(() => {
    const w = parseFloat(formWeight), r = parseInt(formReps);
    return !isNaN(w) && w > 0 && !isNaN(r) && r >= 1 ? brzycki(w, r) : null;
  }, [formWeight, formReps]);

  // Esercizi per muscolo: built-in + custom dell'utente
  const exercisesForMuscle = useMemo(() => (muscle: MuscleIdPR): string[] => {
    const builtin = MUSCLE_EXERCISES_PR[muscle];
    const custom  = customExercises.filter(e => e.muscle_group === muscle).map(e => e.name);
    return [...builtin, ...custom];
  }, [customExercises]);

  function handleSaveCustom() {
    if (!formMuscle || !customName.trim()) return;
    addCustomEx.mutate(
      { name: customName.trim(), muscle_group: formMuscle, unit: customUnit },
      {
        onSuccess: () => {
          setFormExercise(customName.trim());
          setCustomName('');
          setShowCustomForm(false);
        },
      },
    );
  }

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
    // Mappa estesa: built-in + custom
    const customMap: Record<string, MuscleIdPR> = {};
    for (const ce of customExercises) customMap[ce.name] = ce.muscle_group as MuscleIdPR;
    const fullMap = { ...EXERCISE_TO_MUSCLE_PR, ...customMap };

    for (const [exercise, best] of Object.entries(bestByExercise)) {
      const muscle = fullMap[exercise];
      if (muscle) r[muscle].push({ exercise, oneRM: best.value, date: best.date, history: maxes.filter(m => m.exercise === exercise) });
    }
    return r;
  }, [bestByExercise, maxes, customExercises]);

  const milestones = useMemo(() => {
    const ms: { date: string; text: string }[] = [];
    const best: Record<string, number> = {};
    const sorted = [...maxes].filter(m => m.unit === 'kg').sort((a, b) => a.date.localeCompare(b.date));
    for (const m of sorted) {
      const prev = best[m.exercise] ?? 0;
      if (m.value > prev) {
        if (prev > 0) ms.push({ date: m.date, text: `Record · ${m.exercise} · ${m.value.toFixed(1)}kg` });
        for (const ms2 of ROUND_MILESTONES)
          if (prev < ms2 && m.value >= ms2) ms.push({ date: m.date, text: `Traguardo · ${m.exercise} · ${ms2}kg` });
        best[m.exercise] = m.value;
      }
    }
    return ms.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  }, [maxes]);

  const hasPRs = MUSCLE_ORDER_PR.some(m => byMuscle[m].length > 0);
  const visibleMuscles = filterMuscle ? [filterMuscle] : MUSCLE_ORDER_PR.filter(m => byMuscle[m].length > 0);

  function handleSave() {
    if (!formExercise || !computed1RM) return;
    addMax.mutate({ exercise: formExercise, value: parseFloat(computed1RM.toFixed(2)), unit: 'kg' }, {
      onSuccess: () => { setFormWeight(''); setFormReps('1'); setFormExercise(''); setFormMuscle(null); setShowAddForm(false); },
    });
  }

  return (
    <>
      {/* Aggiungi Massimale */}
      <button
        className="fg-add-btn"
        onClick={() => { setShowAddForm(v => !v); setFormMuscle(null); setFormExercise(''); setFormWeight(''); }}
      >
        <Plus size={11} strokeWidth={1.5} />
        Aggiungi massimale
      </button>

      {/* Add Form — collapsible */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginBottom: 14 }}
          >
            <div className="mt-cmd-wrap" style={{ marginBottom: 0 }}>
              <p className="ht-section-label">Seleziona gruppo muscolare</p>
              <div className="ht-chips">
                {MUSCLE_ORDER_PR.map(id => (
                  <button
                    key={id}
                    className={`ht-chip${formMuscle === id ? ' ht-chip--active' : ''}`}
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
                        <option value="">Scegli esercizio</option>
                        {exercisesForMuscle(formMuscle).map(ex => (
                          <option key={ex} value={ex}>{ex}</option>
                        ))}
                      </select>
                    </div>

                    {/* Crea esercizio personalizzato */}
                    <button
                      className="mt-cmd-custom-toggle"
                      type="button"
                      onClick={() => setShowCustomForm(v => !v)}
                    >
                      <Plus size={9} strokeWidth={1.5} />
                      {showCustomForm ? 'Annulla' : 'Crea esercizio personalizzato'}
                    </button>

                    <AnimatePresence>
                      {showCustomForm && (
                        <motion.div
                          className="mt-cmd-custom-form"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <div className="mt-cmd-row">
                            <span className="mt-cmd-prompt">›</span>
                            <input
                              className="mt-cmd-input"
                              type="text"
                              placeholder="Nome esercizio"
                              value={customName}
                              onChange={e => setCustomName(e.target.value)}
                            />
                          </div>
                          <div className="mt-cmd-row">
                            <span className="mt-cmd-prompt">›</span>
                            <select className="mt-cmd-select" value={customUnit} onChange={e => setCustomUnit(e.target.value as ExerciseUnit)}>
                              <option value="kg">kg (bilanciere/manubri)</option>
                              <option value="reps">Ripetizioni</option>
                              <option value="seconds">Secondi</option>
                            </select>
                          </div>
                          <button
                            className="mt-cmd-save"
                            style={{ marginTop: 6 }}
                            onClick={handleSaveCustom}
                            disabled={!customName.trim() || addCustomEx.isPending}
                          >
                            {addCustomEx.isPending ? 'Salvataggio...' : 'Aggiungi esercizio'}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-cmd-row">
                      <span className="mt-cmd-prompt">›</span>
                      <input className="mt-cmd-input" type="number" placeholder="Peso (kg)" min="0" step="0.5"
                        value={formWeight} onChange={e => setFormWeight(e.target.value)} />
                      <span className="mt-cmd-sep">×</span>
                      <input className="mt-cmd-input mt-cmd-input--sm" type="number" placeholder="rip." min="1" max="30"
                        value={formReps} onChange={e => setFormReps(e.target.value)} />
                    </div>
                    {computed1RM !== null && parseInt(formReps) > 1 && (
                      <div className="mt-cmd-1rm">
                        <span className="mt-cmd-prompt">›</span>
                        <span>Massimale stimato <strong>{computed1RM.toFixed(1)}</strong>kg</span>
                      </div>
                    )}
                    <button
                      className="mt-cmd-save"
                      onClick={handleSave}
                      disabled={!formExercise || !formWeight || !computed1RM || addMax.isPending}
                    >
                      {addMax.isPending ? 'Salvataggio...' : 'Salva record'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Muscle icon filter */}
      <div className="fg-filter-bar">
        <button
          className={`fg-filter-btn${!filterMuscle ? ' fg-filter-btn--active' : ''}`}
          onClick={() => setFilterMuscle(null)}
          title="Tutti"
        >Tutti</button>
        {MUSCLE_ORDER_PR.filter(m => byMuscle[m].length > 0).map(id => (
          <button
            key={id}
            className={`fg-filter-btn${filterMuscle === id ? ' fg-filter-btn--active' : ''}`}
            onClick={() => setFilterMuscle(p => p === id ? null : id)}
            title={MUSCLE_LABELS_PR[id]}
          >
            {MUSCLE_ICON_PR[id]}
          </button>
        ))}
      </div>

      {/* PR Matrix */}
      {!hasPRs ? (
        <div className="fg-empty">
          <p className="fg-empty-title">Nessun record forgiato.</p>
          <p className="fg-empty-sub">Aggiungi il tuo primo record</p>
        </div>
      ) : (
        visibleMuscles.map(muscleId => byMuscle[muscleId].length > 0 && (
          <div key={muscleId} className="mt-muscle-group">
            <div className="fg-muscle-divider">
              <span className="fg-muscle-div-line" />
              <span className="fg-muscle-div-label">{MUSCLE_ICON_PR[muscleId]} {MUSCLE_LABELS_PR[muscleId]}</span>
              <span className="fg-muscle-div-line" />
            </div>
            <div className="fg-badge-grid">
              {byMuscle[muscleId].map(({ exercise, oneRM, date, history }) => (
                <PRBadge
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

      {/* Wall of Fame */}
      {milestones.length > 0 && (
        <div className="mt-wof">
          <div className="mt-wof-header">
            <Trophy size={11} strokeWidth={1.25} className="mt-wof-icon" />
            <span className="ht-section-label">Bacheca record</span>
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
  const { data: maxes    = [] } = useExerciseMaxes();
  const { data: vitals   = [] } = useBodyVitals();
  const { data: sessions = [] } = useWorkoutSessions();
  const { data: customExercises = [] } = useCustomExercises();
  const addMax     = useAddExerciseMax();
  const addSession = useAddWorkoutSession();
  const addCustomEx = useAddCustomExercise();
  const bodyWeight = vitals[0]?.weight_kg ?? null;

  const initialTab = (params.tab as TabId) ?? 'vessel';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <NebulaCard icon="🫀" title="Salute" variant="health">
      <div className="mt-tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`mt-tab${activeTab === tab.id ? ' mt-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <span className="mt-tab-flicker" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} {...TAB_ANIM}>
          {activeTab === 'vessel' && (
            <VesselTab maxes={maxes} sessions={sessions} addSession={addSession} />
          )}
          {activeTab === 'forge' && (
            <ForgeTab maxes={maxes} addMax={addMax} bodyWeight={bodyWeight} customExercises={customExercises} addCustomEx={addCustomEx} />
          )}
        </motion.div>
      </AnimatePresence>
    </NebulaCard>
  );
}
