import { localParse } from './localParser';
import type { ParsedIntent } from '../types';

// ── Document patterns ─────────────────────────────────────────
// DOC_LIST: "mostrami tutti i miei documenti"
const DOC_LIST_PATTERN = /^(mostrami|dammi|cerca|trova|recupera|restituiscimi|apri|elenca)\s+(i\s+miei\s+|tutti\s+i\s+)?documenti?/i;

// DOC_FETCH: explicit download/retrieve intent for any document type
const DOC_FETCH_PATTERN = /^(restituiscimi|girami|scarica|scaricami|dammi|mostrami|fammi\s+vedere|fammi\s+scaricare|voglio)\b.+\b(busta\s*paga|cedolino|bolletta|bollette|fattura|contratto|ricevuta|referto|carta\s*d[i']?\s*identit|documento|passaporto|patente|polizza|multa)/i;

// DOC_QUESTION: any semantic question about document content — AI decides what's relevant
const DOC_QUESTION_PATTERN = /\b(bolletta|fattura|contratto|ricevuta|busta\s*paga|cedolino|referto|analisi\s+del\s+sangue|multa|verbale|polizza|assicurazion|dichiarazione\s*redditi|730|f24|estratto\s*conto|carta\s*d[i']?\s*identit|passaporto|patente|stipendio|retribuzione|quanto\s+ho\s+(preso|pagato|guadagnato|percepito)|cosa\s+(dice|diceva|c[''è])\s+(il|la|nel|nella))\b/i;

function extractYearFromQuery(text: string): number | null {
  const m = text.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1]) : null;
}

// Used only for DOC_FETCH download requests to pre-filter by stored docType
function extractDocTypeFromQuery(text: string): string | null {
  const t = text.toLowerCase();
  if (/busta\s*paga|cedolino|stipendio|retribuzione/.test(t)) return 'payslip';
  if (/bolletta/.test(t))          return 'utility_bill';
  if (/estratto\s*conto/.test(t))  return 'bank_statement';
  if (/contratto/.test(t))         return 'contract';
  if (/fattura/.test(t))           return 'invoice';
  if (/ricevuta/.test(t))          return 'receipt';
  if (/referto|medico/.test(t))    return 'medical_report';
  if (/multa|verbale/.test(t))     return 'fine';
  if (/polizza|assicurazion/.test(t)) return 'insurance';
  if (/730|f24|irpef|dichiarazione/.test(t)) return 'tax';
  if (/carta\s*d[i']?\s*identit|passaporto|patente/.test(t)) return 'identity';
  return null;
}

const HELP_TRIGGERS    = ['?', 'aiuto', 'help'];
const CAPABILITY_PATTERN = /\b(cosa\s+(sai|puoi|riesci|supporti)\s+fare|cosa\s+posso\s+(fare|chiederti|dirti)|come\s+(funzion|si\s+usa)|posso\s+(caricare|inviarti|mandarti|uploadare|allegare|passarti)|supporti?\s+(pdf|csv|xlsx|documenti?|file)|puoi\s+(leggere|analizzare|importare|gestire).{0,30}(pdf|csv|documenti?|file|estratt)|hai\s+(funzion|capacit|feature)|cosa\s+fai|a\s+cosa\s+servi|come\s+ti\s+uso|come\s+funzioni|cosa\s+gestisci|quali\s+(funzioni|comandi|categorie))/i;
const DELETE_PATTERN   = /^(cancella|elimina|rimuovi|delete)\s+/i;
const DELETE_ALL_PATTERN = /^(cancella|elimina|rimuovi|svuota|reset)\s+(tutto|tutti\s+i\s+dati|il\s+vault|il\s+profilo|i\s+miei?\s+dati)[\s!.]*$/i;
const ANALYSIS_PATTERN = /^(analizza|analisi|riassumi|riassunto|report|insight|come sto nel complesso)/i;

// Ricerche web: notizie, situazioni geopolitiche, eventi attuali
const WEB_SEARCH_PATTERN = /\b(notizie|news)\s+(su|di|da|riguard)\b|cosa\s+sta\s+succedendo\b|aggiornamenti?\s+(su|di)\b|ultimi\s+(sviluppi|aggiornamenti|eventi)\b|\b(situazione|crisi|guerra|conflitto|accordo|elezioni?)\b.{1,50}\b(trump|putin|biden|zelensky|meloni|musk|modi|xi|erdogan|iran|russia|ucraina|cina|usa|america|israele|palestina|nato|europa)\b|\b(trump|putin|biden|zelensky|meloni|musk)\b.{1,50}\b(iran|russia|ucraina|cina|usa|israele|palestina)\b|cerca\s+(informazioni|notizie)\s+su\b|cosa\s+(è\s+successo|succede)\s+(con|in|a)\b.{0,30}\b(trump|putin|biden|iran|russia|ucraina|cina|usa|israele)\b/i;
const NEXUS_PATTERN    = /dipende\s+(da|dal|dalle?)|correlazione\s+(tra|umore|spes|peso|salute)|incrocio\s+tra|relazione\s+tra|nexus|perch[eé]\s+(sono|mi\s+sento|sto\s+(cos[iì]|male|bene)|sono\s+sempre)|cosa\s+(causa|influenza|c[''è]\s+dietro|mi\s+fa)/i;

function extractNexusCategories(text: string): [string | null, string | null] {
  const lower = text.toLowerCase();
  const cats: string[] = [];
  if (/umore|mood|psiche|stress|felice|triste/.test(lower)) cats.push('psychology');
  if (/spes[oa]|finanz|soldi|euro|€|budget/.test(lower))   cats.push('finance');
  if (/peso|sonno|salute|sport|allenamento|acqua/.test(lower)) cats.push('health');
  if (/impegn|calendario|appuntament/.test(lower))         cats.push('calendar');
  return [cats[0] ?? null, cats[1] ?? null];
}

// Pure conversation — no data to save
const CHAT_PATTERN = /^(ciao|salve|buongiorno|buonasera|buona\s*notte|hey|hello|hi|hola|come\s+stai|come\s+va|cosa\s+pensi|chi\s+sei|come\s+ti\s+chiami|grazie|prego|ok|okay|bene|perfetto|capito|va\s+bene|sì|si|no|ah|eh|oh|uh|hmm|mh|dai|esatto|giusto|certo|assolutamente|fantastico|ottimo|bravo|brava)[\s!.?]*$/i;


function extractDeleteCategory(text: string): string | null {
  const m = text.match(/^(?:cancella|elimina|rimuovi|delete)\s+(?:la\s+)?(?:stella|categoria|category)?\s*(.+)$/i);
  if (!m) return null;
  return m[1].trim().toLowerCase().replace(/\s+/g, '_');
}

function extractDeleteCategoryFromSentence(text: string): string | null {
  const lower = text.toLowerCase();
  if (/spes[oa]|finanz|soldi|euro|€|transazion|conto/.test(lower))     return 'finance';
  if (/allenament|sport|palestra|corsa|eserciz|peso|sonno|salute/.test(lower)) return 'health';
  if (/umore|mood|psiche|ansia|stress|emozion/.test(lower))             return 'psychology';
  if (/appuntament|impegn|evento|riunione|calendario/.test(lower))      return 'calendar';
  return null;
}

function extractDeleteDateRange(text: string): [Date, Date] | null {
  const lower = text.toLowerCase();
  const now = new Date();

  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    const from = new Date(year, 0, 1, 0, 0, 0, 0);
    const to   = new Date(year, 11, 31, 23, 59, 59, 999);
    return [from, to];
  }
  if (/ultima\s+settimana|settimana\s+scors[ao]/.test(lower)) {
    const from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0, 0, 0, 0);
    return [from, new Date(now)];
  }
  if (/ultimo\s+mese|mese\s+scors[ao]/.test(lower)) {
    const from = new Date(now); from.setMonth(now.getMonth() - 1); from.setHours(0, 0, 0, 0);
    return [from, new Date(now)];
  }
  if (/ultimo\s+anno|anno\s+scors[ao]/.test(lower)) {
    const from = new Date(now); from.setFullYear(now.getFullYear() - 1); from.setHours(0, 0, 0, 0);
    return [from, new Date(now)];
  }
  if (/questa\s+settimana/.test(lower)) {
    const from = new Date(now); from.setDate(now.getDate() - now.getDay()); from.setHours(0, 0, 0, 0);
    return [from, new Date(now)];
  }
  if (/questo\s+mese/.test(lower)) {
    const from = new Date(now); from.setDate(1); from.setHours(0, 0, 0, 0);
    return [from, new Date(now)];
  }
  return null;
}

// Questions that query existing data (not create new entries)
const QUERY_PATTERN = /(\?$)|^(cosa devo|cosa c'è|cosa ho |quanto ho |quanti |quante |com'era|com era|mostrami|dimmi tutto|elenca|lista |ci sono (impegni|appuntamenti)|ho (impegni|appuntamenti)|impegni (di|per)|cosa (è previsto|succede|mi aspetta))/i;

// Detect category hint from a query sentence
export function inferQueryCategory(text: string): string | null {
  const lower = text.toLowerCase();
  if (/impegn|appuntament|riunione|meeting|calendario|devo fare|previsto|succede/.test(lower)) return 'calendar';
  if (/spes[oa]|finanz|budget|soldi|euro|€|costo|guadagn|entrat/.test(lower))                 return 'finance';
  if (/umore|mood|psiche|ansia|stress|felice|triste/.test(lower))                              return 'psychology';
  if (/peso|sonno|salute|sport|allenamento|acqua/.test(lower))                                 return 'health';
  return null;
}

// Extract a date range hint from a query sentence → [from, to]
export function inferQueryDateRange(text: string): [Date, Date] | null {
  const lower = text.toLowerCase();
  const now   = new Date();
  const DAY_MAP: Record<string, number> = {
    'lunedì': 1, 'lun': 1, 'martedì': 2, 'mar': 2,
    'mercoledì': 3, 'mer': 3, 'giovedì': 4, 'gio': 4,
    'venerdì': 5, 'ven': 5, 'sabato': 6, 'sab': 6,
    'domenica': 0, 'dom': 0,
  };

  if (lower.includes('questa settimana')) {
    const from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0, 0, 0, 0);
    const to   = new Date(now); to.setHours(23, 59, 59, 999);
    return [from, to];
  }
  if (lower.includes('questo mese')) {
    const from = new Date(now); from.setDate(1); from.setHours(0, 0, 0, 0);
    const to   = new Date(now); to.setHours(23, 59, 59, 999);
    return [from, to];
  }
  if (lower.includes('ieri')) {
    const d = new Date(now); d.setDate(now.getDate() - 1);
    const from = new Date(d); from.setHours(0, 0, 0, 0);
    const to   = new Date(d); to.setHours(23, 59, 59, 999);
    return [from, to];
  }
  if (lower.includes('oggi')) {
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    const to   = new Date(now); to.setHours(23, 59, 59, 999);
    return [from, to];
  }
  if (lower.includes('domani')) {
    const d = new Date(now); d.setDate(now.getDate() + 1);
    const from = new Date(d); from.setHours(0, 0, 0, 0);
    const to   = new Date(d); to.setHours(23, 59, 59, 999);
    return [from, to];
  }
  for (const [name, dayNum] of Object.entries(DAY_MAP)) {
    if (lower.includes(name)) {
      const target = new Date(now);
      let diff = dayNum - now.getDay();
      if (diff < 0) diff += 7;
      else if (diff === 0) diff = 0; // today if same day
      target.setDate(now.getDate() + diff);
      const from = new Date(target); from.setHours(0, 0, 0, 0);
      const to   = new Date(target); to.setHours(23, 59, 59, 999);
      return [from, to];
    }
  }
  return null;
}

export type OrchestratorAction =
  | { type: 'save';         intent: ParsedIntent }
  | { type: 'help' }
  | { type: 'capability'; raw: string }
  | { type: 'chat';         raw: string }
  | { type: 'delete';       raw: string; category: string | null; dateRange: [Date, Date] | null; all: boolean }
  | { type: 'query';        raw: string; category: string | null; dateRange: [Date, Date] | null }
  | { type: 'analyse';      raw: string }
  | { type: 'nexus';        raw: string; catA: string | null; catB: string | null }
  | { type: 'doc_list';     raw: string }
  | { type: 'doc_retrieve'; raw: string; docType: string | null; year: number | null; download: boolean }
  | { type: 'doc_query';    raw: string; docType: string | null; keyword: string }
  | { type: 'clarify';     field: 'amount'; category: 'finance'; raw: string }
  | { type: 'web_search';   raw: string; query: string }
  | { type: 'unknown';      raw: string };

export function orchestrate(
  text: string,
  knownCategories: string[]
): OrchestratorAction {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'unknown', raw: trimmed };

  const lower = trimmed.toLowerCase();

  // ── Document commands ────────────────────────────────────
  if (DOC_LIST_PATTERN.test(trimmed))
    return { type: 'doc_list', raw: trimmed };

  if (DOC_FETCH_PATTERN.test(trimmed))
    return { type: 'doc_retrieve', raw: trimmed, docType: extractDocTypeFromQuery(trimmed), year: extractYearFromQuery(trimmed), download: true };

  if (DOC_QUESTION_PATTERN.test(trimmed))
    return { type: 'doc_query', raw: trimmed, docType: null, keyword: trimmed };

  // ── Special commands ─────────────────────────────────────
  if (HELP_TRIGGERS.some(h => lower === h || lower.startsWith(h)))
    return { type: 'help' };

  if (CAPABILITY_PATTERN.test(trimmed))
    return { type: 'capability', raw: trimmed };

  if (DELETE_ALL_PATTERN.test(trimmed))
    return { type: 'delete', raw: trimmed, category: null, dateRange: null, all: true };

  if (DELETE_PATTERN.test(trimmed)) {
    // Try smart sentence extraction first (e.g. "cancella le spese del 2023")
    const sentCat   = extractDeleteCategoryFromSentence(trimmed);
    const dateRange = extractDeleteDateRange(trimmed);
    if (sentCat && dateRange)
      return { type: 'delete', raw: trimmed, category: sentCat, dateRange, all: false };
    if (sentCat)
      return { type: 'delete', raw: trimmed, category: sentCat, dateRange: null, all: false };
    // Fallback: "cancella stella [nome]"
    return { type: 'delete', raw: trimmed, category: extractDeleteCategory(trimmed), dateRange: null, all: false };
  }

  if (ANALYSIS_PATTERN.test(lower))
    return { type: 'analyse', raw: trimmed };

  if (NEXUS_PATTERN.test(lower)) {
    const [catA, catB] = extractNexusCategories(trimmed);
    return { type: 'nexus', raw: trimmed, catA, catB };
  }

  if (QUERY_PATTERN.test(trimmed))
    return {
      type: 'query',
      raw: trimmed,
      category:  inferQueryCategory(trimmed),
      dateRange: inferQueryDateRange(trimmed),
    };

  // ── Chat: greetings / chit-chat — no data to save ────────
  if (CHAT_PATTERN.test(trimmed))
    return { type: 'chat', raw: trimmed };

  // ── Single-word category lookup ───────────────────────────
  const CAT_ALIASES: Record<string, string> = {
    finance: 'finance', finanza: 'finance', spese: 'finance', soldi: 'finance',
    health: 'health', salute: 'health',
    psychology: 'psychology', psico: 'psychology', umore: 'psychology',
    calendar: 'calendar', calendario: 'calendar',
  };
  const catMatch = CAT_ALIASES[lower.replace(/[^a-z]/g, '')];
  if (catMatch) {
    return { type: 'query', raw: trimmed, category: catMatch, dateRange: null };
  }

  // ── Web search: notizie / eventi attuali ─────────────────
  if (WEB_SEARCH_PATTERN.test(trimmed))
    return { type: 'web_search', raw: trimmed, query: trimmed };

  // ── L1: Local parser (zero API cost) ─────────────────────
  const local = localParse(trimmed, knownCategories);
  if (local) {
    return {
      type: 'save',
      intent: { ...local, source: 'local', rawText: trimmed },
    };
  }

  // ── Finance keyword present but no amount → ask for clarification ─
  const FINANCE_VERBS = ['comprato','comprata','acquistato','acquistata','speso','pagato','preso','presa'];
  if (FINANCE_VERBS.some(k => lower.includes(k)) && !/\d/.test(lower)) {
    return { type: 'clarify', field: 'amount', category: 'finance', raw: trimmed };
  }

  // ── Fallback: hybrid AI (empathetic reply + optional extraction) ─
  return { type: 'unknown', raw: trimmed };
}
