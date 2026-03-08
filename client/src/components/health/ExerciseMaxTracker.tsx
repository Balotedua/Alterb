import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Dumbbell, ChevronUp, ChevronDown } from 'lucide-react';
import type { ExerciseUnit } from '@/types';
import type { ExerciseMaxInput } from '@/hooks/useHealth';

interface ExerciseMaxTrackerProps {
  maxes: Array<{ id: string; exercise: string; value: number; unit: ExerciseUnit; date: string }>;
  onUpdate: (id: string, value: number) => void;
  onRemove: (id: string) => void;
  onAdd: (input: ExerciseMaxInput) => void;
  latestByExercise: () => Array<{ id: string; exercise: string; value: number; unit: ExerciseUnit; date: string }>;
}

const PRESET_EXERCISES: { name: string; unit: ExerciseUnit }[] = [
  { name: 'Flessioni', unit: 'reps' },
  { name: 'Plank', unit: 'seconds' },
  { name: 'Squat', unit: 'reps' },
  { name: 'Trazione', unit: 'reps' },
  { name: 'Panca piana', unit: 'kg' },
  { name: 'Stacco', unit: 'kg' },
  { name: 'Shoulder press', unit: 'kg' },
];

function formatValue(value: number, unit: ExerciseUnit): string {
  if (unit === 'seconds') {
    if (value >= 60) return `${Math.floor(value / 60)}m ${value % 60}s`;
    return `${value}s`;
  }
  if (unit === 'kg') return `${value} kg`;
  return `${value} rip`;
}

export function ExerciseMaxTracker({
  onUpdate,
  onRemove,
  onAdd,
  latestByExercise,
}: ExerciseMaxTrackerProps) {
  const latest = latestByExercise();
  const [showAdd, setShowAdd] = useState(false);
  const [newExercise, setNewExercise] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState<ExerciseUnit>('reps');
  const [customMode, setCustomMode] = useState(false);

  function handlePresetSelect(name: string, unit: ExerciseUnit) {
    setNewExercise(name);
    setNewUnit(unit);
    setCustomMode(false);
  }

  function handleAdd() {
    const val = parseFloat(newValue);
    if (!newExercise.trim() || isNaN(val) || val <= 0) return;
    onAdd({ exercise: newExercise.trim(), value: val, unit: newUnit });
    setNewExercise('');
    setNewValue('');
    setNewUnit('reps');
    setShowAdd(false);
    setCustomMode(false);
  }

  return (
    <motion.div
      className="h-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
    >
      <div className="h-card-header">
        <div className="h-card-header-left">
          <Dumbbell size={16} className="h-card-icon" />
          <span className="h-card-title">Massimali</span>
        </div>
        <button className="h-icon-btn" onClick={() => setShowAdd((v) => !v)} aria-label="Aggiungi esercizio">
          <Plus size={16} />
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            className="h-add-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="h-preset-chips">
              {PRESET_EXERCISES.map((p) => (
                <button
                  key={p.name}
                  className={`h-preset-chip ${newExercise === p.name ? 'active' : ''}`}
                  onClick={() => handlePresetSelect(p.name, p.unit)}
                >
                  {p.name}
                </button>
              ))}
              <button
                className={`h-preset-chip ${customMode ? 'active' : ''}`}
                onClick={() => { setCustomMode(true); setNewExercise(''); }}
              >
                + Altro
              </button>
            </div>

            {customMode && (
              <input
                className="h-add-input"
                placeholder="Nome esercizio"
                value={newExercise}
                onChange={(e) => setNewExercise(e.target.value)}
                autoFocus
              />
            )}

            <div className="h-add-row">
              <input
                className="h-add-input h-add-input--num"
                type="number"
                placeholder={newUnit === 'seconds' ? 'Secondi' : newUnit === 'kg' ? 'Kg' : 'Reps'}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                min="0"
              />
              <select
                className="h-add-select"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as ExerciseUnit)}
              >
                <option value="reps">Rip.</option>
                <option value="seconds">Sec.</option>
                <option value="kg">Kg</option>
              </select>
              <button className="h-save-btn" onClick={handleAdd}>
                Salva
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-exercise-list">
        {latest.length === 0 && (
          <p className="h-empty-hint">Nessun massimale registrato. Premi + per aggiungere.</p>
        )}
        <AnimatePresence>
          {latest.map((ex, i) => (
            <motion.div
              key={ex.id}
              className="h-exercise-item"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="h-exercise-meta">
                <span className="h-exercise-name">{ex.exercise}</span>
                <span className="h-exercise-date">{ex.date}</span>
              </div>
              <div className="h-exercise-controls">
                <button
                  className="h-step-btn"
                  onClick={() => onUpdate(ex.id, ex.value - (ex.unit === 'kg' ? 2.5 : ex.unit === 'seconds' ? 5 : 1))}
                  aria-label="Decrementa"
                >
                  <ChevronDown size={13} />
                </button>
                <span className="h-exercise-value">{formatValue(ex.value, ex.unit)}</span>
                <button
                  className="h-step-btn"
                  onClick={() => onUpdate(ex.id, ex.value + (ex.unit === 'kg' ? 2.5 : ex.unit === 'seconds' ? 5 : 1))}
                  aria-label="Incrementa"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  className="h-del-btn"
                  onClick={() => onRemove(ex.id)}
                  aria-label="Rimuovi"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
