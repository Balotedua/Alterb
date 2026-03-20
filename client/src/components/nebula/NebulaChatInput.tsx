import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { orchestrate } from '../../core/orchestrator';
import { saveEntry, getByCategory, queryCalendarByDate, getRecentAll } from '../../vault/vaultService';
import { aiQuery, analyzeGalaxy } from '../../core/aiParser';
import { buildStar, getCategoryMeta, starPosition } from '../starfield/StarfieldView';
import { useAlterStore } from '../../store/alterStore';

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

interface Ray { angle: number; length: number; color: string }

export default function NebulaCore() {
  const [input,        setInput]        = useState('');
  const [hintIdx,      setHintIdx]      = useState(0);
  const [listening,    setListening]    = useState(false);
  const [lastReply,    setLastReply]    = useState<string | null>(null);
  const [isActive,     setIsActive]     = useState(false);
  const [showShockwave, setShowShockwave] = useState(false);
  const [ray,          setRay]          = useState<Ray | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    user, isProcessing, setProcessing,
    upsertStar, addKnownCategory, knownCategories,
    setFocusMode, focusMode, addMessage, activeWidget,
    setHighlightedStar, setActiveWidget,
  } = useAlterStore();

  // ── Rotate hints ──────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setHintIdx(i => (i + 1) % HINTS.length), 3200);
    return () => clearInterval(t);
  }, []);

  // ── Focus input when core opens ────────────────────────────
  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => inputRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  // ── Process input ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing || !user) return;

    setInput('');
    setIsActive(false);
    addMessage('user', text);
    setProcessing(true);
    setLastReply(null);
    setShowShockwave(true);
    setTimeout(() => setShowShockwave(false), 1200);

    try {
      const action = await orchestrate(text, knownCategories);

      if (action.type === 'help') {
        setFocusMode(!focusMode);
        const msg = focusMode ? 'Modalità focus disattivata.' : 'Le stelle si illuminano.';
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

          // ── Ray: center → star position ──
          const pos = starPosition(intent.category);
          const cx  = window.innerWidth  / 2;
          const cy  = window.innerHeight / 2;
          const tx  = pos.x * window.innerWidth;
          const ty  = pos.y * window.innerHeight;
          const dx  = tx - cx, dy = ty - cy;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle  = Math.atan2(dy, dx) * 180 / Math.PI;
          const meta   = getCategoryMeta(intent.category);
          setRay({ angle, length, color: meta.color });
          setTimeout(() => setRay(null), 900);

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
        const msg = 'Clicca sulla stella · usa ✕ sulla voce.';
        setLastReply(msg);
        addMessage('nebula', msg);

      } else if (action.type === 'query') {
        const { category, dateRange } = action;

        // Fetch relevant entries
        let entries = [];
        if (category === 'calendar' && dateRange) {
          entries = await queryCalendarByDate(user.id, dateRange[0], dateRange[1]);
        } else if (category) {
          entries = await getByCategory(user.id, category, 20);
        } else {
          entries = await getRecentAll(user.id, 20);
        }

        // Highlight the relevant star
        if (category) {
          setHighlightedStar(category);
          setTimeout(() => setHighlightedStar(null), 3500);
          // Also fire a ray toward that star
          const pos = starPosition(category);
          const cx  = window.innerWidth  / 2;
          const cy  = window.innerHeight / 2;
          const tx  = pos.x * window.innerWidth;
          const ty  = pos.y * window.innerHeight;
          const dx  = tx - cx, dy = ty - cy;
          const meta = getCategoryMeta(category);
          setRay({ angle: Math.atan2(dy, dx) * 180 / Math.PI, length: Math.sqrt(dx*dx+dy*dy), color: meta.color });
          setTimeout(() => setRay(null), 900);
        }

        // AI text answer
        const reply = await aiQuery(text, entries);
        setLastReply(reply.length > 80 ? reply.slice(0, 77) + '…' : reply);
        addMessage('nebula', reply);

        // Open widget if there are entries and it's a category query
        if (category && entries.length > 0) {
          const meta = getCategoryMeta(category);
          const { inferRenderType } = await import('../widget/PolymorphicWidget');
          setActiveWidget({
            category,
            label: meta.label,
            color: meta.color,
            entries,
            renderType: inferRenderType(entries, category),
          });
        }

      } else if (action.type === 'analyse') {
        const entries = await getRecentAll(user.id, 30);
        const insight = await analyzeGalaxy(entries);
        addMessage('nebula', insight);
        setLastReply('✦ Nebula Insight');
        // Show as a special insight widget (white central star)
        setActiveWidget({
          category: 'insight',
          label: 'Nebula Insight',
          color: '#ffffff',
          entries: [{ id: 'insight', user_id: user.id, category: 'insight', data: { insight }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
          renderType: 'insight',
        });

      } else {
        const msg = '"15 pizza"  ·  "peso 80kg"  ·  "dormito 7 ore"';
        setLastReply(msg);
        addMessage('nebula', msg);
      }
    } finally {
      setProcessing(false);
    }
  }, [input, isProcessing, user, knownCategories, focusMode, upsertStar, addKnownCategory, setFocusMode, setProcessing, addMessage, setHighlightedStar, setActiveWidget]);

  // ── Voice input ────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: AnySpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { setListening(false); return; }
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') setIsActive(false);
  };

  const accentColor = isProcessing ? '#f0c040' : listening ? '#f87171' : '#40e0d0';
  const inputW      = Math.min(360, window.innerWidth * 0.88);

  // Core is hidden when a widget is open
  if (activeWidget) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}>

      {/* ── Shockwave rings ── */}
      <AnimatePresence>
        {showShockwave && (
          <>
            <motion.div
              key="sw1"
              initial={{ scale: 0.6, opacity: 0.6 }}
              animate={{ scale: 7, opacity: 0 }}
              exit={{}}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                marginTop: -46, marginLeft: -46,
                width: 92, height: 92, borderRadius: '50%',
                border: `1px solid ${accentColor}80`,
                pointerEvents: 'none',
              }}
            />
            <motion.div
              key="sw2"
              initial={{ scale: 0.6, opacity: 0.3 }}
              animate={{ scale: 10, opacity: 0 }}
              exit={{}}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                marginTop: -46, marginLeft: -46,
                width: 92, height: 92, borderRadius: '50%',
                border: `1px solid ${accentColor}40`,
                pointerEvents: 'none',
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Ray of light: center → star ── */}
      <AnimatePresence>
        {ray && (
          <motion.div
            key="ray"
            initial={{ opacity: 0.85, scaleX: 0 }}
            animate={{ opacity: 0, scaleX: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: ray.length, height: 1.5,
              background: `linear-gradient(to right, ${ray.color}cc, transparent)`,
              transformOrigin: 'left center',
              transform: `rotate(${ray.angle}deg)`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Nebula reply ── */}
      <AnimatePresence>
        {lastReply && (
          <motion.div
            key={lastReply}
            initial={{ opacity: 0, filter: 'blur(8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(50% + 68px)',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 11, color: 'rgba(180,192,230,0.45)',
              letterSpacing: '0.08em', textAlign: 'center',
              pointerEvents: 'none', whiteSpace: 'nowrap', fontWeight: 300,
            }}
          >
            {lastReply}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Click-outside backdrop ── */}
      {isActive && (
        <div
          style={{ position: 'absolute', inset: 0, pointerEvents: 'all', zIndex: 0 }}
          onClick={() => setIsActive(false)}
        />
      )}

      {/* ── The Core ── */}
      <motion.div
        animate={
          isActive
            ? { scale: 1, width: inputW, x: -(inputW / 2) }
            : { scale: [0.97, 1.03, 0.97], width: 92, x: -46 }
        }
        transition={
          isActive
            ? {
                width: { type: 'spring', stiffness: 260, damping: 30 },
                x:     { type: 'spring', stiffness: 260, damping: 30 },
                scale: { duration: 0 },
              }
            : {
                scale: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
                width: { type: 'spring', stiffness: 260, damping: 30 },
                x:     { type: 'spring', stiffness: 260, damping: 30 },
              }
        }
        onClick={() => !isActive && setIsActive(true)}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          marginTop: -46,
          height: 92,
          borderRadius: 46,
          background: isActive
            ? 'rgba(2,2,8,0.97)'
            : 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.97) 70%)',
          boxShadow: isProcessing
            ? `0 0 28px #f0c04070, 0 0 60px #f0c04030, 0 0 120px #f0c04010`
            : isActive
              ? `0 0 20px ${accentColor}30, 0 0 50px ${accentColor}10`
              : `0 0 24px ${accentColor}60, 0 0 56px ${accentColor}28, 0 0 110px ${accentColor}0e, inset 0 0 18px ${accentColor}08`,
          border: `1px solid ${accentColor}${isActive ? '18' : '30'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isActive ? 'text' : 'pointer',
          overflow: 'hidden',
          pointerEvents: 'all',
          zIndex: 1,
        }}
      >
        <AnimatePresence mode="wait">
          {!isActive ? (
            /* Idle: luminous orb core */
            <motion.div
              key="dot"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.22 }}
              style={{
                width: 12, height: 12, borderRadius: '50%',
                background: `radial-gradient(circle, white 0%, ${accentColor} 55%, transparent 100%)`,
                boxShadow: `0 0 20px ${accentColor}, 0 0 40px ${accentColor}80, 0 0 70px ${accentColor}30`,
                flexShrink: 0,
              }}
            />
          ) : (
            /* Active: input row */
            <motion.div
              key="input-row"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, delay: 0.1 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '0 20px' }}
            >
              {/* Status dot */}
              <div style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: isProcessing ? '#f0c040' : listening ? '#f87171' : `${accentColor}60`,
                boxShadow: isProcessing
                  ? '0 0 8px #f0c040'
                  : listening ? '0 0 8px #f87171' : 'none',
                transition: 'all 0.3s',
              }} />

              {/* Text input */}
              <div style={{ flex: 1, position: 'relative', height: 20 }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={isProcessing}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#dde6f8',
                    fontSize: 13,
                    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
                    fontWeight: 300,
                    letterSpacing: '0.02em',
                    caretColor: accentColor,
                    width: '100%',
                  }}
                />
                {/* Animated placeholder */}
                {!input && (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={hintIdx}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 0.2, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.4 }}
                      style={{
                        position: 'absolute', left: 0, top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: '#6b7280',
                        fontSize: 13,
                        fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
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

              {/* Mic icon (only when active) */}
              <button
                onClick={e => { e.stopPropagation(); toggleVoice(); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: listening ? '#f87171' : `${accentColor}55`,
                  padding: 4, display: 'flex', alignItems: 'center',
                  transition: 'color 0.25s',
                  flexShrink: 0,
                }}
              >
                {listening ? <MicOff size={12} /> : <Mic size={12} />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
