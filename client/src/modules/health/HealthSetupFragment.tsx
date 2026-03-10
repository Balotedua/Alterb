import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NebulaCard, NebulaStat } from '@/components/ui/nebula';
import { useUpsertProfile, useSetGoal } from '@/hooks/useHealthProfile';
import { useNebulaStore } from '@/store/nebulaStore';
import type { Sex, BloodType, ActivityLevel } from '@/types/health';

interface Props {
  params: Record<string, unknown>;
}

const TOTAL_STEPS = 5;
const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; sub: string }[] = [
  { value: 'sedentary',    label: 'Sedentario',    sub: 'poco movimento' },
  { value: 'light',        label: 'Leggero',       sub: 'cammino quotidiano' },
  { value: 'active',       label: 'Attivo',        sub: 'sport 3x/settimana' },
  { value: 'very_active',  label: 'Molto attivo',  sub: 'sport intenso' },
];

export function HealthSetupFragment(_props: Props) {
  const [step, setStep] = useState(0);
  const upsert = useUpsertProfile();
  const setGoal = useSetGoal();
  const clearFragment = useNebulaStore((s) => s.clearFragment);

  // Step 0 — Biometria
  const [heightCm, setHeightCm]   = useState('');
  const [sex, setSex]             = useState<Sex | null>(null);
  const [bloodType, setBloodType] = useState<BloodType | null>(null);
  const [birthYear, setBirthYear] = useState('');

  // Step 1 — Corpo
  const [weightKg, setWeightKg]     = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');

  // Step 2 — Stile di vita
  const [isSmoker, setIsSmoker]           = useState(false);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary');

  // Step 3 — Obiettivi
  const [stepsGoal, setStepsGoal]   = useState('10000');
  const [waterGoalL, setWaterGoalL] = useState('2.0');
  const [sleepGoalH, setSleepGoalH] = useState('8');

  const [saving, setSaving] = useState(false);

  const direction = 1; // always forward for simplicity

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsert.mutateAsync({
        height_cm:          heightCm ? parseInt(heightCm) : null,
        sex,
        blood_type:         bloodType,
        birth_year:         birthYear ? parseInt(birthYear) : null,
        weight_kg:          weightKg ? parseFloat(weightKg) : null,
        body_fat_pct:       bodyFatPct ? parseFloat(bodyFatPct) : null,
        is_smoker:          isSmoker,
        activity_level:     activityLevel,
        is_setup_completed: true,
      });
      await Promise.all([
        setGoal.mutateAsync({ key: 'steps_target',         amount: parseInt(stepsGoal) || 10000 }),
        setGoal.mutateAsync({ key: 'water_ml_target',      amount: Math.round((parseFloat(waterGoalL) || 2) * 1000) }),
        setGoal.mutateAsync({ key: 'sleep_minutes_target', amount: Math.round((parseFloat(sleepGoalH) || 8) * 60) }),
      ]);
      setStep(4);
    } catch (_e) {
      // silently ignore — user can retry
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = ['Biometria', 'Composizione corporea', 'Stile di vita', 'Obiettivi', 'Pronto!'];
  const stepIcons  = ['🧬', '⚖️', '🌿', '🎯', '✨'];

  return (
    <NebulaCard icon={stepIcons[step]} title={stepTitles[step]} variant="health" closable>
      {/* Progress dots */}
      <div className="setup-progress">
        {stepTitles.map((_, i) => (
          <div
            key={i}
            className={`setup-dot${i <= step ? ' setup-dot--active' : ''}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="setup-step"
          initial={{ x: direction * 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction * -20, opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          {step === 0 && (
            <>
              <p className="setup-step-title">Il tuo profilo</p>

              <div className="setup-field">
                <span className="setup-label">Altezza (cm)</span>
                <input
                  className="setup-input"
                  type="number"
                  placeholder="175"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>

              <div className="setup-field">
                <span className="setup-label">Sesso</span>
                <div className="setup-btn-group">
                  {(['M', 'F', 'X'] as Sex[]).map((s) => (
                    <button
                      key={s}
                      className={`setup-option${sex === s ? ' setup-option--active' : ''}`}
                      onClick={() => setSex(s)}
                    >
                      {s === 'M' ? 'Uomo' : s === 'F' ? 'Donna' : 'Altro'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-field">
                <span className="setup-label">Gruppo sanguigno <span className="setup-optional">(opzionale)</span></span>
                <div className="setup-btn-group">
                  {BLOOD_TYPES.map((bt) => (
                    <button
                      key={bt}
                      className={`setup-option${bloodType === bt ? ' setup-option--active' : ''}`}
                      onClick={() => setBloodType(bt)}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-field">
                <span className="setup-label">Anno di nascita</span>
                <input
                  className="setup-input"
                  type="number"
                  placeholder="2000"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="setup-step-title">Corpo</p>

              <div className="setup-field">
                <span className="setup-label">Peso (kg)</span>
                <input
                  className="setup-input"
                  type="number"
                  step="0.1"
                  placeholder="70.0"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>

              <div className="setup-field">
                <span className="setup-label">Massa grassa % <span className="setup-optional">(opzionale)</span></span>
                <input
                  className="setup-input"
                  type="number"
                  step="0.1"
                  placeholder="es. 18"
                  value={bodyFatPct}
                  onChange={(e) => setBodyFatPct(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="setup-step-title">Stile di vita</p>

              <div className="setup-field">
                <span className="setup-label">Fumatore?</span>
                <div className="setup-btn-group">
                  {[false, true].map((v) => (
                    <button
                      key={String(v)}
                      className={`setup-option${isSmoker === v ? ' setup-option--active' : ''}`}
                      onClick={() => setIsSmoker(v)}
                    >
                      {v ? 'Sì' : 'No'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-field">
                <span className="setup-label">Livello di attività</span>
                <div className="setup-btn-group" style={{ flexDirection: 'column' }}>
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`setup-option${activityLevel === opt.value ? ' setup-option--active' : ''}`}
                      onClick={() => setActivityLevel(opt.value)}
                      style={{ textAlign: 'left' }}
                    >
                      <strong>{opt.label}</strong>
                      <span style={{ marginLeft: '0.4rem', opacity: 0.6, fontWeight: 400 }}>
                        {opt.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="setup-step-title">I tuoi obiettivi</p>

              <div className="setup-field">
                <span className="setup-label">Passi giornalieri</span>
                <input
                  className="setup-input"
                  type="number"
                  placeholder="10000"
                  value={stepsGoal}
                  onChange={(e) => setStepsGoal(e.target.value)}
                />
              </div>

              <div className="setup-field">
                <span className="setup-label">Acqua (litri/giorno)</span>
                <input
                  className="setup-input"
                  type="number"
                  step="0.1"
                  placeholder="2.0"
                  value={waterGoalL}
                  onChange={(e) => setWaterGoalL(e.target.value)}
                />
              </div>

              <div className="setup-field">
                <span className="setup-label">Sonno (ore/notte)</span>
                <input
                  className="setup-input"
                  type="number"
                  step="0.5"
                  placeholder="8"
                  value={sleepGoalH}
                  onChange={(e) => setSleepGoalH(e.target.value)}
                />
              </div>

              <button
                className="setup-save-btn"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? 'Salvataggio…' : 'Salva profilo'}
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <p className="setup-step-title">Tutto pronto!</p>
              <div className="setup-summary">
                {heightCm && (
                  <NebulaStat label="Altezza" value={`${heightCm} cm`} color="green" />
                )}
                {weightKg && (
                  <NebulaStat label="Peso" value={`${weightKg} kg`} color="blue" />
                )}
                {stepsGoal && (
                  <NebulaStat label="Passi" value={stepsGoal} color="green" sub="obiettivo/giorno" />
                )}
                {sleepGoalH && (
                  <NebulaStat label="Sonno" value={`${sleepGoalH}h`} color="blue" sub="obiettivo/notte" />
                )}
              </div>
              <button className="setup-save-btn" onClick={clearFragment}>
                Inizia a tracciare
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {step < 4 && (
        <div className="setup-nav">
          <button
            className="setup-btn-secondary"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ← Indietro
          </button>

          {step < 3 && (
            <button
              className="setup-btn-primary"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
            >
              Avanti →
            </button>
          )}
        </div>
      )}
    </NebulaCard>
  );
}
