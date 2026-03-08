import { useCallback, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { ThemeName } from '@/types';

// ─── Theme preview config ──────────────────────────────────────────────────────

interface ThemePreviewConfig {
  label: string;
  bg: string;
  accent: string;
}

const THEME_PREVIEW: Record<ThemeName, ThemePreviewConfig> = {
  minimal: { label: 'Minimal', bg: '#ffffff', accent: '#0066ff' },
  neon: { label: 'Neon', bg: '#0a0a0f', accent: '#00ffcc' },
  carbon: { label: 'Carbon', bg: '#161616', accent: '#f4a93a' },
  aurora: { label: 'Aurora', bg: '#0d1117', accent: '#bc8cff' },
};

const THEME_NAMES: ThemeName[] = ['minimal', 'neon', 'carbon', 'aurora'];

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = 'it' | 'en';
type DateFormat = 'GG/MM/AAAA' | 'MM/GG/AAAA' | 'AAAA-MM-GG';
type Currency = '€ Euro' | '$ Dollaro' | '£ Sterlina';
type Density = 'comoda' | 'compatta';

// ─── PanelPreferenze ──────────────────────────────────────────────────────────

export function PanelPreferenze() {
  const { theme, setTheme } = useTheme();

  const [lang, setLang] = useLocalStorage<Lang>('alter_lang', 'it');
  const [dateFormat, setDateFormat] = useLocalStorage<DateFormat>('alter_date_format', 'GG/MM/AAAA');
  const [currency, setCurrency] = useLocalStorage<Currency>('alter_currency', '€ Euro');
  const [density, setDensity] = useLocalStorage<Density>('alter_density', 'comoda');

  // Sync density class on body
  useEffect(() => {
    if (density === 'compatta') {
      document.body.classList.add('density-compact');
    } else {
      document.body.classList.remove('density-compact');
    }
  }, [density]);

  const handleDensityChange = useCallback(
    (value: Density) => {
      setDensity(value);
    },
    [setDensity],
  );

  return (
    <div className="st-panel">
      {/* Tema */}
      <div className="st-section">
        <p className="st-section__title">Tema</p>
        <div
          className="st-section__body"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {THEME_NAMES.map((t) => {
            const cfg = THEME_PREVIEW[t];
            const isActive = theme === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={isActive}
                style={{
                  background: 'var(--bg-surface)',
                  border: isActive
                    ? '2px solid var(--accent)'
                    : '2px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Miniatura preview */}
                <div
                  style={{
                    width: '100%',
                    height: 36,
                    borderRadius: 6,
                    background: cfg.bg,
                    border: '1px solid rgba(128,128,128,0.2)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    gap: 6,
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Barra accent simulata */}
                  <div
                    style={{
                      width: 8,
                      height: 20,
                      borderRadius: 4,
                      background: cfg.accent,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div
                      style={{
                        height: 5,
                        borderRadius: 3,
                        background: cfg.accent,
                        width: '55%',
                        opacity: 0.85,
                      }}
                    />
                    <div
                      style={{
                        height: 4,
                        borderRadius: 3,
                        background: cfg.accent,
                        width: '35%',
                        opacity: 0.35,
                      }}
                    />
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lingua */}
      <div className="st-section">
        <p className="st-section__title">Lingua</p>
        <div className="st-section__body" style={{ display: 'flex', gap: 10 }}>
          {(
            [
              { value: 'it', label: 'Italiano 🇮🇹' },
              { value: 'en', label: 'English 🇬🇧' },
            ] as { value: Lang; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setLang(value)}
              aria-pressed={lang === value}
              style={{
                border: lang === value ? '2px solid var(--accent)' : '2px solid var(--border)',
                background: lang === value ? 'var(--accent-soft)' : 'var(--bg-surface)',
                color: lang === value ? 'var(--accent)' : 'var(--text)',
                borderRadius: 20,
                padding: '6px 18px',
                fontSize: 14,
                fontWeight: lang === value ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Formato */}
      <div className="st-section">
        <p className="st-section__title">Formato</p>
        <div className="st-section__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label" htmlFor="date-format-select">
              Formato data
            </label>
            <select
              id="date-format-select"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormat)}
              style={{
                width: '100%',
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="GG/MM/AAAA">GG/MM/AAAA</option>
              <option value="MM/GG/AAAA">MM/GG/AAAA</option>
              <option value="AAAA-MM-GG">AAAA-MM-GG</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="currency-select">
              Valuta
            </label>
            <select
              id="currency-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              style={{
                width: '100%',
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="€ Euro">€ Euro</option>
              <option value="$ Dollaro">$ Dollaro</option>
              <option value="£ Sterlina">£ Sterlina</option>
            </select>
          </div>
        </div>
      </div>

      {/* Densità interfaccia */}
      <div className="st-section">
        <p className="st-section__title">Densità interfaccia</p>
        <div className="st-section__body" style={{ display: 'flex', gap: 10 }}>
          {(
            [
              { value: 'comoda', label: 'Comoda' },
              { value: 'compatta', label: 'Compatta' },
            ] as { value: Density; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleDensityChange(value)}
              aria-pressed={density === value}
              style={{
                border: density === value ? '2px solid var(--accent)' : '2px solid var(--border)',
                background: density === value ? 'var(--accent-soft)' : 'var(--bg-surface)',
                color: density === value ? 'var(--accent)' : 'var(--text)',
                borderRadius: 20,
                padding: '6px 18px',
                fontSize: 14,
                fontWeight: density === value ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
