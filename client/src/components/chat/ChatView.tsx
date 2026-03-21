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
            <div style={{ filter: 'drop-shadow(0 0 18px rgba(240,192,64,0.18))', marginBottom: 8 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ display: 'block' }}>
                <style>{`
                  @keyframes cv-spin-outer {
                    0%   { transform: rotate(0deg); }
                    55%  { transform: rotate(290deg); }
                    65%  { transform: rotate(265deg); }
                    75%  { transform: rotate(278deg); }
                    88%  { transform: rotate(355deg); }
                    93%  { transform: rotate(340deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes cv-spin-inner {
                    0%   { transform: rotate(0deg); }
                    40%  { transform: rotate(-180deg); }
                    52%  { transform: rotate(-155deg); }
                    62%  { transform: rotate(-175deg); }
                    100% { transform: rotate(-360deg); }
                  }
                  @keyframes cv-pulse-dot {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50%       { opacity: 0.9; transform: scale(1.6); }
                  }
                  .cv-arc-outer {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: cv-spin-outer 5.2s ease-in-out infinite;
                  }
                  .cv-arc-inner {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: cv-spin-inner 7.5s ease-in-out infinite;
                  }
                  .cv-dot-pulse {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: cv-pulse-dot 2.8s ease-in-out infinite;
                  }
                `}</style>
                {/* static tracks */}
                <circle cx="36" cy="36" r="30" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5"/>
                <circle cx="36" cy="36" r="19" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                {/* outer arc */}
                <circle
                  cx="36" cy="36" r="30"
                  stroke="url(#cvGrad)" strokeWidth="1.5"
                  strokeDasharray="188.4" strokeDashoffset="47"
                  strokeLinecap="round"
                  className="cv-arc-outer"
                />
                {/* inner arc */}
                <circle
                  cx="36" cy="36" r="19"
                  stroke="#a78bfa" strokeWidth="1"
                  strokeDasharray="119.4" strokeDashoffset="89"
                  strokeLinecap="round"
                  className="cv-arc-inner"
                />
                {/* center pulse */}
                <circle
                  cx="36" cy="36" r="3"
                  fill="rgba(240,192,64,0.65)"
                  className="cv-dot-pulse"
                />
                <defs>
                  <linearGradient id="cvGrad" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f0c040"/>
                    <stop offset="100%" stopColor="#40e0d0"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 100, letterSpacing: '0.03em', color: 'rgba(200,210,234,0.58)', margin: '4px 0 0' }}>
              Di cosa vuoi tenere traccia?
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.16)', letterSpacing: '0.14em', textTransform: 'uppercase', margin: 0, lineHeight: 2.2 }}>
              "15 pizza" · "peso 82kg" · "umore 8"
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
