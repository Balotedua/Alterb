import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNebulaStore } from '@/store/nebulaStore';
import { NebulaEntity } from './NebulaEntity';
import { NebulaChatInput } from './NebulaChatInput';
import { FinanceFragment } from '@/components/fragments/FinanceFragment';
import { HealthFragment } from '@/components/fragments/HealthFragment';
import { PsychologyFragment } from '@/components/fragments/PsychologyFragment';
import { ConsciousnessFragment } from '@/components/fragments/ConsciousnessFragment';

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
  const { intent } = useNebulaStore();
  switch (intent) {
    case 'FINANCE':       return <FinanceFragment />;
    case 'HEALTH':        return <HealthFragment />;
    case 'PSYCHOLOGY':    return <PsychologyFragment />;
    case 'CONSCIOUSNESS': return <ConsciousnessFragment />;
    default:              return null;
  }
}

export function NebulaCore() {
  const { intent } = useNebulaStore();
  const kbOffset  = useKeyboardOffset();
  const kbOpen    = kbOffset > 80;

  return (
    <div
      className={[
        'nebula-core',
        kbOpen          ? 'nebula-core--kb'       : '',
        intent !== 'IDLE' ? 'nebula-core--fragment' : '',
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
          <ActiveFragment key={intent} />
        </AnimatePresence>
      </div>

      <NebulaChatInput />
    </div>
  );
}
