import { useState, useEffect, useRef, useCallback } from 'react';
import { nebulaCameraRef } from './nebulaCamera';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, ArrowUp, Menu, Paperclip } from 'lucide-react';
import { orchestrate, inferQueryCategory, inferQueryDateRange } from '../../core/orchestrator';
import { parseBankCsv, importBankCsv, importBankXlsx } from '../../import/bankCsvImport';
import type { BankTransaction } from '../../import/bankCsvImport';
import { extractDocument, isDocumentFile } from '../../import/documentOcr';
import { quickConnect } from '../../core/insightEngine';
import { saveEntry, getByCategory, queryCalendarByDate, getRecentAll, getFinanceByTransactionDate, deleteCategory, deleteByCategoryAndDateRange, deleteAllUserData, saveChatSession, updateChatSession, saveCorrection } from '../../vault/vaultService';
import { aiQuery, aiChat, aiChatAndExtract, aiNexusNarrative, aiCapability, aiChatStream, aiChatAndExtractStream, aiCorrection, aiExtractCorrectionRule } from '../../core/aiParser';
import { validateEntry } from '../../core/l3Validator';
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
  'Ricordami tra 10 minuti di chiamare Marco...',
  'Perché sono sempre stanco?',
  'Audit di coerenza...',
  'Quiz cognitivo...',
  'Ricordami tra 1 ora di prendere le medicine...',
  'Ghost protocol...',
  'Ho un account su Instagram con email@mail.com...',
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
  const [csvElapsed,       setCsvElapsed]       = useState(0);
  const [csvProgress,      setCsvProgress]      = useState<{ done: number; total: number } | null>(null);
  const [pendingOcr,       setPendingOcr]       = useState<{ file: File; text: string; filename: string; pageCount?: number; confidence?: number } | null>(null);
  const [ocrLoading,       setOcrLoading]       = useState(false);
  const [ocrElapsed,       setOcrElapsed]       = useState(0);
  const [pendingDelete,    setPendingDelete]    = useState<{ label: string; onConfirm: () => Promise<void> } | null>(null);
  const [pendingClarification, setPendingClarification] = useState<{ originalText: string } | null>(null);
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
    viewMode, addTimer, messages,
    pendingGreeting, setPendingGreeting,
    setStreamingMessage,
    calibration, correctionRules, setShowCalibration,
    addCorrectionRule,
  } = useAlterStore();


  // ── Ghost star → pre-fill input ───────────────────────────
  useEffect(() => {
    if (!ghostStarPrompt) return;
    setInput(ghostStarPrompt);
    setIsActive(true);
    setGhostStarPrompt(null);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [ghostStarPrompt, setGhostStarPrompt]);

  // ── OCR elapsed timer ─────────────────────────────────────
  useEffect(() => {
    if (!ocrLoading) { setOcrElapsed(0); return; }
    const t = setInterval(() => setOcrElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [ocrLoading]);

  // ── CSV import elapsed timer ───────────────────────────────
  useEffect(() => {
    if (!csvImporting) { setCsvElapsed(0); return; }
    const t = setInterval(() => setCsvElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [csvImporting]);

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

  // ── File upload: CSV / XLSX / document (OCR) ────────────
  const handleFileUpload = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();

    // XLSX → bank import pipeline (same as CSV)
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      if (!user) return;
      addMessage('nebula', `Importazione ${file.name}...`);
      try {
        const result = await importBankXlsx(file, user.id, (d, t) => {
          setLastReply(`Importazione ${d}/${t}...`);
        });
        const dupNote = result.duplicates.length > 0 ? ` · ⚠ ${result.duplicates.length} doppioni saltati` : '';
        const msg = `✓ ${result.imported} transazioni importate da ${file.name}${dupNote}`;
        addMessage('nebula', msg);
        setLastReply(msg);
      } catch {
        addMessage('nebula', 'Errore durante l\'importazione XLSX.');
      } finally {
        setLastReply(null);
      }
      return;
    }

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
    setCsvProgress({ done: 0, total: transactions.length });
    addMessage('user', `Importa CSV · ${transactions.length} transazioni`);
    setLastReply('Categorizzazione in corso…');
    setProcessing(true);
    try {
      const result = await importBankCsv(text, user.id, (done, total) => {
        setCsvProgress({ done, total });
        setLastReply(`${done}/${total} transazioni…`);
      });
      const dupNote = result.duplicates.length > 0 ? ` · ⚠ ${result.duplicates.length} doppioni saltati` : '';
      const reply = `🏦 ${result.imported} transazioni importate nel vault${dupNote}`;
      setLastReply(reply);
      addMessage('nebula', reply);
      // update finance star
      const { buildStar } = await import('../starfield/StarfieldView');
      const star = buildStar('finance', 1, new Date().toISOString());
      const existing = useAlterStore.getState().stars.find(s => s.id === 'finance');
      upsertStar({ ...star, entryCount: (existing?.entryCount ?? 0) + result.imported, intensity: Math.min(1, (existing?.intensity ?? 0.3) + 0.05 * result.imported), isNew: !existing });
      addKnownCategory('finance');
    } catch {
      const msg = 'Errore durante l\'import CSV.';
      setLastReply(msg); addMessage('nebula', msg);
    } finally {
      setCsvImporting(false);
      setCsvProgress(null);
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
      const { uploadDocument } = await import('../../import/documentStorage');
      const upload = await uploadDocument(user.id, file);

      // 2. AI classifier — understands any document type without hardcoded rules
      setLastReply('Analisi AI...');
      const { classifyDocument } = await import('../../core/aiParser');
      const classification = await classifyDocument(text);

      // 3. Save vault entry (reference + extracted text + AI metadata)
      const vaultData: Record<string, unknown> = {
        storagePath:    upload.storagePath,
        filename,
        docType:        classification.docType,
        docTypeLabel:   classification.docTypeLabel,
        main_subject:   classification.main_subject,
        doc_date:       classification.doc_date,
        value:          classification.value,
        summary:        classification.summary,
        tags:           classification.tags,
        extractedText:  text.slice(0, 4000),
        charCount:      text.length,
        fileSize:       upload.fileSize,
        compressedSize: upload.compressedSize,
        mimeType:       file.type,
        uploadedAt:     new Date().toISOString(),
      };
      if (pendingOcr.pageCount) vaultData.pageCount = pendingOcr.pageCount;

      const saved = await saveEntry(user.id, 'documents', vaultData);
      if (!saved) throw new Error('Vault save failed');

      addKnownCategory('documents');
      const star     = buildStar('documents', 1, saved.created_at);
      const existing = useAlterStore.getState().stars.find(s => s.id === 'documents');
      upsertStar({ ...star, entryCount: (existing?.entryCount ?? 0) + 1, intensity: Math.min(1, (existing?.intensity ?? 0) + 0.1), isNew: !existing });

      const sizeSaved = Math.round((1 - upload.compressedSize / upload.fileSize) * 100);
      const sizeNote  = sizeSaved > 5 ? ` · −${sizeSaved}%` : '';
      const subjectNote = classification.main_subject ? ` · ${classification.main_subject}` : '';
      const valueNote   = classification.value ? ` · €${classification.value}` : '';
      const summaryLine = classification.summary && classification.summary !== classification.docTypeLabel
        ? `\n${classification.summary}` : '';
      const reply = `📄 ${classification.docTypeLabel}${subjectNote}${valueNote}${sizeNote}${summaryLine}`;
      setLastReply(`📄 ${classification.docTypeLabel}${subjectNote}${valueNote}${sizeNote}`);
      addMessage('nebula', reply);

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
    if (navigator.vibrate) navigator.vibrate([8, 4, 12]);

    setInput('');
    setIsActive(false);
    inputRef.current?.blur();
    addMessage('user', text);
    if (pendingGreeting) { addMessage('nebula', pendingGreeting); setPendingGreeting(null); }
    setProcessing(true);
    setLastReply(null);

    // If answering a pending clarification, merge original phrase + amount
    const wasClarification = pendingClarification !== null && overrideText === undefined;
    let processText = text;
    if (wasClarification) {
      processText = `${pendingClarification!.originalText} ${text}`;
      setPendingClarification(null);
    }

    try {
      const action = await orchestrate(processText, knownCategories);

      if (action.type === 'help') {
        setFocusMode(!focusMode);
        const focusCtx = focusMode
          ? 'L\'utente ha appena disattivato la modalità focus — le stelle tornano normali. Dì qualcosa di breve e caldo.'
          : 'L\'utente ha appena attivato la modalità focus — le stelle si illuminano tutte con le etichette. Dì qualcosa di breve e coinvolgente.';
        const msg = await aiChat(focusCtx, messages);
        setLastReply(msg); addMessage('nebula', msg);

      } else if (action.type === 'clarify') {
        if (wasClarification) {
          // User answered the clarification but still no amount — don't loop, give up
          const msg = 'Digita l\'importo (es. "15€") e ti registro la spesa.';
          setLastReply(msg); addMessage('nebula', msg);
        } else {
          const msg = 'Quanto hai speso?';
          setPendingClarification({ originalText: action.raw });
          setLastReply(msg); addMessage('nebula', msg);
        }

      } else if (action.type === 'capability') {
        const msg = await aiCapability(action.raw, messages);
        setLastReply(msg); addMessage('nebula', msg);

      } else if (action.type === 'save') {
        const { intent } = action;
        // For L1 hits: fire aiChat in parallel (no AI call was made yet)
        const chatPromise = intent.source === 'local' ? aiChat(text) : Promise.resolve(null);
        const [saved, chatReply] = await Promise.all([
          saveEntry(user.id, intent.category, intent.data),
          chatPromise,
        ]);
        if (saved && intent.category !== 'chat') {
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
          // ASMR particle burst at the star position
          useAlterStore.getState().setParticleBurst({ x: pos.x * window.innerWidth, y: pos.y * window.innerHeight, color: meta.color });
          const confirmTag = `${meta.icon} ${meta.label}`;

          // ── Dynamic Island timer: near-future calendar reminders ──
          if (intent.category === 'calendar' && intent.data.scheduled_at) {
            const endsAt = new Date(intent.data.scheduled_at as string).getTime();
            const delta  = endsAt - Date.now();
            // Start live countdown only for reminders within 24h
            if (delta > 0 && delta <= 24 * 3600 * 1000) {
              addTimer({
                id: saved.id,
                title: (intent.data.title as string) || (intent.data.raw as string) || 'Promemoria',
                endsAt,
              });
            }
          }

          // Show warm chat reply if available, then a minimal save signal
          if (chatReply) {
            const display = chatReply.length > 120 ? chatReply.slice(0, 117) + '…' : chatReply;
            setLastReply(display);
            addMessage('nebula', chatReply);
            setTimeout(() => addMessage('nebula', `✦ ${meta.icon}`), 800);
          } else {
            const reply = `✦ ${meta.icon} Registrato in ${meta.label}`;
            setLastReply(reply); addMessage('nebula', reply);
          }

          // ── L3 Validator: anomaly detection vs vault history ──
          if (['finance', 'health'].includes(intent.category)) {
            getByCategory(user.id, intent.category, 30).then(history => {
              const alert = validateEntry(intent.category, intent.data as Record<string, unknown>, history);
              if (alert) {
                setTimeout(() => {
                  addMessage('nebula', alert.message);
                }, 1200);
              }
            });
          }

          // ── Big Bang: proactive follow-up on first entry ──
          if (!existing) {
            const bigBangPromise = aiChat(
              `Hai appena visto la prima cosa che l'utente ha registrato in "${meta.label}" (${meta.icon}): ${JSON.stringify(intent.data)}. Reagisci da amico curioso — fai una domanda specifica su quello che hai visto, non generica. 1-2 frasi, tono naturale.`,
              messages
            );
            setTimeout(async () => {
              const bbMsg = await bigBangPromise;
              setLastReply(bbMsg); addMessage('nebula', bbMsg);
            }, 2400);

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
        // Build a compact vault snapshot from current stars so Alter can connect the dots
        const starsSnapshot = useAlterStore.getState().stars;
        const hasData = starsSnapshot.length > 0 || knownCategories.filter(c => !['finance','health','psychology','calendar'].includes(c)).length > 0;
        let vaultContext: string | undefined = starsSnapshot.length > 0
          ? starsSnapshot.map(s => `${s.icon} ${s.label}: ${s.entryCount} voci, ultima: ${s.lastEntry ? new Date(s.lastEntry).toLocaleDateString('it-IT') : 'n/d'}`).join('\n')
          : hasData ? '(dati presenti nel vault, stelle ancora in caricamento)' : undefined;
        // If the chat message hints at finances, inject real transaction data
        let chatHasDetailedData = false;
        if (user && inferQueryCategory(text) === 'finance') {
          const detectedRange = inferQueryDateRange(text);
          const finEntries = await getFinanceByTransactionDate(user.id, detectedRange?.[0], detectedRange?.[1], 100);
          if (finEntries.length > 0) {
            const txLines = finEntries.slice(0, 60).map(e => {
              const d = e.data as Record<string, unknown>;
              return `[${String(d.date ?? e.created_at).slice(0, 10)}] ${d.type === 'income' ? '+' : '-'}${Math.abs(Number(d.amount ?? 0)).toFixed(2)}€ ${String(d.description ?? '')}`;
            }).join('\n');
            vaultContext = (vaultContext ? vaultContext + '\n\n' : '') + `Transazioni finance:\n${txLines}`;
            chatHasDetailedData = true;
          }
        }
        const reply = await aiChatStream(text, (chunk) => setStreamingMessage(chunk), messages, vaultContext, undefined, calibration, correctionRules, chatHasDetailedData);
        setStreamingMessage(null);
        setLastReply(reply.length > 120 ? reply.slice(0, 117) + '…' : reply);
        addMessage('nebula', reply);

      } else if (action.type === 'delete') {
        const { category, dateRange, all } = action;

        if (all && user) {
          // Full reset — ask confirmation
          addMessage('nebula', '⚠️ Stai per cancellare TUTTI i tuoi dati. Irreversibile. Confermi?');
          setPendingDelete({
            label: 'Cancella TUTTI i dati del vault',
            onConfirm: async () => {
              const ok = await deleteAllUserData(user.id);
              const msg = ok ? 'Vault azzerato. Tutte le stelle sono state rimosse.' : 'Errore durante il reset.';
              if (ok) stars.forEach(s => removeStar(s.id));
              setLastReply(msg); addMessage('nebula', msg);
            },
          });
        } else if (category && dateRange && user) {
          // Date-range targeted delete — ask confirmation
          const [from, to] = dateRange;
          const fromStr = from.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
          const toStr   = to.toLocaleDateString('it-IT',   { day: '2-digit', month: 'short', year: 'numeric' });
          const label = `Cancella "${category}" dal ${fromStr} al ${toStr}`;
          addMessage('nebula', `Stai per cancellare i dati "${category}" dal ${fromStr} al ${toStr}. Confermi?`);
          setPendingDelete({
            label,
            onConfirm: async () => {
              const count = await deleteByCategoryAndDateRange(user.id, category, from, to);
              const msg = count > 0
                ? `${count} voci "${category}" cancellate (${fromStr} → ${toStr}).`
                : `Nessuna voce trovata in quel periodo per "${category}".`;
              setLastReply(msg); addMessage('nebula', msg);
            },
          });
        } else if (category && user) {
          if (category === 'ai_profile') return; // black box — invisible to user
          // Delete entire category (star) — ask confirmation first
          addMessage('nebula', `⚠️ Stai per eliminare tutta la categoria "${category}" e i suoi dati. L'azione è irreversibile. Confermi?`);
          setPendingDelete({
            label: `Elimina categoria "${category}"`,
            onConfirm: async () => {
              const ok = await deleteCategory(user.id, category);
              const msg = ok ? `Stella "${category}" rimossa.` : `Categoria "${category}" non trovata.`;
              if (ok) removeStar(category);
              setLastReply(msg); addMessage('nebula', msg);
            },
          });
        } else {
          const msg = await aiChat(`L'utente ha detto "${text}" ma non è chiaro cosa vuole cancellare. Chiedigli gentilmente cosa intende eliminare — puoi cancellare una categoria intera, un periodo specifico, o tutto.`, messages);
          setLastReply(msg); addMessage('nebula', msg);
        }

      } else if (action.type === 'query') {
        const { category, dateRange } = action;
        let entries = [];
        if (category === 'calendar' && dateRange) {
          entries = await queryCalendarByDate(user.id, dateRange[0], dateRange[1]);
        } else if (category === 'finance') {
          // Use actual transaction date (data->>'date'), not import time (created_at)
          entries = await getFinanceByTransactionDate(
            user.id,
            dateRange ? dateRange[0] : undefined,
            dateRange ? dateRange[1] : undefined,
            200
          );
        } else if (category) {
          entries = await getByCategory(user.id, category, 50);
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
        const reply = await aiQuery(text, entries, calibration, correctionRules);
        setLastReply(reply.length > 80 ? reply.slice(0, 77) + '…' : reply);
        addMessage('nebula', reply);
        if (category) {
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

      } else if (action.type === 'nexus') {
        const { catA, catB } = action;
        // Free-form nexus: "Perché sono stanco?" — no explicit categories given
        if (!catB) {
          const entries = await getRecentAll(user.id, 60);
          if (entries.length < 3) {
            const msg = await aiChat(`L'utente vuole usare il Nexus (correlazioni tra categorie) ma ha solo ${entries.length} dati nel vault — troppo pochi. Spiegagli in modo caldo cosa deve fare per attivarlo.`, messages);
            setLastReply(msg); addMessage('nebula', msg);
          } else {
            setLastReply('✦ Nexus in analisi...');
            const narrative = await aiNexusNarrative(text, entries);
            addMessage('nebula', narrative);
            setLastReply('✦ Nexus');
          }
        } else {
          // Both catA and catB are strings here (catB checked above, catA may still be null → fallback)
          const a = catA ?? 'psychology';
          const b = catB;
          const [entriesA, entriesB] = await Promise.all([
            getByCategory(user.id, a, 30),
            getByCategory(user.id, b, 30),
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
          const mapA  = dayBucket(entriesA, valueKey(a));
          const mapB  = dayBucket(entriesB, valueKey(b));
          const days  = [...mapA.keys()].filter(d => mapB.has(d)).sort();
          if (days.length < 3) {
            const msg = await aiChat(`L'utente vuole vedere la correlazione tra ${a} e ${b} ma ci sono solo ${days.length} giorni in comune — troppo pochi. Spiegagli in modo caldo cosa manca e come rimediare.`, messages);
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
            const metaA = getCategoryMeta(a);
            const metaB = getCategoryMeta(b);
            const chartData = days.map((d, i) => ({
              date: d.slice(5).replace('-', '/'),
              [a]: +(nx[i] * 100).toFixed(1),
              [b]: +(ny[i] * 100).toFixed(1),
            }));
            setNexusBeam({ catA: a, catB: b, colorA: metaA.color, colorB: metaB.color, correlation: corr });
            setTimeout(() => setNexusBeam(null), 9000);
            const corrPct  = (Math.abs(corr) * 100).toFixed(0);
            const corrSign = corr > 0.25 ? 'positiva' : corr < -0.25 ? 'inversa' : 'debole';
            const reply    = await aiChat(
              `Ho calcolato una correlazione ${corrSign} del ${corrPct}% tra ${metaA.label} e ${metaB.label} su ${n} giorni di dati. Commenta questo risultato in modo caldo e concreto — cosa significa per la vita dell'utente? Max 2 frasi.`,
              messages
            );
            setLastReply(reply.length > 80 ? reply.slice(0, 77) + '…' : reply);
            addMessage('nebula', reply);
            setActiveWidget({
              category: 'nexus',
              label: `${metaA.icon} ${metaA.label} ↔ ${metaB.icon} ${metaB.label}`,
              color: metaA.color,
              entries: [{ id: 'nexus', user_id: user.id, category: 'nexus',
                data: { catA: a, catB: b, catALabel: metaA.label, catBLabel: metaB.label,
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
          const msg = await aiChat('L\'utente chiede i suoi documenti ma il vault è vuoto. Suggeriscigli di caricare un PDF con il tasto 📎 — puoi archiviare buste paga, bollette, fatture, referti. Max 1-2 frasi, tono caldo.', messages);
          setLastReply(msg); addMessage('nebula', msg);
        } else {
          const { inferRenderType } = await import('../widget/PolymorphicWidget');
          const meta = getCategoryMeta('documents');
          setActiveWidget({ category: 'documents', label: 'Documenti', color: meta.color, entries: docs, renderType: inferRenderType(docs, 'documents') });
          const reply = `📄 ${docs.length} documenti nel vault`;
          setLastReply(reply); addMessage('nebula', reply);
        }

      } else if (action.type === 'doc_retrieve') {
        const { getDocumentsByType, getByCategory: getAllDocs } = await import('../../vault/vaultService');
        let docs = action.docType
          ? await getDocumentsByType(user.id, action.docType)
          : await getAllDocs(user.id, 'documents', 50);
        // Filter by year if specified
        if (action.year) {
          docs = docs.filter(d => new Date(d.created_at).getFullYear() === action.year);
        }
        if (docs.length === 0) {
          const yearHint = action.year ? ` del ${action.year}` : '';
          const msg = await aiChat(`L'utente cerca documenti${yearHint} ma non ne ho trovati nel vault. Digli gentilmente che può caricarli con 📎. Max 1 frase.`, messages);
          setLastReply(msg); addMessage('nebula', msg);
        } else {
          const meta = getCategoryMeta('documents');
          const yearHint = action.year ? ` ${action.year}` : '';
          const typeLabel = docs[0] ? ((docs[0].data as Record<string,unknown>).docTypeLabel as string) ?? 'Documenti' : 'Documenti';
          setActiveWidget({
            category: 'documents',
            label: `${typeLabel}${yearHint} · ${docs.length}`,
            color: meta.color,
            entries: docs,
            renderType: 'doc_download',
          });
          const reply = `📄 ${docs.length} document${docs.length === 1 ? 'o' : 'i'} trovat${docs.length === 1 ? 'o' : 'i'}`;
          setLastReply(reply); addMessage('nebula', reply);
        }

      } else if (action.type === 'doc_query') {
        const { getByCategory: getAllDocs } = await import('../../vault/vaultService');
        const { aiDocumentQuery } = await import('../../core/aiParser');
        // Semantic query: pass ALL documents and let the AI decide what's relevant
        const allDocs = await getAllDocs(user.id, 'documents', 25);
        const reply = await aiDocumentQuery(text, allDocs);
        setLastReply(reply.length > 80 ? reply.slice(0, 77) + '…' : reply);
        addMessage('nebula', reply);

      } else if (action.type === 'web_search') {
        setLastReply('🔎 Cerco online...');
        const { webSearch } = await import('../../core/webSearch');
        const webContext = await webSearch(action.query);
        const reply = await aiChatStream(
          action.raw,
          (chunk) => setStreamingMessage(chunk),
          messages,
          undefined,
          webContext ?? undefined,
          calibration,
          correctionRules,
        );
        setStreamingMessage(null);
        setLastReply(reply.length > 80 ? reply.slice(0, 77) + '…' : reply);
        addMessage('nebula', reply);

      } else if (action.type === 'coherence_audit') {
        const { generateCoherenceAudit } = await import('../../core/insightEngine');
        addMessage('nebula', '🔍 Sto analizzando i tuoi dati degli ultimi 90 giorni...');
        const report = await generateCoherenceAudit(user.id);
        if (!report) {
          const err = 'Non ho ancora abbastanza dati per fare un audit di coerenza. Continua a tracciare le tue giornate!';
          setLastReply(err); addMessage('nebula', err);
        } else {
          const color = report.score >= 70 ? '#40e0d0' : report.score >= 45 ? '#f0c040' : '#f08080';
          setActiveWidget({
            category:   'insight',
            label:      'Audit di Coerenza',
            color,
            entries:    [{ id: 'coherence', user_id: user.id, category: 'insight', data: report as unknown as Record<string, unknown>, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
            renderType: 'coherence',
          });
          const intro = report.score >= 70
            ? `✦ Punteggio di coerenza: ${report.score}/100. Stai camminando nella direzione giusta.`
            : report.score >= 45
            ? `✦ Punteggio di coerenza: ${report.score}/100. Ci sono alcune tensioni da guardare insieme.`
            : `✦ Punteggio di coerenza: ${report.score}/100. Ho trovato delle contraddizioni importanti — ma insieme possiamo lavorarci.`;
          setLastReply(intro); addMessage('nebula', intro);
        }

      } else if (action.type === 'quiz') {
        const quizEntries = await getByCategory(user.id, 'quiz', 50);
        const quizMeta = getCategoryMeta('quiz');
        setActiveWidget({ category: 'quiz', label: 'Quiz Cognitivi', color: quizMeta.color, entries: quizEntries, renderType: 'quiz' });
        const reply = quizEntries.length === 0
          ? '🧩 Cognitive Battery pronta — testa reazione, memoria di lavoro e riconoscimento dei pattern!'
          : `🧩 ${quizEntries.length} session${quizEntries.length === 1 ? 'e' : 'i'} completata${quizEntries.length === 1 ? '' : 'e'}. Pronto per una nuova sfida?`;
        setLastReply(reply); addMessage('nebula', reply);

      } else if (action.type === 'privacy') {
        const privacyEntries = await getByCategory(user.id, 'privacy', 200);
        setActiveWidget({ category: 'privacy', label: 'Ghost Protocol', color: '#7c3aed', entries: privacyEntries, renderType: 'privacy' });
        const reply = privacyEntries.length > 0
          ? `👁 Ombra digitale attivata. ${privacyEntries.length} account tracciato${privacyEntries.length > 1 ? 'i' : ''}.`
          : '👁 Ghost Protocol attivo. Dimmi "ho un account su Facebook con email@mail.com" per iniziare a tracciare la tua impronta digitale.';
        setLastReply(reply); addMessage('nebula', reply);

      } else if (action.type === 'codex') {
        const { getChronicles } = await import('../../vault/vaultService');
        const chronicles = await getChronicles(user.id);
        const meta = getCategoryMeta('chronicle');
        setActiveWidget({
          category:   'chronicle',
          label:      'Il Codex Galattico',
          color:      meta.color,
          entries:    chronicles,
          renderType: 'codex',
        });
        const reply = chronicles.length === 0
          ? '📖 Il tuo Codex Galattico è pronto. Genera il primo capitolo.'
          : `📖 ${chronicles.length} capitol${chronicles.length === 1 ? 'o' : 'i'} scritti. Il nostro viaggio continua.`;
        setLastReply(reply); addMessage('nebula', reply);

      } else if (action.type === 'correction') {
        // User flagged something wrong — Nebula apologizes proactively + saves a correction rule
        const reply = await aiCorrection(text, (chunk) => setStreamingMessage(chunk), correctionRules, calibration);
        setStreamingMessage(null);
        setLastReply(reply.length > 120 ? reply.slice(0, 117) + '…' : reply);
        addMessage('nebula', reply);

        // Extract and persist the correction rule (fire and forget)
        if (user) {
          aiExtractCorrectionRule(text).then(rule => {
            saveCorrection(user.id, rule, text);
            addCorrectionRule({ rule, trigger: text, createdAt: new Date().toISOString() });
          });
        }

      } else if (action.type === 'calibrate') {
        setShowCalibration(true);
        const msg = 'Dimmi come preferisci che mi esprima — aggiusta i cursori e salvo il profilo 🌌';
        addMessage('nebula', msg);
        setLastReply(msg);

      } else {
        // Auto-trigger calibration after 10th message if never calibrated, or every 50 messages
        const msgCount = messages.length;
        if (!calibration && msgCount >= 10 && msgCount % 50 !== 0) {
          // First-time trigger: show after processing
        }
        if (msgCount > 0 && msgCount % 50 === 0) {
          setTimeout(() => {
            setShowCalibration(true);
            addMessage('nebula', 'Ogni tanto mi piace chiederti — sto parlando come preferisci? 🌌 Puoi regolare il mio tono con i cursori qui sotto.');
          }, 1500);
        }

        // Chatbot-first: AI replies and optionally extracts data in one call (streaming)
        const starsForFallback = useAlterStore.getState().stars;
        let fallbackVaultContext: string | undefined = starsForFallback.length > 0
          ? starsForFallback.map(s => `${s.icon} ${s.label}: ${s.entryCount} voci, ultima: ${s.lastEntry ? new Date(s.lastEntry).toLocaleDateString('it-IT') : 'n/d'}`).join('\n')
          : undefined;

        // If the query is finance-related, inject real transaction data so the AI can actually answer
        let fallbackHasDetailedData = false;
        if (user && inferQueryCategory(text) === 'finance') {
          const detectedRange = inferQueryDateRange(text);
          const finEntries = await getFinanceByTransactionDate(
            user.id,
            detectedRange?.[0],
            detectedRange?.[1],
            100
          );
          if (finEntries.length > 0) {
            const txLines = finEntries.slice(0, 60).map(e => {
              const d = e.data as Record<string, unknown>;
              return `[${String(d.date ?? e.created_at).slice(0, 10)}] ${d.type === 'income' ? '+' : '-'}${Math.abs(Number(d.amount ?? 0)).toFixed(2)}€ ${String(d.description ?? '')}`;
            }).join('\n');
            fallbackVaultContext = (fallbackVaultContext ? fallbackVaultContext + '\n\n' : '') + `Transazioni finance:\n${txLines}`;
            fallbackHasDetailedData = true;
          }
        }

        const result = await aiChatAndExtractStream(text, (chunk) => setStreamingMessage(chunk), messages, fallbackVaultContext, calibration, correctionRules, fallbackHasDetailedData);
        setStreamingMessage(null);
        const display = result.reply.length > 80 ? result.reply.slice(0, 77) + '…' : result.reply;
        setLastReply(display);
        addMessage('nebula', result.reply);

        if (result.extractions.length > 0) {
          const { CATEGORY_META } = await import('../starfield/StarfieldView');
          const savedCats: string[] = [];
          for (const ext of result.extractions) {
            if (ext.category === 'chat') continue;
            const saved = await saveEntry(user.id, ext.category, { ...ext.data, raw: text });
            if (saved) {
              addKnownCategory(ext.category);
              if (ext.categoryMeta && !CATEGORY_META[ext.category]) {
                CATEGORY_META[ext.category] = ext.categoryMeta;
              }
              const star     = buildStar(ext.category, 1, saved.created_at);
              const existing = useAlterStore.getState().stars.find(s => s.id === ext.category);
              upsertStar({ ...star, entryCount: (existing?.entryCount ?? 0) + 1, intensity: Math.min(1, (existing?.intensity ?? 0) + 0.12), isNew: !existing });
              const meta = getCategoryMeta(ext.category);
              savedCats.push(`${meta.icon} ${meta.label}`);
            }
          }
          if (savedCats.length > 0) {
            setTimeout(() => addMessage('nebula', `✦ ${savedCats.join(' · ')}`), 600);
          }
        }
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
      setStreamingMessage(null);
      setProcessing(false);
    }
  }, [input, isProcessing, user, knownCategories, focusMode, upsertStar, removeStar, addKnownCategory, setFocusMode, setProcessing, addMessage, setHighlightedStar, setActiveWidget, setNexusBeam, setCurrentSessionId, pendingClarification, setStreamingMessage]);

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
        accept="application/pdf,text/csv,text/plain,text/markdown,.csv,.txt,.md,.pdf,image/*"
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
        {viewMode === 'chat' && (
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
        )}
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


      {/* ── World-space anchor (camera sync — invisible) ── */}
      <div ref={anchorRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', willChange: 'transform' }} />

      {/* ── Central processing overlay ── */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            key="proc-center"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed',
              bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 18px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 202,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'none',
            }}
          >
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2], scaleY: [0.6, 1.3, 0.6] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
                style={{
                  display: 'block',
                  width: 3, height: 18,
                  borderRadius: 2,
                  background: 'rgba(240,192,64,0.8)',
                  transformOrigin: 'center',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom minimal input ── */}
      <motion.div
        ref={nebulaWrapRef}
        animate={{ opacity: isProcessing ? 0 : 1, y: isProcessing ? 24 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed',
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          left: 0,
          right: 0,
          marginLeft: 'auto',
          marginRight: 'auto',
          zIndex: 202,
          width: 'min(440px, calc(100vw - 48px))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          pointerEvents: isProcessing ? 'none' : 'all',
        }}
      >

        {/* Status / reply above input — only during processing */}
        <AnimatePresence mode="wait">
          {lastReply && isProcessing ? (
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

        {/* Delete confirmation */}
        <AnimatePresence>
          {pendingDelete && (
            <motion.div
              key="delete-confirm"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                width: '100%',
                background: 'rgba(20,8,8,0.95)',
                border: '1px solid rgba(240,80,80,0.28)',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, color: 'rgba(240,80,80,0.8)', letterSpacing: '0.1em', marginBottom: 8 }}>
                ⚠️ CONFERMA CANCELLAZIONE
              </div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
                {pendingDelete.label}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => { const fn = pendingDelete.onConfirm; setPendingDelete(null); await fn(); }}
                  style={{
                    flex: 1, background: 'rgba(240,80,80,0.15)', border: '1px solid rgba(240,80,80,0.35)',
                    borderRadius: 9, padding: '7px', fontSize: 11.5, fontWeight: 600,
                    color: '#f08080', cursor: 'pointer', letterSpacing: '0.04em',
                  }}
                >
                  Sì, cancella
                </button>
                <button
                  onClick={() => { setPendingDelete(null); addMessage('nebula', 'Cancellazione annullata.'); }}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    borderRadius: 9, padding: '7px 14px', fontSize: 11.5,
                    color: 'var(--text-dim)', cursor: 'pointer',
                  }}
                >
                  Annulla
                </button>
              </div>
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
                background: 'var(--glass)',
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

        {/* CSV importing indicator */}
        <AnimatePresence>
          {csvImporting && (
            <motion.div
              key="csv-loading"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                padding: '12px 14px',
                background: 'rgba(240,192,64,0.07)',
                border: '1px solid rgba(240,192,64,0.25)',
                borderRadius: 14,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'rgba(240,192,64,0.9)', letterSpacing: '0.06em', fontWeight: 500 }}>
                  {csvProgress
                    ? `${csvProgress.done} / ${csvProgress.total} transazioni`
                    : 'Importazione in corso…'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {csvProgress && csvProgress.total > 0 && (
                    <div style={{ fontSize: 11, color: 'rgba(240,192,64,0.7)', fontWeight: 600 }}>
                      {Math.round((csvProgress.done / csvProgress.total) * 100)}%
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: 'rgba(240,192,64,0.4)', letterSpacing: '0.04em' }}>
                    {csvElapsed}s
                  </div>
                </div>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: 'rgba(240,192,64,0.12)', overflow: 'hidden', position: 'relative' }}>
                {csvProgress && csvProgress.total > 0 ? (
                  <motion.div
                    animate={{ width: `${Math.round((csvProgress.done / csvProgress.total) * 100)}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{ position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, rgba(240,192,64,0.5), rgba(240,192,64,0.9))' }}
                  />
                ) : (
                  <motion.div
                    animate={{ x: ['-80%', '180%'] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '55%', borderRadius: 4, background: 'linear-gradient(90deg, transparent, rgba(240,192,64,0.7), transparent)' }}
                  />
                )}
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
                padding: '12px 14px',
                background: 'rgba(64,224,208,0.05)',
                border: '1px solid rgba(64,224,208,0.18)',
                borderRadius: 14,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                <div style={{ fontSize: 10, color: 'rgba(64,224,208,0.75)', letterSpacing: '0.08em' }}>
                  {ocrElapsed < 4 ? 'Lettura documento…' : ocrElapsed < 10 ? 'Analisi testo…' : 'Elaborazione AI…'}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(64,224,208,0.4)', letterSpacing: '0.04em' }}>
                  {ocrElapsed}s{ocrElapsed < 6 ? '' : ocrElapsed < 15 ? ' · ~15s' : ' · ancora un po\'…'}
                </div>
              </div>
              {/* Indeterminate shimmer bar */}
              <div style={{ height: 3, borderRadius: 3, background: 'rgba(64,224,208,0.10)', overflow: 'hidden', position: 'relative' }}>
                <motion.div
                  animate={{ x: ['-80%', '180%'] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '55%', borderRadius: 3, background: 'linear-gradient(90deg, transparent, rgba(64,224,208,0.7), transparent)' }}
                />
              </div>
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
                background: 'var(--glass)',
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
            background: 'var(--glass)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: isActive
              ? '1px solid rgba(240,192,64,0.18)'
              : '1px solid var(--border)',
            borderRadius: 16,
            padding: '0 10px 0 16px',
            transition: 'border-color 0.35s',
            boxShadow: isActive
              ? '0 0 0 1px rgba(240,192,64,0.04), 0 8px 32px rgba(0,0,0,0.4)'
              : '0 4px 24px rgba(0,0,0,0.3)',
          }}
          onClick={openInput}
        >
          {/* Processing indicator */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                key="proc-dots"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, paddingRight: 2 }}
              >
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2], scaleY: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
                    style={{
                      display: 'block',
                      width: 3, height: 12,
                      borderRadius: 2,
                      background: 'rgba(240,192,64,0.75)',
                      transformOrigin: 'center',
                    }}
                  />
                ))}
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
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 16, fontWeight: 300,
              letterSpacing: '0.02em',
              caretColor: 'var(--text)',
              minHeight: 46,
              WebkitAppearance: 'none',
            }}
          />

          {/* Send / Mic + Attach */}
          {input.length > 0 ? (
            <motion.button
              onMouseDown={e => { e.preventDefault(); handleSubmit(); }}
              onTouchStart={e => { e.preventDefault(); handleSubmit(); }}
              whileTap={{ scale: 0.72 }}
              transition={{ type: 'spring', stiffness: 700, damping: 15, mass: 0.8 }}
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
            </motion.button>
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

      </motion.div>
    </div>
  );
}
