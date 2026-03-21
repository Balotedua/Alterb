import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import { getByCategory } from '../../vault/vaultService';
import type { Star, VaultEntry } from '../../types';

function getMetricLabel(category: string, data: Record<string, unknown>): string {
  if (category === 'finance') {
    const amt = data.amount as number;
    const type = data.type as string;
    if (amt !== undefined) return `${type === 'income' ? '+' : '-'}${amt}€`;
  }
  if (category === 'health') {
    if (data.value !== undefined) return `${data.value}${data.unit ?? ''}`;
    if (data.hours !== undefined) return `${data.hours}h`;
    if (data.liters !== undefined) return `${data.liters}L`;
  }
  if (category === 'psychology' && data.score !== undefined) {
    return `${data.score}/10`;
  }
  if (category === 'calendar' && data.title !== undefined) {
    return String(data.title);
  }
  return '';
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  return `${Math.floor(diff / 86400)}g fa`;
}

function DashboardCard({ star, isLast }: { star: Star; isLast: boolean }) {
  const { user, setActiveWidget } = useAlterStore();
  const [metric, setMetric] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    getByCategory(user.id, star.id, 1).then((entries: VaultEntry[]) => {
      if (entries.length > 0) {
        setMetric(getMetricLabel(star.id, entries[0].data as Record<string, unknown>));
      }
    });
  }, [star.id, user]);

  const handleClick = async () => {
    if (!user) return;
    const entries = await getByCategory(user.id, star.id, 20);
    const { inferRenderType } = await import('../widget/PolymorphicWidget');
    setActiveWidget({
      category: star.id,
      label: star.label,
      color: star.color,
      entries,
      renderType: inferRenderType(entries, star.id),
    });
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      style={{
        borderLeft: `2px solid ${star.color}`,
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {/* Category label */}
      <span style={{
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: '0.12em',
        color: star.color,
        opacity: 0.70,
        flexShrink: 0,
        minWidth: 64,
      }}>
        {star.label.toUpperCase()}
      </span>

      {/* Dominant metric */}
      <span style={{
        flex: 1,
        fontSize: 28,
        fontWeight: 200,
        color: 'rgba(255,255,255,0.90)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
        lineHeight: 1,
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {metric || `${star.entryCount}`}
      </span>

      {/* Timestamp */}
      <span style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.22)',
        flexShrink: 0,
        minWidth: 36,
        textAlign: 'right',
      }}>
        {star.lastEntry ? relativeTime(star.lastEntry) : '—'}
      </span>
    </motion.div>
  );
}

export default function DashboardView() {
  const { stars } = useAlterStore();
  const visibleStars = stars.filter(s => !s.ephemeral && s.id !== 'insight');

  return (
    <motion.div
      key="dashboard-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed', inset: 0,
        background: '#03030a',
        overflowY: 'auto',
        paddingBottom: 'calc(44px + 80px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 16,
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <p style={{
          fontSize: 9, letterSpacing: '0.20em',
          color: 'rgba(255,255,255,0.18)',
          margin: '8px 0 20px',
        }}>
          DATA
        </p>

        {visibleStars.length === 0 ? (
          <div style={{
            textAlign: 'center', marginTop: '30vh',
            color: 'rgba(255,255,255,0.28)', fontSize: 13, lineHeight: 1.8,
          }}>
            Nessun dato ancora.<br />
            Vai in Chat e scrivi qualcosa.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleStars.map((star, i) => (
              <DashboardCard key={star.id} star={star} isLast={i === visibleStars.length - 1} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
