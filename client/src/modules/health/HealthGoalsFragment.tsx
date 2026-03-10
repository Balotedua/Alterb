import { useState, useRef } from 'react';
import { NebulaCard } from '@/components/ui/nebula';
import { useHealthGoals, useSetGoal, getGoalAmount } from '@/hooks/useHealthProfile';
import type { HealthGoalKey } from '@/types/health';

interface Props {
  params: Record<string, unknown>;
}

interface GoalDef {
  icon:    string;
  label:   string;
  key:     HealthGoalKey;
  unit:    string;
  /** Convert stored amount → display string */
  toDisplay: (amount: number) => string;
  /** Convert user input string → amount to store */
  fromInput: (input: string) => number;
  /** Placeholder for the input */
  placeholder: string;
}

const GOALS: GoalDef[] = [
  {
    icon:        '🦶',
    label:       'Passi giornalieri',
    key:         'steps_target',
    unit:        'passi',
    toDisplay:   (a) => a.toLocaleString('it'),
    fromInput:   (s) => parseInt(s) || 10000,
    placeholder: '10000',
  },
  {
    icon:        '💧',
    label:       'Acqua',
    key:         'water_ml_target',
    unit:        'litri/giorno',
    toDisplay:   (a) => (a / 1000).toFixed(1),
    fromInput:   (s) => Math.round((parseFloat(s) || 2) * 1000),
    placeholder: '2.0',
  },
  {
    icon:        '🔥',
    label:       'Calorie bruciate',
    key:         'calories_target',
    unit:        'kcal/giorno',
    toDisplay:   (a) => a.toLocaleString('it'),
    fromInput:   (s) => parseInt(s) || 2500,
    placeholder: '2500',
  },
  {
    icon:        '🌙',
    label:       'Sonno',
    key:         'sleep_minutes_target',
    unit:        'ore/notte',
    toDisplay:   (a) => (a / 60).toFixed(1),
    fromInput:   (s) => Math.round((parseFloat(s) || 8) * 60),
    placeholder: '8',
  },
];

export function HealthGoalsFragment(_props: Props) {
  const { data: goals = [], isLoading } = useHealthGoals();
  const setGoal = useSetGoal();

  const [editingKey, setEditingKey]     = useState<HealthGoalKey | null>(null);
  const [inputValue, setInputValue]     = useState('');
  const [savingKey, setSavingKey]       = useState<HealthGoalKey | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (def: GoalDef, currentAmount: number) => {
    setEditingKey(def.key);
    setInputValue(def.toDisplay(currentAmount));
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const commitEdit = async (def: GoalDef) => {
    if (editingKey !== def.key) return;
    const amount = def.fromInput(inputValue);
    setEditingKey(null);
    setSavingKey(def.key);
    try {
      await setGoal.mutateAsync({ key: def.key, amount });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <NebulaCard icon="🎯" title="Obiettivi salute" variant="health" closable>
      {isLoading ? (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center' }}>
          Caricamento…
        </p>
      ) : (
        <div className="health-goals-list">
          {GOALS.map((def) => {
            const amount    = getGoalAmount(goals, def.key);
            const isEditing = editingKey === def.key;
            const isSaving  = savingKey  === def.key;

            return (
              <div key={def.key} className="health-goal-row">
                <span className="health-goal-icon">{def.icon}</span>
                <div className="health-goal-info">
                  <div className="health-goal-name">{def.label}</div>
                  <div className="health-goal-unit">{def.unit}</div>
                </div>
                <div className="health-goal-value-wrap">
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      className="health-goal-input"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onBlur={() => void commitEdit(def)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitEdit(def);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                    />
                  ) : (
                    <span
                      className="health-goal-value"
                      onClick={() => startEdit(def, amount)}
                      title="Clicca per modificare"
                    >
                      {def.toDisplay(amount)}
                    </span>
                  )}
                  {isSaving && (
                    <span className="health-goal-saving">✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </NebulaCard>
  );
}
