import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TimerPillProps {
  id: string;
  title: string;
  endsAt: number;
  index: number;
  total: number;
}

function TimerPill({ id, title, endsAt, index, total }: TimerPillProps) {
  const removeTimer = useAlterStore(s => s.removeTimer);
  const [expanded, setExpanded] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [fired, setFired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 250);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const remaining = endsAt - now;
  const isExpired = remaining <= 0;

  // Trigger fired state once
  useEffect(() => {
    if (isExpired && !fired) {
      setFired(true);
      setExpanded(true);
      // Auto-dismiss after 8s
      setTimeout(() => removeTimer(id), 8000);
    }
  }, [isExpired, fired, id, removeTimer]);

  // Stagger vertically if multiple timers
  const topOffset = 12 + index * 0; // stack all at top, only show one at a time conceptually

  // Progress ring (SVG) — origDuration computed once at mount
  const RADIUS = 18;
  const CIRC = 2 * Math.PI * RADIUS;
  const startRef = useRef(Date.now()); // mount time
  const origDuration = endsAt - startRef.current;
  const progress = origDuration > 0 ? Math.max(0, Math.min(1, remaining / origDuration)) : 0;
  const dash = CIRC * progress;

  return (
    <motion.div
      layout
      initial={{ y: -80, opacity: 0, scale: 0.8 }}
      animate={{ y: topOffset, opacity: 1, scale: 1 }}
      exit={{ y: -80, opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: `translateX(-50%) translateY(${topOffset}px)`,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <motion.div
        layout
        onClick={() => !isExpired && setExpanded(e => !e)}
        animate={{
          width: expanded ? 280 : 120,
          height: expanded ? 'auto' : 34,
          borderRadius: expanded ? 22 : 999,
          backgroundColor: isExpired ? 'rgba(167,139,250,0.15)' : 'rgba(8,8,14,0.97)',
          boxShadow: isExpired
            ? '0 0 32px rgba(167,139,250,0.5), 0 4px 24px rgba(0,0,0,0.7)'
            : '0 0 0 1px rgba(255,255,255,0.08), 0 4px 20px rgba(0,0,0,0.6)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          overflow: 'hidden',
          cursor: isExpired ? 'default' : 'pointer',
          backdropFilter: 'blur(20px)',
          border: isExpired ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
          userSelect: 'none',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!expanded ? (
            /* ── Minimized pill ── */
            <motion.div
              key="mini"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '0 12px', height: 34,
              }}
            >
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>⏱</span>
              <span style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 13,
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '0.04em',
              }}>
                {formatCountdown(remaining)}
              </span>
            </motion.div>
          ) : (
            /* ── Expanded card ── */
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ padding: isExpired ? '18px 20px' : '14px 18px' }}
            >
              {isExpired ? (
                /* ── Fired state ── */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], rotate: [-6, 6, -4, 4, 0] }}
                    transition={{ duration: 0.6, repeat: 2 }}
                    style={{ fontSize: 28 }}
                  >
                    🔔
                  </motion.div>
                  <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Promemoria
                  </div>
                  <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
                    {title}
                  </div>
                  <button
                    onClick={() => removeTimer(id)}
                    style={{
                      marginTop: 4,
                      background: 'rgba(167,139,250,0.2)',
                      border: '1px solid rgba(167,139,250,0.35)',
                      borderRadius: 999,
                      color: '#a78bfa',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '5px 16px',
                      cursor: 'pointer',
                      letterSpacing: '0.06em',
                    }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                /* ── Countdown state ── */
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Ring */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <svg width={44} height={44} style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx={22} cy={22} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
                      <circle
                        cx={22} cy={22} r={RADIUS}
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${CIRC}`}
                        style={{ transition: 'stroke-dasharray 0.25s linear' }}
                      />
                    </svg>
                    <span style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600,
                    }}>
                      ⏱
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                      Promemoria
                    </div>
                    <div style={{
                      color: '#ffffff', fontSize: 13, fontWeight: 500,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {title}
                    </div>
                    <div style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 17, fontWeight: 700,
                      color: remaining < 60000 ? '#f87171' : '#a78bfa',
                      marginTop: 4,
                      transition: 'color 0.5s',
                    }}>
                      {formatCountdown(remaining)}
                    </div>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTimer(id); }}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 999,
                      color: 'rgba(255,255,255,0.4)',
                      width: 26, height: 26,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 11, flexShrink: 0,
                    }}
                    title="Annulla"
                  >
                    ✕
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Minimize hint */}
      {expanded && !isExpired && (
        <div style={{
          marginTop: 4, fontSize: 9, color: 'rgba(255,255,255,0.15)',
          letterSpacing: '0.06em',
        }}>
          tocca per minimizzare
        </div>
      )}
    </motion.div>
  );
}

export default function DynamicIslandTimer() {
  const activeTimers = useAlterStore(s => s.activeTimers);
  if (activeTimers.length === 0) return null;

  return (
    <AnimatePresence>
      {activeTimers.map((t, i) => (
        <TimerPill key={t.id} {...t} index={i} total={activeTimers.length} />
      ))}
    </AnimatePresence>
  );
}
