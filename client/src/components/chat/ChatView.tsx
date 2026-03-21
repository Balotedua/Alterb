import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';

export default function ChatView() {
  const { messages } = useAlterStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <motion.div
      key="chat-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed', inset: 0,
        background: '#050508',
        overflowY: 'auto',
        paddingBottom: 'calc(56px + 80px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 24,
      }}
    >
      <div style={{
        maxWidth: 560, margin: '0 auto',
        padding: '0 16px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>

        {messages.length === 0 ? (
          <div style={{
            marginTop: '30vh',
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          }}>
            <div style={{ fontSize: 36, opacity: 0.6 }}>✦</div>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: 300, lineHeight: 1.7, margin: 0 }}>
              Ciao. Scrivi qualcosa o usa la voce.
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em', margin: 0, lineHeight: 1.8 }}>
              "15 pizza" · "peso 82kg"<br />
              "umore 8" · "riunione lunedì 15:00"
            </p>
          </div>
        ) : messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} style={{
              display: 'flex',
              justifyContent: isUser ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isUser
                  ? 'rgba(240,192,64,0.10)'
                  : 'rgba(255,255,255,0.05)',
                border: isUser
                  ? '1px solid rgba(240,192,64,0.18)'
                  : '1px solid rgba(255,255,255,0.07)',
                fontSize: 14,
                fontWeight: 300,
                color: isUser ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.72)',
                lineHeight: 1.55,
                letterSpacing: '0.01em',
              }}>
                {!isUser && (
                  <div style={{
                    fontSize: 9, letterSpacing: '0.12em',
                    color: '#a78bfa', marginBottom: 4, fontWeight: 600,
                  }}>
                    ALTER
                  </div>
                )}
                {msg.text}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>
    </motion.div>
  );
}
