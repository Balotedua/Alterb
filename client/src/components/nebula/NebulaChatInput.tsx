import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send } from 'lucide-react';
import { orchestrate } from '../../core/orchestrator';
import { saveEntry } from '../../vault/vaultService';
import { buildStar, getCategoryMeta } from '../starfield/StarfieldView';
import { useAlterStore } from '../../store/alterStore';

// ─── Rotating hints ────────────────────────────────────────────
const HINTS = [
  'Ho speso 15€ per pizza...',
  'Dormito 7 ore...',
  'Peso 82 kg...',
  'Umore 8 oggi...',
  'Corsa 5km...',
  'Il gatto ha mangiato...',
  'Guadagnato 1200€...',
  '? per scoprire le funzioni...',
  'Ho iniziato a leggere Dune...',
  'Acqua 1.5 litri...',
  'Mi sento stressato oggi...',
  '50€ abbonamento palestra...',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

export default function NebulaChatInput() {
  const [input,     setInput]     = useState('');
  const [hintIdx,   setHintIdx]   = useState(0);
  const [listening, setListening] = useState(false);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [showPulse, setShowPulse] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    user, isProcessing, setProcessing,
    upsertStar, addKnownCategory, knownCategories,
    setFocusMode, focusMode, addMessage,
  } = useAlterStore();

  // ── Rotate hints ──────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setHintIdx(i => (i + 1) % HINTS.length), 3200);
    return () => clearInterval(t);
  }, []);

  // ── Process input ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing || !user) return;

    setInput('');
    addMessage('user', text);
    setProcessing(true);
    setLastReply(null);
    setShowPulse(true);
    setTimeout(() => setShowPulse(false), 1000);

    try {
      const action = await orchestrate(text, knownCategories);

      if (action.type === 'help') {
        setFocusMode(!focusMode);
        const msg = focusMode ? 'Modalità focus disattivata.' : 'Le stelle si illuminano — tocca per esplorarle.';
        setLastReply(msg);
        addMessage('nebula', msg);

      } else if (action.type === 'save') {
        const { intent } = action;
        const saved = await saveEntry(user.id, intent.category, intent.data);

        if (saved) {
          addKnownCategory(intent.category);

          if (intent.source === 'ai' && intent.categoryMeta) {
            const { CATEGORY_META } = await import('../starfield/StarfieldView');
            if (!CATEGORY_META[intent.category]) {
              CATEGORY_META[intent.category] = intent.categoryMeta;
            }
          }

          const star = buildStar(intent.category, 1, saved.created_at);
          const existing = useAlterStore.getState().stars.find(s => s.id === intent.category);
          upsertStar({
            ...star,
            entryCount: (existing?.entryCount ?? 0) + 1,
            intensity:  Math.min(1, (existing?.intensity ?? 0) + 0.12),
            isNew:      !existing,
          });

          const meta  = getCategoryMeta(intent.category);
          const src   = intent.source === 'local' ? '' : ' · AI';
          const reply = `${meta.icon}  ${meta.label}${src}`;
          setLastReply(reply);
          addMessage('nebula', reply);
        } else {
          const msg = 'Errore nel salvataggio. Riprova.';
          setLastReply(msg);
          addMessage('nebula', msg);
        }

      } else if (action.type === 'delete') {
        const msg = 'Apri la stella · usa ✕ sulla voce.';
        setLastReply(msg);
        addMessage('nebula', msg);

      } else if (action.type === 'analyse') {
        const msg = 'Analisi AI — presto disponibile.';
        setLastReply(msg);
        addMessage('nebula', msg);

      } else {
        const msg = '"15 pizza"  ·  "peso 80kg"  ·  "dormito 7 ore"';
        setLastReply(msg);
        addMessage('nebula', msg);
      }
    } finally {
      setProcessing(false);
    }
  }, [input, isProcessing, user, knownCategories, focusMode, upsertStar, addKnownCategory, setFocusMode, setProcessing, addMessage]);

  // ── Voice input ────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: AnySpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { setListening(false); return; }

    const rec = new SR();
    rec.lang  = 'it-IT';
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      setInput(e.results[0][0].transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const accentColor = isProcessing ? '#f0c040' : listening ? '#f87171' : '#40e0d0';
  const hasInput    = input.trim().length > 0;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 16px 44px',
      zIndex: 200,
      pointerEvents: 'none',
    }}>
      {/* Nebula reply */}
      <AnimatePresence>
        {lastReply && (
          <motion.div
            key={lastReply}
            initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(8px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              marginBottom: 18,
              fontSize: 11,
              color: 'rgba(180, 192, 230, 0.5)',
              letterSpacing: '0.07em',
              maxWidth: 320,
              textAlign: 'center',
              pointerEvents: 'none',
              lineHeight: 1.7,
              fontWeight: 300,
            }}
          >
            {lastReply}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating pill — continuous hover animation */}
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', pointerEvents: 'all' }}
      >
        {/* Submit pulse ring */}
        <AnimatePresence>
          {showPulse && (
            <motion.div
              key="pulse"
              initial={{ scale: 1, opacity: 0.65 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{}}
              transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                inset: -1,
                borderRadius: 999,
                border: `1px solid ${accentColor}`,
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* Second pulse ring (delayed) */}
        <AnimatePresence>
          {showPulse && (
            <motion.div
              key="pulse2"
              initial={{ scale: 1, opacity: 0.35 }}
              animate={{ scale: 3.2, opacity: 0 }}
              exit={{}}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
              style={{
                position: 'absolute',
                inset: -1,
                borderRadius: 999,
                border: `1px solid ${accentColor}`,
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* Gradient border wrapper */}
        <div style={{
          background: hasInput
            ? `linear-gradient(135deg, ${accentColor}55 0%, rgba(167,139,250,0.35) 50%, ${accentColor}45 100%)`
            : 'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)',
          borderRadius: 999,
          padding: '1px',
          transition: 'background 0.5s ease',
          boxShadow: hasInput
            ? `0 0 36px ${accentColor}15, 0 12px 40px rgba(0,0,0,0.5)`
            : '0 10px 40px rgba(0,0,0,0.45)',
        }}>
          {/* Inner pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: 'min(520px, 94vw)',
            padding: '12px 16px',
            background: 'rgba(3,3,7,0.98)',
            borderRadius: 999,
            backdropFilter: 'blur(32px)',
          }}>

            {/* Status dot */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: isProcessing ? '#f0c040' : listening ? '#f87171' : 'rgba(255,255,255,0.1)',
              boxShadow: isProcessing
                ? '0 0 8px #f0c040, 0 0 20px rgba(240,192,64,0.45)'
                : listening
                  ? '0 0 8px #f87171, 0 0 16px rgba(248,113,113,0.35)'
                  : 'none',
              transition: 'all 0.35s',
            }} />

            {/* Text input */}
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#dde6f8',
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 300,
                  letterSpacing: '0.025em',
                  caretColor: accentColor,
                }}
              />
              {/* Animated placeholder */}
              {!input && (
                <AnimatePresence mode="wait">
                  <motion.span
                    key={hintIdx}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 0.22, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      position: 'absolute', left: 0, top: 0,
                      pointerEvents: 'none',
                      color: '#6b7280',
                      fontSize: 14,
                      fontWeight: 300,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {HINTS[hintIdx]}
                  </motion.span>
                </AnimatePresence>
              )}
            </div>

            {/* Voice button */}
            <button
              onClick={toggleVoice}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: listening ? '#f87171' : 'rgba(255,255,255,0.16)',
                padding: 4, display: 'flex', alignItems: 'center',
                transition: 'color 0.25s',
              }}
            >
              {listening ? <MicOff size={13} /> : <Mic size={13} />}
            </button>

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !hasInput}
              style={{
                background: hasInput ? 'rgba(64,224,208,0.07)' : 'transparent',
                border: 'none',
                cursor: hasInput ? 'pointer' : 'default',
                color: hasInput ? '#40e0d0' : 'rgba(255,255,255,0.1)',
                padding: '4px 5px',
                display: 'flex', alignItems: 'center',
                borderRadius: 6,
                transition: 'all 0.25s',
              }}
            >
              <Send size={13} />
            </button>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
