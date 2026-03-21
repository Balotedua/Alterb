import { useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import { getByCategory } from '../../vault/vaultService';
import { inferRenderType } from '../widget/PolymorphicWidget';
import type { Star } from '../../types';

// ─── Category meta registry ───────────────────────────────────
export const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  finance:    { label: 'Finanza',     color: '#f0c040', icon: '💰' },
  health:     { label: 'Salute',      color: '#40e0d0', icon: '💪' },
  psychology: { label: 'Psiche',      color: '#a78bfa', icon: '🧠' },
  calendar:   { label: 'Calendario',  color: '#60a5fa', icon: '📅' },
};

export function getCategoryMeta(cat: string) {
  if (CATEGORY_META[cat]) return CATEGORY_META[cat];
  let hash = 0;
  for (const c of cat) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  const PALETTE = ['#f472b6','#fb923c','#4ade80','#38bdf8','#e879f9','#facc15'];
  const ICONS   = ['⭐','🌿','🎯','📚','✈️','🐾','🎵','🔮'];
  const color   = PALETTE[Math.abs(hash) % PALETTE.length];
  const icon    = ICONS[Math.abs(hash >> 4) % ICONS.length];
  return { label: cat.charAt(0).toUpperCase() + cat.slice(1), color, icon };
}

// ─── Ghost nodes ──────────────────────────────────────────────
const GHOST_NODES = [
  { id: 'arena',     x: 0.18, y: 0.28, whisper: 'Protocollo Arena — Sfida i tuoi pari' },
  { id: 'memoria',   x: 0.80, y: 0.22, whisper: 'Memoria — Ricorda ciò che conta' },
  { id: 'obiettivi', x: 0.64, y: 0.72, whisper: 'Obiettivi — Traccia il tuo cammino' },
  { id: 'rituali',   x: 0.12, y: 0.60, whisper: 'Rituali — Costruisci le tue abitudini' },
];

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
  scale: number;
  dragging: boolean;
  dragX: number;
  dragY: number;
  didDrag: boolean;
  pinchDist: number;
  pinchMidX: number;
  pinchMidY: number;
  constellationAlpha: number; // 0..0.12, fades in when idle
}

// ─── StarfieldView ────────────────────────────────────────────
export default function StarfieldView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile  = window.innerWidth < 768;

  const stateRef = useRef<CanvasState>({
    particles: initParticles(isMobile ? 90 : 180),
    raf: 0, hovered: null, t: 0,
    panX: 0, panY: 0, scale: 1,
    dragging: false, dragX: 0, dragY: 0, didDrag: false,
    pinchDist: -1, pinchMidX: 0, pinchMidY: 0,
    constellationAlpha: 0,
  });

  const { stars, focusMode, setActiveWidget, user, markStarSeen, highlightedStarId, alertEvent } = useAlterStore();

  // Ghost whisper at screen-space coords
  const [ghostWhisper, setGhostWhisper] = useState<{ sx: number; sy: number; text: string } | null>(null);
  const ghostIdRef = useRef<string | null>(null);

  // Star suction animation before widget opens
  const [suckStar, setSuckStar] = useState<{ id: string; color: string; dx: number; dy: number } | null>(null);

  // Full-screen supernova flash
  const [flashActive, setFlashActive] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (stars.some(s => s.isNew)) {
      setFlashActive(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashActive(false), 900);
    }
  }, [stars]);

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
    const { scale } = state;
    state.t += 0.007;

    // Void absolute
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // ── Constellation alpha: fade in when idle, out when dragging ──
    if (state.dragging) {
      state.constellationAlpha = Math.max(0, state.constellationAlpha - 0.025);
    } else {
      state.constellationAlpha = Math.min(0.12, state.constellationAlpha + 0.004);
    }

    // ── Parallax particles — 3 depth layers ──
    state.particles.forEach((p) => {
      p.a += p.da;
      if (p.a <= 0.02) { p.a = 0.02; p.da = Math.abs(p.da); }
      if (p.a >= 1)    { p.a = 1;    p.da = -Math.abs(p.da); }
      const factor = LAYER_PARALLAX[p.layer];
      const px = p.x * W + state.panX * factor;
      const py = p.y * H + state.panY * factor;
      const brightness = 90 + p.layer * 18;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${brightness},${brightness + 20},${brightness + 50},${p.a * (0.18 + p.layer * 0.08)})`;
      ctx.fill();
    });

    const starsNow        = useAlterStore.getState().stars;
    const highlightedId   = useAlterStore.getState().highlightedStarId;
    const alertEvt        = useAlterStore.getState().alertEvent;
    const hov = state.hovered;
    const s   = Math.sqrt(Math.max(scale, 0.3)); // visual scale factor

    // ── Ghost nodes (camera-aware) ──
    GHOST_NODES.forEach((ghost) => {
      if (starsNow.find(st => st.id === ghost.id)) return;
      const { sx: px, sy: py } = toScreen(ghost.x, ghost.y, W, H);
      if (px < -120 || px > W + 120 || py < -120 || py > H + 120) return;
      const isHov   = hov === `ghost:${ghost.id}`;
      const flicker = Math.sin(state.t * 1.1 + ghost.x * 7) * 0.5 + 0.5;
      const baseOp  = isHov ? 0.32 : 0.05 + flicker * 0.03;
      const gr      = (isHov ? 30 : 16) * s;

      const grd = ctx.createRadialGradient(px, py, 0, px, py, gr);
      grd.addColorStop(0, `rgba(130,140,170,${baseOp * 0.7})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(px, py, gr, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();

      ctx.beginPath(); ctx.arc(px, py, (isHov ? 3 : 1.8) * s, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(130,140,170,${baseOp + 0.08})`; ctx.fill();
    });

    // ── Category stars (camera-aware) ──
    starsNow.forEach((star) => {
      const { sx: px, sy: py } = toScreen(star.x, star.y, W, H);
      if (px < -160 || px > W + 160 || py < -160 || py > H + 160) return;
      const isHov      = hov === star.id;
      const isHighlit  = highlightedId === star.id;
      const isAlert    = alertEvt != null && star.id === 'calendar';
      const [r, g, b]  = isAlert ? [255, 80, 80] : hexToRgb(star.color);
      const { intensity } = star;
      // highlighted: fast bright pulse; alert: fast red pulse
      const pulse = isHighlit
        ? Math.sin(state.t * 6 + star.x * 18) * 0.18 + 0.92
        : isAlert
          ? Math.sin(state.t * 4) * 0.25 + 0.85
          : Math.sin(state.t * 1.4 + star.x * 18) * 0.05 + 0.95;
      const glowBoost  = isHighlit ? 2.2 : isAlert ? 2.4 : 1;

      // Outer corona
      const coronaR = (isHov ? 160 : 110) * (0.25 + intensity * 0.75) * pulse * s * glowBoost;
      const corona  = ctx.createRadialGradient(px, py, 0, px, py, coronaR);
      corona.addColorStop(0,   `rgba(${r},${g},${b},${0.14 * intensity})`);
      corona.addColorStop(0.5, `rgba(${r},${g},${b},${0.05 * intensity})`);
      corona.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(px, py, coronaR, 0, Math.PI * 2);
      ctx.fillStyle = corona; ctx.fill();

      // Main glow
      const glowR = (isHov ? 90 : 55) * (0.45 + intensity * 0.55) * pulse * s * glowBoost;
      const grd   = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      grd.addColorStop(0,    `rgba(${r},${g},${b},${0.85 * intensity})`);
      grd.addColorStop(0.35, `rgba(${r},${g},${b},${0.35 * intensity})`);
      grd.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(px, py, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();

      // Core
      const coreR  = (isHov ? 7 : 3 + intensity * 4) * pulse * s;
      const coreGrd = ctx.createRadialGradient(px, py, 0, px, py, coreR);
      coreGrd.addColorStop(0,    `rgba(255,255,255,${0.95 * intensity})`);
      coreGrd.addColorStop(0.25, `rgba(${r},${g},${b},1)`);
      coreGrd.addColorStop(1,    `rgba(${r},${g},${b},0.3)`);
      ctx.beginPath(); ctx.arc(px, py, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrd; ctx.fill();

      // Decay ring
      if (intensity < 0.22) {
        ctx.beginPath(); ctx.arc(px, py, coreR + 6 * s, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.1)`;
        ctx.lineWidth = 0.5; ctx.setLineDash([2, 4]);
        ctx.stroke(); ctx.setLineDash([]);
      }
    });

    // ── Constellation lines between nearby stars ──
    if (state.constellationAlpha > 0.002 && starsNow.length > 1) {
      ctx.save();
      ctx.lineWidth = 0.3;
      for (let i = 0; i < starsNow.length; i++) {
        for (let j = i + 1; j < starsNow.length; j++) {
          const a = starsNow[i], b = starsNow[j];
          const pa = toScreen(a.x, a.y, W, H);
          const pb = toScreen(b.x, b.y, W, H);
          const dist = Math.hypot(pa.sx - pb.sx, pa.sy - pb.sy);
          if (dist < 320) {
            const fade = (1 - dist / 320) * state.constellationAlpha;
            ctx.beginPath();
            ctx.moveTo(pa.sx, pa.sy);
            ctx.lineTo(pb.sx, pb.sy);
            ctx.strokeStyle = `rgba(200,215,255,${fade})`;
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
      state.panX += e.clientX - state.dragX;
      state.panY += e.clientY - state.dragY;
      state.dragX = e.clientX;
      state.dragY = e.clientY;
      state.didDrag = true;
      canvas.style.cursor = 'grabbing';
      return;
    }

    const starsNow = useAlterStore.getState().stars;
    let found: string | null = null;

    for (const star of starsNow) {
      const { sx, sy } = toScreen(star.x, star.y, W, H);
      if (Math.hypot(sx - e.clientX, sy - e.clientY) < 22) { found = star.id; break; }
    }
    if (!found) {
      for (const ghost of GHOST_NODES) {
        if (starsNow.find(s => s.id === ghost.id)) continue;
        const { sx, sy } = toScreen(ghost.x, ghost.y, W, H);
        if (Math.hypot(sx - e.clientX, sy - e.clientY) < 26) {
          found = `ghost:${ghost.id}`; break;
        }
      }
    }

    state.hovered = found;
    canvas.style.cursor = found ? 'pointer' : 'grab';

    const newGhostId = found?.startsWith('ghost:') ? found.slice(6) : null;
    if (newGhostId !== ghostIdRef.current) {
      ghostIdRef.current = newGhostId;
      if (newGhostId) {
        const ghost = GHOST_NODES.find(g => g.id === newGhostId);
        if (ghost) {
          const { sx, sy } = toScreen(ghost.x, ghost.y, W, H);
          setGhostWhisper({ sx, sy, text: ghost.whisper });
        }
      } else {
        setGhostWhisper(null);
      }
    }
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
    const factor   = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.25, Math.min(5, state.scale * factor));
    const cx = e.clientX - W / 2;
    const cy = e.clientY - H / 2;
    state.panX = cx + (state.panX - cx) * (newScale / state.scale);
    state.panY = cy + (state.panY - cy) * (newScale / state.scale);
    state.scale = newScale;
  }, []);

  const openWidget = useCallback(async (star: { id: string; label: string; color: string }) => {
    if (!user) return;
    const entries = await getByCategory(user.id, star.id);
    setActiveWidget({ category: star.id, label: star.label, color: star.color, entries, renderType: inferRenderType(entries) });
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
        setSuckStar({ id: star.id, color: star.color, dx: sx - cx, dy: sy - cy });
        setTimeout(() => { setSuckStar(null); openWidget(star); }, 480);
        break;
      }
    }
  }, [user, openWidget, toScreen]);

  // ── Touch: pan + pinch-zoom ────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const state = stateRef.current;
    if (e.touches.length === 1) {
      state.dragging  = true;
      state.dragX     = e.touches[0].clientX;
      state.dragY     = e.touches[0].clientY;
      state.didDrag   = false;
      state.pinchDist = -1;
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
      state.panX   += tx - state.dragX;
      state.panY   += ty - state.dragY;
      state.dragX   = tx;
      state.dragY   = ty;
      state.didDrag = true;
    } else if (e.touches.length === 2 && state.pinchDist > 0) {
      const dx      = e.touches[0].clientX - e.touches[1].clientX;
      const dy      = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const factor  = newDist / state.pinchDist;
      const newScale = Math.max(0.25, Math.min(5, state.scale * factor));
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const cx = midX - W / 2, cy = midY - H / 2;
      state.panX = cx + (state.panX - cx) * (newScale / state.scale);
      state.panY = cy + (state.panY - cy) * (newScale / state.scale);
      state.panX += midX - state.pinchMidX;
      state.panY += midY - state.pinchMidY;
      state.scale     = newScale;
      state.pinchDist = newDist;
      state.pinchMidX = midX;
      state.pinchMidY = midY;
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
        for (const star of starsNow) {
          const { sx, sy } = toScreen(star.x, star.y, W, H);
          if (Math.hypot(sx - state.dragX, sy - state.dragY) < 32) {
            setSuckStar({ id: star.id, color: star.color, dx: sx - cx, dy: sy - cy });
            setTimeout(() => { setSuckStar(null); openWidget(star); }, 480);
            break;
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
  }, [user, setActiveWidget, markStarSeen, toScreen]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000' }}>
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

      {/* Full-screen supernova flash */}
      <AnimatePresence>
        {flashActive && (
          <motion.div
            key="nova-flash"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', inset: 0,
              background: 'white',
              pointerEvents: 'none',
              zIndex: 90,
            }}
          />
        )}
      </AnimatePresence>

      {/* Supernova burst on new stars */}
      <AnimatePresence>
        {stars.filter(s => s.isNew).map((star) => (
          <motion.div
            key={`nova-${star.id}`}
            initial={{ scale: 0.1, opacity: 1 }}
            animate={{ scale: 32, opacity: 0 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => markStarSeen(star.id)}
            style={{
              position: 'absolute',
              left:  `${star.x * 100}%`,
              top:   `${star.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 60, height: 60, borderRadius: '50%',
              background: `radial-gradient(circle, white 0%, ${star.color} 20%, ${star.color}60 50%, transparent 70%)`,
              pointerEvents: 'none',
              zIndex: 80,
            }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
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

      {/* Star suction: animates star particle toward center before widget opens */}
      <AnimatePresence>
        {suckStar && (
          <motion.div
            key={`suck-${suckStar.id}`}
            initial={{ x: suckStar.dx, y: suckStar.dy, scale: 1.6, opacity: 1 }}
            animate={{ x: 0, y: 0, scale: 0, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.45, ease: [0.55, 0, 1, 0.8] }}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              marginLeft: -8, marginTop: -8,
              width: 16, height: 16, borderRadius: '50%',
              background: `radial-gradient(circle, white 0%, ${suckStar.color} 55%, transparent 100%)`,
              boxShadow: `0 0 20px ${suckStar.color}, 0 0 40px ${suckStar.color}80`,
              pointerEvents: 'none',
              zIndex: 95,
            }}
          />
        )}
      </AnimatePresence>

      {/* Ghost node whisper — at screen coords captured on hover */}
      <AnimatePresence>
        {ghostWhisper && (
          <motion.div
            key={ghostWhisper.text}
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              left: ghostWhisper.sx,
              top:  ghostWhisper.sy - 38,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              background: 'rgba(3,3,7,0.92)',
              border: '1px solid rgba(130,140,170,0.1)',
              borderRadius: 10,
              padding: '6px 12px',
              backdropFilter: 'blur(20px)',
              whiteSpace: 'nowrap',
              zIndex: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{
              fontSize: 10, color: 'rgba(140,152,185,0.6)',
              letterSpacing: '0.07em', fontWeight: 300,
            }}>
              {ghostWhisper.text}
            </span>
          </motion.div>
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
