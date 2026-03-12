import { useRef, useEffect } from 'react';
import { useNebulaStore } from '@/store/nebulaStore';
import { getTheme } from '@/config/nebulaThemes';

const N          = 180;   // fewer points → cleaner ring
const BASE_SPEED = 0.28;  // slower base rotation

// Smooth ease-out for fragment fade
function easeOutExpo(x: number) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

// Deterministic seed-based "random" (constant across frames)
function seededRand(seed: number) {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

// Lerp helper
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─────────────────────────────────────────────────────────────────────────────

export function NebulaEntity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    const setup = () => {
      const size = canvas.offsetWidth;
      canvas.width  = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
      return { s: size, cx: size / 2, cy: size / 2, r: size * 0.34 };
    };

    let dim = setup();
    const onResize = () => { dim = setup(); };
    window.addEventListener('resize', onResize);

    // Pre-compute per-particle data (deterministic, no per-frame random)
    const PARTICLE_COUNT = 48;
    const particleAngles = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) =>
      (i / PARTICLE_COUNT) * Math.PI * 2
    );
    const particleSpeeds = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) =>
      0.5 + seededRand(i * 7.3) * 0.7
    );
    const particleSizes = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) =>
      1.2 + seededRand(i * 3.1) * 2.2
    );

    const angles = Float32Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2);

    let t       = 0;
    let lastNow = performance.now();

    // ── Smooth state targets (no sudden jumps) ────────────────────────────────

    // glowExtra: 0 = idle, 1 = max active state
    let glowExtra  = 0;  // current smoothed glow boost
    // speedExtra multiplier: 1 = base speed
    let speedMul   = 1;
    // fragmentFade: 0 = visible, 1 = dissolved
    let fragmentFade = 0;
    // thinkPulse: 0 = idle, 1 = full explosive thinking state
    let thinkPulse = 0;

    // Slow continuous breath: drives a gentle idle pulse
    // Computed in loop from t — no extra state needed

    const loop = (now: number) => {
      const delta = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      t += delta;

      const {
        typingIntensity,
        isBursting,
        isResponseBursting,
        isThinking,
        activeFragment,
        nebulaTheme,
      } = useNebulaStore.getState();
      const th = getTheme(nebulaTheme);

      // ── Target glow: based on state, no sudden jumps ──────────────────────
      let glowTarget = 0;
      if (isThinking || isResponseBursting) glowTarget = 0.65;
      else if (isBursting)                  glowTarget = 0.38;
      else if (typingIntensity > 0.1)       glowTarget = typingIntensity * 0.18;

      // Fast rise, slow gentle decay — premium feel
      const glowLerp = glowTarget > glowExtra ? delta * 2.2 : delta * 0.55;
      glowExtra = lerp(glowExtra, glowTarget, Math.min(glowLerp, 1));

      // ── Think pulse — sale/scende lentamente per transizioni morbide ────────
      thinkPulse = lerp(thinkPulse, isThinking ? 1 : 0, Math.min(delta * 1.2, 1));

      // ── Target rotation speed — leggermente più veloce, mai frenetico ────────
      const speedTarget = isThinking ? 1.35 : 1.0;
      speedMul = lerp(speedMul, speedTarget, Math.min(delta * 0.8, 1));

      // ── Fragment dissolve (smooth expo ease) ──────────────────────────────
      const fadeLerp = activeFragment ? delta * 2.8 : delta * 3.5;
      fragmentFade   = lerp(fragmentFade, activeFragment ? 1 : 0, Math.min(fadeLerp, 1));
      const visibility = Math.max(0, 1 - easeOutExpo(fragmentFade));

      const { s, cx, cy, r } = dim;
      ctx.clearRect(0, 0, s, s);

      if (visibility < 0.005) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── Continuous slow breathing (always present, very subtle) ───────────
      // Two overlapping sines at different periods → organic, never mechanical
      const breathe = (
        Math.sin(t * 0.55 * Math.PI) * 0.55 +
        Math.sin(t * 0.23 * Math.PI + 1.2) * 0.45
      ) * 0.5 + 0.5; // 0→1

      // ── Center glow ───────────────────────────────────────────────────────
      const baseGlowA = 0.045 + breathe * 0.022;
      const glowA     = Math.min(0.22, (baseGlowA + glowExtra * 0.14)) * visibility;
      const glowR     = r * (0.88 + breathe * 0.08 + glowExtra * 0.12);

      const [gi0, gi1, gi2] = th.glowInner;
      const [go0, go1, go2] = th.glowOuter;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0,    `rgba(${gi0},${gi1},${gi2},${glowA.toFixed(3)})`);
      grd.addColorStop(0.5,  `rgba(${go0},${go1},${go2},${(glowA * 0.28).toFixed(3)})`);
      grd.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // ── Particle ring ─────────────────────────────────────────────────────
      const [pb0, pb1, pb2] = th.particleBase;
      const [pw0, pw1]      = th.particleWave;

      const speed = BASE_SPEED * speedMul;

      // ── Thinking: ondulazione lenta e fluida, come acqua che respira ────────
      const thinkFlow  = thinkPulse * Math.sin(t * 1.4) * 0.45;   // onda lenta principale
      const thinkDrift = thinkPulse * Math.sin(t * 0.7 + 1.1) * 0.2; // deriva secondaria

      for (let i = 0; i < N; i++) {
        const a  = angles[i];
        // Due armoniche con modulazione dolce durante il thinking
        const w1 = Math.cos(a - t * speed + thinkFlow * Math.sin(a * 0.5));
        const w2 = Math.cos(a - t * speed * 0.55 + Math.PI * 0.7 + thinkDrift * Math.cos(a * 0.8));
        const wave = Math.max(0, w1) * 0.68 + Math.max(0, w2) * 0.32;

        // Ampiezza leggermente maggiore durante thinking, mai aggressiva
        const waveAmp = 0.036 + thinkPulse * 0.055;
        const rr = r
          + wave * r * waveAmp
          + breathe * r * 0.038;

        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;

        // Brightness: base wave + smooth glow state (no harsh flash)
        const brightMul = 1 + breathe * 0.12 + glowExtra * 0.55;
        const alpha = Math.min(0.90, (0.05 + wave * 0.78) * brightMul) * visibility;
        const dotR  = (1.1 + wave * 1.4) * (1 + glowExtra * 0.12) * visibility;

        // Color: base + wave shift, no burst color spike
        const red   = Math.round(pb0 + wave * pw0);
        const green = Math.round(pb1 + wave * pw1);
        const blue  = Math.min(255, pb2);

        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${red},${green},${blue},${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // ── Fragment dissolve: particles drift outward smoothly ───────────────
      if (fragmentFade > 0.02 && fragmentFade < 0.98) {
        const fade       = easeOutExpo(fragmentFade);
        const driftAlpha = Math.sin(fragmentFade * Math.PI) * 0.4; // bell curve

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const angle = particleAngles[i] + t * 0.06;
          const dist  = r * (0.45 + fade * particleSpeeds[i] * 1.2);
          const px    = cx + Math.cos(angle) * dist;
          const py    = cy + Math.sin(angle) * dist;
          const sz    = particleSizes[i] * (1 - fade * 0.75);
          const a     = driftAlpha * (0.10 + seededRand(i) * 0.22);

          if (sz < 0.1 || a < 0.01) continue;

          const rC = Math.round(pb0 + fade * 55);
          const gC = Math.round(pb1 + fade * 80);
          ctx.beginPath();
          ctx.arc(px, py, sz, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rC},${gC},${pb2},${a.toFixed(3)})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame((n) => { lastNow = n; loop(n); });

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
