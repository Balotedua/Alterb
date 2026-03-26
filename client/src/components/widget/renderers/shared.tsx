// ─── Shared sub-components & constants ───────────────────────
import { motion } from 'framer-motion';
import { useAlterStore } from '../../../store/alterStore';
import { deleteEntry } from '../../../vault/vaultService';
import type { VaultEntry } from '../../../types';

// Desaturated / muted palette — no rainbow saturation spikes
export const PIE_PALETTE = ['#c96f6f','#c87a45','#b89630','#8b72d0','#5187c8','#2fa87a','#c45e96','#82b528'];

export function SurgicalInsight({ values, unit, category, color }: {
  values: number[]; unit: string; category?: string; color: string;
}) {
  if (values.length < 3) return null;
  const half     = Math.floor(values.length / 2);
  const firstAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const lastAvg  = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
  const pct      = firstAvg === 0 ? 0 : ((lastAvg - firstAvg) / firstAvg) * 100;
  const arrow    = pct > 2 ? '↑' : pct < -2 ? '↓' : '→';
  const trendClr = pct > 2 ? '#c96f6f' : pct < -2 ? '#3aad80' : 'rgba(255,255,255,0.2)';
  const recent   = values.slice(-3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const now      = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const projection = recentAvg * daysLeft;
  return (
    <div style={{
      marginTop: 10, padding: '7px 12px', borderRadius: 8,
      background: 'rgba(255,255,255,0.016)',
      borderLeft: `2px solid ${trendClr}35`,
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 10, letterSpacing: '0.04em',
    }}>
      <span style={{ color: trendClr, fontWeight: 500 }}>
        {arrow} {pct > 0 ? '+' : ''}{pct.toFixed(1)}% vs media precedente
      </span>
      {daysLeft > 0 && category === 'finance' && projection > 0 && (
        <span style={{ color: '#3a3f52' }}>
          · Proiezione fine mese: {unit}{projection.toFixed(0)}
        </span>
      )}
      {daysLeft > 0 && category !== 'finance' && (
        <span style={{ color, opacity: 0.4 }}>
          · Media attuale: {unit}{recentAvg.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string; color?: string }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        flex: 1, padding: '12px 14px', borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}>
      <div style={{
        fontSize: 9, color: 'rgba(255,255,255,0.3)',
        textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 7,
        fontWeight: 400,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 200, color: '#ffffff',
        letterSpacing: '-0.01em',
        fontFamily: "'Space Mono', monospace",
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
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.22, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px 7px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.018)',
        borderLeft: `2px solid ${color}28`,
      }}
    >
      <div style={{
        flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontWeight: 300,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 11, color: 'rgba(255,255,255,0.82)',
        fontWeight: 300, whiteSpace: 'nowrap',
        fontFamily: "'Space Mono', monospace",
      }}>
        {value}
      </div>
      <motion.button
        onClick={handleDelete}
        whileHover={{ color: '#e06060', opacity: 1 }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.2)', padding: 2, fontSize: 9, lineHeight: 1,
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
    <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
      {tabs.map(t => (
        <motion.button
          key={t}
          onClick={() => onChange(t)}
          whileTap={{ scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            position: 'relative',
            padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 400,
            background: 'transparent',
            color: active === t ? color : 'rgba(255,255,255,0.22)',
            transition: 'color 0.2s',
          }}
        >
          {active === t && (
            <motion.span
              layoutId="tab-pill"
              style={{
                position: 'absolute', inset: 0, borderRadius: 20,
                background: `${color}14`,
                boxShadow: `0 0 8px ${color}20`,
                zIndex: -1,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          {t}
        </motion.button>
      ))}
    </div>
  );
}
