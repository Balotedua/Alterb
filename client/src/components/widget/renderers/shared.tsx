// ─── Shared sub-components & constants ───────────────────────
import { useAlterStore } from '../../../store/alterStore';
import { deleteEntry } from '../../../vault/vaultService';
import type { VaultEntry } from '../../../types';

export const PIE_PALETTE = ['#f87171','#fb923c','#fbbf24','#a78bfa','#60a5fa','#34d399','#f472b6','#a3e635'];

export function SurgicalInsight({ values, unit, category, color }: {
  values: number[]; unit: string; category?: string; color: string;
}) {
  if (values.length < 3) return null;
  const half     = Math.floor(values.length / 2);
  const firstAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const lastAvg  = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
  const pct      = firstAvg === 0 ? 0 : ((lastAvg - firstAvg) / firstAvg) * 100;
  const arrow    = pct > 2 ? '↑' : pct < -2 ? '↓' : '→';
  const trendClr = pct > 2 ? '#f87171' : pct < -2 ? '#4ade80' : '#6b7280';
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

export function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: 1, padding: '12px 14px', borderRadius: 12,
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${color}12`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)`,
    }}>
      <div style={{
        fontSize: 9, color: '#4b5268',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7,
        fontWeight: 400,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 100, color,
        textShadow: `0 0 20px ${color}50`,
        letterSpacing: '0.01em',
      }}>
        {value}
      </div>
    </div>
  );
}

export function EntryRow({ entry, color, label, value }: {
  entry: VaultEntry; color: string; label: string; value: string
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
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px 7px 12px', borderRadius: 8,
      background: 'rgba(255,255,255,0.018)',
      borderLeft: `2px solid ${color}35`,
      transition: 'background 0.15s',
    }}>
      <div style={{
        flex: 1, fontSize: 12, color: '#b0bcd4',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontWeight: 300,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, color,
        fontWeight: 400, whiteSpace: 'nowrap',
        textShadow: `0 0 10px ${color}40`,
      }}>
        {value}
      </div>
      <button
        onClick={handleDelete}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#3a3f52', padding: 2, opacity: 0.6, fontSize: 9,
          transition: 'color 0.2s, opacity 0.2s', lineHeight: 1,
        }}
        onMouseEnter={e => { (e.target as HTMLElement).style.color = '#f87171'; (e.target as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.color = '#3a3f52'; (e.target as HTMLElement).style.opacity = '0.6'; }}
      >
        ✕
      </button>
    </div>
  );
}

export function TabBar({ tabs, active, color, onChange }: {
  tabs: string[]; active: string; color: string; onChange: (t: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
          fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 400,
          background: active === t ? `${color}18` : 'transparent',
          color: active === t ? color : '#3a3f52',
          transition: 'all 0.2s',
        }}>{t}</button>
      ))}
    </div>
  );
}
