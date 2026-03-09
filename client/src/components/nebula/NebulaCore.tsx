import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNebulaStore } from '@/store/nebulaStore';
import { NebulaEntity }    from './NebulaEntity';
import { NebulaChatInput } from './NebulaChatInput';
import { FRAGMENT_REGISTRY } from '@/modules/fragmentRegistry';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import './nebula.css';

/** Tracks how many px the virtual keyboard has pushed the viewport up. */
function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const o = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setOffset(o);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return offset;
}

function ActiveFragment() {
  const { activeFragment, fragmentParams } = useNebulaStore();

  if (!activeFragment) return null;

  const Component = FRAGMENT_REGISTRY[activeFragment];
  if (!Component) {
    console.warn(`Fragment "${activeFragment}" not found in registry`);
    return null;
  }

  // Determine variant based on fragment name
  let variant: 'finance' | 'health' | 'psychology' | 'default' = 'default';
  if (activeFragment.toLowerCase().includes('finance')) variant = 'finance';
  else if (activeFragment.toLowerCase().includes('health')) variant = 'health';
  else if (activeFragment.toLowerCase().includes('psych')) variant = 'psychology';

  return (
    <NebulaCard 
      title={activeFragment.replace(/([A-Z])/g, ' $1').trim()} 
      variant={variant}
      closable={true}
    >
      <Component params={fragmentParams} />
    </NebulaCard>
  );
}

export function NebulaCore() {
  const { activeFragment } = useNebulaStore();
  const kbOffset = useKeyboardOffset();
  const kbOpen   = kbOffset > 80;

  return (
    <div
      className={[
        'nebula-core',
        kbOpen          ? 'nebula-core--kb'       : '',
        activeFragment  ? 'nebula-core--fragment'  : '',
      ].filter(Boolean).join(' ')}
      style={{ '--kb-offset': `${kbOffset}px` } as React.CSSProperties}
    >
      <div className="nb-orb nb-orb--1" />
      <div className="nb-orb nb-orb--2" />

      <div className="nb-entity-wrapper">
        <NebulaEntity />
      </div>

      <div className="nb-fragment-area">
        <AnimatePresence mode="wait">
          <ActiveFragment key={activeFragment ?? 'none'} />
        </AnimatePresence>
      </div>

      <NebulaChatInput />
    </div>
  );
}
