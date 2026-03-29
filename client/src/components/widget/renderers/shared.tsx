// ─── Shared sub-components & constants ───────────────────────
import { motion } from 'framer-motion';
import { useAlterStore } from '../../../store/alterStore';
import { deleteEntry } from '../../../vault/vaultService';
import type { VaultEntry } from '../../../types';

// Desaturated / muted palette — no rainbow saturation spikes
export const PIE_PALETTE = ['#c96f6f','#c87a45','#b89630','#8b72d0','#5187c8','#2fa87a','#c45e96','#82b528'];

const EASE = [0.4, 0, 0.2, 1] as const;

export function SurgicalInsight({ values, unit, category, color }: {
  values: number[]; unit: string; category?: string; color: string;
}) {
  if (values.length < 3) return null;
  const half     = Math.floor(values.length / 2);
  const firstAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const lastAvg  = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
  const pct      = firstAvg === 0 ? 0 : ((lastAvg - firstAvg) / firstAvg) * 100;
  const arrow    = pct > 2 ? '↑' : pct < -2 ? '↓' : '→';
  const trendClr = pct > 2 ? '#f87171' : pct < -2 ? '#34d399' : 'rgba(255,255,255,0.2)';
  const recent   = values.slice(-3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const now      = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const projection = recentAvg * daysLeft;
  return (
    <div style={{
      marginTop: 12,
      padding: '9px 14px',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${trendClr}22`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 11,
      letterSpacing: '0.01em',
    }}>
      <span style={{ color: trendClr, fontWeight: 500 }}>
        {arrow} {pct > 0 ? '+' : ''}{pct.toFixed(1)}% vs media precedente
      </span>
      {daysLeft > 0 && category === 'finance' && projection > 0 && (
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>
          · Proiezione fine mese: {unit}{projection.toFixed(0)}
        </span>
      )}
      {daysLeft > 0 && category !== 'finance' && (
        <span style={{ color, opacity: 0.55 }}>
          · Media attuale: {unit}{recentAvg.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string; color?: string }) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15, ease: EASE }}
      style={{
        flex: 1,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}>
      <div style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.40)',
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        marginBottom: 8,
        fontWeight: 500,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 600,
        color: '#f0f0f0',
        letterSpacing: '-0.03em',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {value}
      </div>
    </motion.div>
  );
}

export function EntryRow({ entry, color, label, value, index = 0 }: {
  entry: VaultEntry; color: string; label: string; value: string; index?: number;
}) {
  const { setActiveWidget, activeWidget } = useAlterStore();
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteEntry(entry.id);
    if (activeWidget) {
      setActiveWidget({
        ...activeWidget,
        entries: activeWidget.entries.filter(en => en.id !== entry.id),
      });
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.14)' }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18, delay: index * 0.025, ease: EASE }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{
        flex: 1,
        fontSize: 13,
        color: 'rgba(255,255,255,0.75)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 400,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.90)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {value}
      </div>
      <motion.button
        onClick={handleDelete}
        whileHover={{ color: '#f87171', opacity: 1 }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.22)', padding: 4, fontSize: 11, lineHeight: 1,
        }}
      >
        ✕
      </motion.button>
    </motion.div>
  );
}

export function TabBar({ tabs, active, color, onChange }: {
  tabs: string[]; active: string; color: string; onChange: (t: string) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      marginBottom: 18,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      paddingBottom: 12,
    }}>
      {tabs.map(t => (
        <motion.button
          key={t}
          onClick={() => onChange(t)}
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.18, ease: EASE }}
          style={{
            position: 'relative',
            padding: '5px 14px',
            borderRadius: 20,
            border: 'none',
            cursor: 'pointer',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 500,
            background: 'transparent',
            color: active === t ? color : 'rgba(255,255,255,0.35)',
            transition: 'color 0.18s',
          }}
        >
          {active === t && (
            <motion.span
              layoutId="tab-pill"
              style={{
                position: 'absolute', inset: 0, borderRadius: 20,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                zIndex: -1,
              }}
              transition={{ duration: 0.2, ease: EASE }}
            />
          )}
          {t}
        </motion.button>
      ))}
    </div>
  );
}
