import { createContext, useEffect, useState } from 'react';
import { THEMES } from '../styles/themes';

export const ThemeContext = createContext(null);

const STORAGE_KEY = 'alter_theme';
const DEFAULT_THEME = 'minimal';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME
  );

  const setTheme = (name) => {
    if (!THEMES[name]) return;
    setThemeState(name);
    localStorage.setItem(STORAGE_KEY, name);
  };

  // Applica CSS variables al root quando il tema cambia
  useEffect(() => {
    const vars = THEMES[theme] ?? THEMES[DEFAULT_THEME];
    Object.entries(vars).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: Object.keys(THEMES) }}>
      {children}
    </ThemeContext.Provider>
  );
}
