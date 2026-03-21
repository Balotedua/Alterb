import { useState, useEffect, useRef, useCallback } from 'react';
import { nebulaCameraRef } from './nebulaCamera';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, ArrowUp, Menu, Paperclip } from 'lucide-react';
import { orchestrate } from '../../core/orchestrator';
import { parseBankCsv, importBankCsv } from '../../import/bankCsvImport';
import type { BankTransaction } from '../../import/bankCsvImport';
import { extractDocument, isDocumentFile } from '../../import/documentOcr';
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
  const [pendingCsv,       setPendingCsv]       = useState<{ transactions: BankTransaction[]; text: string } | null>(null);
  const [csvImporting,     setCsvImporting]     = useState(false);
  const [pendingOcr,       setPendingOcr]       = useState<{ file: File; text: string; filename: string; pageCount?: number; confidence?: number } | null>(null);
  const [ocrLoading,       setOcrLoading]       = useState(false);
  const evolveCmdRef   = useRef<string | null>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileRef        = useRef<HTMLInputElement>(null);
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
    user, stars, isProcessing, setProcessing,
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

  // ── File upload: CSV or document (OCR) ───────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();

    // Document: PDF / image / text → OCR pipeline
    if (isDocumentFile(file) && !name.endsWith('.csv')) {
      setOcrLoading(true);
      setLastReply('Lettura documento...');
      try {
        const result = await extractDocument(file);
        if (!result.text) {
          addMessage('nebula', 'Nessun testo estratto dal documento.');
          return;
        }
        setPendingOcr({ file, text: result.text, filename: file.name, pageCount: result.pageCount, confidence: result.confidence });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Errore lettura documento.';
        addMessage('nebula', msg);
        setLastReply(msg);
      } finally {
        setOcrLoading(false);
        setLastReply(null);
      }
      return;
    }

    // CSV → bank import pipeline
    const text = await file.text();
    const transactions = parseBankCsv(text);
    if (transactions.length === 0) {
      addMessage('nebula', 'Nessuna transazione trovata nel file CSV.');
      return;
    }
    setPendingCsv({ transactions, text });
  }, [addMessage, setLastReply]);

  const confirmCsvImport = useCallback(async () => {
    if (!pendingCsv || !user || csvImporting) return;
    const { text, transactions } = pendingCsv;
    setPendingCsv(null);
    setCsvImporting(true);
    addMessage('user', `Importa CSV · ${transactions.length} transazioni`);
    setLastReply('Categorizzazione AI...');
    setProcessing(true);
    try {
      let lastDone = 0;
      const count = await importBankCsv(text, user.id, (done, total) => {
        if (done - lastDone >= 5 || done === total) {
          lastDone = done;
          setLastReply(`Importazione ${done}/${total}...`);
        }
      });
      const reply = `🏦 ${count} transazioni importate nel vault`;
      setLastReply(reply);
      addMessage('nebula', reply);
      // update finance star
      const { buildStar } = await import('../starfield/StarfieldView');
      const star = buildStar('finance', 1, new Date().toISOString());
      const existing = useAlterStore.getState().stars.find(s => s.id === 'finance');
      upsertStar({ ...star, entryCount: (existing?.entryCount ?? 0) + count, intensity: Math.min(1, (existing?.intensity ?? 0.3) + 0.05 * count), isNew: !existing });
      addKnownCategory('finance');
    } catch {
      const msg = 'Errore durante l\'import CSV.';
      setLastReply(msg); addMessage('nebula', msg);
    } finally {
      setCsvImporting(false);
      setProcessing(false);
    }
  }, [pendingCsv, user, csvImporting, addMessage, setProcessing, upsertStar, addKnownCategory]);

  // ── OCR: upload to Storage + save vault reference ────────
  const confirmOcrImport = useCallback(async () => {
    if (!pendingOcr || !user || isProcessing) return;
    const { file, text, filename } = pendingOcr;
    setPendingOcr(null);
    addMessage('user', `📄 ${filename}`);
    setProcessing(true);
    setLastReply('Caricamento...');

    try {
      // 1. Upload file to Supabase Storage
      const { uploadDocument, detectDocType, extractAmount, extractIssuer } = await import('../../import/documentStorage');
      const upload = await uploadDocument(user.id, file);

      // 2. Enrich metadata from text
      const { docType, docTypeLabel } = detectDocType(text, filename);
      const amount  = extractAmount(text);
      const issuer  = extractIssuer(text);

      // 3. Save vault entry (reference + extracted text)
      setLastReply('Analisi...');
      const vaultData: Record<string, unknown> = {
        storagePath:   upload.storagePath,
        filename,
        docType,
        docTypeLabel,
        extractedText: text.slice(0, 4000),
        charCount:     text.length,
        fileSize:      upload.fileSize,
        compressedSize: upload.compressedSize,
        mimeType:      file.type,
        uploadedAt:    new Date().toISOString(),
      };
      if (amount)  vaultData.amount  = amount;
      if (issuer)  vaultData.issuer  = issuer;
      if (pendingOcr.pageCount) vaultData.pageCount = pendingOcr.pageCount;

      const saved = await saveEntry(user.id, 'documents', vaultData);
      if (!saved) throw new Error('Vault save failed');

      addKnownCategory('documents');
      const star     = buildStar('documents', 1, saved.created_at);
      const existing = useAlterStore.getState().stars.find(s => s.id === 'documents');
      upsertStar({ ...star, entryCount: (existing?.entryCount ?? 0) + 1, intensity: Math.min(1, (existing?.intensity ?? 0) + 0.1), isNew: !existing });

      const sizeSaved = Math.round((1 - upload.compressedSize / upload.fileSize) * 100);
      const sizeNote  = sizeSaved > 5 ? ` · −${sizeSaved}%` : '';
      const reply = `📄 ${docTypeLabel}${issuer ? ' · ' + issuer : ''}${amount ? ' · €' + amount : ''}${sizeNote}`;
      setLastReply(reply); addMessage('nebula', reply);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore caricamento documento.';
      setLastReply(msg); addMessage('nebula', msg);
    } finally {
      setProcessing(false);
    }
  }, [pendingOcr, user, isProcessing, addMessage, setProcessing, upsertStar, addKnownCategory]);

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
      } else if (action.type === 'doc_list') {
        const { getByCategory: getDocs } = await import('../../vault/vaultService');
        const docs = await getDocs(user.id, 'documents', 30);
        if (docs.length === 0) {
          const msg = 'Nessun documento nel vault. Carica un PDF o un\'immagine con 📎.';
          setLastReply(msg); addMessage('nebula', msg);
        } else {
          const { inferRenderType } = await import('../widget/PolymorphicWidget');
          const meta = getCategoryMeta('documents');
          setActiveWidget({ category: 'documents', label: 'Documenti', color: meta.color, entries: docs, renderType: inferRenderType(docs, 'documents') });
          const reply = `📄 ${docs.length} documenti nel vault`;
          setLastReply(reply); addMessage('nebula', reply);
        }

      } else if (action.type === 'doc_retrieve') {
        const { getDocumentsByType } = await import('../../vault/vaultService');
        const { getDocumentUrl } = await import('../../import/documentStorage');
        const docs = action.docType
          ? await getDocumentsByType(user.id, action.docType)
          : await (await import('../../vault/vaultService')).getByCategory(user.id, 'documents', 10);
        if (docs.length === 0) {
          const msg = 'Documento non trovato nel vault.';
          setLastReply(msg); addMessage('nebula', msg);
        } else {
          const latest = docs[0];
          const d = latest.data as Record<string, unknown>;
          const path = d.storagePath as string | undefined;
          if (path) {
            const url = await getDocumentUrl(path);
            if (url) {
              const label = (d.docTypeLabel as string) ?? 'Documento';
              const reply = `📄 ${label} · link temporaneo generato`;
              setLastReply(reply);
              addMessage('nebula', `${reply}\n${url}`);
              window.open(url, '_blank');
            } else {
              const msg = 'Errore generazione link. Riprova.';
              setLastReply(msg); addMessage('nebula', msg);
            }
          } else {
            const msg = 'Documento senza file allegato.';
            setLastReply(msg); addMessage('nebula', msg);
          }
        }

      } else if (action.type === 'doc_query') {
        const { searchDocuments, getDocumentsByType } = await import('../../vault/vaultService');
        const { aiDocumentQuery } = await import('../../core/aiParser');
        const byType    = action.docType ? await getDocumentsByType(user.id, action.docType) : [];
        const byKeyword = await searchDocuments(user.id, action.keyword.slice(0, 30));
        const combined  = [...byType, ...byKeyword].filter((d, i, a) => a.findIndex(x => x.id === d.id) === i);
        const reply = await aiDocumentQuery(text, combined);
        setLastReply(reply.length > 80 ? reply.slice(0, 77) + '…' : reply);
        addMessage('nebula', reply);

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
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) return;
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
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,.md,.pdf,image/*"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) { handleFileUpload(e.target.files[0]); e.target.value = ''; } }}
      />

      {/* ── Top bar: nav + wordmark ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center',
        padding: '10px 14px',
        zIndex: 202, pointerEvents: 'none',
      }}>
        <button
          onMouseDown={e => { e.preventDefault(); setShowChatSidebar(!showChatSidebar); }}
          onTouchStart={e => { e.preventDefault(); setShowChatSidebar(!showChatSidebar); }}
          style={{
            background: 'none', border: 'none',
            borderRadius: 8, padding: '7px 8px',
            cursor: 'pointer',
            color: showChatSidebar ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.25s',
            pointerEvents: 'all',
          }}
          title="Cronologia chat"
        >
          <Menu size={14} />
        </button>
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontSize: 9, letterSpacing: '0.52em', textTransform: 'uppercase',
          color: 'rgba(80,95,125,0.38)', fontWeight: 300,
          pointerEvents: 'none', userSelect: 'none',
        }}>
          Alter
        </span>
      </div>

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

      {/* ── Welcome overlay: shown when no data yet ── */}
      <AnimatePresence>
        {stars.length === 0 && !isActive && !isProcessing && !lastReply && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            transition={{ duration: 1.2, delay: 0.5 }}
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -58%)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 100,
            }}
          >
            <div style={{
              fontSize: 34, fontWeight: 100,
              letterSpacing: '0.02em',
              color: 'rgba(200,210,234,0.65)',
              marginBottom: 14,
              lineHeight: 1.2,
              fontFamily: 'inherit',
            }}>
              Inizia il tuo<br/>universo.
            </div>
            <div style={{
              fontSize: 9.5, letterSpacing: '0.2em',
              color: 'rgba(58,63,82,0.65)',
              textTransform: 'uppercase', fontWeight: 300,
            }}>
              Scrivi qualcosa · Usa la voce
            </div>
          </motion.div>
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
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.4 }}
              style={{
                fontSize: 11.5, color: 'rgba(255,255,255,0.58)',
                letterSpacing: '0.04em', fontWeight: 300,
                textAlign: 'center', pointerEvents: 'none',
                lineHeight: 1.5,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 20, padding: '5px 16px',
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

        {/* CSV pending chip */}
        <AnimatePresence>
          {pendingCsv && !csvImporting && (
            <motion.div
              key="csv-pending"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                width: '100%',
                background: 'rgba(10,10,18,0.92)',
                border: '1px solid rgba(240,192,64,0.2)',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 8 }}>
                CSV · {pendingCsv.transactions.length} TRANSAZIONI RILEVATE
              </div>
              <div style={{ maxHeight: 100, overflowY: 'auto', marginBottom: 8 }}>
                {pendingCsv.transactions.slice(0, 5).map((tx, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, padding: '2px 0', color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>{tx.description}</span>
                    <span style={{ color: tx.type === 'income' ? '#4ecb71' : '#f08080', flexShrink: 0 }}>
                      {tx.type === 'income' ? '+' : '-'}{Math.abs(tx.amount).toFixed(2)}€
                    </span>
                  </div>
                ))}
                {pendingCsv.transactions.length > 5 && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>+{pendingCsv.transactions.length - 5} altre...</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onMouseDown={e => { e.preventDefault(); confirmCsvImport(); }}
                  style={{
                    flex: 1, background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.25)',
                    borderRadius: 8, padding: '6px', fontSize: 11, fontWeight: 600,
                    color: '#f0c040', cursor: 'pointer',
                  }}
                >
                  Importa {pendingCsv.transactions.length} transazioni
                </button>
                <button
                  onMouseDown={e => { e.preventDefault(); setPendingCsv(null); }}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: '6px 10px', fontSize: 11,
                    color: 'var(--text-dim)', cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* OCR loading indicator */}
        <AnimatePresence>
          {ocrLoading && (
            <motion.div
              key="ocr-loading"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                fontSize: 10.5, color: 'rgba(64,224,208,0.7)',
                letterSpacing: '0.08em',
                padding: '5px 14px',
                background: 'rgba(64,224,208,0.06)',
                border: '1px solid rgba(64,224,208,0.15)',
                borderRadius: 12,
              }}
            >
              ◌ Lettura OCR in corso...
            </motion.div>
          )}
        </AnimatePresence>

        {/* OCR pending chip */}
        <AnimatePresence>
          {pendingOcr && (
            <motion.div
              key="ocr-pending"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                width: '100%',
                background: 'rgba(10,10,18,0.92)',
                border: '1px solid rgba(64,224,208,0.2)',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, color: 'rgba(64,224,208,0.7)', letterSpacing: '0.1em', marginBottom: 6 }}>
                📄 {pendingOcr.filename.toUpperCase()}
                {pendingOcr.pageCount ? ` · ${pendingOcr.pageCount} PAG` : ''}
                {pendingOcr.confidence != null ? ` · OCR ${pendingOcr.confidence}%` : ''}
              </div>
              <div style={{
                maxHeight: 80, overflowY: 'auto', marginBottom: 8,
                fontSize: 10.5, color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.5,
                fontStyle: 'italic',
              }}>
                {pendingOcr.text.slice(0, 300)}{pendingOcr.text.length > 300 ? '…' : ''}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onMouseDown={e => { e.preventDefault(); confirmOcrImport(); }}
                  style={{
                    flex: 1, background: 'rgba(64,224,208,0.08)', border: '1px solid rgba(64,224,208,0.22)',
                    borderRadius: 8, padding: '6px', fontSize: 11, fontWeight: 600,
                    color: '#40e0d0', cursor: 'pointer',
                  }}
                >
                  Salva nel vault
                </button>
                <button
                  onMouseDown={e => { e.preventDefault(); setPendingOcr(null); }}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: '6px 10px', fontSize: 11,
                    color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input container — glass */}
        <motion.div
          animate={{ opacity: isActive || input.length > 0 ? 1 : 0.88 }}
          transition={{ duration: 0.4 }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(5,5,12,0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: isActive
              ? '1px solid rgba(240,192,64,0.18)'
              : '1px solid rgba(255,255,255,0.065)',
            borderRadius: 16,
            padding: '0 10px 0 16px',
            transition: 'border-color 0.35s',
            boxShadow: isActive
              ? '0 0 0 1px rgba(240,192,64,0.04), 0 8px 32px rgba(0,0,0,0.4)'
              : '0 4px 24px rgba(0,0,0,0.3)',
          }}
          onClick={openInput}
        >
          {/* Processing ring */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                key="proc-wrap"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.25 }}
                style={{ width: 14, height: 14, flexShrink: 0 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    border: '1.5px solid rgba(240,192,64,0.12)',
                    borderTopColor: 'rgba(240,192,64,0.7)',
                  }}
                />
              </motion.div>
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

          {/* Send / Mic + Attach */}
          {input.length > 0 ? (
            <button
              onMouseDown={e => { e.preventDefault(); handleSubmit(); }}
              onTouchStart={e => { e.preventDefault(); handleSubmit(); }}
              style={{
                background: 'rgba(240,192,64,0.1)',
                border: '1px solid rgba(240,192,64,0.22)',
                cursor: 'pointer',
                color: 'rgba(240,192,64,0.9)',
                padding: '7px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
                borderRadius: 10,
                transition: 'all 0.2s',
                pointerEvents: 'all',
              }}
            >
              <ArrowUp size={14} />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onMouseDown={e => { e.preventDefault(); fileRef.current?.click(); }}
                onTouchStart={e => { e.preventDefault(); fileRef.current?.click(); }}
                style={{
                  background: 'none', border: '1px solid transparent',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.18)',
                  padding: '7px', display: 'flex', alignItems: 'center',
                  borderRadius: 10, transition: 'all 0.2s', pointerEvents: 'all',
                }}
                title="Allega CSV"
              >
                <Paperclip size={13} />
              </button>
              <button
                onMouseDown={e => { e.preventDefault(); toggleVoice(); }}
                onTouchStart={e => { e.preventDefault(); toggleVoice(); }}
                style={{
                  background: listening ? 'rgba(240,100,100,0.1)' : 'none',
                  border: listening ? '1px solid rgba(240,100,100,0.2)' : '1px solid transparent',
                  cursor: 'pointer',
                  color: listening ? 'rgba(255,100,100,0.85)' : 'rgba(255,255,255,0.2)',
                  padding: '7px', flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  borderRadius: 10,
                  transition: 'all 0.2s',
                  pointerEvents: 'all',
                }}
              >
                {listening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
