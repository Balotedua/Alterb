import type { ParsedIntent } from '../types';

// ─── Keyword dictionaries ─────────────────────────────────────
const FINANCE_KW   = ['€','euro','spesa','speso','pagato','costo','costa','comprato','spendi','spendo','ristorante','caffè','caffe','pizza','pranzo','cena','affitto','bolletta','abbonamento','benzina','taxi','uber','supermercato'];
const WEIGHT_KW    = ['kg','chili','peso','pesavo','peso','bmi'];
const SLEEP_KW     = ['ore di sonno','dormito','sonno','dormire','letto','svegliato','sveglia'];
const WATER_KW     = ['acqua','litri','ml','idratazione','bicchiere'];
const SPORT_KW     = ['km','corsa','palestra','allenamento','bici','nuoto','camminato','passi','steps','workout','running','yoga','crossfit','pesi'];
const MOOD_KW      = ['umore','mood','felice','triste','stressato','stress','ansioso','ansia','calmo','depresso','su di giri','giù','ottimo','pessimo','sento','sto bene','sto male'];
const INCOME_KW    = ['guadagnato','entrata','stipendio','fattura','incassato','ricevuto','bonifico','rimborso'];
const CALENDAR_KW  = ['appuntamento','riunione','meeting','promemoria','ricordami','evento','visita','colloquio','call','conferenza','scadenza','appuntam'];
const RECURRING_KW = ['ogni giorno','tutti i giorni','tutte le mattine','tutte le sere','ogni mattina','ogni sera','ogni settimana','ricordami ogni'];
const ROUTINE_KW   = ['routine','imposta routine','orario giornaliero'];

function extractNumber(text: string): number | null {
  const m = text.match(/(\d+([.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

function stripNumber(text: string): string {
  return text.replace(/(\d+([.,]\d+)?)\s*[€]?/g, '').replace(/[€]/g, '').trim();
}

function cleanFinanceLabel(text: string): string {
  let s = stripNumber(text);
  // Rimuove verbi spesa/entrata comuni
  s = s.replace(/^(ho\s+)?(speso|pagato|comprato|costato|costa|costo|spendo|spendi|guadagnato|ricevuto|preso)\s*/i, '');
  // Rimuove preposizioni iniziali
  s = s.replace(/^(per|al|alla|agli|alle|ai|dal|dalla|allo|dell[aeo']?|un[ao]?|il|lo|la|gli|le|i|in|da)\s+/i, '');
  return s.trim();
}

function extractScheduledDate(text: string): string | null {
  const lower = text.toLowerCase();
  const now   = new Date();
  let target: Date | null = null;

  // ── Relative time: "tra N minuti/ore/secondi" ──────────────
  const minM = lower.match(/tra\s+(\d+)\s*minut/);
  if (minM) return new Date(now.getTime() + parseInt(minM[1]) * 60_000).toISOString();
  const hrM = lower.match(/tra\s+(\d+)\s*or[ae]/);
  if (hrM) return new Date(now.getTime() + parseInt(hrM[1]) * 3_600_000).toISOString();
  if (/tra\s+(mezzora|mezz['']?ora)/.test(lower))
    return new Date(now.getTime() + 30 * 60_000).toISOString();
  if (/tra\s+un['']?\s*ora/.test(lower))
    return new Date(now.getTime() + 3_600_000).toISOString();
  const secM = lower.match(/tra\s+(\d+)\s*second/);
  if (secM) return new Date(now.getTime() + parseInt(secM[1]) * 1_000).toISOString();

  const DAY_MAP: Record<string, number> = {
    'lunedì': 1, 'lun': 1, 'martedì': 2, 'mar': 2,
    'mercoledì': 3, 'mer': 3, 'giovedì': 4, 'gio': 4,
    'venerdì': 5, 'ven': 5, 'sabato': 6, 'sab': 6,
    'domenica': 0, 'dom': 0,
  };

  if (lower.includes('dopodomani')) {
    target = new Date(now); target.setDate(now.getDate() + 2);
  } else if (lower.includes('domani')) {
    target = new Date(now); target.setDate(now.getDate() + 1);
  } else if (lower.includes('oggi')) {
    target = new Date(now);
  } else {
    for (const [name, dayNum] of Object.entries(DAY_MAP)) {
      if (lower.includes(name)) {
        target = new Date(now);
        let diff = dayNum - now.getDay();
        if (diff <= 0) diff += 7;
        target.setDate(now.getDate() + diff);
        break;
      }
    }
  }

  if (!target) return null;

  const timeM = lower.match(/(?:ore|alle)\s*(\d{1,2})(?::(\d{2}))?/);
  if (timeM) {
    target.setHours(parseInt(timeM[1]), parseInt(timeM[2] ?? '0'), 0, 0);
  } else {
    target.setHours(9, 0, 0, 0);
  }
  return target.toISOString();
}

export function localParse(
  text: string,
  knownCategories: string[]
): Omit<ParsedIntent, 'source' | 'rawText'> | null {
  const lower = text.toLowerCase().trim();
  const num   = extractNumber(lower);

  // ── 0. Known custom categories (user-trained) ──────────────
  for (const cat of knownCategories) {
    if (!['finance','health','psychology'].includes(cat)) {
      if (lower.includes(cat.toLowerCase()) && num !== null) {
        return {
          category: cat,
          data: { value: num, label: stripNumber(lower), raw: text, renderType: 'numeric' },
        };
      }
    }
  }

  // ── 1. Finance: income ─────────────────────────────────────
  if (INCOME_KW.some(k => lower.includes(k)) && num !== null) {
    const label = cleanFinanceLabel(lower);
    return {
      category: 'finance',
      data: { type: 'income', amount: num, label: label || 'entrata', raw: text, renderType: 'finance' },
    };
  }

  // ── 2. Finance: expense  ───────────────────────────────────
  if (FINANCE_KW.some(k => lower.includes(k)) && num !== null) {
    const label = cleanFinanceLabel(lower);
    return {
      category: 'finance',
      data: { type: 'expense', amount: num, label: label || 'spesa', raw: text, renderType: 'finance' },
    };
  }

  // ── 3. Finance: "15 pizza" pattern (number + noun, no unit) ─
  const shortFinance = lower.match(/^(\d+([.,]\d+)?)\s*€?\s+([a-zA-ZÀ-ú]{3,})$/);
  if (shortFinance && num !== null) {
    const label = shortFinance[3];
    const notHealth = ![...WEIGHT_KW, ...SLEEP_KW, ...SPORT_KW, ...WATER_KW].includes(label);
    if (notHealth) {
      return {
        category: 'finance',
        data: { type: 'expense', amount: num, label, raw: text, renderType: 'finance' },
      };
    }
  }

  // ── 4. Health: weight ─────────────────────────────────────
  if (WEIGHT_KW.some(k => lower.includes(k)) && num !== null) {
    return {
      category: 'health',
      data: { type: 'weight', value: num, unit: 'kg', raw: text, renderType: 'chart' },
    };
  }

  // ── 5. Health: sleep ──────────────────────────────────────
  if (SLEEP_KW.some(k => lower.includes(k)) && num !== null) {
    return {
      category: 'health',
      data: { type: 'sleep', hours: num, raw: text, renderType: 'chart' },
    };
  }

  // ── 6. Health: water ──────────────────────────────────────
  if (WATER_KW.some(k => lower.includes(k)) && num !== null) {
    return {
      category: 'health',
      data: { type: 'water', liters: num, raw: text, renderType: 'chart' },
    };
  }

  // ── 7. Health: sport ──────────────────────────────────────
  if (SPORT_KW.some(k => lower.includes(k))) {
    return {
      category: 'health',
      data: { type: 'activity', value: num, label: lower, raw: text, renderType: 'workout' },
    };
  }

  // ── 8. Psychology: mood ───────────────────────────────────
  if (MOOD_KW.some(k => lower.includes(k))) {
    return {
      category: 'psychology',
      data: { type: 'mood', score: num, note: text, raw: text, renderType: 'mood' },
    };
  }

  // ── 9. Calendar event ─────────────────────────────────────
  if (CALENDAR_KW.some(k => lower.includes(k))) {
    const scheduledAt = extractScheduledDate(lower);
    const title = text.replace(/^(appuntamento|riunione|meeting|promemoria|ricordami|evento|visita|colloquio|call|conferenza|scadenza)\s*/i, '').trim() || text;
    return {
      category: 'calendar',
      data: { is_event: true, scheduled_at: scheduledAt, title, raw: text, renderType: 'timeline' },
    };
  }

  return null;
}
