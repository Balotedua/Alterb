import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'pwa_prompt_last_shown';
const INTERVAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 giorni

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function shouldShow(): boolean {
  if (!isMobile() || isInstalled()) return false;
  const last = localStorage.getItem(STORAGE_KEY);
  if (!last) return true;
  return Date.now() - parseInt(last, 10) >= INTERVAL_MS;
}

export default function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const ios = isIOS();

  useEffect(() => {
    if (shouldShow()) {
      // Piccolo delay per non bloccare il paint iniziale
      const t = setTimeout(() => setVisible(true), 1800);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="pwa-prompt"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(5,7,13,0.97)',
            backdropFilter: 'blur(24px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px 24px',
            overflowY: 'auto',
          }}
        >
          {/* Glow orb */}
          <div style={{
            position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)',
            width: 220, height: 220,
            background: 'radial-gradient(circle, rgba(155,127,212,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', maxWidth: 380, width: '100%', textAlign: 'center' }}>
            {/* Icon */}
            <div style={{ fontSize: 52, marginBottom: 20 }}>
              {ios ? '🔵' : '🟢'}
            </div>

            <div style={{
              color: 'rgba(155,127,212,0.7)', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10,
            }}>
              Installa Alter
            </div>

            <h2 style={{
              color: '#ffffff', fontSize: 24, fontWeight: 600,
              margin: '0 0 8px', lineHeight: 1.25,
            }}>
              {ios ? 'Aggiungi alla Home' : 'Installa come app'}
            </h2>

            <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 14, margin: '0 0 32px', lineHeight: 1.6 }}>
              {ios
                ? 'Apri Alter su Safari e segui questi passi per installarlo sulla tua Home Screen.'
                : 'Installa Alter su Android per un\'esperienza completa, anche offline.'}
            </p>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left', marginBottom: 36 }}>
              {ios ? (
                <>
                  <Step n={1} text='Apri questa pagina in Safari (non Chrome).' />
                  <Step n={2} text="Tocca l'icona di Condivisione — il quadrato con la freccia in basso." />
                  <Step n={3} text='Scorri e tocca "Aggiungi alla schermata Home".' />
                  <Step n={4} text='Conferma con "Aggiungi" in alto a destra.' />
                </>
              ) : (
                <>
                  <Step n={1} text='Apri questa pagina in Chrome.' />
                  <Step n={2} text='Cerca il banner "Aggiungi alla schermata Home" in basso.' />
                  <Step n={3} text='Se non appare: tocca i tre puntini ⋮ in alto a destra.' />
                  <Step n={4} text='Tocca "Installa app" e conferma.' />
                </>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={dismiss}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 14,
                border: '1px solid rgba(155,127,212,0.3)',
                background: 'rgba(155,127,212,0.12)',
                color: '#c4b0e8',
                fontSize: 15, fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
                marginBottom: 12,
              }}
            >
              Ho capito
            </button>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        minWidth: 26, height: 26, borderRadius: '50%',
        background: 'rgba(155,127,212,0.15)',
        border: '1px solid rgba(155,127,212,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9B7FD4', fontSize: 12, fontWeight: 600, flexShrink: 0,
      }}>
        {n}
      </div>
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, margin: 0, lineHeight: 1.55 }}>
        {text}
      </p>
    </div>
  );
}
