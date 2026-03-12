import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNebulaStore } from '@/store/nebulaStore';

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function NebulaChatHistory() {
  const { chatHistory, isThinking, activeFragment, pendingConfirmation } = useNebulaStore();
  const innerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message or thinking state change
  useEffect(() => {
    const el = innerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatHistory.length, isThinking]);

  // Only in pure chat mode
  if (activeFragment || pendingConfirmation || chatHistory.length === 0) return null;

  return (
    <div className="nch-root">
      <div className="nch-inner" ref={innerRef}>
        <AnimatePresence initial={false}>
          {chatHistory.map((msg) => (
            <motion.div
              key={msg.timestamp}
              className={`nch-row nch-row--${msg.role}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32, ease }}
            >
              {msg.role === 'user' ? (
                <span className="nch-bubble-user">{msg.content}</span>
              ) : (
                <span className="nch-bubble-ai">{msg.content}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        {isThinking && (
          <motion.div
            className="nch-row nch-row--assistant"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease }}
          >
            <span className="nch-dots">
              <span /><span /><span />
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
