import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send } from 'lucide-react';
import { orchestrate } from '../../core/orchestrator';
import { saveEntry } from '../../vault/vaultService';
import { buildStar, getCategoryMeta } from '../starfield/StarfieldView';
import { useAlterStore } from '../../store/alterStore';

// ─── Rotating placeholder hints ───────────────────────────────
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

// ─── Web Speech API types ─────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

export default function NebulaChatInput() {
  const [input,       setInput]       = useState('');
  const [hintIdx,     setHintIdx]     = useState(0);
  const [listening,   setListening]   = useState(false);
  const [lastReply,   setLastReply]   = useState<string | null>(null);
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
          // Register category
          addKnownCategory(intent.category);

          // Store category meta if from AI
          if (intent.source === 'ai' && intent.categoryMeta) {
            // Patch getCategoryMeta cache (runtime override)
            const { CATEGORY_META } = await import('../starfield/StarfieldView');
            if (!CATEGORY_META[intent.category]) {
              CATEGORY_META[intent.category] = intent.categoryMeta;
            }
          }

          // Build/update star
          const star = buildStar(intent.category, 1, saved.created_at);
          const existing = useAlterStore.getState().stars.find(s => s.id === intent.category);
          upsertStar({
            ...star,
            entryCount: (existing?.entryCount ?? 0) + 1,
            intensity:  Math.min(1, (existing?.intensity ?? 0) + 0.12),
            isNew:      !existing,
          });

          const meta    = getCategoryMeta(intent.category);
          const src     = intent.source === 'local' ? '' : ' (AI)';
          const reply   = `${meta.icon} Salvato in ${meta.label}${src}. Tocca la stella per vedere i dati.`;
          setLastReply(reply);
          addMessage('nebula', reply);
        } else {
          const msg = 'Errore nel salvataggio. Riprova.';
          setLastReply(msg);
          addMessage('nebula', msg);
        }

      } else if (action.type === 'delete') {
        const msg = 'Per eliminare, apri la stella e usa ✕ sulla voce.';
        setLastReply(msg);
        addMessage('nebula', msg);

      } else if (action.type === 'analyse') {
        const msg = 'Analisi in arrivo — funzione AI avanzata (presto disponibile).';
        setLastReply(msg);
        addMessage('nebula', msg);

      } else {
        const msg = 'Non ho capito. Prova: "15 pizza", "peso 80kg", "dormito 7 ore".';
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

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 16px 28px',
      zIndex: 200,
      pointerEvents: 'none',
    }}>
      {/* Nebula reply */}
      <AnimatePresence>
        {lastReply && (
          <motion.div
            key={lastReply}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              marginBottom: 10,
              fontSize: 12,
              color: 'rgba(204, 214, 246, 0.75)',
              letterSpacing: '0.03em',
              maxWidth: 360,
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {lastReply}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: 'min(480px, 96vw)',
        padding: '10px 14px',
        background: 'rgba(12,12,20,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 999,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        pointerEvents: 'all',
      }}>
        {/* Listening indicator */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isProcessing ? '#f0c040' : listening ? '#f87171' : 'rgba(255,255,255,0.15)',
          flexShrink: 0,
          boxShadow: isProcessing ? '0 0 8px #f0c040' : listening ? '0 0 8px #f87171' : 'none',
          transition: 'all 0.3s',
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
              color: '#ccd6f6',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 300,
              letterSpacing: '0.02em',
            }}
          />
          {/* Animated placeholder */}
          {!input && (
            <AnimatePresence mode="wait">
              <motion.span
                key={hintIdx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 0.35, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.4 }}
                style={{
                  position: 'absolute', left: 0, top: 0,
                  pointerEvents: 'none',
                  color: '#8892b0',
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
            color: listening ? '#f87171' : '#8892b0',
            padding: 4, display: 'flex', alignItems: 'center',
            transition: 'color 0.2s',
          }}
        >
          {listening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={isProcessing || !input.trim()}
          style={{
            background: input.trim() ? 'rgba(240,192,64,0.15)' : 'transparent',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            color: input.trim() ? '#f0c040' : '#8892b0',
            padding: 4, display: 'flex', alignItems: 'center',
            borderRadius: 6,
            transition: 'all 0.2s',
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
