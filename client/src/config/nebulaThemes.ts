/**
 * Nebula theme definitions.
 * Each theme controls:
 *  - CSS background + orbs  (applied via data-nb-theme on .nebula-core)
 *  - Entity canvas colors   (read from store in NebulaEntity loop)
 *  - Accent CSS variable    (--nb-accent on .nebula-core)
 */

export interface NebulaTheme {
  id:           string;
  label:        string;
  description:  string;
  /** Swatch gradient shown in the picker */
  swatch:       string;
  /** CSS accent value — space-separated R G B for modern rgb()/rgba() */
  accentRGB:    string;
  /** Card icon gradient */
  iconGrad:     string;
  /** Entity canvas: inner center glow color */
  glowInner:    [number, number, number];
  /** Entity canvas: outer center glow color */
  glowOuter:    [number, number, number];
  /** Entity canvas: base ring particle color */
  particleBase: [number, number, number];
  /** Entity canvas: wave addition (r, g) to particle base */
  particleWave: [number, number];
  /** Entity canvas: send-burst addition (r, g) */
  particleSend: [number, number];
  /** Entity canvas: response-burst addition (r, g) */
  particleResp: [number, number];
}

export const NEBULA_THEMES: NebulaTheme[] = [
  {
    id:          'nebula',
    label:       'Nebula',
    description: 'Viola cosmico',
    swatch:      'radial-gradient(circle at 35% 35%, #9333ea, #1a0c42 70%)',
    accentRGB:   '167 139 250',
    iconGrad:    'linear-gradient(135deg, rgba(124,58,237,0.9), rgba(109,40,217,0.9))',
    glowInner:   [130, 70, 245],
    glowOuter:   [95,  50, 200],
    particleBase: [145, 112, 250],
    particleWave: [68,  60],
    particleSend: [25,  18],
    particleResp: [55,  45],
  },
  {
    id:          'bianco',
    label:       'Bianco',
    description: 'Luce essenziale',
    swatch:      'radial-gradient(circle at 35% 35%, #ede8ff, #f8f5ff 70%)',
    accentRGB:   '109 40 217',
    iconGrad:    'linear-gradient(135deg, rgba(109,40,217,0.85), rgba(79,20,187,0.85))',
    glowInner:   [109,  40, 217],
    glowOuter:   [ 79,  20, 187],
    particleBase: [100,  30, 200],
    particleWave: [ 40,  20],
    particleSend: [ 18,  10],
    particleResp: [ 28,  15],
  },
  {
    id:          'ghiaccio',
    label:       'Ghiaccio',
    description: 'Blu artico',
    swatch:      'radial-gradient(circle at 35% 35%, #60a5fa, #050e22 70%)',
    accentRGB:   '96 165 250',
    iconGrad:    'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(37,99,235,0.9))',
    glowInner:   [80,  140, 235],
    glowOuter:   [55,  100, 205],
    particleBase: [140, 170, 245],
    particleWave: [45,  25],
    particleSend: [20,  12],
    particleResp: [35,  20],
  },
  {
    id:          'rosso',
    label:       'Rosso',
    description: 'Cremisi scuro',
    swatch:      'radial-gradient(circle at 35% 35%, #ef4444, #200505 70%)',
    accentRGB:   '248 113 113',
    iconGrad:    'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(185,28,28,0.9))',
    glowInner:   [200,  40,  60],
    glowOuter:   [155,  20,  40],
    particleBase: [228,  80,  85],
    particleWave: [27,   10],
    particleSend: [15,    5],
    particleResp: [27,   10],
  },
];

export const DEFAULT_THEME_ID = 'nebula';
export const NB_THEME_KEY     = 'nb_theme';

export function getTheme(id: string): NebulaTheme {
  return NEBULA_THEMES.find(t => t.id === id) ?? NEBULA_THEMES[0];
}
