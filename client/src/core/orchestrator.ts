import { localParse } from './localParser';
import { aiParse }   from './aiParser';
import type { ParsedIntent } from '../types';

const HELP_TRIGGERS = ['?', 'aiuto', 'help', 'cosa sai fare', 'cosa puoi fare'];
const DELETE_PATTERN = /^(cancella|elimina|rimuovi|delete)\s+/i;
const ANALYSIS_PATTERN = /^(analizza|analisi|riassumi|riassunto|report|quanto|come sto|dimmi|spiega)/i;

export type OrchestratorAction =
  | { type: 'save';     intent: ParsedIntent }
  | { type: 'help' }
  | { type: 'delete';   raw: string }
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
