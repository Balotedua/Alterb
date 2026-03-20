import { localParse } from './localParser';
import { aiParse }   from './aiParser';
import type { ParsedIntent } from '../types';

const HELP_TRIGGERS    = ['?', 'aiuto', 'help', 'cosa sai fare', 'cosa puoi fare'];
const DELETE_PATTERN   = /^(cancella|elimina|rimuovi|delete)\s+/i;
const ANALYSIS_PATTERN = /^(analizza|analisi|riassumi|riassunto|report|correlazioni?|insight|come sto nel complesso)/i;

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
  | { type: 'save';     intent: ParsedIntent }
  | { type: 'help' }
  | { type: 'delete';   raw: string }
  | { type: 'query';    raw: string; category: string | null; dateRange: [Date, Date] | null }
  | { type: 'analyse';  raw: string }
  | { type: 'unknown';  raw: string };

export async function orchestrate(
  text: string,
  knownCategories: string[]
): Promise<OrchestratorAction> {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'unknown', raw: trimmed };

  const lower = trimmed.toLowerCase();

  // ── Special commands ─────────────────────────────────────
  if (HELP_TRIGGERS.some(h => lower === h || lower.startsWith(h)))
    return { type: 'help' };

  if (DELETE_PATTERN.test(trimmed))
    return { type: 'delete', raw: trimmed };

  if (ANALYSIS_PATTERN.test(lower))
    return { type: 'analyse', raw: trimmed };

  if (QUERY_PATTERN.test(trimmed))
    return {
      type: 'query',
      raw: trimmed,
      category:  inferQueryCategory(trimmed),
      dateRange: inferQueryDateRange(trimmed),
    };

  // ── L1: Local parser (zero API cost) ─────────────────────
  const local = localParse(trimmed, knownCategories);
  if (local) {
    return {
      type: 'save',
      intent: { ...local, source: 'local', rawText: trimmed },
    };
  }

  // ── L2: AI parser ────────────────────────────────────────
  const ai = await aiParse(trimmed);
  if (ai) {
    return {
      type: 'save',
      intent: { ...ai, source: 'ai', rawText: trimmed },
    };
  }

  return { type: 'unknown', raw: trimmed };
}
