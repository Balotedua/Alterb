import { useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import { getByCategory, getSemanticLinks, getRecentAll } from '../../vault/vaultService';
import { inferRenderType } from '../widget/PolymorphicWidget';
import type { Star } from '../../types';
import { nebulaCameraRef } from '../nebula/nebulaCamera';

// ─── Category meta registry ───────────────────────────────────
export const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  finance:      { label: 'Finanza',          color: '#f5c842', icon: '💰' },
  health:       { label: 'Salute',           color: '#00e8d0', icon: '💪' },
  psychology:   { label: 'Salute Mentale',   color: '#c084fc', icon: '🧠' },
  mental_health:{ label: 'Salute Mentale',   color: '#c084fc', icon: '🧠' },
  calendar:     { label: 'Calendario',       color: '#60a5fa', icon: '📅' },
  routine:      { label: 'Tempo & Routine',  color: '#34d399', icon: '⏳' },
  notes:        { label: 'Archivio',         color: '#e2e8f0', icon: '📓' },
  interests:    { label: 'Interessi',        color: '#fb923c', icon: '🌍' },
  career:       { label: 'Carriera',         color: '#818cf8', icon: '🚀' },
  badges:       { label: 'Badge',            color: '#fbbf24', icon: '🏆' },
  insight:      { label: 'Insight',          color: '#fcd34d', icon: '✨' },
};

export function getCategoryMeta(cat: string) {
  if (CATEGORY_META[cat]) return CATEGORY_META[cat];
  let hash = 0;
  for (const c of cat) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  const PALETTE = ['#f0b8d0','#f5c898','#a0d8a8','#90c8f0','#d0a8f0','#f0e0a0'];
  const ICONS   = ['⭐','🌿','🎯','📚','✈️','🐾','🎵','🔮'];
  const color   = PALETTE[Math.abs(hash) % PALETTE.length];
  const icon    = ICONS[Math.abs(hash >> 4) % ICONS.length];
  return { label: cat.charAt(0).toUpperCase() + cat.slice(1), color, icon };
}

// ─── Subcategory constellation map (L1 zoom) ─────────────────
export const SUBCATEGORY_MAP: Record<string, Array<{ id: string; label: string; icon: string }>> = {
  finance:      [{ id: 'transazioni', label: 'Transazioni', icon: '💳' }, { id: 'cashflow', label: 'Cashflow', icon: '📊' }, { id: 'aggiungi', label: 'Aggiungi', icon: '➕' }, { id: 'budget', label: 'Budget', icon: '🎯' }, { id: 'ricorrenti', label: 'Ricorrenti', icon: '🔄' }, { id: 'analisi', label: 'Analisi', icon: '🔥' }],
  health:       [{ id: 'peso', label: 'Peso', icon: '⚖️' }, { id: 'allenamento', label: 'Allenamento', icon: '🏋️' }, { id: 'sonno', label: 'Sonno', icon: '😴' }, { id: 'nutrizione', label: 'Nutrizione', icon: '🥗' }],
  psychology:   [{ id: 'umore', label: 'Umore', icon: '🎭' }, { id: 'stress', label: 'Stress', icon: '💆' }, { id: 'gratitudine', label: 'Gratitudine', icon: '✨' }, { id: 'riflessioni', label: 'Riflessioni', icon: '📝' }],
  mental_health:[{ id: 'umore', label: 'Umore', icon: '🎭' }, { id: 'stress', label: 'Stress', icon: '💆' }, { id: 'gratitudine', label: 'Gratitudine', icon: '✨' }, { id: 'riflessioni', label: 'Riflessioni', icon: '📝' }],
  calendar:     [{ id: 'eventi', label: 'Eventi', icon: '📅' }, { id: 'promemoria', label: 'Promemoria', icon: '🔔' }, { id: 'routine', label: 'Routine', icon: '⏳' }],
  career:       [{ id: 'obiettivi', label: 'Obiettivi', icon: '🎯' }, { id: 'skills', label: 'Skills', icon: '🚀' }, { id: 'log', label: 'Work Log', icon: '📋' }],
  notes:        [{ id: 'note', label: 'Note', icon: '📓' }, { id: 'idee', label: 'Idee', icon: '💡' }],
  interests:    [{ id: 'hobby', label: 'Hobby', icon: '🌍' }, { id: 'letture', label: 'Letture', icon: '📚' }, { id: 'musica', label: 'Musica', icon: '🎵' }],
  routine:      [{ id: 'mattina', label: 'Mattina', icon: '☀️' }, { id: 'sera', label: 'Sera', icon: '🌙' }, { id: 'abitudini', label: 'Abitudini', icon: '✅' }],
};

// ─── Fixed positions for known categories (well-distributed) ─
const FIXED_STAR_POSITIONS: Record<string, { x: number; y: number }> = {
  finance:      { x: 0.22, y: 0.28 },
  health:       { x: 0.72, y: 0.24 },
  psychology:   { x: 0.82, y: 0.62 },
  mental_health:{ x: 0.82, y: 0.62 },
  calendar:     { x: 0.30, y: 0.72 },
  routine:      { x: 0.60, y: 0.74 },
  notes:        { x: 0.14, y: 0.56 },
  interests:    { x: 0.50, y: 0.20 },
  career:       { x: 0.80, y: 0.38 },
  badges:       { x: 0.48, y: 0.68 },
  insight:      { x: 0.35, y: 0.40 },
};

// ─── Deterministic star position ─────────────────────────────
export function starPosition(cat: string): { x: number; y: number } {
  if (FIXED_STAR_POSITIONS[cat]) return FIXED_STAR_POSITIONS[cat];
  let h1 = 0, h2 = 0;
  for (let i = 0; i < cat.length; i++) {
    h1 = ((h1 << 5) - h1) + cat.charCodeAt(i);
    h2 = ((h2 << 3) - h2) + cat.charCodeAt(cat.length - 1 - i);
    h1 |= 0; h2 |= 0;
  }
  return {
    x: 0.12 + (Math.abs(h1 % 1000) / 1000) * 0.76,
    y: 0.15 + (Math.abs(h2 % 1000) / 1000) * 0.65,
  };
}

// ─── Subcategory star position — clustered near parent ────────
function substarPos(parentX: number, parentY: number, subId: string, idx: number, total: number): { x: number; y: number } {
  let hash = 0;
  for (const c of subId) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  hash |= 0;
  const baseAngle = (idx / total) * Math.PI * 2 - Math.PI / 2;
  const jitter    = ((Math.abs(hash) % 200) / 200 - 0.5) * 0.55;
  const angle     = baseAngle + jitter;
  const dist      = 0.052 + (Math.abs(hash >> 8) % 100) / 100 * 0.068;
  return {
    x: Math.max(0.02, Math.min(0.98, parentX + Math.cos(angle) * dist)),
    y: Math.max(0.02, Math.min(0.98, parentY + Math.sin(angle) * dist)),
  };
}

// ─── Particles ────────────────────────────────────────────────
// layer 0 = distant/slow, layer 1 = mid, layer 2 = near/fast
interface Particle { x: number; y: number; r: number; a: number; da: number; layer: 0 | 1 | 2; sparkle?: boolean; }

// Parallax factors per layer (applied to panX/panY)
const LAYER_PARALLAX = [0.12, 0.38, 0.78] as const;
const LAYER_RADIUS   = [[0.12, 0.35], [0.28, 0.72], [0.45, 1.3]] as const;
const LAYER_FLICKER  = [0.0006, 0.0014, 0.0028] as const;

function initParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const layer = Math.floor(Math.random() * 3) as 0 | 1 | 2;
    const [rMin, rMax] = LAYER_RADIUS[layer];
    const r = rMin + Math.random() * (rMax - rMin);
    return {
      x: Math.random(), y: Math.random(),
      r,
      a: Math.random(),
      da: (Math.random() - 0.5) * LAYER_FLICKER[layer] * 2 + LAYER_FLICKER[layer],
      layer,
      sparkle: layer === 2 && r > 0.9 && Math.random() < 0.22,
    };
  });
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

// ─── Camera + canvas state ────────────────────────────────────
interface CanvasState {
  particles: Particle[];
  raf: number;
  hovered: string | null;
  t: number;
  panX: number;
  panY: number;
  velX: number; // pan inertia
  velY: number;
  scale: number;
  targetScale: number; // smooth zoom target
  dragging: boolean;
  dragX: number;
  dragY: number;
  didDrag: boolean;
  pinchDist: number;
  pinchMidX: number;
  pinchMidY: number;
  pinching: boolean; // true while 2-finger pinch is active → skip scale lerp
  constellationAlpha: number; // 0..0.12, fades in when idle
  touchStartX: number;
  touchStartY: number;
}

// ─── StarfieldView ────────────────────────────────────────────
export default function StarfieldView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile  = window.innerWidth < 768;

  const stateRef = useRef<CanvasState>({
    particles: initParticles(isMobile ? 26 : 48),
    raf: 0, hovered: null, t: 0,
    panX: 0, panY: 0, velX: 0, velY: 0, scale: 1, targetScale: 1,
    dragging: false, dragX: 0, dragY: 0, didDrag: false,
    pinchDist: -1, pinchMidX: 0, pinchMidY: 0, pinching: false,
    touchStartX: 0, touchStartY: 0,
    constellationAlpha: 0,
  });

  const { stars, focusMode, setActiveWidget, user, markStarSeen, highlightedStarId, alertEvent, setSemanticLinks, setGhostStarPrompt } = useAlterStore();

  // Subtle ripple at click position
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; color: string } | null>(null);
  const [nexusScanning, setNexusScanning] = useState(false);

  // Load semantic links whenever the star count changes
  useEffect(() => {
    if (!user) return;
    getSemanticLinks(user.id).then(links => setSemanticLinks(links));
  }, [user, stars.length, setSemanticLinks]);

  // Mark new stars as seen immediately (no animation needed)
  useEffect(() => {
    stars.filter(s => s.isNew).forEach(s => markStarSeen(s.id));
  }, [stars, markStarSeen]);


  // ── Camera: normalized → screen coords ────────────────────
  const toScreen = useCallback((nx: number, ny: number, W: number, H: number) => {
    const { panX, panY, scale } = stateRef.current;
    return {
      sx: (nx - 0.5) * W * scale + W / 2 + panX,
      sy: (ny - 0.5) * H * scale + H / 2 + panY,
    };
  }, []);

  // ── Draw loop ──────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const state = stateRef.current;
    state.t += 0.007;

    // Smooth zoom: snap during pinch (no lag), lerp otherwise
    if (state.pinching || Math.abs(state.scale - state.targetScale) <= 0.0005) {
      state.scale = state.targetScale;
    } else {
      state.scale += (state.targetScale - state.scale) * 0.14;
    }

    // Pan inertia: apply velocity when not dragging
    if (!state.dragging && (Math.abs(state.velX) > 0.05 || Math.abs(state.velY) > 0.05)) {
      state.panX += state.velX;
      state.panY += state.velY;
      state.velX *= 0.88;
      state.velY *= 0.88;
      if (nebulaCameraRef.el) nebulaCameraRef.el.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    }
    const { scale } = state;

    // Deep space background — theme-aware radial vignette
    const currentTheme = useAlterStore.getState().theme ?? 'dark';
    const BG_COLORS: Record<string, [string, string, string]> = {
      dark:   ['#020312', '#010209', '#000000'],
      matrix: ['#001200', '#000800', '#000300'],
      nebula: ['#0d0020', '#06000f', '#020008'],
      light:  ['#dde2ff', '#eaeeff', '#f4f6ff'],
    };
    const [bgC0, bgC1, bgC2] = BG_COLORS[currentTheme] ?? BG_COLORS.dark;
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
    bg.addColorStop(0,   bgC0);
    bg.addColorStop(0.5, bgC1);
    bg.addColorStop(1,   bgC2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle nebula wisps — tinted dust clouds for depth
    const NEBULA_TINTS: Record<string, [number,number,number]> = {
      dark:   [28, 46, 128],
      matrix: [0,  130, 28],
      nebula: [88, 36, 175],
      light:  [55, 75, 195],
    };
    const [nt_r, nt_g, nt_b] = NEBULA_TINTS[currentTheme] ?? NEBULA_TINTS.dark;
    [[0.15, 0.25, 0.30], [0.80, 0.68, 0.26], [0.50, 0.10, 0.22]].forEach(([wx, wy, wr]) => {
      const wg = ctx.createRadialGradient(wx * W, wy * H, 0, wx * W, wy * H, Math.min(W, H) * wr);
      wg.addColorStop(0, `rgba(${nt_r},${nt_g},${nt_b},0.032)`);
      wg.addColorStop(1, `rgba(${nt_r},${nt_g},${nt_b},0)`);
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, H);
    });

    // ── Constellation alpha: fade in when idle, out when dragging ──
    if (state.dragging) {
      state.constellationAlpha = Math.max(0, state.constellationAlpha - 0.025);
    } else {
      state.constellationAlpha = Math.min(0.05, state.constellationAlpha + 0.003);
    }

    // ── Parallax particles — 3 depth layers ──
    const isLightTheme = currentTheme === 'light';
    const isMatrixTheme = currentTheme === 'matrix';
    const isNebulaTheme = currentTheme === 'nebula';
    state.particles.forEach((p) => {
      p.a += p.da;
      if (p.a <= 0.02) { p.a = 0.02; p.da = Math.abs(p.da); }
      if (p.a >= 1)    { p.a = 1;    p.da = -Math.abs(p.da); }
      const factor = LAYER_PARALLAX[p.layer];
      const px = p.x * W + state.panX * factor;
      const py = p.y * H + state.panY * factor;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      const particleAlpha = p.a * (0.08 + p.layer * 0.045);
      const pColor = isLightTheme
        ? `rgba(80,80,160,${particleAlpha * 0.55})`
        : isMatrixTheme
        ? `rgba(0,255,65,${particleAlpha * 0.65})`
        : isNebulaTheme
        ? `rgba(180,140,255,${particleAlpha * 0.60})`
        : `rgba(255,255,255,${particleAlpha})`;
      ctx.fillStyle = pColor;
      ctx.fill();
      // 4-point cross sparkle on select bright particles
      if (p.sparkle && particleAlpha > 0.038) {
        const sl = p.r * 3.8;
        const sa = particleAlpha * 0.65;
        const sc = isLightTheme ? `rgba(80,80,180,${sa})` : `rgba(255,255,255,${sa})`;
        ctx.save();
        ctx.strokeStyle = sc;
        ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.moveTo(px - sl, py); ctx.lineTo(px + sl, py); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py - sl * 0.65); ctx.lineTo(px, py + sl * 0.65); ctx.stroke();
        ctx.restore();
      }
    });

    const starsNow        = useAlterStore.getState().stars;
    const highlightedId   = useAlterStore.getState().highlightedStarId;
    const alertEvt        = useAlterStore.getState().alertEvent;
    const hov = state.hovered;
    const s   = Math.sqrt(Math.max(scale, 0.3)); // visual scale factor

    // ── Semantic cluster beams (drawn behind stars) ──
    const semLinks = useAlterStore.getState().semanticLinks;
    if (semLinks.length > 0) {
      ctx.save();
      for (const link of semLinks) {
        const sA = starsNow.find(st => st.id === link.catA);
        const sB = starsNow.find(st => st.id === link.catB);
        if (!sA || !sB) continue;
        const pa = toScreen(sA.x, sA.y, W, H);
        const pb = toScreen(sB.x, sB.y, W, H);
        const [rA, gA, bA] = hexToRgb(sA.color);
        const [rB, gB, bB] = hexToRgb(sB.color);
        const strength = (link.similarity - 0.55) / 0.45; // 0..1
        const breathe  = 0.82 + Math.sin(state.t * 0.65 + link.catA.charCodeAt(0) * 0.13) * 0.18;
        const alpha    = strength * 0.30 * breathe;
        const grad = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
        grad.addColorStop(0,   `rgba(${rA},${gA},${bA},${alpha})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.7})`);
        grad.addColorStop(1,   `rgba(${rB},${gB},${bB},${alpha})`);
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1.5 + strength * 2.0;
        ctx.shadowBlur  = 8 * strength;
        ctx.shadowColor = `rgba(${rA},${gA},${bA},0.5)`;
        ctx.stroke();
        ctx.shadowBlur  = 0;
      }
      ctx.restore();
    }

    // ── Category stars — minimal luminous dots ──
    starsNow.forEach((star) => {
      const { sx: px, sy: py } = toScreen(star.x, star.y, W, H);
      if (px < -80 || px > W + 80 || py < -80 || py > H + 80) return;

      const isHov     = hov === star.id;
      const isHighlit = highlightedId === star.id;
      const isAlert   = alertEvt != null && star.id === 'calendar';
      const isInsight = star.isInsight ?? false;
      const [r, g, b] = isAlert ? [255, 80, 80] : isInsight ? [240, 192, 64] : hexToRgb(star.color);
      const { intensity } = star;
      const isEphemeral = star.ephemeral ?? false;

      // Very slow, smooth twinkle — almost imperceptible
      const twinkle = Math.sin(state.t * (0.55 + star.x * 1.4) + star.y * 3.8) * 0.05 + 0.95;
      const pulse   = isHighlit
        ? Math.sin(state.t * 4.5) * 0.15 + 0.9
        : isAlert   ? Math.sin(state.t * 3)   * 0.18 + 0.88
        : isInsight ? Math.sin(state.t * 1.8) * 0.20 + 0.92
        : twinkle;
      const alpha   = (isEphemeral ? 0.35 : 0.45) + (intensity * (isEphemeral ? 0.35 : 0.55));
      const a       = alpha * pulse;

      // Planet vs star: main CATEGORY_META entries are planets
      const isPlanet = !!CATEGORY_META[star.id];
      // Outer glow halo — tight, precise corona
      const glowR = isPlanet
        ? (isHov ? 68 : 38 + intensity * 28) * s
        : (isHov ? 40 : 18 + intensity * 24) * s;
      const glowGrd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      glowGrd.addColorStop(0,    `rgba(${r},${g},${b},${a * 0.55})`);
      glowGrd.addColorStop(0.18, `rgba(${r},${g},${b},${a * 0.22})`);
      glowGrd.addColorStop(0.50, `rgba(${r},${g},${b},${a * 0.06})`);
      glowGrd.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      ctx.beginPath(); ctx.arc(px, py, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glowGrd; ctx.fill();

      // Wide secondary bloom (OLED bleed) — restrained
      const bloomR = glowR * 1.7;
      const bloomGrd = ctx.createRadialGradient(px, py, 0, px, py, bloomR);
      bloomGrd.addColorStop(0,   `rgba(${r},${g},${b},${a * 0.09})`);
      bloomGrd.addColorStop(0.4, `rgba(${r},${g},${b},${a * 0.025})`);
      bloomGrd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      ctx.beginPath(); ctx.arc(px, py, bloomR, 0, Math.PI * 2);
      ctx.fillStyle = bloomGrd; ctx.fill();

      // Colored core: sphere gradient for planets, point star for others
      const coreR = isPlanet
        ? (isHov ? 32 : 19 + intensity * 13) * s
        : (isHov ? 9 : 3.5 + intensity * 6) * s * (isHighlit || isAlert ? 1.5 : 1);
      const efa = isEphemeral ? 0.55 : 1;
      const coreGrd = isPlanet
        ? ctx.createRadialGradient(px - coreR * 0.30, py - coreR * 0.30, 0, px, py, coreR)
        : ctx.createRadialGradient(px, py, 0, px, py, coreR);
      if (isPlanet) {
        coreGrd.addColorStop(0,    `rgba(255,255,255,${a * 0.96 * efa})`);
        coreGrd.addColorStop(0.16, `rgba(255,255,255,${a * 0.55 * efa})`);
        coreGrd.addColorStop(0.42, `rgba(${r},${g},${b},${a * efa})`);
        coreGrd.addColorStop(0.74, `rgba(${Math.max(0,r-70)},${Math.max(0,g-70)},${Math.max(0,b-70)},${a * 0.80 * efa})`);
        coreGrd.addColorStop(1,    `rgba(0,0,0,${a * 0.94 * efa})`);
      } else {
        coreGrd.addColorStop(0,    `rgba(255,255,255,${a * efa})`);
        coreGrd.addColorStop(0.35, `rgba(${r},${g},${b},${a * efa})`);
        coreGrd.addColorStop(1,    `rgba(${r},${g},${b},${a * 0.55 * efa})`);
      }
      ctx.beginPath(); ctx.arc(px, py, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrd;
      ctx.shadowBlur  = isHov ? 38 : (isPlanet ? 30 + intensity * 22 : 16 + intensity * 24) * s;
      ctx.shadowColor = `rgba(${r},${g},${b},0.95)`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Dual orbital rings + icon for planets
      if (isPlanet) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.28);
        // Inner ring — precise hairline
        ctx.beginPath();
        ctx.ellipse(0, 0, coreR * 1.60, coreR * 0.36, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.42})`;
        ctx.lineWidth = 0.85 * s;
        ctx.shadowBlur = 5;
        ctx.shadowColor = `rgba(${r},${g},${b},0.55)`;
        ctx.stroke();
        // Outer ghost ring
        ctx.beginPath();
        ctx.ellipse(0, 0, coreR * 2.15, coreR * 0.50, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.09})`;
        ctx.lineWidth = 0.45 * s;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();
        const pmeta = getCategoryMeta(star.id);
        ctx.save();
        ctx.font = `${Math.round(coreR * 0.80)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = isHov ? 0.88 : 0.68;
        ctx.fillText(pmeta.icon, px, py);
        ctx.restore();
      }

      // Label
      ctx.save();
      ctx.font = isPlanet
        ? `300 ${Math.round(8.5 * Math.max(s, 1))}px -apple-system, "SF Pro Display", system-ui, sans-serif`
        : `300 8px -apple-system, "SF Pro Display", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${r},${g},${b},${isHov ? 0.95 : isPlanet ? 0.68 : 0.44})`;
      ctx.shadowBlur  = isHov ? 10 : isPlanet ? 7 : 3;
      ctx.shadowColor = `rgba(${r},${g},${b},${isPlanet ? 0.50 : 0.35})`;
      ctx.fillText(star.label.toUpperCase(), px, py + coreR + (isPlanet ? 22 : 16) * s);
      ctx.shadowBlur = 0;
      ctx.restore();
      void isInsight;
    });

    // ── Subcategory stars — colored pixels near each planet ──
    starsNow.forEach((pStar) => {
      const subs = SUBCATEGORY_MAP[pStar.id] ?? [];
      if (!subs.length) return;
      const [sr, sg, sb] = hexToRgb(pStar.color);
      subs.forEach((sub, i) => {
        const pos = substarPos(pStar.x, pStar.y, sub.id, i, subs.length);
        const { sx: spx, sy: spy } = toScreen(pos.x, pos.y, W, H);
        if (spx < -40 || spx > W + 40 || spy < -40 || spy > H + 40) return;
        const isSubHov = hov === `sub:${pStar.id}:${sub.id}`;
        const twinkle  = 0.60 + Math.sin(state.t * (0.50 + pos.x * 1.7) + pos.y * 4.0 + i * 1.3) * 0.40;
        // Soft glow
        const subGlowR = (isSubHov ? 18 : 5 + scale * 1.8) * s;
        const subGlowGrd = ctx.createRadialGradient(spx, spy, 0, spx, spy, subGlowR);
        subGlowGrd.addColorStop(0, `rgba(${sr},${sg},${sb},${twinkle * 0.28})`);
        subGlowGrd.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
        ctx.beginPath(); ctx.arc(spx, spy, subGlowR, 0, Math.PI * 2);
        ctx.fillStyle = subGlowGrd; ctx.fill();
        // Pixel core
        const subCoreR = Math.min((1.3 + Math.min(scale - 1, 2.8) * 0.60) * s, 6 * s);
        const subCoreGrd = ctx.createRadialGradient(spx, spy, 0, spx, spy, subCoreR);
        subCoreGrd.addColorStop(0,   `rgba(255,255,255,${twinkle * (isSubHov ? 1 : 0.92)})`);
        subCoreGrd.addColorStop(0.4, `rgba(${sr},${sg},${sb},${twinkle * 0.9})`);
        subCoreGrd.addColorStop(1,   `rgba(${sr},${sg},${sb},0)`);
        ctx.beginPath(); ctx.arc(spx, spy, subCoreR, 0, Math.PI * 2);
        ctx.fillStyle = subCoreGrd;
        ctx.shadowBlur  = isSubHov ? 16 : 4;
        ctx.shadowColor = `rgba(${sr},${sg},${sb},0.95)`;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Label — fades in when zoomed in (scale > 1.8)
        const labelAlpha = isSubHov ? 1 : Math.max(0, Math.min(1, (scale - 1.8) / 0.6));
        if (labelAlpha > 0.02) {
          ctx.save();
          ctx.font = `400 ${Math.round(8 * Math.max(s, 1))}px -apple-system, "SF Pro Display", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(${sr},${sg},${sb},${labelAlpha * 0.82})`;
          ctx.shadowBlur  = 5;
          ctx.shadowColor = `rgba(${sr},${sg},${sb},${labelAlpha * 0.6})`;
          ctx.fillText(sub.label.toUpperCase(), spx, spy + subCoreR + 10 * Math.max(s, 1));
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      });
    });

    // ── Ghost Stars: missing pillar categories ──
    const PILLARS = ['finance', 'health', 'psychology', 'calendar'] as const;
    PILLARS.forEach((cat) => {
      if (starsNow.some(st => st.id === cat)) return;
      const pos = starPosition(cat);
      const { sx: px, sy: py } = toScreen(pos.x, pos.y, W, H);
      const meta = getCategoryMeta(cat);
      const [gr, gg, gb] = hexToRgb(meta.color);
      const isGhostHov = hov === `ghost:${cat}`;
      const breathe = isGhostHov ? 0.75 : (0.25 + Math.sin(state.t * 0.7 + cat.charCodeAt(0) * 0.33) * 0.08);
      const radius  = (isGhostHov ? 9 : 5) * s;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${gr},${gg},${gb},${breathe})`;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      // faint "+" inside
      ctx.fillStyle = `rgba(${gr},${gg},${gb},${breathe * 0.6})`;
      ctx.font = `300 6px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('+', px, py + 2.5);
      ctx.font = `300 7px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = `rgba(${gr},${gg},${gb},${isGhostHov ? 0.50 : 0.14})`;
      ctx.fillText(meta.label.toUpperCase(), px, py + radius + 11);
      ctx.restore();
    });

    // ── Constellation lines between nearby stars ──
    if (state.constellationAlpha > 0.002 && starsNow.length > 1) {
      ctx.save();
      ctx.lineWidth = 0.4;
      for (let i = 0; i < starsNow.length; i++) {
        for (let j = i + 1; j < starsNow.length; j++) {
          const a = starsNow[i], b = starsNow[j];
          const pa = toScreen(a.x, a.y, W, H);
          const pb = toScreen(b.x, b.y, W, H);
          const dist = Math.hypot(pa.sx - pb.sx, pa.sy - pb.sy);
          if (dist < 220) {
            const fade = (1 - dist / 220) * state.constellationAlpha * 1.2;
            const [rA, gA, bA] = hexToRgb(a.color);
            const [rB, gB, bB] = hexToRgb(b.color);
            const grad = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
            grad.addColorStop(0, `rgba(${rA},${gA},${bA},${fade})`);
            grad.addColorStop(1, `rgba(${rB},${gB},${bB},${fade})`);
            ctx.beginPath();
            ctx.moveTo(pa.sx, pa.sy);
            ctx.lineTo(pb.sx, pb.sy);
            ctx.strokeStyle = grad;
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    // ── Nexus beam between two correlated stars ──
    const nexusBeam = useAlterStore.getState().nexusBeam;
    if (nexusBeam) {
      const sA = starsNow.find(st => st.id === nexusBeam.catA);
      const sB = starsNow.find(st => st.id === nexusBeam.catB);
      if (sA && sB) {
        const pa = toScreen(sA.x, sA.y, W, H);
        const pb = toScreen(sB.x, sB.y, W, H);
        const [rA, gA, bA] = hexToRgb(nexusBeam.colorA);
        const [rB, gB, bB] = hexToRgb(nexusBeam.colorB);
        const pulse = Math.sin(state.t * 3) * 0.35 + 0.65;
        // Beam gradient
        const beamGrd = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
        beamGrd.addColorStop(0,   `rgba(${rA},${gA},${bA},${0.7 * pulse})`);
        beamGrd.addColorStop(0.5, `rgba(255,255,255,${0.55 * pulse})`);
        beamGrd.addColorStop(1,   `rgba(${rB},${gB},${bB},${0.7 * pulse})`);
        ctx.save();
        ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy);
        ctx.strokeStyle = beamGrd; ctx.lineWidth = 1.5 * pulse;
        ctx.shadowBlur = 12; ctx.shadowColor = `rgba(255,255,255,0.3)`;
        ctx.stroke();
        // Resonance rings
        const ringR = 28 + Math.sin(state.t * 4) * 9;
        [[pa, rA, gA, bA], [pb, rB, gB, bB]].forEach(([pos, r, g, b]) => {
          const p = pos as { sx: number; sy: number };
          ctx.beginPath(); ctx.arc(p.sx, p.sy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.35 * pulse})`;
          ctx.lineWidth = 0.8; ctx.shadowBlur = 0;
          ctx.stroke();
          ctx.beginPath(); ctx.arc(p.sx, p.sy, ringR * 1.6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.12 * pulse})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });
        ctx.restore();
      }
    }


    state.raf = requestAnimationFrame(draw);
  }, [toScreen]);

  // ── Canvas setup ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    stateRef.current.raf = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(stateRef.current.raf);
    };
  }, [draw]);

  // ── Mouse: hover + drag ────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const state  = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;

    if (state.dragging) {
      const dx = e.clientX - state.dragX;
      const dy = e.clientY - state.dragY;
      state.panX += dx;
      state.panY += dy;
      state.velX = dx;
      state.velY = dy;
      state.dragX = e.clientX;
      state.dragY = e.clientY;
      state.didDrag = true;
      canvas.style.cursor = 'grabbing';
      if (nebulaCameraRef.el) nebulaCameraRef.el.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
      return;
    }

    const starsNow = useAlterStore.getState().stars;
    let found: string | null = null;

    for (const star of starsNow) {
      const { sx, sy } = toScreen(star.x, star.y, W, H);
      if (Math.hypot(sx - e.clientX, sy - e.clientY) < 22) { found = star.id; break; }
    }
    if (!found) {
      outer: for (const star of starsNow) {
        const subs = SUBCATEGORY_MAP[star.id] ?? [];
        for (let i = 0; i < subs.length; i++) {
          const pos = substarPos(star.x, star.y, subs[i].id, i, subs.length);
          const { sx, sy } = toScreen(pos.x, pos.y, W, H);
          if (Math.hypot(sx - e.clientX, sy - e.clientY) < 14) { found = `sub:${star.id}:${subs[i].id}`; break outer; }
        }
      }
    }
    if (!found) {
      const PILLARS = ['finance', 'health', 'psychology', 'calendar'];
      for (const cat of PILLARS) {
        if (starsNow.some(s => s.id === cat)) continue;
        const pos = starPosition(cat);
        const { sx, sy } = toScreen(pos.x, pos.y, W, H);
        if (Math.hypot(sx - e.clientX, sy - e.clientY) < 20) { found = `ghost:${cat}`; break; }
      }
    }
    state.hovered = found;
    canvas.style.cursor = found ? 'pointer' : 'grab';
  }, [toScreen]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    state.dragging = true;
    state.dragX    = e.clientX;
    state.dragY    = e.clientY;
    state.didDrag  = false;
  }, []);

  const handleMouseUp = useCallback(() => {
    stateRef.current.dragging = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'grab';
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const state  = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const rect = canvas.getBoundingClientRect();

    // Normalize deltaY across deltaMode (pixel / line / page)
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;   // line mode → pixels
    if (e.deltaMode === 2) delta *= 400;  // page mode → pixels

    // Trackpad pinch fires wheel with ctrlKey — use finer sensitivity
    const sensitivity = e.ctrlKey ? 0.008 : 0.0018;
    const factor = Math.exp(-delta * sensitivity);
    const newTarget = Math.max(0.35, Math.min(4, state.targetScale * factor));
    if (newTarget === state.targetScale) return;

    // Anchor zoom at cursor position (relative to canvas center)
    const cx = (e.clientX - rect.left) * (W / rect.width) - W / 2;
    const cy = (e.clientY - rect.top)  * (H / rect.height) - H / 2;
    const ratio = newTarget / state.targetScale;
    state.panX = cx + (state.panX - cx) * ratio;
    state.panY = cy + (state.panY - cy) * ratio;
    state.targetScale = newTarget;
    if (nebulaCameraRef.el) nebulaCameraRef.el.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    if (nebulaCameraRef.nebula) nebulaCameraRef.nebula.style.transform = `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px))`;
  }, []);

  const openWidget = useCallback(async (star: { id: string; label: string; color: string }, subTab?: string) => {
    if (!user) return;
    const entries = await getByCategory(user.id, star.id);
    const renderType = star.id === 'insight' ? 'insight' : inferRenderType(entries, star.id);
    setActiveWidget({ category: star.id, label: star.label, color: star.color, entries, renderType, subTab });
    markStarSeen(star.id);
  }, [user, setActiveWidget, markStarSeen]);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (state.didDrag) { state.didDrag = false; return; }
    if (!user) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const starsNow = useAlterStore.getState().stars;

    // Planet click
    for (const star of starsNow) {
      const { sx, sy } = toScreen(star.x, star.y, W, H);
      if (Math.hypot(sx - e.clientX, sy - e.clientY) < 28) {
        setClickRipple({ x: sx, y: sy, color: star.color });
        openWidget(star);
        return;
      }
    }
    // Subcategory star click
    for (const star of starsNow) {
      const subs = SUBCATEGORY_MAP[star.id] ?? [];
      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i];
        const pos = substarPos(star.x, star.y, sub.id, i, subs.length);
        const { sx, sy } = toScreen(pos.x, pos.y, W, H);
        if (Math.hypot(sx - e.clientX, sy - e.clientY) < 14) {
          setClickRipple({ x: sx, y: sy, color: star.color });
          openWidget(star, sub.id);
          return;
        }
      }
    }
    // Ghost star click → pre-fill input
    const GHOST_PROMPTS: Record<string, string> = {
      finance: 'Ho speso ', health: 'Peso ', psychology: 'Umore ', calendar: 'Domani ',
    };
    for (const cat of ['finance', 'health', 'psychology', 'calendar']) {
      if (starsNow.some(s => s.id === cat)) continue;
      const pos = starPosition(cat);
      const { sx, sy } = toScreen(pos.x, pos.y, W, H);
      if (Math.hypot(sx - e.clientX, sy - e.clientY) < 20) {
        setGhostStarPrompt(GHOST_PROMPTS[cat] ?? `${cat} `);
        break;
      }
    }
  }, [user, openWidget, toScreen, setGhostStarPrompt]);

  // ── Touch: pan + pinch-zoom ────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const state = stateRef.current;
    if (e.touches.length === 1) {
      state.dragging    = true;
      state.dragX       = e.touches[0].clientX;
      state.dragY       = e.touches[0].clientY;
      state.touchStartX = e.touches[0].clientX;
      state.touchStartY = e.touches[0].clientY;
      state.didDrag     = false;
      state.pinchDist   = -1;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      state.pinchDist = Math.hypot(dx, dy);
      state.pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      state.pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      state.dragging  = false;
      state.pinching  = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const state  = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;

    if (e.touches.length === 1 && state.dragging) {
      const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
      const dx = tx - state.dragX, dy = ty - state.dragY;
      state.panX   += dx;
      state.panY   += dy;
      state.velX    = dx;
      state.velY    = dy;
      state.dragX = tx;
      state.dragY = ty;
      if (Math.hypot(tx - state.touchStartX, ty - state.touchStartY) > 8) state.didDrag = true;
      if (nebulaCameraRef.el) nebulaCameraRef.el.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    } else if (e.touches.length === 2 && state.pinchDist > 0) {
      const dx      = e.touches[0].clientX - e.touches[1].clientX;
      const dy      = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const factor  = newDist / state.pinchDist;
      const newScale = Math.max(0.25, Math.min(5, state.targetScale * factor));
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const cx = midX - W / 2, cy = midY - H / 2;
      state.panX = cx + (state.panX - cx) * (newScale / state.targetScale);
      state.panY = cy + (state.panY - cy) * (newScale / state.targetScale);
      state.panX += midX - state.pinchMidX;
      state.panY += midY - state.pinchMidY;
      state.targetScale = newScale;
      state.pinchDist = newDist;
      state.pinchMidX = midX;
      state.pinchMidY = midY;
      if (nebulaCameraRef.el) nebulaCameraRef.el.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const state  = stateRef.current;
    const canvas = canvasRef.current;

    if (e.touches.length === 0) {
      // Tap (not drag) → star click
      if (!state.didDrag && user && canvas) {
        const W = canvas.width, H = canvas.height;
        const starsNow = useAlterStore.getState().stars;
        let touchHit = false;
        for (const star of starsNow) {
          const { sx, sy } = toScreen(star.x, star.y, W, H);
          if (Math.hypot(sx - state.touchStartX, sy - state.touchStartY) < 36) {
            setClickRipple({ x: sx, y: sy, color: star.color });
            openWidget(star);
            touchHit = true;
            break;
          }
        }
        if (!touchHit) {
          outer: for (const star of starsNow) {
            const subs = SUBCATEGORY_MAP[star.id] ?? [];
            for (let i = 0; i < subs.length; i++) {
              const pos = substarPos(star.x, star.y, subs[i].id, i, subs.length);
              const { sx, sy } = toScreen(pos.x, pos.y, W, H);
              if (Math.hypot(sx - state.touchStartX, sy - state.touchStartY) < 18) {
                setClickRipple({ x: sx, y: sy, color: star.color });
                openWidget(star, subs[i].id);
                touchHit = true;
                break outer;
              }
            }
          }
        }
        if (!touchHit) {
          const GHOST_PROMPTS: Record<string, string> = {
            finance: 'Ho speso ', health: 'Peso ', psychology: 'Umore ', calendar: 'Domani ',
          };
          for (const cat of ['finance', 'health', 'psychology', 'calendar']) {
            if (starsNow.some(s => s.id === cat)) continue;
            const pos = starPosition(cat);
            const { sx, sy } = toScreen(pos.x, pos.y, W, H);
            if (Math.hypot(sx - state.touchStartX, sy - state.touchStartY) < 32) {
              setGhostStarPrompt(GHOST_PROMPTS[cat] ?? `${cat} `);
              break;
            }
          }
        }
      }
      state.dragging  = false;
      state.pinchDist = -1;
      state.pinching  = false;
      state.didDrag   = false;
    } else if (e.touches.length === 1) {
      state.pinchDist = -1;
      state.pinching  = false;
      state.dragging  = true;
      state.dragX     = e.touches[0].clientX;
      state.dragY     = e.touches[0].clientY;
    }
  }, [user, setActiveWidget, markStarSeen, toScreen, setGhostStarPrompt]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#020205' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Empty galaxy onboarding */}
      <AnimatePresence>
        {stars.length === 0 && (
          <motion.div
            key="empty-galaxy"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              top: '42%',
              left: 0, right: 0,
              transform: 'translateY(-50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 10,
              width: '100%',
              padding: '0 20px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 18, opacity: 0.18 }}>✦</div>
            <p style={{
              fontSize: 13, fontWeight: 300, letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.55)', marginBottom: 10, lineHeight: 1.6,
            }}>
              La tua galassia è vuota.
            </p>
            <p style={{
              fontSize: 11, fontWeight: 300, letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.28)', lineHeight: 1.8, maxWidth: '100%',
            }}>
              Ogni cosa che scrivi diventa una stella.<br />
              Prova con <span style={{ color: '#e8d090' }}>«Ho speso 12€ al supermercato»</span>,<br />
              <span style={{ color: '#90d8d2' }}>«Peso 74kg»</span> o{' '}
              <span style={{ color: '#c4b2f5' }}>«Umore 8/10»</span>.<br />
              Scrivi nell'input in basso e guarda la galassia prendere vita.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus mode labels (normalized position, decorative) */}
      <AnimatePresence>
        {focusMode && stars.map((star) => (
          <motion.div
            key={star.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              position: 'absolute',
              left:  `calc(${star.x * 100}% + 14px)`,
              top:   `calc(${star.y * 100}% - 8px)`,
              pointerEvents: 'none',
            }}
          >
            <span style={{
              fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: star.color, opacity: 0.8,
              textShadow: `0 0 12px ${star.color}, 0 0 24px ${star.color}50`,
              whiteSpace: 'nowrap', fontWeight: 400,
            }}>
              {star.icon} {star.label}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>


      {/* Sentinel alert banner */}
      <AnimatePresence>
        {alertEvent && (
          <motion.div
            key="sentinel-alert"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => useAlterStore.getState().setAlertEvent(null)}
            style={{
              position: 'absolute',
              top: 56, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(10,10,18,0.95)',
              border: '1px solid rgba(167,139,250,0.5)',
              borderRadius: 14,
              padding: '10px 18px',
              display: 'flex', alignItems: 'center', gap: 10,
              whiteSpace: 'nowrap',
              zIndex: 50,
              boxShadow: '0 0 24px rgba(167,139,250,0.25)',
              backdropFilter: 'blur(12px)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18 }}>🔔</span>
            <div>
              <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 1 }}>Promemoria</div>
              <span style={{ fontSize: 13, color: '#ffffff', fontWeight: 500 }}>
                {alertEvent.title} · {new Date(alertEvent.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nexus scan button */}
      {stars.length >= 2 && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          onClick={async () => {
            if (!user || nexusScanning) return;
            setNexusScanning(true);
            try {
              const entries = await getRecentAll(user.id, 80);
              const { aiNexusNarrative } = await import('../../core/aiParser');
              const narrative = await aiNexusNarrative('Analizza le correlazioni tra tutte le mie categorie e dimmi cosa noti di interessante.', entries);
              setActiveWidget({
                category: 'insight', label: '✦ Scansione Nexus', color: '#a78bfa',
                entries: [{ id: 'nexus-scan', user_id: user.id, category: 'insight',
                  data: { insight: narrative }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
                renderType: 'insight',
              });
            } finally {
              setNexusScanning(false);
            }
          }}
          style={{
            position: 'absolute',
            bottom: 90, left: '50%', transform: 'translateX(-50%)', margin: 0,
            zIndex: 40,
            background: nexusScanning ? 'rgba(167,139,250,0.15)' : 'rgba(10,10,18,0.8)',
            border: '1px solid rgba(167,139,250,0.35)',
            borderRadius: 20,
            padding: '7px 18px',
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: nexusScanning ? 'wait' : 'pointer',
            color: '#a78bfa',
            fontSize: 12, fontWeight: 500, letterSpacing: '0.06em',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 20px rgba(167,139,250,0.12)',
            transition: 'all 0.25s',
          }}
        >
          <span style={{ fontSize: 14, animation: nexusScanning ? 'spin 1.2s linear infinite' : 'none' }}>
            {nexusScanning ? '◌' : '✦'}
          </span>
          {nexusScanning ? 'Nexus in analisi...' : 'Scansione Nexus'}
        </motion.button>
      )}


      {/* Subtle click ripple */}
      <AnimatePresence>
        {clickRipple && (
          <motion.div
            key={`ripple-${clickRipple.x}-${clickRipple.y}`}
            initial={{ scale: 0.6, opacity: 0.5 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{}}
            onAnimationComplete={() => setClickRipple(null)}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: clickRipple.x, top: clickRipple.y,
              marginLeft: -18, marginTop: -18,
              width: 36, height: 36, borderRadius: '50%',
              border: `1.5px solid ${clickRipple.color}`,
              pointerEvents: 'none',
              zIndex: 95,
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

// ─── Build star from category summary data ────────────────────
export function buildStar(category: string, count: number, lastEntry: string): Star {
  const pos  = starPosition(category);
  const meta = getCategoryMeta(category);
  const daysSince    = (Date.now() - new Date(lastEntry).getTime()) / 86400000;
  const recencyScore = Math.max(0, 1 - daysSince / 14);
  const countScore   = Math.min(1, count / 20);
  const intensity    = Math.max(0.15, (recencyScore * 0.6 + countScore * 0.4));

  return {
    id:         category,
    label:      meta.label,
    color:      meta.color,
    icon:       meta.icon,
    x:          pos.x,
    y:          pos.y,
    intensity,
    entryCount: count,
    lastEntry,
  };
}
