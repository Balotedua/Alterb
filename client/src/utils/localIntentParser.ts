/**
 * Local keyword-based Italian NLP intent parser.
 * Works without any AI API — used as primary parser when VITE_DEEPSEEK_API_KEY
 * is not set, or as fallback when the DeepSeek call fails.
 */

import type { NebulaIntent, NebulaResponseType } from '@/store/nebulaStore';

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

// ── main parser ───────────────────────────────────────────────────────────────

export function parseLocalIntent(raw: string): LocalIntentResult {
  const t = raw.toLowerCase().trim();

  const isDelete = has(t, /\b(cancella|elimina|rimuovi|togli)\b/);
  const isAdd    = has(t, /\b(aggiungi|inserisci|registra|ho speso|ho guadagnato|nuova? spesa|nuova? entrata)\b/);
  const isShow   = has(t, /\b(mostrami|mostra|vedi|visualizza|dammi|voglio vedere|elenco|lista)\b/);
  const isChart  = has(t, /\b(grafico|andamento|trend|storico|storia)\b/);

  const isFinance  = has(t, /\b(spesa|spese|entrat[ae]|soldi|saldo|finanze?|budget|transazioni?|euro|€|conto|bonifico|pagamento)\b/);
  const isIncome   = has(t, /\b(entrat[ae]|guadagn[oi]|stipendio|ricevuto|incassato)\b/);
  const isHealth   = has(t, /\b(sonno|dormito|dormi|peso|acqua|bevo|bevuto|salute|esercizio|allenamento|calorie|sport|attività)\b/);
  const isPsych    = has(t, /\b(umore|emozioni?|stress|ansia|ansioso|triste|felice|contento|come sto|mi sento|sento|benessere)\b/);

  // ── FINANCE ────────────────────────────────────────────────────────────────

  if (isDelete && (isFinance || has(t, /\b(spese|transazioni?)\b/))) {
    const d = days(t);
    const amt = num(t);
    const type = isIncome ? 'income' : has(t, /\b(spese|uscite|pagamenti)\b/) ? 'expense' : null;
    return {
      type: 'VISUAL', module: 'FINANCE', intent: 'FINANCE',
      fragment: 'FinanceDelete',
      params: { days: d ?? null, amount: amt ?? null, filterType: type },
      intensity: 0.7,
      message: d
        ? `Ecco le transazioni degli ultimi ${d} giorni. Eliminale premendo 🗑.`
        : 'Ecco le tue transazioni recenti. Eliminale premendo 🗑.',
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

  // ── DEFAULT TALK ───────────────────────────────────────────────────────────

  return {
    type: 'TALK', module: 'NONE', intent: 'IDLE',
    fragment: '',
    params: {},
    intensity: 0.25,
    message: 'Ciao! Puoi dirmi: "mostrami le spese", "aggiungi spesa 20€ caffè", "cancella spese ultimi 7 giorni", "come sto dormendo?"',
  };
}
