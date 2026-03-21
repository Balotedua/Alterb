import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { orchestrate } from '../../core/orchestrator';
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
  const inputRef      = useRef<HTMLInputElement>(null);
  const evolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}>

      {/* ── Immersive blur backdrop when active ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="blur-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              position: 'absolute', inset: 0,
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              background: 'rgba(5,5,8,0.22)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Shockwave rings ── */}
      <AnimatePresence>
        {showShockwave && (
          <>
            <motion.div
              key="sw-flash"
              initial={{ opacity: 0.35 }} animate={{ opacity: 0 }} exit={{}}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle at center, rgba(240,249,255,0.12) 0%, transparent 65%)',
                pointerEvents: 'none',
              }}
            />
            {([
              { scale: 14, op: 0.8, dur: 1.4, delay: 0 },
              { scale: 22, op: 0.4, dur: 2.0, delay: 0.1 },
              { scale: 32, op: 0.2, dur: 2.6, delay: 0.22 },
            ] as const).map((sw, i) => (
              <motion.div
                key={`sw${i}`}
                initial={{ scale: 0.4, opacity: sw.op }}
                animate={{ scale: sw.scale, opacity: 0 }} exit={{}}
                transition={{ duration: sw.dur, ease: [0.22, 1, 0.36, 1], delay: sw.delay }}
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  marginTop: -46, marginLeft: -46,
                  width: 92, height: 92, borderRadius: '50%',
                  border: '1px solid rgba(240,249,255,0.55)',
                  pointerEvents: 'none',
                }}
              />
            ))}
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

      {/* ── Ghost text — floats above Nebula, zero box ── */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(50% - 82px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 202,
          pointerEvents: 'none',
          textAlign: 'center',
          minWidth: 220,
        }}
      >
        <AnimatePresence mode="wait">
          {isActive && (
            <motion.div
              key="ghost-input"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.22 }}
              style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 0,
                fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
                fontWeight: 300,
                fontSize: 14,
                letterSpacing: '0.04em',
                color: 'rgba(255,255,255,0.92)',
                whiteSpace: 'nowrap',
              }}
            >
              {input ? (
                <span>{input}</span>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.span
                    key={hintIdx}
                    initial={{ opacity: 0 }} animate={{ opacity: 0.22 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ color: 'rgba(200,220,255,0.22)' }}
                  >
                    {HINTS[hintIdx]}
                  </motion.span>
                </AnimatePresence>
              )}
              {/* Blinking cursor */}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                style={{ color: 'rgba(240,249,255,0.65)', marginLeft: 1 }}
              >_</motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              position: 'fixed',
              top: 'calc(50% + 72px)',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10, color: 'rgba(180,192,230,0.4)',
              letterSpacing: '0.10em', textAlign: 'center',
              fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
              pointerEvents: 'none', whiteSpace: 'nowrap', fontWeight: 300,
            }}
          >
            {lastReply}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Evolve suggestion ── */}
      <AnimatePresence>
        {evolveSuggestion && !isActive && (
          <motion.div
            key="evolve"
            initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => {
              const stars = useAlterStore.getState().stars;
              if (stars.length >= 2) {
                const [a, b] = stars.slice(0, 2);
                setInput(`correlazione ${a.id} ${b.id}`);
                setEvolveSuggestion(null);
                inputRef.current?.focus();
              }
            }}
            style={{
              position: 'fixed',
              top: 'calc(50% + 100px)',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 9,
              color: 'rgba(167,139,250,0.55)',
              letterSpacing: '0.08em',
              textAlign: 'center',
              fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
              pointerEvents: 'all',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: 300,
              padding: '5px 14px',
              borderRadius: 20,
              border: '1px solid rgba(167,139,250,0.12)',
              background: 'rgba(5,5,8,0.6)',
              backdropFilter: 'blur(10px)',
              zIndex: 202,
            }}
          >
            ✦ {evolveSuggestion}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Click-outside backdrop ── */}
      {isActive && (
        <div
          style={{ position: 'absolute', inset: 0, pointerEvents: 'all', zIndex: 0 }}
          onClick={() => { setIsActive(false); setInput(''); inputRef.current?.blur(); }}
        />
      )}

      {/* ── The Nebula Core — ALWAYS fixed at dead center ── */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
        }}
      >
        <motion.div
          animate={{ scale: isProcessing ? [1, 1.08, 1] : isActive ? 1.04 : [0.97, 1.03, 0.97] }}
          transition={
            isProcessing
              ? { scale: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } }
              : isActive
                ? { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                : { scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }
          }
          style={{
            width: 92, height: 92,
            borderRadius: '50%',
            background: isProcessing
              ? 'radial-gradient(circle at 50% 50%, rgba(240,192,64,0.55) 0%, rgba(240,192,64,0.08) 45%, transparent 72%)'
              : 'radial-gradient(circle at 50% 50%, rgba(255,215,0,0.30) 0%, rgba(240,249,255,0.90) 28%, rgba(240,249,255,0.10) 56%, transparent 78%)',
            boxShadow: isProcessing
              ? '0 0 50px rgba(240,192,64,0.65), 0 0 110px rgba(240,192,64,0.35), 0 0 220px rgba(240,192,64,0.12)'
              : isActive
                ? '0 0 55px rgba(240,249,255,0.75), 0 0 110px rgba(240,249,255,0.38), 0 0 220px rgba(240,249,255,0.14)'
                : '0 0 44px rgba(240,249,255,0.55), 0 0 88px rgba(240,249,255,0.28), 0 0 176px rgba(240,249,255,0.10), 0 0 350px rgba(240,249,255,0.04)',
            border: `0.5px solid rgba(240,249,255,${isActive ? '0.42' : '0.18'})`,
            cursor: isActive ? 'text' : 'pointer',
            pointerEvents: 'all',
            position: 'relative',
          }}
        >
          {/* Input — invisible, covers full orb, captures tap → keyboard */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setIsActive(true)}
            onBlur={() => { if (!isProcessing) setIsActive(false); }}
            disabled={isProcessing}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              borderRadius: '50%',
              opacity: 0,
              background: 'transparent',
              border: 'none', outline: 'none',
              cursor: isActive ? 'text' : 'pointer',
              zIndex: 10,
              fontSize: 16, // prevents iOS auto-zoom
            }}
          />

          {/* Processing pulse dot */}
          {isProcessing && (
            <motion.div
              animate={{ scale: [1, 1.7, 1], opacity: [0.9, 0.1, 0.9] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 9, height: 9, borderRadius: '50%',
                background: '#f0c040',
                boxShadow: '0 0 14px #f0c040, 0 0 28px #f0c04080',
                pointerEvents: 'none',
              }}
            />
          )}
        </motion.div>
      </div>

      {/* ── Mic — below orb, only when active ── */}
      <AnimatePresence>
        {isActive && (
          <motion.button
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            onMouseDown={e => { e.preventDefault(); toggleVoice(); }} // mousedown to avoid blur
            style={{
              position: 'fixed',
              top: 'calc(50% + 58px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: listening ? '#f87171' : 'rgba(240,249,255,0.28)',
              padding: 6,
              pointerEvents: 'all',
              zIndex: 202,
              transition: 'color 0.25s',
            }}
          >
            {listening ? <MicOff size={13} /> : <Mic size={13} />}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
