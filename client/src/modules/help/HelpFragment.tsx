import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useNebulaStore } from '@/store/nebulaStore';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  icon: string;
  glow: string;
  available: boolean;
  mainFragment?: string;
  mainFragmentParams?: Record<string, unknown>;
  manualFragment?: string;
}

// ── Data ───────────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'finance',
    label: 'Finanze',
    icon: '💰',
    glow: '#f59e0b',
    available: true,
    mainFragment: 'FinancePanorama',
    mainFragmentParams: {},
    manualFragment: 'FinanceManual',
  },
  {
    id: 'workout',
    label: 'Salute',
    icon: '💪',
    glow: '#10b981',
    available: true,
    mainFragment: 'HealthWorkout',
    mainFragmentParams: {},
    manualFragment: 'WorkoutManual',
  },
  {
    id: 'psych',
    label: 'Mente',
    icon: '🧠',
    glow: '#8b5cf6',
    available: false,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    glow: '#94a3b8',
    available: true,
    mainFragment: 'Settings',
    mainFragmentParams: {},
  },
  {
    id: 'consciousness',
    label: 'Coscienza',
    icon: '📓',
    glow: '#06b6d4',
    available: true,
    mainFragment: 'ConsciousnessInbox',
    mainFragmentParams: {},
    manualFragment: 'ConsciousnessManual',
  },
  {
    id: 'routine',
    label: 'Routine',
    icon: '📅',
    glow: '#f97316',
    available: false,
    mainFragment: 'Routine',
    mainFragmentParams: {},
  },
  {
    id: 'news',
    label: 'News',
    icon: '📰',
    glow: '#3b82f6',
    available: false,
  },
  {
    id: 'career',
    label: 'Carriera',
    icon: '💼',
    glow: '#f43f5e',
    available: false,
  },
  {
    id: 'badges',
    label: 'Badge',
    icon: '🏆',
    glow: '#eab308',
    available: false,
  },
  {
    id: 'bug',
    label: 'Segnala',
    icon: '⚠️',
    glow: '#f87171',
    available: true,
    mainFragment: 'BugReport',
    mainFragmentParams: {},
  },
  {
    id: 'admin',
    label: 'Sviluppatore',
    icon: '🔐',
    glow: '#c4b5fd',
    available: true,
    mainFragment: 'Admin',
    mainFragmentParams: {},
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function HelpFragment(_: { params?: Record<string, unknown> }) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const { openFromReturn } = useNebulaStore();

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleOpen(section: Section) {
    if (!section.available || !section.mainFragment) return;
    openFromReturn(section.mainFragment, section.mainFragmentParams ?? {}, 'Help');
  }

  function handleManual(section: Section) {
    if (!section.manualFragment) return;
    openFromReturn(section.manualFragment, {}, 'Help');
  }

  return (
    <NebulaCard title="Cosa sa fare Nebula" variant="default" closable>
      <div className="help-sections">
        {SECTIONS.map((section) => {
          const isOpen = openSections.has(section.id);
          return (
            <div key={section.id} className="help-section">
              {/* Toggle header */}
              <button
                className={['help-section-toggle', isOpen ? 'help-section-toggle--open' : ''].filter(Boolean).join(' ')}
                style={{ '--s-glow': section.glow } as React.CSSProperties}
                onClick={() => toggleSection(section.id)}
              >
                <span className="help-section-icon">{section.icon}</span>
                <span className="help-section-name">{section.label}</span>
                {!section.available && <span className="help-section-soon">presto</span>}
                <span className={['help-section-arrow', isOpen ? 'help-section-arrow--open' : ''].filter(Boolean).join(' ')}>›</span>
              </button>

              {/* Expanded: 2 actions */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="actions"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="help-action-list">
                      {/* Primary: open panel */}
                      <button
                        className={['help-action-item', 'help-action-item--panel', !section.available || !section.mainFragment ? 'help-action-item--disabled' : ''].filter(Boolean).join(' ')}
                        style={{ '--s-glow': section.glow } as React.CSSProperties}
                        onClick={() => handleOpen(section)}
                        disabled={!section.available || !section.mainFragment}
                      >
                        <span className="help-action-icon">⊞</span>
                        <span className="help-action-label">Sezione {section.label}</span>
                        <span className="help-action-go">→</span>
                      </button>

                      {/* Secondary: open manual (only if defined) */}
                      {section.manualFragment && (
                        <button
                          className="help-action-item help-action-item--manual"
                          onClick={() => handleManual(section)}
                        >
                          <span className="help-action-icon">📖</span>
                          <span className="help-action-label">Spiegami sezione {section.label}</span>
                          <span className="help-action-go">→</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </NebulaCard>
  );
}
