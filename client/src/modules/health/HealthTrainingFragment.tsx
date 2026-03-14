import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { useExerciseMaxes, useAddExerciseMax, latestByExercise } from '@/hooks/useHealth';
import { NebulaCard } from '@/components/ui/nebula';
import type { ExerciseUnit } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type MuscleId = 'head' | 'chest' | 'shoulders' | 'arms' | 'core' | 'quads_glutes' | 'back';

// ─── Constants ───────────────────────────────────────────────────────────────

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
  head:        'Testa · Stress',
  chest:       'Petto',
  shoulders:   'Spalle',
  arms:        'Braccia',
  core:        'Core',
  quads_glutes:'Gambe',
  back:        'Dorso',
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

// ─── Color logic ─────────────────────────────────────────────────────────────

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

// ─── SVG Silhouette ───────────────────────────────────────────────────────────

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
      {/* HEAD */}
      <g className={`ht-part ${sel('head')}`} style={{ filter: filters.head }} onClick={() => onClick('head')}>
        <ellipse cx="80" cy="35" rx="24" ry="28" fill={colors.head} />
      </g>

      {/* NECK */}
      <rect x="73" y="61" width="14" height="13" rx="4" fill="rgba(255,255,255,0.08)" />

      {/* SHOULDERS */}
      <g className={`ht-part ${sel('shoulders')}`} style={{ filter: filters.shoulders }} onClick={() => onClick('shoulders')}>
        <ellipse cx="44" cy="94" rx="22" ry="18" fill={colors.shoulders} />
        <ellipse cx="116" cy="94" rx="22" ry="18" fill={colors.shoulders} />
      </g>

      {/* CHEST or BACK */}
      {!showBack ? (
        <g className={`ht-part ${sel('chest')}`} style={{ filter: filters.chest }} onClick={() => onClick('chest')}>
          <rect x="54" y="74" width="52" height="62" rx="8" fill={colors.chest} />
        </g>
      ) : (
        <g className={`ht-part ${sel('back')}`} style={{ filter: filters.back }} onClick={() => onClick('back')}>
          <rect x="54" y="74" width="52" height="62" rx="8" fill={colors.back} />
        </g>
      )}

      {/* UPPER ARMS */}
      <g className={`ht-part ${sel('arms')}`} style={{ filter: filters.arms }} onClick={() => onClick('arms')}>
        <rect x="22" y="84" width="19" height="56" rx="9" fill={colors.arms} />
        <rect x="119" y="84" width="19" height="56" rx="9" fill={colors.arms} />
        {/* Forearms (slightly dimmer) */}
        <rect x="23" y="146" width="17" height="46" rx="8" fill={colors.arms} style={{ opacity: 0.7 }} />
        <rect x="120" y="146" width="17" height="46" rx="8" fill={colors.arms} style={{ opacity: 0.7 }} />
      </g>

      {/* HANDS */}
      <ellipse cx="31" cy="199" rx="10" ry="7" fill="rgba(255,255,255,0.07)" />
      <ellipse cx="129" cy="199" rx="10" ry="7" fill="rgba(255,255,255,0.07)" />

      {/* CORE */}
      <g className={`ht-part ${sel('core')}`} style={{ filter: filters.core }} onClick={() => onClick('core')}>
        <rect x="56" y="136" width="48" height="54" rx="7" fill={colors.core} />
      </g>

      {/* QUADS / GLUTES */}
      <g className={`ht-part ${sel('quads_glutes')}`} style={{ filter: filters.quads_glutes }} onClick={() => onClick('quads_glutes')}>
        <rect x="56" y="190" width="22" height="88" rx="10" fill={colors.quads_glutes} />
        <rect x="82" y="190" width="22" height="88" rx="10" fill={colors.quads_glutes} />
      </g>

      {/* CALVES (decorative) */}
      <rect x="58" y="280" width="18" height="68" rx="8" fill="rgba(255,255,255,0.09)" />
      <rect x="84" y="280" width="18" height="68" rx="8" fill="rgba(255,255,255,0.09)" />

      {/* FEET (decorative) */}
      <ellipse cx="67" cy="354" rx="14" ry="6" fill="rgba(255,255,255,0.07)" />
      <ellipse cx="93" cy="354" rx="14" ry="6" fill="rgba(255,255,255,0.07)" />
    </svg>
  );
}

// ─── Main Fragment ────────────────────────────────────────────────────────────

export function HealthTrainingFragment({ params: _ }: { params: Record<string, unknown> }) {
  const { data: maxes = [] } = useExerciseMaxes();
  const addMax = useAddExerciseMax();
  const latest = useMemo(() => latestByExercise(maxes), [maxes]);

  // Last trained per muscle group
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

  // State
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleId | null>(null);
  const [showBack, setShowBack]   = useState(false);
  const [logMuscle, setLogMuscle] = useState<MuscleId | null>(null);
  const [logExercise, setLogExercise] = useState('');
  const [logValue, setLogValue]   = useState('');
  const [logUnit, setLogUnit]     = useState<ExerciseUnit>('kg');
  const [logNote, setLogNote]     = useState('');

  // Big Three
  const bigThree = useMemo(() =>
    BIG_THREE.map(({ key, label }) => {
      const ex = latest.find(e => e.exercise === key);
      return { label, value: ex ? `${ex.value} kg` : '—' };
    }),
  [latest]);

  // Training calendar (last 42 days, 6 weeks)
  const calDays = useMemo(() => {
    const dayMap: Record<string, number> = {};
    for (const ex of maxes) dayMap[ex.date] = (dayMap[ex.date] ?? 0) + 1;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (41 - i));
      const date = d.toISOString().slice(0, 10);
      return { date, count: dayMap[date] ?? 0 };
    });
  }, [maxes]);

  // Popover exercises for selected muscle
  const popoverExs = useMemo(() => {
    if (!selectedMuscle) return [];
    const names = MUSCLE_EXERCISES[selectedMuscle].map(e => e.name);
    return latest.filter(ex => names.includes(ex.exercise));
  }, [selectedMuscle, latest]);

  // Handlers
  function handleMuscleClick(id: MuscleId) {
    setSelectedMuscle(prev => prev === id ? null : id);
  }

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
    setLogValue('');
    setLogNote('');
    setLogExercise('');
    setLogMuscle(null);
  }

  // Legend items
  const LEGEND = [
    { color: '#ff2244', label: '<24h' },
    { color: '#ff8800', label: '<48h' },
    { color: '#ffdd00', label: '<72h' },
    { color: 'rgba(255,255,255,0.18)', label: 'Recuperato' },
  ];

  return (
    <NebulaCard icon="💪" title="Training · Silhouette" variant="health">

      {/* ── Silhouette Row ─────────────────────────────────────────────── */}
      <div className="ht-body-row">
        <div className="ht-svg-wrap">
          {/* Rotate toggle */}
          <button
            className="ht-rotate-btn"
            onClick={() => { setShowBack(v => !v); setSelectedMuscle(null); }}
            title={showBack ? 'Vista frontale' : 'Vista dorsale'}
          >
            <RotateCcw size={14} />
            {showBack ? 'Front' : 'Back'}
          </button>

          <BodySilhouette
            colors={colors}
            filters={filters}
            selected={selectedMuscle}
            showBack={showBack}
            onClick={handleMuscleClick}
          />

          {/* Legend */}
          <div className="ht-legend">
            {LEGEND.map(l => (
              <div key={l.label} className="ht-legend-item">
                <span className="ht-legend-dot" style={{ background: l.color }} />
                <span className="ht-legend-label">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Muscle Popover ─────────────────────────────────────────── */}
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
                <button className="ht-popover-close" onClick={() => setSelectedMuscle(null)}>
                  <X size={12} />
                </button>
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

      {/* ── Big Three ──────────────────────────────────────────────────── */}
      <div className="ht-big3">
        {bigThree.map(({ label, value }) => (
          <div key={label} className="ht-big3-card">
            <span className="ht-big3-val">{value}</span>
            <span className="ht-big3-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Quick Log ──────────────────────────────────────────────────── */}
      <div className="ht-section">
        <p className="ht-section-label">QUICK LOG</p>

        {/* Muscle chips */}
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
              {/* Exercise selector */}
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

              {/* Value + unit */}
              <div className="ht-log-row">
                <input
                  className="ht-log-input"
                  type="number"
                  min="0"
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

              {/* Field note */}
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

      {/* ── Training Calendar ──────────────────────────────────────────── */}
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
    </NebulaCard>
  );
}
