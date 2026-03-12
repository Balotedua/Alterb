import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNebulaStore } from '@/store/nebulaStore';
import { NebulaEntity }          from './NebulaEntity';
import { NebulaChatInput }       from './NebulaChatInput';
import { NebulaConfirmCard }     from './NebulaConfirmCard';
import { FragmentErrorBoundary } from './FragmentErrorBoundary';
import { BugReportButton }       from './BugReportButton';
import { NebulaWelcome }         from './NebulaWelcome';
import { NebulaMessageDisplay }  from './NebulaMessageDisplay';
import { FRAGMENT_REGISTRY }     from '@/modules/fragmentRegistry';
import './nebula.css';

interface VVState { height: number; offsetTop: number }

/**
 * Tracks the visual viewport (what's actually visible, excluding the keyboard).
 * We size .nebula-core directly to the visual viewport so the chat input
 * at bottom:2rem is always above the keyboard — no CSS variable tricks needed.
 */
function useVisualViewport(): VVState & { kbOpen: boolean } {
  const snap = (): VVState => {
    const vv = window.visualViewport;
    return vv
      ? { height: vv.height, offsetTop: Math.max(0, vv.offsetTop) }
      : { height: window.innerHeight, offsetTop: 0 };
  };

  const [state, setState] = useState<VVState>(snap);

  useEffect(() => {
    const update = () => setState(snap());
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    // Fallback: window resize fires on Android even when visualViewport doesn't
    window.addEventListener('resize', update);
    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
    };
  }, []);

  // Keyboard open = visual viewport is significantly shorter than the inner height
  const kbOpen = window.innerHeight - state.height > 80;

  return { ...state, kbOpen };
}

function ActiveFragment() {
  const { activeFragment, fragmentParams } = useNebulaStore();

  if (!activeFragment) return null;

  const Component = FRAGMENT_REGISTRY[activeFragment];
  if (!Component) {
    console.warn(`[Nebula] Fragment "${activeFragment}" not found in registry`);
    return null;
  }

  return (
    <FragmentErrorBoundary key={activeFragment}>
      <Component params={fragmentParams} />
    </FragmentErrorBoundary>
  );
}

export function NebulaCore() {
  const { activeFragment, pendingConfirmation, clearFragment, nebulaTheme } = useNebulaStore();
  const { height: vvHeight, offsetTop: vvTop, kbOpen } = useVisualViewport();

  const hasContent = !!(activeFragment || pendingConfirmation);

  return (
    <div
      className={[
        'nebula-core',
        kbOpen     ? 'nebula-core--kb'      : '',
        hasContent ? 'nebula-core--fragment' : '',
      ].filter(Boolean).join(' ')}
      data-nb-theme={nebulaTheme}
      style={{
        // Pin the container exactly to the visual viewport.
        // When the keyboard opens, height shrinks and the input at bottom:2rem
        // is naturally above the keyboard — no offset hacks required.
        top:    `${vvTop}px`,
        height: `${vvHeight}px`,
        bottom: 'auto',
        transform: 'translateZ(0)',
      } as React.CSSProperties}
    >
      <div className="nb-orb nb-orb--1" />
      <div className="nb-orb nb-orb--2" />

      <div className="nb-entity-wrapper">
        <NebulaEntity />
      </div>

      {activeFragment && !pendingConfirmation && (
        <div className="nb-backdrop" onClick={clearFragment} />
      )}

      <div className="nb-fragment-area">
        <AnimatePresence mode="wait">
          {pendingConfirmation ? (
            <NebulaConfirmCard key="confirm" />
          ) : (
            <ActiveFragment key={activeFragment ?? 'none'} />
          )}
        </AnimatePresence>
      </div>

      <NebulaWelcome />
      <NebulaMessageDisplay />
      <NebulaChatInput />
      <BugReportButton />
    </div>
  );
}
