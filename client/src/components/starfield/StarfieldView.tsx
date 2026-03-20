import { useEffect, useRef, useCallback } from 'react';
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
  // deterministic color for custom categories
  let hash = 0;
  for (const c of cat) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  const PALETTE = ['#f472b6','#fb923c','#4ade80','#38bdf8','#e879f9','#facc15'];
  const ICONS   = ['⭐','🌿','🎯','📚','✈️','🐾','🎵','🔮'];
  const color   = PALETTE[Math.abs(hash) % PALETTE.length];
  const icon    = ICONS[Math.abs(hash >> 4) % ICONS.length];
  return { label: cat.charAt(0).toUpperCase() + cat.slice(1), color, icon };
}

// ─── Deterministic star position from category name ───────────
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

// ─── Ambient particle system ─────────────────────────────────
interface Particle { x: number; y: number; r: number; a: number; da: number; }

function initParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.2 + 0.3,
    a: Math.random(),
    da: (Math.random() - 0.5) * 0.003,
  }));
}

// ─── Canvas renderer ─────────────────────────────────────────
interface CanvasState {
  particles: Particle[];
  raf: number;
  hovered: string | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ─── StarfieldView component ─────────────────────────────────
export default function StarfieldView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<CanvasState>({
    particles: initParticles(180),
    raf: 0,
    hovered: null,
  });

  const { stars, focusMode, setActiveWidget, user, markStarSeen } = useAlterStore();

  // ── Draw loop ──────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx   = canvas.getContext('2d')!;
    const W     = canvas.width;
    const H     = canvas.height;
    const state = stateRef.current;

    // Background
    ctx.fillStyle = 'rgba(5,5,8,0.18)';
    ctx.fillRect(0, 0, W, H);

    // ── Ambient particles ──
    state.particles.forEach((p) => {
      p.a += p.da;
      if (p.a <= 0) { p.a = 0; p.da = Math.abs(p.da); }
      if (p.a >= 1) { p.a = 1; p.da = -Math.abs(p.da); }
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(140,160,200,${p.a * 0.35})`;
      ctx.fill();
    });

    // ── Category stars ──
    const starsSnapshot = useAlterStore.getState().stars;
    const hov = state.hovered;

    starsSnapshot.forEach((star) => {
      const px = star.x * W;
      const py = star.y * H;
      const isHovered = hov === star.id;
      const [r, g, b] = hexToRgb(star.color);
      const intensity  = star.intensity;

      // Glow (outer)
      const glowRadius = (isHovered ? 48 : 36) * (0.4 + intensity * 0.6);
      const grd = ctx.createRadialGradient(px, py, 0, px, py, glowRadius);
      grd.addColorStop(0,   `rgba(${r},${g},${b},${0.35 * intensity})`);
      grd.addColorStop(0.5, `rgba(${r},${g},${b},${0.12 * intensity})`);
      grd.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core
      const coreR = isHovered ? 7 : (4 + intensity * 4);
      ctx.beginPath();
      ctx.arc(px, py, coreR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.7 + intensity * 0.3})`;
      ctx.fill();

      // Inner spark
      ctx.beginPath();
      ctx.arc(px - coreR * 0.25, py - coreR * 0.25, coreR * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,0.6)`;
      ctx.fill();
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

  // ── Mouse interaction ─────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const mx = e.clientX / W, my = e.clientY / H;
    const starsNow = useAlterStore.getState().stars;
    let found: string | null = null;
    for (const star of starsNow) {
      const dx = (star.x - mx) * W;
      const dy = (star.y - my) * H;
      if (Math.sqrt(dx * dx + dy * dy) < 22) { found = star.id; break; }
    }
    stateRef.current.hovered = found;
    canvas.style.cursor = found ? 'pointer' : 'default';
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
    <div style={{ position: 'fixed', inset: 0, background: '#050508' }}>
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
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              left:  `calc(${star.x * 100}% + 12px)`,
              top:   `calc(${star.y * 100}% - 8px)`,
              pointerEvents: 'none',
            }}
          >
            <span style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: star.color,
              opacity: 0.9,
              textShadow: `0 0 8px ${star.color}`,
              whiteSpace: 'nowrap',
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
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => markStarSeen(star.id)}
            style={{
              position: 'absolute',
              left:  `${star.x * 100}%`,
              top:   `${star.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${star.color} 0%, transparent 70%)`,
              pointerEvents: 'none',
            }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Build star from category + summary data
export function buildStar(category: string, count: number, lastEntry: string): Star {
  const pos  = starPosition(category);
  const meta = getCategoryMeta(category);
  const daysSince = (Date.now() - new Date(lastEntry).getTime()) / 86400000;
  const recencyScore = Math.max(0, 1 - daysSince / 14); // fades over 2 weeks
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
