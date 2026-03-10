import { useRef, useEffect } from 'react';
import { useNebulaStore } from '@/store/nebulaStore';

const N          = 200;
const BASE_SPEED = 0.42; // slightly slower for calmer feel

// ── Burst envelopes ───────────────────────────────────────────────────────────

const SEND_DUR = 0.9;
function sendBright(t: number) {
  if (t >= SEND_DUR) return 0;
  return t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - 0.06) / 0.84);
}
function sendRadius(t: number) {
  if (t >= SEND_DUR) return 0;
  return Math.sin((t / SEND_DUR) * Math.PI) * 0.22;
}

const RESP_DUR = 2.6; // longer, more cinematic response
function respBright(t: number) {
  if (t >= RESP_DUR) return 0;
  return t < 0.4 ? t / 0.4 : Math.max(0, 1 - (t - 0.4) / (RESP_DUR - 0.4));
}
function respRadius(t: number) {
  if (t >= RESP_DUR) return 0;
  return Math.sin((t / RESP_DUR) * Math.PI) * 0.45;
}

// Smooth ease-out for fragment fade (no jerky random)
function easeOutExpo(x: number) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

// Deterministic "random" from a seed (seeded per-particle, constant across frames)
function seededRand(seed: number) {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
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

    // Pre-compute per-particle seeds (deterministic, no per-frame random)
    const PARTICLE_COUNT = 64;
    const particleSeeds = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) => i);
    const particleAngles = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) =>
      (i / PARTICLE_COUNT) * Math.PI * 2
    );
    const particleSpeeds = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) =>
      0.6 + seededRand(i * 7.3) * 0.8
    );
    const particleSizes = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) =>
      1.5 + seededRand(i * 3.1) * 2.5
    );

    const angles = Float32Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2);

    let t       = 0;
    let lastNow = performance.now();

    let sActive = false; let sT = 0; let prevS = false;
    let rActive = false; let rT = 0; let prevR = false;

    // Fragment fade — smooth lerp, no random
    let fragmentFade = 0; // 0 = fully visible, 1 = fully dissolved

    const loop = (now: number) => {
      const delta = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      t += delta;

      const { typingIntensity, isBursting, isResponseBursting, isThinking, activeFragment } =
        useNebulaStore.getState();

      // Leading-edge detection
      if (isBursting         && !prevS) { sActive = true; sT = 0; }
      if (isResponseBursting && !prevR) { rActive = true; rT = 0; }
      prevS = isBursting;
      prevR = isResponseBursting;

      // Smooth fragment fade — expo ease toward target
      const targetFade = activeFragment ? 1 : 0;
      const fadeSpeed  = activeFragment ? 2.8 : 3.5; // dissolve slightly slower than appear
      fragmentFade += (targetFade - fragmentFade) * Math.min(delta * fadeSpeed, 1);
      const visibility = Math.max(0, 1 - easeOutExpo(fragmentFade));

      if (sActive) { sT += delta; if (sT >= SEND_DUR) sActive = false; }
      if (rActive) { rT += delta; if (rT >= RESP_DUR) rActive = false; }

      const sB   = sActive ? sendBright(sT)  : 0;
      const sR   = sActive ? sendRadius(sT)  : 0;
      const rB   = rActive ? respBright(rT)  : 0;
      const rRad = rActive ? respRadius(rT)  : 0;

      // Gentle breathing while thinking — smooth sine
      const anxious = isThinking ? Math.max(0, 1 - rT * 2.2) : 0;
      const breathe  = anxious * (Math.sin(t * Math.PI * 2.4) * 0.5 + 0.5);

      // Typing: subtle intensity boost (no speed change — keeps it calm)
      const typingBoost = typingIntensity * 0.12;

      const speed = BASE_SPEED * (1 + anxious * 0.22);

      const { s, cx, cy, r } = dim;
      ctx.clearRect(0, 0, s, s);

      if (visibility < 0.005) {
        rafRef.current = requestAnimationFrame(loop);
        return; // fully dissolved, skip drawing
      }

      // ── Center glow ────────────────────────────────────────────────────────
      const glowR = r * (0.82 + sR * 0.55 + rRad * 1.05);
      const glowA = (0.05 + sB * 0.12 + rB * 0.25 + breathe * 0.04) * visibility;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0,   `rgba(130,70,245,${glowA.toFixed(3)})`);
      grd.addColorStop(0.45, `rgba(95,50,200,${(glowA * 0.3).toFixed(3)})`);
      grd.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // ── Particle ring ───────────────────────────────────────────────────────
      for (let i = 0; i < N; i++) {
        const a  = angles[i];
        const w1 = Math.cos(a - t * speed);
        const w2 = Math.cos(a - t * speed * 0.6 + Math.PI);
        const wave = Math.max(0, w1) * 0.72 + Math.max(0, w2) * 0.35;

        const waveAmp = 0.042;
        const rr = r
          + wave * r * waveAmp
          + breathe * r * 0.055
          + sR   * r
          + rRad * r;

        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;

        const brightMul = 1 + breathe * 0.15 + sB * 0.9 + rB * 2.0 + typingBoost;
        const alpha = Math.min(0.95, (0.07 + wave * 0.82) * brightMul) * visibility;
        const dotR  = (1.3 + wave * 1.6) * (1 + sB * 0.3 + rB * 0.5) * visibility;

        const red   = Math.round(145 + wave * 68 + sB * 25 + rB * 55);
        const green = Math.round(112 + wave * 60 + sB * 18 + rB * 45);

        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${red},${green},250,${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // ── Smooth dispersion on fragment open ─────────────────────────────────
      // Deterministic particles drift outward — no Math.random() per frame
      if (fragmentFade > 0.02 && fragmentFade < 0.98) {
        const fade      = easeOutExpo(fragmentFade);
        const driftAlpha = Math.sin(fragmentFade * Math.PI) * 0.5; // bell curve

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const angle = particleAngles[i] + t * 0.08; // slow drift rotation
          const dist  = r * (0.5 + fade * particleSpeeds[i] * 1.4);
          const px    = cx + Math.cos(angle) * dist;
          const py    = cy + Math.sin(angle) * dist;
          const sz    = particleSizes[i] * (1 - fade * 0.7);
          const a     = driftAlpha * (0.15 + seededRand(particleSeeds[i]) * 0.3);

          if (sz < 0.1 || a < 0.01) continue;

          // color: violet → pale lavender as they drift
          const rC = Math.round(167 + fade * 60);
          const gC = Math.round(139 + fade * 90);
          ctx.beginPath();
          ctx.arc(px, py, sz, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rC},${gC},250,${a.toFixed(3)})`;
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
