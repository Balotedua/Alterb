/**
 * Local keyword-based Italian NLP intent parser.
 * Works without any AI API — used as primary parser when VITE_DEEPSEEK_API_KEY
 * is not set, or as fallback when the DeepSeek call fails.
 */

import type { NebulaIntent, NebulaResponseType } from '@/store/nebulaStore';
import type { NebulaContext } from '@/types/nebula';

export interface LocalIntentResult {
  type: NebulaResponseType;
  module: 'FINANCE' | 'HEALTH' | 'PSYCH' | 'NONE';
  intent: NebulaIntent;
  fragment: string;
  params: Record<string, unknown>;
  intensity: number;
  message: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function num(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

function days(text: string): number | null {
  const pats = [
    /ultim[oi]\s+(\d+)\s+giorni?/i,
    /negli?\s+ultim[oi]\s+(\d+)\s+giorni?/i,
    /(\d+)\s+giorni?\s+fa/i,
    /(\d+)gg/i,
  ];
  for (const p of pats) {
    const m = text.match(p);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function has(text: string, ...patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

const MONTHS_IT: Record<string, number> = {
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
  luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12,
};

function parseMonth(text: string): { month: number; year: number | null } | null {
  for (const [name, num] of Object.entries(MONTHS_IT)) {
    const re = new RegExp(`\\b${name}\\b`, 'i');
    if (re.test(text)) {
      const yearMatch = text.match(/\b(20\d{2})\b/);
      return { month: num, year: yearMatch ? parseInt(yearMatch[1]) : null };
    }
  }
  return null;
}

function parseLimit(text: string): number | null {
  const m = text.match(/\b(?:ultime?|prime?|ultim[oi])\s+(\d+)\s+transazioni?/i);
  return m ? parseInt(m[1]) : null;
}

// ── main parser ───────────────────────────────────────────────────────────────

export function parseLocalIntent(raw: string, context?: NebulaContext | null): LocalIntentResult {
  const t = raw.toLowerCase().trim();

  const isDelete = has(t, /\b(cancella|elimina|rimuovi|togli|delete)\b/);
  const isAdd    = has(t, /\b(aggiungi|inserisci|registra|ho speso|ho guadagnato|nuov[ae]? (spesa|entrata|transazione)|add)\b/);
  const isShow   = has(t, /\b(mostrami|mostra|vedi|visualizza|dammi|voglio vedere|elenco|lista|apri)\b/);
  const isChart  = has(t, /\b(grafico|andamento|trend|storico|storia)\b/);

  const isFinance  = has(t, /\b(spesa|spese|entrat[ae]|soldi|saldo|finanze?|budget|transazion[ei]|euro|€|conto|bonifico|pagamento)\b/);
  const isIncome   = has(t, /\b(entrat[ae]|guadagn[oi]|stipendio|ricevuto|incassato)\b/);
  const isHealth   = has(t, /\b(sonno|dormito|dormi|peso|acqua|bevo|bevuto|salute|esercizio|allenamento|calorie|sport|attività|passi|profilo salute|setup salute|recap salute)\b/);
  const isPsych    = has(t, /\b(umore|emozioni?|stress|ansia|ansioso|triste|felice|contento|come sto|mi sento|sento|benessere)\b/);

  // ── FINANCE ────────────────────────────────────────────────────────────────

  if (isDelete && (isFinance || has(t, /\b(spese|transazion[ei])\b/))) {
    const filterType = isIncome ? 'income' : has(t, /\b(spese|uscite|pagamenti)\b/) ? 'expense' : null;

    // "elimina tutte le transazioni / elimina tutto"
    if (has(t, /\b(tutte?|tutto)\b/) && !has(t, /\b(ultim[oi]|giorni?)\b/)) {
      return {
        type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
        fragment: 'FinanceDelete',
        params: { deleteAll: true, ...(filterType ? { filterType } : {}) },
        intensity: 0.85,
        message: filterType === 'expense'
          ? 'Attenzione: stai per eliminare tutte le uscite. Conferma nella lista.'
          : filterType === 'income'
            ? 'Attenzione: stai per eliminare tutte le entrate. Conferma nella lista.'
            : 'Attenzione: stai per eliminare tutte le transazioni. Conferma nella lista.',
      };
    }

    // "elimina le ultime N transazioni"
    const lim = parseLimit(t);
    if (lim !== null) {
      return {
        type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
        fragment: 'FinanceDelete',
        params: { limit: lim, ...(filterType ? { filterType } : {}) },
        intensity: 0.75,
        message: `Ecco le ultime ${lim} transazioni. Eliminale singolarmente o tutte insieme.`,
      };
    }

    // "elimina le transazioni di aprile / marzo 2026"
    const monthParsed = parseMonth(t);
    if (monthParsed) {
      const monthNames: Record<number, string> = {
        1:'gennaio', 2:'febbraio', 3:'marzo', 4:'aprile', 5:'maggio', 6:'giugno',
        7:'luglio', 8:'agosto', 9:'settembre', 10:'ottobre', 11:'novembre', 12:'dicembre',
      };
      return {
        type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
        fragment: 'FinanceDelete',
        params: {
          month: monthParsed.month,
          ...(monthParsed.year ? { year: monthParsed.year } : {}),
          ...(filterType ? { filterType } : {}),
        },
        intensity: 0.75,
        message: `Transazioni di ${monthNames[monthParsed.month]}${monthParsed.year ? ` ${monthParsed.year}` : ''}. Eliminale singolarmente o tutte insieme.`,
      };
    }

    // "elimina spese ultimi N giorni"
    const d = days(t);
    return {
      type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceDelete',
      params: { ...(d ? { days: d } : {}), ...(filterType ? { filterType } : {}) },
      intensity: 0.7,
      message: d
        ? `Transazioni degli ultimi ${d} giorni. Eliminale singolarmente o tutte insieme.`
        : 'Le tue transazioni recenti. Eliminale singolarmente o tutte insieme.',
    };
  }

  // "aggiungi transazione" generico senza dettagli → apri form vuoto
  if (isAdd && has(t, /\btransazion[ei]\b/) && !isFinance && !isIncome) {
    return {
      type: 'ACTION', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceAdd',
      params: {},
      intensity: 0.5,
      message: 'Inserisci i dettagli della transazione.',
    };
  }

  // CSV import
  if (has(t, /\b(csv|importa|importazione|carica|upload|massiva?)\b/) && has(t, /\b(transazion[ei]|spese|csv|dati|file)\b/)) {
    return {
      type: 'ACTION', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceCsv',
      params: {},
      intensity: 0.5,
      message: 'Carica il tuo file CSV. Colonne attese: date, amount, type, description, category.',
    };
  }

  if (isAdd && (isFinance || isIncome)) {
    const amount = num(t);
    const type = isIncome ? 'income' : 'expense';
    const cleanDesc = t
      .replace(/\d+(?:[.,]\d+)?(\s*(euro|€))?/g, '')
      .replace(/\b(aggiungi|inserisci|registra|ho speso|ho guadagnato|nuova?|spesa|entrata|euro|€)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceAdd',
      params: { amount, description: cleanDesc || null, type },
      intensity: 0.6,
      message: type === 'income' ? 'Registriamo questa entrata.' : 'Registriamo questa spesa.',
    };
  }

  // Analisi / grafici
  if (isFinance && has(t, /\b(analisi|analizza|statistiche?|grafico|grafici|andamento|trend|settimana|giorno|mensile|mesi|storico|quando spendo|spendo di più|picco)\b/)) {
    return {
      type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceAnalytics',
      params: {},
      intensity: 0.5,
      message: 'Ecco le tue analisi finanziarie. Tre viste: ultimi 7 giorni, spesa per giorno della settimana e confronto 6 mesi.',
    };
  }

  // Associa / collega transazioni non categorizzate
  if (has(t, /\b(associa|collega|linka?|categorizza)\b/) && has(t, /\b(transazion[ei]|spese?|moviment[io]|non categ|non assoc|da assoc)\b/)) {
    return {
      type: 'ACTION', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceLink',
      params: {},
      intensity: 0.55,
      message: 'Ecco le transazioni non ancora categorizzate. Seleziona una categoria di default o scegline un\'altra.',
    };
  }

  // Spese per categoria
  if (isFinance && has(t, /\b(categori[ae]|categoria|categorizzo|non categorizzat[eo]|raggruppa|per tipo)\b/)) {
    const type = isIncome ? 'income' : has(t, /\bspese?\b/) ? 'expense' : null;
    return {
      type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceCategory',
      params: type ? { type } : {},
      intensity: 0.5,
      message: 'Ecco le tue spese raggruppate per categoria. Clicca su una per vedere le transazioni e ricategorizzarle.',
    };
  }

  if (isFinance && isChart) {
    const d = days(t) ?? 14;
    const metric = isIncome ? 'income' : has(t, /\bflusso\b/) ? 'both' : 'expenses';
    return {
      type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceChart',
      params: { days: d, metric },
      intensity: 0.5,
      message: `Grafico ${metric === 'income' ? 'entrate' : metric === 'both' ? 'flusso netto' : 'uscite'} — ultimi ${d} giorni.`,
    };
  }

  if (isFinance && (isShow || has(t, /\b(spese|transazioni?|uscite)\b/))) {
    const limit = num(t);
    const type = isIncome ? 'income' : has(t, /\b(spese|uscite)\b/) ? 'expense' : null;
    return {
      type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceList',
      params: { limit: limit ?? 8, ...(type ? { type } : {}) },
      intensity: 0.5,
      message: type === 'expense' ? 'Ecco le tue ultime uscite.' : type === 'income' ? 'Ecco le tue ultime entrate.' : 'Ecco le tue ultime transazioni.',
    };
  }

  if (isFinance) {
    return {
      type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceOverview',
      params: {},
      intensity: 0.5,
      message: 'Riepilogo finanze di questo mese.',
    };
  }

  // ── HEALTH ─────────────────────────────────────────────────────────────────

  const isHealthSetup = (
    (has(t, /\b(setup|profilo|configurazione|onboarding|prima volta|completa profilo|anagrafica)\b/) && isHealth) ||
    has(t, /\b(setup salute|profilo salute|configura salute)\b/)
  );

  const isHealthDaily = (
    (has(t, /\b(oggi|giornata|recap|giornaliero|come.è andata|resoconto|riepilogo di oggi)\b/) && isHealth) ||
    has(t, /\b(quanti passi|calorie oggi|recap salute)\b/)
  );

  const isHealthGoals = (
    (has(t, /\b(obiettiv[io]|target|massimal[ei]|goal)\b/) && isHealth) ||
    has(t, /\b(obiettivi salute|target salute)\b/)
  );

  const isHealthSteps = has(t, /\b(passi|camminat[oa]|percorso|steps)\b/) && isHealth;

  const isHealthPR       = has(t, /\b(pr|personal record|record personale|massimal[ei]|1rm|one rep max|panca piana|squat|stacco|wall of fame|progressione|forza massimale)\b/);
  const isHealthTraining = has(t, /\b(training|allenament[oi]|muscol[io]|silhouette|log sessione|big three|corpo|palestra|gym|workout)\b/) || (has(t, /\b(forza|squat|panca|stacco)\b/) && !isHealthPR);

  if (isHealthPR && !isHealthTraining) {
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthWorkout',
      params: { tab: 'pr' },
      intensity: 0.55,
      message: 'PR Matrix — i tuoi record personali e la progressione della forza.',
    };
  }

  if (isHealthTraining || isHealthPR) {
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthWorkout',
      params: { tab: isHealthPR ? 'pr' : 'silhouette' },
      intensity: 0.55,
      message: isHealthPR
        ? 'PR Matrix — i tuoi record personali e la progressione della forza.'
        : 'Silhouette interattiva — clicca un muscolo per il dettaglio.',
    };
  }

  if (isHealthSetup) {
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthSetup',
      params: {},
      intensity: 0.45,
      message: 'Configura il tuo profilo salute in pochi passi.',
    };
  }

  if (isHealthGoals) {
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthGoals',
      params: {},
      intensity: 0.4,
      message: 'Ecco i tuoi obiettivi salute.',
    };
  }

  if (isHealthSteps) {
    const stepsNum = num(t);
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthDaily',
      params: { logKey: 'steps', logAmount: stepsNum ?? null },
      intensity: 0.4,
      message: stepsNum
        ? `Registro ${stepsNum.toLocaleString('it')} passi nel riepilogo di oggi.`
        : 'Ecco il tuo riepilogo passi di oggi.',
    };
  }

  if (isHealthDaily) {
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthDaily',
      params: {},
      intensity: 0.4,
      message: 'Ecco il tuo riepilogo di oggi.',
    };
  }

  if (isHealth && has(t, /\b(sonno|dormito|dormi|letto)\b/)) {
    const d = days(t) ?? 7;
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthSleep',
      params: { limit: d },
      intensity: 0.4,
      message: 'Ecco il tuo storico del sonno.',
    };
  }

  if (isHealth && has(t, /\b(acqua|bevo|bevuto|idratazione)\b/)) {
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthWater',
      params: {},
      intensity: 0.4,
      message: 'Ecco la tua idratazione di oggi.',
    };
  }

  if (isHealth) {
    return {
      type: 'VISUAL', module: 'HEALTH', intent: 'HEALTH',
      fragment: 'HealthOverview',
      params: {},
      intensity: 0.4,
      message: 'Riepilogo salute.',
    };
  }

  // ── PSYCHOLOGY ─────────────────────────────────────────────────────────────

  if (isPsych && (isChart || isShow || has(t, /\b(storico|storia|settimana)\b/))) {
    const d = days(t) ?? 7;
    return {
      type: 'VISUAL', module: 'PSYCH', intent: 'PSYCHOLOGY',
      fragment: 'MoodHistory',
      params: { days: d },
      intensity: 0.5,
      message: `Storico umore — ultimi ${d} giorni.`,
    };
  }

  if (isPsych) {
    const isNeg = has(t, /\b(triste|male|peggio|stressato|ansioso|stanco|giù)\b/);
    return {
      type: 'HYBRID', module: 'PSYCH', intent: 'PSYCHOLOGY',
      fragment: 'PsychOverview',
      params: {},
      intensity: isNeg ? 0.75 : 0.55,
      message: isNeg ? 'Capisco. Vediamo com\'è stato il tuo umore di recente.' : 'Ecco il tuo umore recente.',
    };
  }

  // ── ROUTINE & APPUNTAMENTI ─────────────────────────────────────────────────

  const isRoutine     = has(t, /\b(routine|abitudini?|habit|promemoria|reminder|pastiglia|farmaco|medicinale|esercizio quotidiano|ricorrente|giornaliero|ogni giorno)\b/);
  const isAppointment = has(t, /\b(appuntamento|colloquio|riunione|visita|agenda|calendario|evento|impegno|ricordami|ricorda|to.?do|todo|cosa da fare)\b/);

  if (isRoutine || isAppointment) {
    const tab = isAppointment && !isRoutine ? 'appointments' : 'routine';
    return {
      type: 'VISUAL', module: 'NONE', intent: 'IDLE',
      fragment: 'Routine',
      params: { tab },
      intensity: 0.35,
      message: tab === 'appointments'
        ? 'Ecco la tua agenda appuntamenti.'
        : 'Ecco le tue routine giornaliere.',
    };
  }

  // ── HELP ───────────────────────────────────────────────────────────────────

  if (has(t, /\b(guida|aiuto|help|cosa (puoi|sai) fare|come si fa|come funziona|comandi|istruzioni|tutorial|cosa posso (dire|scrivere|chiedere))\b/)) {
    return {
      type: 'VISUAL', module: 'NONE', intent: 'IDLE',
      fragment: 'Help',
      params: {},
      intensity: 0.3,
      message: 'Ecco la guida ai comandi disponibili. Clicca su una categoria per esplorare.',
    };
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────────

  if (has(t, /\b(impostazioni?|settings?|profilo|account|tema|lingua|password|disconnetti|logout)\b/)) {
    return {
      type: 'VISUAL', module: 'NONE', intent: 'IDLE',
      fragment: 'Settings',
      params: {},
      intensity: 0.3,
      message: 'Ecco le impostazioni del tuo account.',
    };
  }

  // ── CONTEXT-AWARE PRONOUN RESOLUTION ───────────────────────────────────────
  // Handles vague follow-ups like "cancellala", "mostrami quella", "riaprila"
  // using the last meaningful intent stored in nebulaStore.lastContext.

  if (context?.fragment) {
    // "cancellala / cancellale / eliminali / rimuovila" → open FinanceDelete with same params
    if (
      context.module === 'FINANCE' &&
      has(t, /\b(cancellala|cancellale|eliminali|eliminarla|rimuovila|rimuovile)\b/)
    ) {
      return {
        type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
        fragment: 'FinanceDelete',
        params: context.params,
        intensity: 0.7,
        message: 'Eccole. Eliminale singolarmente o tutte insieme.',
      };
    }

    // "mostrala / riaprila / quella / di nuovo" → reopen last fragment
    if (has(t, /\b(mostrala|riaprila|rimostrala|di nuovo|ancora|quella|quelle)\b/)) {
      return {
        type: 'VISUAL', module: context.module, intent: context.intent,
        fragment: context.fragment,
        params: context.params,
        intensity: 0.4,
        message: 'Eccola.',
      };
    }
  }

  // ── DEFAULT TALK ───────────────────────────────────────────────────────────

  return {
    type: 'TALK', module: 'NONE', intent: 'IDLE',
    fragment: '',
    params: {},
    intensity: 0.25,
    message: 'Ciao! Puoi dirmi: "mostrami le spese", "aggiungi spesa 20€ caffè", "cancella spese ultimi 7 giorni", "come sto dormendo?", "apri impostazioni". Scrivi "guida" per vedere tutti i comandi.',
  };
}
