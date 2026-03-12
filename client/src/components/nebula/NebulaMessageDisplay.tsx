import { motion, AnimatePresence } from 'framer-motion';
import { useNebulaStore } from '@/store/nebulaStore';

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function NebulaMessageDisplay() {
  const { chatHistory, isThinking, activeFragment, pendingConfirmation } = useNebulaStore();

  // Non mostrare durante fragment/confirmation
  if (activeFragment || pendingConfirmation) return null;
  // Niente da mostrare se history vuota
  if (chatHistory.length === 0) return null;

  const lastMsg = chatHistory[chatHistory.length - 1];
  const showDots = isThinking || lastMsg.role === 'user';
  const aiText = !showDots && lastMsg.role === 'assistant' ? lastMsg.content : null;

  return (
    <div className="nmd-root">
      <AnimatePresence mode="wait">
        {showDots ? (
          <motion.div
            key="dots"
            className="nmd-dots"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.3, ease }}
          >
            <span /><span /><span />
          </motion.div>
        ) : aiText ? (
          <motion.p
            key={lastMsg.timestamp}
            className="nmd-ai-text"
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.55, ease }}
          >
            {aiText}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
