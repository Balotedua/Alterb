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

// ─── Ghost nodes (undiscovered feature seeds) ─────────────────
const GHOST_NODES = [
  { id: 'arena',     x: 0.18, y: 0.28, whisper: 'Protocollo Arena — Sfida i tuoi pari' },
  { id: 'memoria',   x: 0.80, y: 0.22, whisper: 'Memoria — Ricorda ciò che conta' },
  { id: 'obiettivi', x: 0.64, y: 0.72, whisper: 'Obiettivi — Traccia il tuo cammino' },
  { id: 'rituali',   x: 0.12, y: 0.60, whisper: 'Rituali — Costruisci le tue abitudini' },
];

// ─── Deterministic star position ─────────────────────────────
function starPosition(cat: string): { x: number; y: number } {
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

// ─── Particle system ──────────────────────────────────────────
interface Particle { x: number; y: number; r: number; a: number; da: number; }

function initParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 0.8 + 0.2,
    a: Math.random(),
    da: (Math.random() - 0.5) * 0.002,
  }));
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

interface CanvasState {
  particles: Particle[];
  raf: number;
  hovered: string | null;
  t: number;
}

// ─── StarfieldView ────────────────────────────────────────────
export default function StarfieldView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<CanvasState>({
    particles: initParticles(220),
    raf: 0,
    hovered: null,
    t: 0,
  });

  const { stars, focusMode, setActiveWidget, user, markStarSeen } = useAlterStore();

  // Ghost whisper tooltip state
  const [ghostWhisper, setGhostWhisper] = useState<{ x: number; y: number; text: string } | null>(null);
  const ghostIdRef = useRef<string | null>(null);

  // ── Draw loop ──────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx   = canvas.getContext('2d')!;
    const W     = canvas.width;
    const H     = canvas.height;
    const state = stateRef.current;
    state.t += 0.007;

    // Background fade
    ctx.fillStyle = 'rgba(3,3,7,0.2)';
    ctx.fillRect(0, 0, W, H);

    // ── Ambient particles ──
    state.particles.forEach((p) => {
      p.a += p.da;
      if (p.a <= 0) { p.a = 0; p.da = Math.abs(p.da); }
      if (p.a >= 1) { p.a = 1; p.da = -Math.abs(p.da); }
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(110,130,170,${p.a * 0.22})`;
      ctx.fill();
    });

    const starsSnapshot = useAlterStore.getState().stars;
    const hov = state.hovered;

    // ── Ghost nodes ──
    GHOST_NODES.forEach((ghost) => {
      if (starsSnapshot.find(s => s.id === ghost.id)) return;
      const px = ghost.x * W;
      const py = ghost.y * H;
      const isGhostHov = hov === `ghost:${ghost.id}`;
      const flicker = Math.sin(state.t * 1.1 + ghost.x * 7) * 0.5 + 0.5;
      const baseOp  = isGhostHov ? 0.32 : 0.05 + flicker * 0.03;

      // Ghost glow
      const grd = ctx.createRadialGradient(px, py, 0, px, py, isGhostHov ? 30 : 16);
      grd.addColorStop(0, `rgba(130,140,170,${baseOp * 0.7})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(px, py, isGhostHov ? 30 : 16, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Ghost core
      ctx.beginPath();
      ctx.arc(px, py, isGhostHov ? 3 : 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(130,140,170,${baseOp + 0.08})`;
      ctx.fill();
    });

    // ── Category stars ──
    starsSnapshot.forEach((star) => {
      const px = star.x * W;
      const py = star.y * H;
      const isHovered = hov === star.id;
      const [r, g, b] = hexToRgb(star.color);
      const intensity  = star.intensity;
      const pulse = Math.sin(state.t * 1.4 + star.x * 18) * 0.05 + 0.95;

      // Outer corona
      const coronaR = (isHovered ? 90 : 60) * (0.25 + intensity * 0.75) * pulse;
      const corona = ctx.createRadialGradient(px, py, 0, px, py, coronaR);
      corona.addColorStop(0,   `rgba(${r},${g},${b},${0.07 * intensity})`);
      corona.addColorStop(0.5, `rgba(${r},${g},${b},${0.025 * intensity})`);
      corona.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(px, py, coronaR, 0, Math.PI * 2);
      ctx.fillStyle = corona;
      ctx.fill();

      // Main glow
      const glowR = (isHovered ? 46 : 26) * (0.45 + intensity * 0.55) * pulse;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      grd.addColorStop(0,   `rgba(${r},${g},${b},${0.6 * intensity})`);
      grd.addColorStop(0.35, `rgba(${r},${g},${b},${0.22 * intensity})`);
      grd.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(px, py, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core (radial gradient: white center → neon)
      const coreR = (isHovered ? 7 : 3 + intensity * 4) * pulse;
      const coreGrd = ctx.createRadialGradient(px, py, 0, px, py, coreR);
      coreGrd.addColorStop(0,   `rgba(255,255,255,${0.95 * intensity})`);
      coreGrd.addColorStop(0.25, `rgba(${r},${g},${b},1)`);
      coreGrd.addColorStop(1,    `rgba(${r},${g},${b},0.3)`);
      ctx.beginPath();
      ctx.arc(px, py, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrd;
      ctx.fill();

      // Decay ring for inactive stars (> 14 days)
      if (intensity < 0.22) {
        ctx.beginPath();
        ctx.arc(px, py, coreR + 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.1)`;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    state.raf = requestAnimationFrame(draw);
  }, []);

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

  // ── Mouse interaction ──────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const mx = e.clientX / W, my = e.clientY / H;
    const starsNow = useAlterStore.getState().stars;
    let found: string | null = null;

    // Check real stars first
    for (const star of starsNow) {
      const dx = (star.x - mx) * W;
      const dy = (star.y - my) * H;
      if (Math.sqrt(dx * dx + dy * dy) < 22) { found = star.id; break; }
    }

    // Then check ghost nodes
    if (!found) {
      for (const ghost of GHOST_NODES) {
        if (starsNow.find(s => s.id === ghost.id)) continue;
        const dx = (ghost.x - mx) * W;
        const dy = (ghost.y - my) * H;
        if (Math.sqrt(dx * dx + dy * dy) < 26) { found = `ghost:${ghost.id}`; break; }
      }
    }

    stateRef.current.hovered = found;
    canvas.style.cursor = found ? 'pointer' : 'default';

    // Update ghost whisper (only on change to avoid setState thrash)
    const newGhostId = found?.startsWith('ghost:') ? found.slice(6) : null;
    if (newGhostId !== ghostIdRef.current) {
      ghostIdRef.current = newGhostId;
      if (newGhostId) {
        const ghost = GHOST_NODES.find(g => g.id === newGhostId);
        if (ghost) setGhostWhisper({ x: ghost.x, y: ghost.y, text: ghost.whisper });
      } else {
        setGhostWhisper(null);
      }
    }
  }, []);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!user) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const mx = e.clientX / W, my = e.clientY / H;
    const starsNow = useAlterStore.getState().stars;

    for (const star of starsNow) {
      const dx = (star.x - mx) * W;
      const dy = (star.y - my) * H;
      if (Math.sqrt(dx * dx + dy * dy) < 22) {
        const entries = await getByCategory(user.id, star.id);
        setActiveWidget({
          category: star.id,
          label:    star.label,
          color:    star.color,
          entries,
          renderType: inferRenderType(entries),
        });
        markStarSeen(star.id);
        break;
      }
    }
  }, [user, setActiveWidget, markStarSeen]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#030307' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Focus mode labels */}
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
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: star.color,
              opacity: 0.8,
              textShadow: `0 0 12px ${star.color}, 0 0 24px ${star.color}50`,
              whiteSpace: 'nowrap',
              fontWeight: 400,
            }}>
              {star.icon} {star.label}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Supernova burst on new stars */}
      <AnimatePresence>
        {stars.filter(s => s.isNew).map((star) => (
          <motion.div
            key={`nova-${star.id}`}
            initial={{ scale: 0.1, opacity: 1 }}
            animate={{ scale: 6, opacity: 0 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => markStarSeen(star.id)}
            style={{
              position: 'absolute',
              left:  `${star.x * 100}%`,
              top:   `${star.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `radial-gradient(circle, white 0%, ${star.color} 25%, transparent 70%)`,
              pointerEvents: 'none',
            }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </AnimatePresence>

      {/* Ghost node whisper */}
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
              left: `${ghostWhisper.x * 100}%`,
              top:  `calc(${ghostWhisper.y * 100}% - 34px)`,
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
              fontSize: 10,
              color: 'rgba(140,152,185,0.6)',
              letterSpacing: '0.07em',
              fontWeight: 300,
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
  const daysSince = (Date.now() - new Date(lastEntry).getTime()) / 86400000;
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
