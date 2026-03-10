import { motion } from 'framer-motion';
import { useNebulaStore } from '@/store/nebulaStore';
import { haptics } from '@/utils/haptics';

const anim = {
  initial:    { opacity: 0, scale: 0.88, y: 24 },
  animate:    { opacity: 1, scale: 1,    y: 0  },
  exit:       { opacity: 0, scale: 0.88, y: 24 },
  transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

export function NebulaConfirmCard() {
  const {
    pendingConfirmation,
    setConfirmation,
    setIntent,
    setFragment,
    addMessage,
    triggerResponseBurst,
  } = useNebulaStore();

  if (!pendingConfirmation) return null;

  const {
    question,
    confirmLabel = 'Conferma',
    cancelLabel  = 'Annulla',
    fragment,
    params,
    responseType,
    intent,
    intensity,
  } = pendingConfirmation;

  function handleConfirm() {
    setConfirmation(null);
    setIntent(intent, intensity, '');
    setFragment(fragment, params, responseType);
    haptics.fragment();
    triggerResponseBurst();
  }

  function handleCancel() {
    setConfirmation(null);
    const msg = 'Ok, azione annullata.';
    setIntent('IDLE', 0.2, msg);
    setFragment(null, {}, 'TALK');
    addMessage('assistant', msg);
    triggerResponseBurst();
  }

  return (
    <motion.div className="nebula-confirm-card" {...anim}>
      <p className="nebula-confirm-question">{question}</p>
      <div className="nebula-confirm-actions">
        <button className="nebula-confirm-btn nebula-confirm-btn--cancel" onClick={handleCancel}>
          {cancelLabel}
        </button>
        <button className="nebula-confirm-btn nebula-confirm-btn--confirm" onClick={handleConfirm}>
          {confirmLabel}
        </button>
      </div>
    </motion.div>
  );
}
