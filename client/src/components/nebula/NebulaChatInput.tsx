import { useState, useEffect, useRef, useCallback } from 'react';
import { nebulaCameraRef } from './nebulaCamera';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { orchestrate } from '../../core/orchestrator';
import { quickConnect } from '../../core/insightEngine';
import { saveEntry, getByCategory, queryCalendarByDate, getRecentAll, deleteCategory } from '../../vault/vaultService';
import { aiQuery, analyzeGalaxy, aiChat } from '../../core/aiParser';
import { buildStar, getCategoryMeta, starPosition } from '../starfield/StarfieldView';
import { useAlterStore } from '../../store/alterStore';

const HINTS = [
  'Ho speso 15€ per pizza...',
  'Dormito 7 ore...',
  'Peso 82 kg...',
  'Umore 8 oggi...',
  'Corsa 5km...',
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
  const [input,            setInput]            = useState('');
  const [hintIdx,          setHintIdx]          = useState(0);
  const [listening,        setListening]        = useState(false);
  const [lastReply,        setLastReply]        = useState<string | null>(null);
  const [isActive,         setIsActive]         = useState(false);
  const [showShockwave,    setShowShockwave]    = useState(false);
  const [ray,              setRay]              = useState<Ray | null>(null);
  const [evolveSuggestion, setEvolveSuggestion] = useState<string | null>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const evolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef      = useRef<HTMLDivElement>(null);
  const nebulaWrapRef  = useRef<HTMLDivElement>(null);

  // Register anchors with the camera sync system
  useEffect(() => {
    nebulaCameraRef.el     = anchorRef.current;
    nebulaCameraRef.nebula = nebulaWrapRef.current;
    return () => { nebulaCameraRef.el = null; nebulaCameraRef.nebula = null; };
  }, []);

  const {
    user, isProcessing, setProcessing,
    upsertStar, removeStar, addKnownCategory, knownCategories,
    setFocusMode, focusMode, addMessage,
    setHighlightedStar, setActiveWidget, setNexusBeam,
  } = useAlterStore();

  // ── Rotate hints ──────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setHintIdx(i => (i + 1) % HINTS.length), 3200);
    return () => clearInterval(t);
  }, []);

  // ── Evolve: auto-suggest after 10s idle ───────────────────
  useEffect(() => {
    if (evolveTimerRef.current) clearTimeout(evolveTimerRef.current);
    setEvolveSuggestion(null);
    if (isActive || isProcessing) return;
    evolveTimerRef.current = setTimeout(() => {
      const starsNow = useAlterStore.getState().stars;
      if (starsNow.length >= 2) {
        const [a, b] = starsNow.slice(0, 2);
        setEvolveSuggestion(`Ho notato una connessione tra ${a.icon} ${a.label} e ${b.icon} ${b.label}. Vuoi vedere?`);
      }
    }, 10000);
    return () => { if (evolveTimerRef.current) clearTimeout(evolveTimerRef.current); };
  }, [isActive, isProcessing]);

  // ── Process input ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing || !user) return;

    setInput('');
    setIsActive(false);
    inputRef.current?.blur();
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
        setLastReply(msg); addMessage('nebula', msg);

      } else if (action.type === 'save') {
        const { intent } = action;
        const saved = await saveEntry(user.id, intent.category, intent.data);
        if (saved) {
          addKnownCategory(intent.category);
          if (intent.source === 'ai' && intent.categoryMeta) {
            const { CATEGORY_META } = await import('../starfield/StarfieldView');
            if (!CATEGORY_META[intent.category]) CATEGORY_META[intent.category] = intent.categoryMeta;
          }
          const star     = buildStar(intent.category, 1, saved.created_at);
          const existing = useAlterStore.getState().stars.find(s => s.id === intent.category);
          upsertStar({ ...star, entryCount: (existing?.entryCount ?? 0) + 1, intensity: Math.min(1, (existing?.intensity ?? 0) + 0.12), isNew: !existing });
          const pos = starPosition(intent.category);
          const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
          const dx = pos.x * window.innerWidth - cx, dy = pos.y * window.innerHeight - cy;
          const meta = getCategoryMeta(intent.category);
          setRay({ angle: Math.atan2(dy, dx) * 180 / Math.PI, length: Math.sqrt(dx*dx+dy*dy), color: meta.color });
          setTimeout(() => setRay(null), 900);
          const src   = intent.source === 'local' ? '' : ' · AI';
          const reply = `${meta.icon}  ${meta.label}${src}`;
          setLastReply(reply); addMessage('nebula', reply);

          // ── Auto-connect: find related star 2s after save ──
          setTimeout(() => {
            const starsNow = useAlterStore.getState().stars;
            const conn = quickConnect(intent.category, intent.rawText, starsNow);
            if (conn) {
              const metaB = getCategoryMeta(conn.catB);
              setNexusBeam({ catA: intent.category, catB: conn.catB, colorA: meta.color, colorB: conn.colorB, correlation: conn.correlation });
              addMessage('nebula', `✦ Collegato: ${meta.icon} ${meta.label} ↔ ${metaB.icon} ${metaB.label}`);
              setTimeout(() => setNexusBeam(null), 9000);
            }
          }, 2000);
        } else {
          const msg = 'Errore nel salvataggio. Riprova.';
          setLastReply(msg); addMessage('nebula', msg);
        }

      } else if (action.type === 'chat') {
        const reply = await aiChat(text);
        setLastReply(reply.length > 80 ? reply.slice(0, 77) + '…' : reply);
        addMessage('nebula', reply);

      } else if (action.type === 'delete') {
        const { category } = action;
        if (category && user) {
          const ok = await deleteCategory(user.id, category);
          const msg = ok ? `Stella "${category}" rimossa.` : `Categoria "${category}" non trovata.`;
          if (ok) removeStar(category);
          setLastReply(msg); addMessage('nebula', msg);
        } else {
          const msg = 'Dimmi quale stella eliminare: "elimina stella [nome]"';
          setLastReply(msg); addMessage('nebula', msg);
        }

      } else if (action.type === 'query') {
        const { category, dateRange } = action;
        let entries = [];
        if (category === 'calendar' && dateRange) {
          entries = await queryCalendarByDate(user.id, dateRange[0], dateRange[1]);
        } else if (category) {
          entries = await getByCategory(user.id, category, 20);
        } else {
          entries = await getRecentAll(user.id, 20);
        }
        if (category) {
          setHighlightedStar(category);
          setTimeout(() => setHighlightedStar(null), 3500);
          const pos  = starPosition(category);
          const cx   = window.innerWidth / 2, cy = window.innerHeight / 2;
          const dx   = pos.x * window.innerWidth - cx, dy = pos.y * window.innerHeight - cy;
          const meta = getCategoryMeta(category);
          setRay({ angle: Math.atan2(dy, dx) * 180 / Math.PI, length: Math.sqrt(dx*dx+dy*dy), color: meta.color });
          setTimeout(() => setRay(null), 900);
        }
        const reply = await aiQuery(text, entries);
        setLastReply(reply.length > 80 ? reply.slice(0, 77) + '…' : reply);
        addMessage('nebula', reply);
        if (category && entries.length > 0) {
          const meta = getCategoryMeta(category);
          const { inferRenderType } = await import('../widget/PolymorphicWidget');
          setActiveWidget({ category, label: meta.label, color: meta.color, entries, renderType: inferRenderType(entries, category) });

          // Create ephemeral view star for date-range queries
          if (dateRange && category !== 'calendar') {
            const days = Math.round((new Date(dateRange[1]).getTime() - new Date(dateRange[0]).getTime()) / 86400000);
            const viewId = `${category}:${days}d`;
            const now = new Date().toISOString();
            const existing = useAlterStore.getState().stars.find(s => s.id === viewId);
            if (!existing) {
              upsertStar({
                id: viewId,
                label: `${meta.label} ${days}g`,
                color: meta.color,
                icon: meta.icon,
                x: Math.min(0.88, Math.max(0.12, starPosition(category).x + 0.07)),
                y: Math.min(0.80, Math.max(0.12, starPosition(category).y + 0.06)),
                intensity: 0.35,
                entryCount: entries.length,
                lastEntry: now,
                ephemeral: true,
                lastAccessedAt: now,
                isNew: false,
              });
            } else {
              upsertStar({ ...existing, lastAccessedAt: now });
            }
          }
        }

      } else if (action.type === 'analyse') {
        const entries = await getRecentAll(user.id, 30);
        const insight = await analyzeGalaxy(entries);
        addMessage('nebula', insight);
        setLastReply('✦ Nebula Insight');
        setActiveWidget({
          category: 'insight', label: 'Nebula Insight', color: '#ffffff',
          entries: [{ id: 'insight', user_id: user.id, category: 'insight', data: { insight }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
          renderType: 'insight',
        });

      } else if (action.type === 'nexus') {
        const { catA, catB } = action;
        if (!catA || !catB) {
          const msg = 'Specifica due categorie: es. "correlazione umore spese"';
          setLastReply(msg); addMessage('nebula', msg);
        } else {
          const [entriesA, entriesB] = await Promise.all([
            getByCategory(user.id, catA, 30),
            getByCategory(user.id, catB, 30),
          ]);
          const valueKey = (cat: string) =>
            cat === 'finance' ? 'amount' : cat === 'psychology' ? 'score' : 'value';
          const dayBucket = (entries: typeof entriesA, key: string) => {
            const m = new Map<string, number>();
            for (const e of entries) {
              const day = e.created_at.slice(0, 10);
              m.set(day, (m.get(day) ?? 0) + ((e.data[key] as number) ?? 0));
            }
            return m;
          };
          const mapA  = dayBucket(entriesA, valueKey(catA));
          const mapB  = dayBucket(entriesB, valueKey(catB));
          const days  = [...mapA.keys()].filter(d => mapB.has(d)).sort();
          if (days.length < 3) {
            const msg = `Non abbastanza dati in comune tra ${catA} e ${catB} (${days.length} giorni).`;
            setLastReply(msg); addMessage('nebula', msg);
          } else {
            const xs = days.map(d => mapA.get(d)!);
            const ys = days.map(d => mapB.get(d)!);
            const maxX = Math.max(...xs), maxY = Math.max(...ys);
            const nx = xs.map(x => maxX > 0 ? x / maxX : 0);
            const ny = ys.map(y => maxY > 0 ? y / maxY : 0);
            const n  = days.length;
            const mx = nx.reduce((a,b) => a+b,0) / n;
            const my = ny.reduce((a,b) => a+b,0) / n;
            let num = 0, dx2 = 0, dy2 = 0;
            for (let i = 0; i < n; i++) { const dx = nx[i]-mx, dy = ny[i]-my; num += dx*dy; dx2 += dx*dx; dy2 += dy*dy; }
            const corr = Math.sqrt(dx2*dy2) === 0 ? 0 : num / Math.sqrt(dx2*dy2);
            const metaA = getCategoryMeta(catA);
            const metaB = getCategoryMeta(catB);
            const chartData = days.map((d, i) => ({
              date: d.slice(5).replace('-', '/'),
              [catA]: +(nx[i] * 100).toFixed(1),
              [catB]: +(ny[i] * 100).toFixed(1),
            }));
            setNexusBeam({ catA, catB, colorA: metaA.color, colorB: metaB.color, correlation: corr });
            setTimeout(() => setNexusBeam(null), 9000);
            const corrPct  = (Math.abs(corr) * 100).toFixed(0);
            const corrSign = corr > 0.25 ? 'positiva' : corr < -0.25 ? 'inversa' : 'debole';
            const reply    = `Nexus: correlazione ${corrSign} ${corrPct}% (${n} giorni)`;
            setLastReply(reply); addMessage('nebula', reply);
            setActiveWidget({
              category: 'nexus',
              label: `${metaA.icon} ${metaA.label} ↔ ${metaB.icon} ${metaB.label}`,
              color: metaA.color,
              entries: [{ id: 'nexus', user_id: user.id, category: 'nexus',
                data: { catA, catB, catALabel: metaA.label, catBLabel: metaB.label,
                  colorA: metaA.color, colorB: metaB.color, correlation: corr, chartData },
                created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
              renderType: 'nexus',
            });
          }
        }
      } else {
        const msg = '"15 pizza"  ·  "peso 80kg"  ·  "dormito 7 ore"';
        setLastReply(msg); addMessage('nebula', msg);
      }
    } finally {
      setProcessing(false);
    }
  }, [input, isProcessing, user, knownCategories, focusMode, upsertStar, removeStar, addKnownCategory, setFocusMode, setProcessing, addMessage, setHighlightedStar, setActiveWidget, setNexusBeam]);

  // ── Global keypress auto-focus ────────────────────────────
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1 && !isProcessing) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [isProcessing]);

  // ── Voice input ────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: AnySpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { setListening(false); return; }
    const rec = new SR();
    rec.lang = 'it-IT'; rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); };
    rec.onerror  = () => setListening(false);
    rec.onend    = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { setIsActive(false); setInput(''); inputRef.current?.blur(); }
  };

  const openInput = () => {
    setIsActive(true);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}>

      {/* ── Vignette when active ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(5,5,8,0.55) 100%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Shockwave rings ── */}
      <AnimatePresence>
        {showShockwave && ([
          { scale: 10, op: 0.45, dur: 1.0, delay: 0 },
          { scale: 18, op: 0.2,  dur: 1.6, delay: 0.1 },
        ] as const).map((sw, i) => (
          <motion.div
            key={`sw${i}`}
            initial={{ scale: 0.5, opacity: sw.op }}
            animate={{ scale: sw.scale, opacity: 0 }} exit={{}}
            transition={{ duration: sw.dur, ease: [0.22, 1, 0.36, 1], delay: sw.delay }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              marginTop: -24, marginLeft: -24,
              width: 48, height: 48, borderRadius: '50%',
              border: '1px solid rgba(240,249,255,0.3)',
              pointerEvents: 'none',
            }}
          />
        ))}
      </AnimatePresence>

      {/* ── Ray of light: center → star ── */}
      <AnimatePresence>
        {ray && (
          <motion.div
            key="ray"
            initial={{ opacity: 0.65, scaleX: 0 }}
            animate={{ opacity: 0, scaleX: 1 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: ray.length, height: 1,
              background: `linear-gradient(to right, ${ray.color}aa, transparent)`,
              transformOrigin: 'left center',
              transform: `rotate(${ray.angle}deg)`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── World-space anchor (camera sync — invisible) ── */}
      <div ref={anchorRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', willChange: 'transform' }} />

      {/* ── Central nebula + expandable input ── */}
      <div ref={nebulaWrapRef} style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 202,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        pointerEvents: 'none',
      }}>

        {/* Status / hint text above the nebula */}
        <AnimatePresence mode="wait">
          {lastReply && !isActive ? (
            <motion.div
              key={`reply-${lastReply}`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 3 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontSize: 10,
                color: 'rgba(200,215,255,0.35)',
                letterSpacing: '0.08em',
                fontWeight: 300,
                textAlign: 'center',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {lastReply}
            </motion.div>
          ) : !isActive ? (
            <motion.div
              key={`hint-${hintIdx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{
                fontSize: 9,
                color: 'rgba(200,220,255,0.06)',
                letterSpacing: '0.06em',
                fontWeight: 300,
                pointerEvents: 'none',
                textAlign: 'center',
              }}
            >
              {HINTS[hintIdx]}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Entity: minimal star ── */}
        <motion.div
          onClick={isActive ? undefined : openInput}
          animate={{ y: isActive ? 0 : [0, -5, 0], opacity: isActive ? 0 : 1 }}
          transition={isActive ? { duration: 0.2 } : { y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.25 } }}
          style={{
            position: 'relative',
            width: 64, height: 64,
            flexShrink: 0,
            cursor: isActive ? 'default' : 'pointer',
            pointerEvents: isActive ? 'none' : 'all',
          }}
        >
          {/* Ambient glow */}
          <motion.div
            animate={{
              opacity: [0.12, 0.22, 0.12],
              scale: [1, 1.12, 1],
            }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: -20,
              borderRadius: '50%',
              background: isProcessing
                ? 'radial-gradient(circle, rgba(240,192,64,0.22) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(167,139,250,0.16) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          {/* Outer ring */}
          <motion.div
            animate={{
              rotate: isProcessing ? 360 : 0,
              opacity: isProcessing ? 0.7 : 0.15,
            }}
            transition={isProcessing
              ? { rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.4 } }
              : { duration: 0.6 }
            }
            style={{
              position: 'absolute', inset: -10,
              borderRadius: '50%',
              border: `1px solid ${isProcessing ? 'rgba(240,192,64,0.6)' : 'rgba(167,139,250,0.4)'}`,
              borderTopColor: 'transparent',
            }}
          />
          {/* Core dot */}
          <motion.div
            animate={{ scale: isProcessing ? [1, 1.1, 1] : 1 }}
            transition={isProcessing ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              background: isProcessing
                ? 'radial-gradient(circle at 50% 50%, rgba(255,245,200,0.95) 0%, rgba(240,192,64,0.5) 50%, transparent 100%)'
                : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.9) 0%, rgba(167,139,250,0.35) 55%, transparent 100%)',
              boxShadow: isProcessing
                ? '0 0 16px rgba(240,192,64,0.5), 0 0 40px rgba(240,192,64,0.12)'
                : '0 0 12px rgba(200,190,255,0.3), 0 0 32px rgba(167,139,250,0.08)',
            }}
          />
        </motion.div>

        {/* ── Expandable input ── */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              key="input-bar"
              initial={{ opacity: 0, scaleY: 0.85, y: -6 }}
              animate={{ opacity: 1, scaleY: 1, y: 0 }}
              exit={{ opacity: 0, scaleY: 0.85, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: 'min(440px, calc(100vw - 48px))',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(5,5,10,0.96)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
                padding: '10px 14px',
                backdropFilter: 'blur(60px)',
                WebkitBackdropFilter: 'blur(60px)',
                pointerEvents: 'all',
                boxShadow: '0 4px 32px rgba(0,0,0,0.8)',
                transformOrigin: 'top center',
              }}
            >
              {/* Status dot */}
              <motion.div
                animate={{
                  background: isProcessing ? '#f0c040' : 'rgba(240,249,255,0.55)',
                  boxShadow: isProcessing ? '0 0 8px #f0c040' : '0 0 5px rgba(240,249,255,0.25)',
                  scale: isProcessing ? [1, 1.6, 1] : 1,
                }}
                transition={isProcessing ? { scale: { duration: 0.55, repeat: Infinity } } : { duration: 0.3 }}
                style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0 }}
              />

              {/* Input field */}
              <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  onFocus={() => setIsActive(true)}
                  onBlur={() => { if (!isProcessing) setIsActive(false); }}
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none', outline: 'none',
                    color: 'rgba(255,255,255,0.9)',
                    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
                    fontSize: 12, fontWeight: 300,
                    letterSpacing: '0.04em',
                    caretColor: 'rgba(200,220,255,0.6)',
                  }}
                />
                {!input && (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`ph-${hintIdx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      style={{
                        position: 'absolute', left: 0, top: 0,
                        fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
                        fontSize: 12, fontWeight: 300,
                        letterSpacing: '0.04em',
                        color: 'rgba(200,220,255,0.14)',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%',
                      }}
                    >
                      {HINTS[hintIdx]}
                    </motion.span>
                  </AnimatePresence>
                )}
              </div>

              {/* Mic */}
              <button
                onMouseDown={e => { e.preventDefault(); toggleVoice(); }}
                onTouchStart={e => { e.preventDefault(); toggleVoice(); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: listening ? '#f87171' : 'rgba(240,249,255,0.18)',
                  padding: '2px 0', flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.2s',
                }}
              >
                {listening ? <MicOff size={12} /> : <Mic size={12} />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
