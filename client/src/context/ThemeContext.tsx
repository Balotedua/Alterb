import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { THEMES } from '@/styles/themes';
import type { ThemeName } from '@/types';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (name: ThemeName) => void;
  themes: ThemeName[];
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'alter_theme';
const DEFAULT_THEME: ThemeName = 'minimal';

function isThemeName(value: string): value is ThemeName {
  return value in THEMES;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? '';
    return isThemeName(stored) ? stored : DEFAULT_THEME;
  });

  const setTheme = (name: ThemeName) => {
    if (!THEMES[name]) return;
    setThemeState(name);
    localStorage.setItem(STORAGE_KEY, name);
  };

  useEffect(() => {
    const vars = THEMES[theme] ?? THEMES[DEFAULT_THEME];
    Object.entries(vars).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: Object.keys(THEMES) as ThemeName[] }}>
      {children}
    </ThemeContext.Provider>
  );
}
