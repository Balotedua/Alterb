import type { ThemeMap } from '@/types';

export const THEMES: ThemeMap = {
  minimal: {
    '--bg': '#ffffff',
    '--bg-surface': '#f5f5f5',
    '--text': '#111111',
    '--text-muted': '#666666',
    '--accent': '#0066ff',
    '--accent-soft': '#e0eaff',
    '--border': '#e0e0e0',
    '--radius': '8px',
  },
  neon: {
    '--bg': '#0a0a0f',
    '--bg-surface': '#12121a',
    '--text': '#f0f0ff',
    '--text-muted': '#8080aa',
    '--accent': '#00ffcc',
    '--accent-soft': '#00ffcc22',
    '--border': '#2a2a3a',
    '--radius': '6px',
  },
  carbon: {
    '--bg': '#161616',
    '--bg-surface': '#1e1e1e',
    '--text': '#e8e8e8',
    '--text-muted': '#888888',
    '--accent': '#f4a93a',
    '--accent-soft': '#f4a93a22',
    '--border': '#2e2e2e',
    '--radius': '4px',
  },
  aurora: {
    '--bg': '#0d1117',
    '--bg-surface': '#161b22',
    '--text': '#cdd9e5',
    '--text-muted': '#768390',
    '--accent': '#bc8cff',
    '--accent-soft': '#bc8cff22',
    '--border': '#30363d',
    '--radius': '10px',
  },
};
