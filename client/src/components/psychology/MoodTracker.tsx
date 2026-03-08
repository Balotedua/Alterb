import { MOOD_CONFIG } from '@/utils/constants';

export function MoodTracker() {
  return (
    <div className="mood-tracker">
      <p className="mood-tracker__label">Come ti senti oggi?</p>
      <div className="mood-tracker__buttons">
        {MOOD_CONFIG.map((m) => (
          <button
            key={m.id}
            className="mood-btn"
            title={m.label}
            aria-label={m.label}
            style={{ '--mood-color': m.color } as React.CSSProperties}
          >
            <span className="mood-btn__emoji">{m.emoji}</span>
            <span className="mood-btn__label">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
