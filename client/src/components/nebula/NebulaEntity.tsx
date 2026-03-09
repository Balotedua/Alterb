import { useRef, useEffect } from 'react';
import { useNebulaStore } from '@/store/nebulaStore';

const N          = 200;
const BASE_SPEED = 0.50;

// ── Burst envelope helpers ────────────────────────────────────────────────────
// Radius uses a slow sine-bell so the ring expands then returns gracefully.
// Brightness peaks immediately (the "flash") then fades — this is what reads as explosion.

/** Send burst — 1.0 s */
const SEND_DUR = 1.0;
function sendBright(t: number) {
  if (t >= SEND_DUR) return 0;
  return t < 0.07 ? t / 0.07 : Math.max(0, 1 - (t - 0.07) / 0.93);
}
function sendRadius(t: number) {
  if (t >= SEND_DUR) return 0;
  return Math.sin((t / SEND_DUR) * Math.PI) * 0.28; // peak +28 % radius at 0.5 s
}

/** Response burst — 2.2 s, soft onset (no hard flash), wide expansion */
const RESP_DUR = 2.2;
function respBright(t: number) {
  if (t >= RESP_DUR) return 0;
  // Gentle ease-in over 0.35 s, then long smooth fade — no abrupt flash
  return t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / (RESP_DUR - 0.35));
}
function respRadius(t: number) {
  if (t >= RESP_DUR) return 0;
  return Math.sin((t / RESP_DUR) * Math.PI) * 0.50; // peak +50 % radius at 1.1 s
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

    const angles = Float32Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2);

    let t       = 0;
    let lastNow = performance.now();

    // Local burst state — no React state, no re-renders
    let sActive = false; let sT = 0; let prevS = false;
    let rActive = false; let rT = 0; let prevR = false;

    // Stato per la dissolvenza quando il fragment è attivo
    let fragmentActive = false;
    let fragmentFade = 0; // 0 = visibile, 1 = completamente dissolto

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

      // Gestione transizione fragment attivo
      const targetFragmentActive = !!activeFragment;
      if (targetFragmentActive !== fragmentActive) {
        // Inizia la transizione
        fragmentActive = targetFragmentActive;
      }
      // Interpolazione smooth del fade
      const targetFade = fragmentActive ? 1 : 0;
      fragmentFade += (targetFade - fragmentFade) * delta * 4; // velocità di transizione

      if (sActive) { sT += delta; if (sT >= SEND_DUR) sActive = false; }
      if (rActive) { rT += delta; if (rT >= RESP_DUR) rActive = false; }

      const sB = sActive ? sendBright(sT) : 0;
      const sR = sActive ? sendRadius(sT) : 0;
      const rB = rActive ? respBright(rT) : 0;
      const rRad = rActive ? respRadius(rT) : 0;

      // Anxious breathing while waiting: faster wave + periodic radius throb
      // Fade out throb smoothly as response burst kicks in (no jarring cut)
      const anxious = isThinking ? Math.max(0, 1 - rT * 2.5) : 0;
      const anxiousThrob = anxious * (Math.sin(t * Math.PI * 2.6) * 0.5 + 0.5); // ~1.3 Hz

      // Speed only grows with typing — bursts stay chill; thinking adds urgency
      const speed = BASE_SPEED * (1 + typingIntensity * 0.55 + anxious * 0.38);

      const { s, cx, cy, r } = dim;
      ctx.clearRect(0, 0, s, s);

      // ── Center glow ──────────────────────────────────────────────────────────
      // Radius expands with burst; alpha spikes on flash then slowly fades
      const glowR = r * (0.80 + sR * 0.6 + rRad * 1.1);
      const glowA = 0.04 + typingIntensity * 0.06 + sB * 0.14 + rB * 0.28;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0,    `rgba(130,70,245,${glowA * (1 - fragmentFade)})`);
      grd.addColorStop(0.5,  `rgba(95,50,205,${(glowA * 0.38 * (1 - fragmentFade)).toFixed(3)})`);
      grd.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // ── Particle ring ────────────────────────────────────────────────────────
      for (let i = 0; i < N; i++) {
        const a    = angles[i];
        const w1   = Math.cos(a - t * speed);
        const w2   = Math.cos(a - t * speed * 0.62 + Math.PI);
        const wave = Math.max(0, w1) * 0.75 + Math.max(0, w2) * 0.38;

        // Radius: base pulse + typing swell + anxious throb + slow burst expansion
        const waveAmp = 0.04 + typingIntensity * 0.08;
        const rr = r
          + wave * r * waveAmp
          + typingIntensity * r * 0.055
          + anxiousThrob * r * 0.06  // restless throb while thinking
          + sR   * r
          + rRad * r;

        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;

        // Brightness: flash from burst, gentle boost from typing/thinking
        const brightMul = 1 + typingIntensity * 0.35 + anxiousThrob * 0.18 + sB * 1.0 + rB * 2.2;
        const alpha = Math.min(0.97, (0.08 + wave * 0.84) * brightMul) * (1 - fragmentFade);
        const dotR  = (1.4 + wave * 1.7) * (1 + sB * 0.35 + rB * 0.55) * (1 - fragmentFade * 0.5);

        // On flash: color warms toward white-lavender, then returns to violet
        const red   = Math.round(148 + wave * 72 + sB * 30 + rB * 60);
        const green = Math.round(115 + wave * 65 + sB * 20 + rB * 50);

        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${red},${green},250,${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // ── Linee di connessione dal centro verso l'esterno (solo quando fragment è attivo) ──
      if (fragmentFade > 0.01) {
        const lineCount = 12;
        const lineLength = r * 1.8;
        const lineWidth = 2 * (1 - fragmentFade);
        const lineAlpha = 0.15 * fragmentFade;

        for (let i = 0; i < lineCount; i++) {
          const angle = (i / lineCount) * Math.PI * 2 + t * 0.3;
          const startX = cx + Math.cos(angle) * r * 0.7;
          const startY = cy + Math.sin(angle) * r * 0.7;
          const endX = cx + Math.cos(angle) * (r * 0.7 + lineLength);
          const endY = cy + Math.sin(angle) * (r * 0.7 + lineLength);

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = `rgba(167, 139, 250, ${lineAlpha})`;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }

        // Punti di connessione alle estremità delle linee
        for (let i = 0; i < lineCount; i++) {
          const angle = (i / lineCount) * Math.PI * 2 + t * 0.3;
          const pointX = cx + Math.cos(angle) * (r * 0.7 + lineLength);
          const pointY = cy + Math.sin(angle) * (r * 0.7 + lineLength);
          const pointRadius = 3 * fragmentFade;

          ctx.beginPath();
          ctx.arc(pointX, pointY, pointRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167, 139, 250, ${0.6 * fragmentFade})`;
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
