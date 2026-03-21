import { useState, useEffect, useRef, useCallback } from 'react';
import { nebulaCameraRef } from './nebulaCamera';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, ArrowUp, Menu } from 'lucide-react';
import { orchestrate } from '../../core/orchestrator';
import { quickConnect } from '../../core/insightEngine';
import { saveEntry, getByCategory, queryCalendarByDate, getRecentAll, deleteCategory, saveChatSession, updateChatSession } from '../../vault/vaultService';
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
  const [ray,              setRay]              = useState<Ray | null>(null);
  const [evolveSuggestion, setEvolveSuggestion] = useState<string | null>(null);
  const evolveCmdRef   = useRef<string | null>(null);
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
    ghostStarPrompt, setGhostStarPrompt,
    showChatSidebar, setShowChatSidebar,
    currentSessionId, setCurrentSessionId,
  } = useAlterStore();

  // ── Ghost star → pre-fill input ───────────────────────────
  useEffect(() => {
    if (!ghostStarPrompt) return;
    setInput(ghostStarPrompt);
    setIsActive(true);
    setGhostStarPrompt(null);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [ghostStarPrompt, setGhostStarPrompt]);

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
        for (let i = 0; i < starsNow.length; i++) {
          const conn = quickConnect(starsNow[i].id, '', starsNow);
          if (conn) {
            const a = starsNow[i];
            const b = starsNow.find(s => s.id === conn.catB);
            if (b) {
              evolveCmdRef.current = `correlazione ${a.id} ${b.id}`;
              setEvolveSuggestion(`✦ Connessione rilevata: ${a.icon} ${a.label} ↔ ${b.icon} ${b.label}`);
              break;
            }
          }
        }
      }
    }, 10000);
    return () => { if (evolveTimerRef.current) clearTimeout(evolveTimerRef.current); };
  }, [isActive, isProcessing]);

  // ── Process input ─────────────────────────────────────────
  const handleSubmit = useCallback(async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    if (!text || isProcessing || !user) return;

    setInput('');
    setIsActive(false);
    inputRef.current?.blur();
    addMessage('user', text);
    setProcessing(true);
    setLastReply(null);

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

          // ── Big Bang: proactive follow-up on first entry ──
          if (!existing) {
            const BIG_BANG: Record<string, string> = {
              finance:    'Prima spesa. Vuoi impostare un budget o tracciare un\'abitudine?',
              health:     'Prima nota salute. Aggiungi peso o ore di sonno?',
              psychology: 'Prima nota psiche. Vuoi un check-in umore quotidiano?',
              calendar:   'Primo evento. Vuoi impostare promemoria?',
            };
            const bbMsg = BIG_BANG[intent.category] ?? 'Categoria creata. Cosa vuoi aggiungere?';
            setTimeout(() => { setLastReply(bbMsg); addMessage('nebula', bbMsg); }, 2400);

            // ── Void filling: suggest next missing pillar ──
            const VOID_TARGETS: Record<string, string> = {
              finance: 'health', health: 'psychology', psychology: 'finance', calendar: 'health',
            };
            const voidTarget = VOID_TARGETS[intent.category];
            if (voidTarget) {
              setTimeout(() => {
                const starsNow2 = useAlterStore.getState().stars;
                if (!starsNow2.some(s => s.id === voidTarget)) {
                  const vMeta = getCategoryMeta(voidTarget);
                  setEvolveSuggestion(`${vMeta.icon} Vuoi iniziare a tracciare ${vMeta.label.toLowerCase()}?`);
                }
              }, 5500);
            }
          }

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
      // Persist chat session in vault (fire-and-forget)
      if (user) {
        const allMsgs = useAlterStore.getState().messages;
        if (allMsgs.length >= 2) {
          const title = allMsgs.find(m => m.role === 'user')?.text.slice(0, 50) ?? 'Chat';
          const sessionMsgs = allMsgs.map(m => ({ role: m.role, text: m.text, ts: m.ts }));
          const sid = useAlterStore.getState().currentSessionId;
          if (!sid) {
            saveChatSession(user.id, title, sessionMsgs).then(saved => {
              if (saved) setCurrentSessionId(saved.id);
            });
          } else {
            updateChatSession(sid, title, sessionMsgs);
          }
        }
      }
      setProcessing(false);
    }
  }, [input, isProcessing, user, knownCategories, focusMode, upsertStar, removeStar, addKnownCategory, setFocusMode, setProcessing, addMessage, setHighlightedStar, setActiveWidget, setNexusBeam, setCurrentSessionId]);

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
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      setListening(false);
      setTimeout(() => handleSubmit(t), 80);
    };
    rec.onerror  = () => setListening(false);
    rec.onend    = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, handleSubmit]);

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

      {/* ── Hamburger: chat history ── */}
      <button
        onMouseDown={e => { e.preventDefault(); setShowChatSidebar(!showChatSidebar); }}
        onTouchStart={e => { e.preventDefault(); setShowChatSidebar(!showChatSidebar); }}
        style={{
          position: 'fixed', top: 12, left: 16, zIndex: 202,
          background: 'rgba(8,8,18,0.70)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: 9,
          cursor: 'pointer',
          color: showChatSidebar ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.40)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'color 0.2s, background 0.2s',
          pointerEvents: 'all',
        }}
        title="Cronologia chat"
      >
        <Menu size={15} />
      </button>

      {/* ── Ray of light: center → star (white, monochrome) ── */}
      <AnimatePresence>
        {ray && (
          <motion.div
            key="ray"
            initial={{ opacity: 0.5, scaleX: 0 }}
            animate={{ opacity: 0, scaleX: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: ray.length, height: 1,
              background: 'linear-gradient(to right, rgba(255,255,255,0.4), transparent)',
              transformOrigin: 'left center',
              transform: `rotate(${ray.angle}deg)`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── World-space anchor (camera sync — invisible) ── */}
      <div ref={anchorRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', willChange: 'transform' }} />

      {/* ── Bottom minimal input ── */}
      <div ref={nebulaWrapRef} style={{
        position: 'fixed',
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 202,
        width: 'min(440px, calc(100vw - 48px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'all',
      }}>

        {/* Status / reply above input */}
        <AnimatePresence mode="wait">
          {lastReply && !isActive ? (
            <motion.div
              key={`reply-${lastReply}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.35 }}
              style={{
                fontSize: 12, color: 'rgba(255,255,255,0.68)',
                letterSpacing: '0.04em', fontWeight: 300,
                textAlign: 'center', pointerEvents: 'none',
                lineHeight: 1.5,
              }}
            >
              {lastReply}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Evolve suggestion — clickable chip */}
        <AnimatePresence>
          {evolveSuggestion && !isActive && (
            <motion.div
              key="evolve"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => { setInput(evolveCmdRef.current ?? ''); evolveCmdRef.current = null; setEvolveSuggestion(null); setTimeout(() => inputRef.current?.focus(), 60); }}
              style={{
                fontSize: 10, color: 'rgba(167,139,250,0.75)',
                letterSpacing: '0.05em', cursor: 'pointer',
                textAlign: 'center',
                padding: '5px 12px',
                background: 'rgba(167,139,250,0.08)',
                border: '1px solid rgba(167,139,250,0.18)',
                borderRadius: 12,
              }}
            >
              {evolveSuggestion}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input container — glass */}
        <motion.div
          animate={{ opacity: isActive || input.length > 0 ? 1 : 0.70 }}
          transition={{ duration: 0.4 }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(8,8,18,0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: isActive
              ? '1px solid rgba(255,255,255,0.14)'
              : '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            padding: '0 12px 0 16px',
            transition: 'border-color 0.3s',
          }}
          onClick={openInput}
        >
          {/* Processing dot */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                key="proc"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [1, 0.4, 1], scale: [1, 1.4, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, repeat: Infinity }}
                style={{ width: 3, height: 3, borderRadius: '50%', background: '#ffffff', flexShrink: 0 }}
              />
            )}
          </AnimatePresence>

          {/* Input */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); setIsActive(true); }}
            onKeyDown={handleKey}
            onFocus={() => setIsActive(true)}
            onBlur={() => { if (!isProcessing) setIsActive(false); }}
            disabled={isProcessing}
            placeholder={HINTS[hintIdx]}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none', outline: 'none',
              color: 'rgba(255,255,255,0.90)',
              fontFamily: 'inherit',
              fontSize: 16, fontWeight: 300,
              letterSpacing: '0.02em',
              caretColor: 'rgba(255,255,255,0.7)',
              minHeight: 46,
              WebkitAppearance: 'none',
            }}
          />

          {/* Send / Mic */}
          {input.length > 0 ? (
            <button
              onMouseDown={e => { e.preventDefault(); handleSubmit(); }}
              onTouchStart={e => { e.preventDefault(); handleSubmit(); }}
              style={{
                background: 'rgba(255,255,255,0.10)',
                border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.90)',
                padding: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
                borderRadius: 8,
                transition: 'all 0.2s',
                pointerEvents: 'all',
              }}
            >
              <ArrowUp size={15} />
            </button>
          ) : (
            <button
              onMouseDown={e => { e.preventDefault(); toggleVoice(); }}
              onTouchStart={e => { e.preventDefault(); toggleVoice(); }}
              style={{
                background: listening ? 'rgba(240,100,100,0.15)' : 'none',
                border: 'none', cursor: 'pointer',
                color: listening ? 'rgba(255,100,100,0.90)' : 'rgba(255,255,255,0.35)',
                padding: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
                borderRadius: 8,
                transition: 'all 0.2s',
                pointerEvents: 'all',
              }}
            >
              {listening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          )}
        </motion.div>

      </div>
    </div>
  );
}
