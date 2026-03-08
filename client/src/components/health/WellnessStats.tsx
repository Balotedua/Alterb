import { motion } from 'framer-motion';
import { Droplets, Moon, Star } from 'lucide-react';
import { WATER_GOAL } from '@/hooks/useHealth';
import type { SleepEntry } from '@/types';

interface WellnessStatsProps {
  todayGlasses: number;
  onAddGlass: () => void;
  onRemoveGlass: () => void;
  sleepEntries: SleepEntry[];
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-progress-track">
      <motion.div
        className="h-progress-fill"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

function QualityStars({ quality }: { quality: number }) {
  return (
    <div className="h-stars">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          fill={s <= quality ? '#f59e0b' : 'none'}
          color={s <= quality ? '#f59e0b' : 'var(--border)'}
        />
      ))}
    </div>
  );
}

export function WellnessStats({ todayGlasses, onAddGlass, onRemoveGlass, sleepEntries }: WellnessStatsProps) {
  const last7Sleep = sleepEntries.slice(0, 7);
  const avgQuality =
    last7Sleep.length > 0
      ? last7Sleep.reduce((s, e) => s + e.quality, 0) / last7Sleep.length
      : 0;
  const avgHours =
    last7Sleep.length > 0
      ? last7Sleep.reduce((s, e) => s + e.duration_minutes, 0) / last7Sleep.length / 60
      : 0;
  const lastNight = sleepEntries[0];

  return (
    <motion.div
      className="h-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
    >
      <div className="h-card-header">
        <div className="h-card-header-left">
          <Droplets size={16} className="h-card-icon" />
          <span className="h-card-title">Benessere</span>
        </div>
      </div>

      <div className="h-wellness-sections">
        {/* Water */}
        <div className="h-wellness-section">
          <div className="h-wellness-row">
            <div className="h-wellness-label">
              <Droplets size={14} color="#06b6d4" />
              <span>Acqua oggi</span>
            </div>
            <span className="h-wellness-value">
              {todayGlasses}/{WATER_GOAL}
            </span>
          </div>
          <ProgressBar value={todayGlasses} max={WATER_GOAL} color="#06b6d4" />
          <div className="h-step-row">
            <button className="h-step-btn h-step-btn--lg" onClick={onRemoveGlass}>−</button>
            <span className="h-water-emoji">
              {Array.from({ length: Math.min(todayGlasses, 8) }).map((_, i) => (
                <span key={i}>💧</span>
              ))}
              {todayGlasses === 0 && <span className="h-empty-hint">Aggiungi un bicchiere</span>}
            </span>
            <button className="h-step-btn h-step-btn--lg" onClick={onAddGlass}>+</button>
          </div>
        </div>

        {/* Sleep quality */}
        <div className="h-wellness-section">
          <div className="h-wellness-row">
            <div className="h-wellness-label">
              <Moon size={14} color="#8b5cf6" />
              <span>Qualità sonno</span>
            </div>
            <QualityStars quality={Math.round(avgQuality)} />
          </div>
          <ProgressBar value={avgQuality} max={5} color="#8b5cf6" />
          <div className="h-wellness-meta">
            Media 7gg: {avgHours > 0 ? `${avgHours.toFixed(1)}h` : '—'}
          </div>
        </div>

        {/* Last night */}
        {lastNight && (
          <div className="h-last-sleep">
            <span className="h-last-sleep-label">Ieri notte</span>
            <div className="h-last-sleep-val">
              <span>{(lastNight.duration_minutes / 60).toFixed(1)}h</span>
              <QualityStars quality={lastNight.quality} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
