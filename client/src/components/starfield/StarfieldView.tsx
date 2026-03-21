import { useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import { getByCategory, getSemanticLinks } from '../../vault/vaultService';
import { inferRenderType } from '../widget/PolymorphicWidget';
import type { Star } from '../../types';
import { nebulaCameraRef } from '../nebula/nebulaCamera';

// ─── Category meta registry ───────────────────────────────────
export const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  finance:    { label: 'Finanza',     color: '#e8d090', icon: '💰' },
  health:     { label: 'Salute',      color: '#90d8d2', icon: '💪' },
  psychology: { label: 'Psiche',      color: '#c4b2f5', icon: '🧠' },
  calendar:   { label: 'Calendario',  color: '#92bef5', icon: '📅' },
  insight:    { label: 'Insight',     color: '#f0c040', icon: '✨' },
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

// ─── Deterministic star position ─────────────────────────────
export function starPosition(cat: string): { x: number; y: number } {
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

// ─── Particles ────────────────────────────────────────────────
// layer 0 = distant/slow, layer 1 = mid, layer 2 = near/fast
interface Particle { x: number; y: number; r: number; a: number; da: number; layer: 0 | 1 | 2; }

// Parallax factors per layer (applied to panX/panY)
const LAYER_PARALLAX = [0.12, 0.38, 0.78] as const;
const LAYER_RADIUS   = [[0.2, 0.5], [0.4, 1.0], [0.7, 1.8]] as const;
const LAYER_FLICKER  = [0.0008, 0.0018, 0.0035] as const;

function initParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const layer = Math.floor(Math.random() * 3) as 0 | 1 | 2;
    const [rMin, rMax] = LAYER_RADIUS[layer];
    return {
      x: Math.random(), y: Math.random(),
      r: rMin + Math.random() * (rMax - rMin),
      a: Math.random(),
      da: (Math.random() - 0.5) * LAYER_FLICKER[layer] * 2 + LAYER_FLICKER[layer],
      layer,
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
  constellationAlpha: number; // 0..0.12, fades in when idle
  touchStartX: number;
  touchStartY: number;
}

// ─── StarfieldView ────────────────────────────────────────────
export default function StarfieldView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile  = window.innerWidth < 768;

  const stateRef = useRef<CanvasState>({
    particles: initParticles(isMobile ? 35 : 60),
    raf: 0, hovered: null, t: 0,
    panX: 0, panY: 0, velX: 0, velY: 0, scale: 1, targetScale: 1,
    dragging: false, dragX: 0, dragY: 0, didDrag: false,
    pinchDist: -1, pinchMidX: 0, pinchMidY: 0,
    touchStartX: 0, touchStartY: 0,
    constellationAlpha: 0,
  });

  const { stars, focusMode, setActiveWidget, user, markStarSeen, highlightedStarId, alertEvent, setSemanticLinks, setGhostStarPrompt } = useAlterStore();

  // Subtle ripple at click position
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; color: string } | null>(null);

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

    // Smooth zoom: lerp toward targetScale
    if (Math.abs(state.scale - state.targetScale) > 0.0005) {
      state.scale += (state.targetScale - state.scale) * 0.14;
    } else {
      state.scale = state.targetScale;
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
      dark:   ['#04040e', '#020208', '#000000'],
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

    // ── Constellation alpha: fade in when idle, out when dragging ──
    if (state.dragging) {
      state.constellationAlpha = Math.max(0, state.constellationAlpha - 0.025);
    } else {
      state.constellationAlpha = Math.min(0.08, state.constellationAlpha + 0.004);
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
      const particleAlpha = p.a * (0.10 + p.layer * 0.06);
      const pColor = isLightTheme
        ? `rgba(80,80,160,${particleAlpha * 0.6})`
        : isMatrixTheme
        ? `rgba(0,255,65,${particleAlpha * 0.7})`
        : isNebulaTheme
        ? `rgba(180,140,255,${particleAlpha * 0.65})`
        : `rgba(255,255,255,${particleAlpha})`;
      ctx.fillStyle = pColor;
      ctx.fill();
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

      // Outer glow halo
      const glowR = (isHov ? 28 : 14 + intensity * 18) * s;
      const glowGrd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      glowGrd.addColorStop(0,    `rgba(${r},${g},${b},${a * 0.45})`);
      glowGrd.addColorStop(0.3,  `rgba(${r},${g},${b},${a * 0.18})`);
      glowGrd.addColorStop(0.65, `rgba(${r},${g},${b},${a * 0.05})`);
      glowGrd.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      ctx.beginPath(); ctx.arc(px, py, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glowGrd; ctx.fill();

      // Colored core: white hot center → star color rim
      const coreR = (isHov ? 7 : 2.8 + intensity * 4.5) * s * (isHighlit || isAlert ? 1.5 : 1);
      const coreGrd = ctx.createRadialGradient(px, py, 0, px, py, coreR);
      const efa = isEphemeral ? 0.55 : 1;
      coreGrd.addColorStop(0,    `rgba(255,255,255,${a * efa})`);
      coreGrd.addColorStop(0.45, `rgba(${r},${g},${b},${a * 0.95 * efa})`);
      coreGrd.addColorStop(1,    `rgba(${r},${g},${b},${a * 0.5 * efa})`);
      ctx.beginPath(); ctx.arc(px, py, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrd;
      // Glow shadow on star
      ctx.shadowBlur  = isHov ? 20 : (8 + intensity * 12) * s;
      ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label — larger, more visible
      ctx.save();
      ctx.font = `500 10px -apple-system, "SF Pro Display", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${r},${g},${b},${isHov ? 0.95 : 0.55})`;
      ctx.fillText(star.label.toUpperCase(), px, py + coreR + 15 * s);
      ctx.restore();
      void isInsight;
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

  const openWidget = useCallback(async (star: { id: string; label: string; color: string }) => {
    if (!user) return;
    const entries = await getByCategory(user.id, star.id);
    const renderType = star.id === 'insight' ? 'insight' : inferRenderType(entries, star.id);
    setActiveWidget({ category: star.id, label: star.label, color: star.color, entries, renderType });
    markStarSeen(star.id);
  }, [user, setActiveWidget, markStarSeen]);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (state.didDrag) { state.didDrag = false; return; }
    if (!user) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const starsNow = useAlterStore.getState().stars;

    for (const star of starsNow) {
      const { sx, sy } = toScreen(star.x, star.y, W, H);
      if (Math.hypot(sx - e.clientX, sy - e.clientY) < 22) {
        setClickRipple({ x: sx, y: sy, color: star.color });
        openWidget(star);
        return;
      }
    }
    // Ghost star click → pre-fill input
    const GHOST_PROMPTS: Record<string, string> = {
      finance: 'Ho speso ', health: 'Peso ', psychology: 'Umore ', calendar: 'Domani ',
    };
    const PILLARS_CLICK = ['finance', 'health', 'psychology', 'calendar'];
    for (const cat of PILLARS_CLICK) {
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
        const cx = W / 2, cy = H / 2;
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
      state.didDrag   = false;
    } else if (e.touches.length === 1) {
      state.pinchDist = -1;
      state.dragging  = true;
      state.dragX     = e.touches[0].clientX;
      state.dragY     = e.touches[0].clientY;
    }
  }, [user, setActiveWidget, markStarSeen, toScreen, setGhostStarPrompt]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050508' }}>
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
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(50% - 80px)',
              left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.92)',
              border: '1px solid rgba(255,80,80,0.35)',
              borderRadius: 12,
              padding: '8px 18px',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 50,
              boxShadow: '0 0 20px rgba(255,80,80,0.25)',
            }}
          >
            <span style={{ fontSize: 11, color: '#f87171', letterSpacing: '0.06em', fontWeight: 400 }}>
              🔔 {alertEvent.title} — {new Date(alertEvent.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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
