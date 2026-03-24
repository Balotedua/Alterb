import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAlterStore } from '../../store/alterStore';
import type { VaultEntry, RenderType } from '../../types';

import FinanceRenderer  from './renderers/FinanceRenderer';
import WorkoutRenderer  from './renderers/WorkoutRenderer';
import TimelineRenderer from './renderers/TimelineRenderer';
import { HealthChart, NumericChart }   from './renderers/HealthRenderer';
import { MoodChart, DiaryList }        from './renderers/MoodRenderer';
import { NebulaInsight, NexusView }    from './renderers/InsightRenderer';
import DocumentRenderer, { DocDownloadList, GenericList } from './renderers/DocRenderer';

// ─── Render type inference ────────────────────────────────────
export function inferRenderType(entries: VaultEntry[], category?: string): RenderType {
  if (category === 'calendar' || (!entries.length && category === 'calendar')) return 'timeline';
  if (category === 'documents') return 'doc_download';
  if (!entries.length) {
    if (category === 'finance') return 'finance';
    if (category === 'health') return 'chart';
    if (category === 'psychology') return 'mood';
    return 'list';
  }
  const data = entries[0].data;
  if (data.is_event || (entries[0] as VaultEntry & { category?: string }).category === 'calendar') return 'timeline';
  // Explicit renderType from parser takes priority
  if (typeof data.renderType === 'string') return data.renderType as RenderType;
  if (data.type === 'mood') return 'mood';
  if (data.type === 'weight' || data.type === 'sleep' || data.type === 'water') return 'chart';
  if (data.type === 'activity') return 'workout';
  if (typeof data.amount === 'number') return 'finance';
  if (typeof data.value === 'number') return 'numeric';
  if (typeof data.note === 'string' && !data.score) return 'diary';
  return 'list';
}

// ─── Main Widget ──────────────────────────────────────────────
export default function PolymorphicWidget() {
  const { activeWidget, setActiveWidget } = useAlterStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveWidget(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveWidget]);

  return (
    <>
      {activeWidget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setActiveWidget(null)}
        />
      )}
      <AnimatePresence>
        {activeWidget && (
          <motion.div
            key="widget"
            initial={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0, x: '-50%', y: '-50%' }}
            animate={{ clipPath: 'circle(150% at 50% 50%)', opacity: 1, x: '-50%', y: '-50%' }}
            exit={{   clipPath: 'circle(0% at 50% 50%)', opacity: 0, x: '-50%', y: '-50%' }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              width: 'min(500px, calc(100vw - 16px))',
              maxHeight: 'min(72vh, calc(100svh - 80px))',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch' as never,
              background: 'rgba(6,6,8,0.92)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 4,
              padding: '20px 20px 16px',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              zIndex: 100,
              boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 10 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {activeWidget.label}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.05em' }}>
                {activeWidget.entries.length}
              </span>
              <button
                onClick={() => setActiveWidget(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2e3347', padding: 4, transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#6b7280')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#2e3347')}
              >
                <X size={13} />
              </button>
            </div>

            {/* Body — polymorphic switch */}
            {activeWidget.renderType === 'doc_download'
            ? <DocumentRenderer  entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.entries.length === 0 ? (
              <p style={{ color: '#2e3347', fontSize: 12, textAlign: 'center', padding: '24px 0', letterSpacing: '0.05em' }}>
                Nessun dato ancora.
              </p>
            ) : activeWidget.renderType === 'finance'      ? <FinanceRenderer   entries={activeWidget.entries} color={activeWidget.color} initialTab={activeWidget.subTab} />
            : activeWidget.renderType === 'workout'      ? <WorkoutRenderer   entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'chart'        ? <HealthChart       entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'numeric'      ? <NumericChart      entries={activeWidget.entries} color={activeWidget.color} label={activeWidget.label} />
            : activeWidget.renderType === 'mood'         ? <MoodChart         entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'diary'        ? <DiaryList         entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'timeline'     ? <TimelineRenderer  entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'insight'      ? <NebulaInsight     entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'nexus'        ? <NexusView         entries={activeWidget.entries} />
            : <GenericList entries={activeWidget.entries} color={activeWidget.color} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
