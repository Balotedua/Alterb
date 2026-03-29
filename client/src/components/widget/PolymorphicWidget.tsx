import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAlterStore } from '../../store/alterStore';
import type { VaultEntry, RenderType } from '../../types';

import FinanceRenderer  from './renderers/FinanceRenderer';
import WorkoutRenderer  from './renderers/WorkoutRenderer';
import TimelineRenderer from './renderers/TimelineRenderer';
import { HealthChart, NumericChart }   from './renderers/HealthRenderer';
import { MoodChart, DiaryList }        from './renderers/MoodRenderer';
import { NexusView }    from './renderers/InsightRenderer';
import DocumentRenderer, { DocDownloadList, GenericList } from './renderers/DocRenderer';
import CodexRenderer from './renderers/CodexRenderer';
import CoherenceRenderer from './renderers/CoherenceRenderer';
import VoidRenderer from './renderers/VoidRenderer';
import PredictiveRenderer from './renderers/PredictiveRenderer';
import CognitiveRenderer from './renderers/CognitiveRenderer';
import PrivacyRenderer from './renderers/PrivacyRenderer';

// ─── Render type inference ────────────────────────────────────
export function inferRenderType(entries: VaultEntry[], category?: string): RenderType {
  if (category === 'calendar' || (!entries.length && category === 'calendar')) return 'timeline';
  if (category === 'documents') return 'doc_download';
  if (category === 'chronicle') return 'codex';
  if (category === 'notes') return 'void';
  if (category === 'privacy') return 'privacy';
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
const BASE_SHADOW = '0 40px 100px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06), inset 1px 0 0 rgba(255,255,255,0.03)';

export default function PolymorphicWidget() {
  const { activeWidget, setActiveWidget } = useAlterStore();
  const widgetRef = useRef<HTMLDivElement>(null);
  const [glowShadow, setGlowShadow] = useState(BASE_SHADOW);

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
            key={`widget-${activeWidget.category}-${activeWidget.subTab ?? ''}`}
            ref={widgetRef}
            initial={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0, x: '-50%', y: '-50%' }}
            animate={{ clipPath: 'circle(150% at 50% 50%)', opacity: 1, x: '-50%', y: '-50%' }}
            exit={{   clipPath: 'circle(0% at 50% 50%)', opacity: 0, x: '-50%', y: '-50%' }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            onMouseMove={(e) => {
              if (!widgetRef.current) return;
              const rect = widgetRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left, y = e.clientY - rect.top;
              const topA  = Math.max(0, 0.1 * (1 - y / 60));
              const leftA = Math.max(0, 0.06 * (1 - x / 60));
              setGlowShadow(`0 40px 100px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,${(0.06 + topA).toFixed(3)}), inset 1px 0 0 rgba(255,255,255,${(0.03 + leftA).toFixed(3)})`);
            }}
            onMouseLeave={() => setGlowShadow(BASE_SHADOW)}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              width: activeWidget.renderType === 'codex' ? 'min(560px, calc(100vw - 24px))' : 'min(500px, calc(100vw - 24px))',
              maxHeight: 'min(72vh, calc(100svh - 80px))',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch' as never,
              background: 'rgba(5,7,16,0.94)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 22,
              padding: '22px 22px 18px',
              backdropFilter: 'blur(56px)',
              WebkitBackdropFilter: 'blur(56px)',
              zIndex: 100,
              // Dynamic cursor border glow — "light blade" tracks cursor proximity
              boxShadow: glowShadow,
              transition: 'box-shadow 0.12s ease',
            }}
          >
            {/* Film-grain texture overlay — 1% opacity, premium material feel */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 22, pointerEvents: 'none', zIndex: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
              opacity: 0.018,
            }} />
            {/* Header */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', marginBottom: 20, gap: 10 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: activeWidget.color,
                boxShadow: `0 0 8px ${activeWidget.color}80`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(240,238,248,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {activeWidget.label}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.14)', letterSpacing: '0.04em', fontFamily: "'Space Mono', monospace" }}>
                {activeWidget.entries.length}
              </span>
              <motion.button
                onClick={() => setActiveWidget(null)}
                whileHover={{ color: 'rgba(255,255,255,0.65)' }}
                whileTap={{ scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.18)', padding: 4, marginLeft: 4, display: 'flex', alignItems: 'center', borderRadius: 6 }}
              >
                <X size={13} />
              </motion.button>
            </div>

            {/* Body — polymorphic switch */}
            {/* eslint-disable-next-line react/jsx-no-useless-fragment */}
            <div style={{ position: 'relative', zIndex: 1 }}>
            {activeWidget.renderType === 'doc_download'
            ? <DocumentRenderer  entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'codex'        ? <CodexRenderer     entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'coherence'    ? <CoherenceRenderer  entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'predictive'   ? <PredictiveRenderer entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'quiz'          ? <CognitiveRenderer  entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'void'         ? <VoidRenderer       entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'privacy'      ? <PrivacyRenderer    entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.entries.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12, textAlign: 'center', padding: '24px 0', letterSpacing: '0.05em' }}>
                Nessun dato ancora.
              </p>
            ) : activeWidget.renderType === 'finance'      ? <FinanceRenderer   entries={activeWidget.entries} color={activeWidget.color} initialTab={activeWidget.subTab} />
            : activeWidget.renderType === 'workout'      ? <WorkoutRenderer   entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'chart'        ? <HealthChart       entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'numeric'      ? <NumericChart      entries={activeWidget.entries} color={activeWidget.color} label={activeWidget.label} />
            : activeWidget.renderType === 'mood'         ? <MoodChart         entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'diary'        ? <DiaryList         entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'timeline'     ? <TimelineRenderer  entries={activeWidget.entries} color={activeWidget.color} />
            : activeWidget.renderType === 'nexus'        ? <NexusView         entries={activeWidget.entries} />
            : <GenericList entries={activeWidget.entries} color={activeWidget.color} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
