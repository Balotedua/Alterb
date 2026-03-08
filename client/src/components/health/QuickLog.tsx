import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Weight, Moon } from 'lucide-react';
import type { BodyVital, SleepEntry } from '@/types';

interface QuickLogProps {
  onAddVital: (input: Omit<BodyVital, 'id'>) => void;
  onAddSleep: (input: Omit<SleepEntry, 'id'>) => void;
}

type ActiveTab = 'vitals' | 'sleep';

export function QuickLog({ onAddVital, onAddSleep }: QuickLogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<ActiveTab>('vitals');

  // Vitals form
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [vitalDate, setVitalDate] = useState(today);

  // Sleep form
  const [sleepHours, setSleepHours] = useState('');
  const [sleepMinutes, setSleepMinutes] = useState('0');
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [sleepDate, setSleepDate] = useState(today);

  function handleVitalSave() {
    const w = weight ? parseFloat(weight) : undefined;
    const h = height ? parseFloat(height) : undefined;
    if (!w && !h) return;
    onAddVital({ weight_kg: w, height_cm: h, date: vitalDate });
    setWeight('');
    setHeight('');
  }

  function handleSleepSave() {
    const h = parseFloat(sleepHours) || 0;
    const m = parseInt(sleepMinutes) || 0;
    const total = h * 60 + m;
    if (total <= 0) return;
    onAddSleep({ duration_minutes: total, quality, date: sleepDate });
    setSleepHours('');
    setSleepMinutes('0');
    setQuality(3);
  }

  return (
    <motion.div
      className="h-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25, ease: 'easeOut' }}
    >
      <div className="h-card-header">
        <div className="h-card-header-left">
          <ClipboardList size={16} className="h-card-icon" />
          <span className="h-card-title">Log Rapido</span>
        </div>
      </div>

      <div className="h-tabs">
        <button
          className={`h-tab ${tab === 'vitals' ? 'active' : ''}`}
          onClick={() => setTab('vitals')}
        >
          <Weight size={13} /> Vitali
        </button>
        <button
          className={`h-tab ${tab === 'sleep' ? 'active' : ''}`}
          onClick={() => setTab('sleep')}
        >
          <Moon size={13} /> Sonno
        </button>
      </div>

      {tab === 'vitals' && (
        <div className="h-log-form">
          <div className="h-log-row">
            <div className="h-log-field">
              <label className="h-log-label">Peso (kg)</label>
              <input
                className="h-log-input"
                type="number"
                placeholder="es. 72.5"
                step="0.1"
                min="20"
                max="300"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="h-log-field">
              <label className="h-log-label">Altezza (cm)</label>
              <input
                className="h-log-input"
                type="number"
                placeholder="es. 175"
                min="100"
                max="250"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>
          <div className="h-log-row">
            <div className="h-log-field">
              <label className="h-log-label">Data</label>
              <input
                className="h-log-input"
                type="date"
                value={vitalDate}
                max={today}
                onChange={(e) => setVitalDate(e.target.value)}
              />
            </div>
            <button className="h-log-save-btn" onClick={handleVitalSave}>
              Salva
            </button>
          </div>
        </div>
      )}

      {tab === 'sleep' && (
        <div className="h-log-form">
          <div className="h-log-row">
            <div className="h-log-field">
              <label className="h-log-label">Ore</label>
              <input
                className="h-log-input"
                type="number"
                placeholder="8"
                min="0"
                max="24"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
              />
            </div>
            <div className="h-log-field">
              <label className="h-log-label">Minuti</label>
              <input
                className="h-log-input"
                type="number"
                placeholder="0"
                min="0"
                max="59"
                step="5"
                value={sleepMinutes}
                onChange={(e) => setSleepMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="h-log-quality">
            <label className="h-log-label">Qualità</label>
            <div className="h-quality-picker">
              {([1, 2, 3, 4, 5] as const).map((q) => (
                <button
                  key={q}
                  className={`h-quality-btn ${quality === q ? 'active' : ''}`}
                  onClick={() => setQuality(q)}
                  aria-pressed={quality === q}
                >
                  {['😴', '😞', '😐', '😊', '🌟'][q - 1]}
                </button>
              ))}
            </div>
          </div>
          <div className="h-log-row">
            <div className="h-log-field">
              <label className="h-log-label">Data</label>
              <input
                className="h-log-input"
                type="date"
                value={sleepDate}
                max={today}
                onChange={(e) => setSleepDate(e.target.value)}
              />
            </div>
            <button className="h-log-save-btn" onClick={handleSleepSave}>
              Salva
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
