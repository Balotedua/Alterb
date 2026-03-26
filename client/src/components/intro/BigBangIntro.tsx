import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props { onComplete: () => void; }

const LETTERS = ['A', 'L', 'T', 'E', 'R'];

export default function BigBangIntro({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      onClick={onComplete}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#05070D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {/* Outer wrapper fades out at the end */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0] }}
        transition={{ duration: 2.0, times: [0, 0.75, 1], ease: 'easeInOut' }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
      >
        {/* Top accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: 180,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(200,168,75,0.55), transparent)',
            transformOrigin: 'center',
          }}
        />

        {/* Wordmark */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {LETTERS.map((ch, i) => (
            <motion.span
              key={ch}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.18 + i * 0.065,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif',
                fontWeight: 200,
                fontSize: 34,
                letterSpacing: '0.22em',
                color: '#F2EFE8',
                userSelect: 'none',
              }}
            >
              {ch}
            </motion.span>
          ))}
        </div>

        {/* Bottom accent line — delayed, thinner */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: 32,
            height: 1,
            background: 'rgba(200,168,75,0.35)',
            transformOrigin: 'center',
          }}
        />
      </motion.div>
    </motion.div>
  );
}
