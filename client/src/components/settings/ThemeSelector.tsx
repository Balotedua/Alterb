import { useTheme } from '@/hooks/useTheme';
import type { ThemeName } from '@/types';

const THEME_LABELS: Record<ThemeName, string> = {
  minimal: '☀️ Minimal',
  neon: '⚡ Neon',
  carbon: '🔥 Carbon',
  aurora: '🌌 Aurora',
};

export function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="theme-selector">
      <h2 className="theme-selector__title">Tema</h2>
      <div className="theme-selector__options">
        {themes.map((t) => (
          <button
            key={t}
            className={['theme-option', theme === t ? 'theme-option--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
          >
            {THEME_LABELS[t] ?? t}
          </button>
        ))}
      </div>
    </div>
  );
}
