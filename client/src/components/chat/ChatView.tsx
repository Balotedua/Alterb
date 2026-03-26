import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import ChatReportModal from './ChatReportModal';
import CalibrationForm from './CalibrationForm';

// Minimal markdown renderer: bold, italic, headers, bullet lists, line breaks
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    // Header
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) return <div key={li} style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', marginTop: 8, marginBottom: 2 }}>{parseInline(h3[1])}</div>;
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) return <div key={li} style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginTop: 10, marginBottom: 2 }}>{parseInline(h2[1])}</div>;
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) return <div key={li} style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', marginTop: 12, marginBottom: 4 }}>{parseInline(h1[1])}</div>;
    // Bullet list
    const bullet = line.match(/^[\*\-]\s+(.*)/);
    if (bullet) return <div key={li} style={{ display: 'flex', gap: 6, marginTop: 2 }}><span style={{ color: 'rgba(167,139,250,0.7)', flexShrink: 0 }}>·</span><span>{parseInline(bullet[1])}</span></div>;
    // Empty line → spacer
    if (line.trim() === '') return <div key={li} style={{ height: 6 }} />;
    // Normal line
    return <div key={li}>{parseInline(line)}</div>;
  });
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<span key={m.index}>{m[2]}</span>);
    else if (m[3] !== undefined) parts.push(<em key={m.index} style={{ fontStyle: 'italic' }}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Blinking cursor appended to streaming text
function StreamingCursor() {
  return (
    <span style={{
      display: 'inline-block', width: 2, height: '0.85em',
      background: 'rgba(167,139,250,0.7)',
      borderRadius: 1, marginLeft: 2, verticalAlign: 'text-bottom',
      animation: 'blink-cursor 0.9s step-end infinite',
    }} />
  );
}

export default function ChatView() {
  const { messages, streamingMessage, showCalibration } = useAlterStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx]     = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx]   = useState<number | null>(null);
  const [showReport, setShowReport]   = useState(false);

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

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
        background: 'var(--bg)',
        overflowY: 'auto',
        paddingBottom: 'calc(56px + 80px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 'calc(52px + env(safe-area-inset-top, 0px))',
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
          const isCopied = copiedIdx === i;
          const isHovered = hoveredIdx === i;
          return (
            <div key={i} style={{
              display: 'flex',
              justifyContent: isUser ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end',
              gap: 6,
            }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isUser && (
                <button
                  onClick={() => copyMessage(msg.text, i)}
                  title="Copia messaggio"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', borderRadius: 6, flexShrink: 0,
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    color: isCopied ? '#40e0d0' : 'rgba(255,255,255,0.35)',
                    display: 'flex', alignItems: 'center',
                    marginBottom: 2,
                  }}
                >
                  {isCopied
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  }
                </button>
              )}
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
                color: isUser ? 'var(--text)' : 'var(--text-dim)',
                lineHeight: 1.55,
                letterSpacing: '0.01em',
                userSelect: 'text',
                cursor: 'text',
              }}>
                {!isUser && (
                  <div style={{
                    fontSize: 9, letterSpacing: '0.12em',
                    color: '#a78bfa', marginBottom: 4, fontWeight: 600,
                  }}>
                    ALTER
                  </div>
                )}
                {isUser ? msg.text : renderMarkdown(msg.text)}
              </div>
              {!isUser && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                  <button
                    onClick={() => copyMessage(msg.text, i)}
                    title="Copia messaggio"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '4px', borderRadius: 6, flexShrink: 0,
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.2s ease',
                      color: isCopied ? '#40e0d0' : 'rgba(255,255,255,0.35)',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    {isCopied
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    }
                  </button>
                  <button
                    onClick={() => setShowReport(true)}
                    title="Segnala risposta imprecisa"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '4px', borderRadius: 6, flexShrink: 0,
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.2s ease',
                      color: 'rgba(240,192,64,0.45)',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming bubble — live text while waiting for full response */}
        {streamingMessage && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 6 }}>
            <div style={{
              maxWidth: '78%',
              padding: '10px 14px',
              borderRadius: '18px 18px 18px 4px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(167,139,250,0.18)',
              fontSize: 14,
              fontWeight: 300,
              color: 'var(--text-dim)',
              lineHeight: 1.55,
              letterSpacing: '0.01em',
            }}>
              <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#a78bfa', marginBottom: 4, fontWeight: 600 }}>
                ALTER
              </div>
              {renderMarkdown(streamingMessage)}
              <StreamingCursor />
            </div>
          </div>
        )}

        <style>{`@keyframes blink-cursor { 0%,100% { opacity: 1 } 50% { opacity: 0 } }`}</style>
        <div ref={bottomRef} />
      </div>

      <AnimatePresence>
        {showCalibration && <CalibrationForm />}
      </AnimatePresence>

      <AnimatePresence>
        {showReport && <ChatReportModal onClose={() => setShowReport(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
