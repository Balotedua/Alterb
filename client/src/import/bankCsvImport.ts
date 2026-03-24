import { saveEntry } from '../vault/vaultService';
import { supabase } from '../config/supabase';
import { applyRule } from '../core/descriptionRules';

export interface ImportResult {
  imported: number;
  duplicates: BankTransaction[];
}

export interface BankTransaction {
  date: string;
  amount: number;   // positive = income, negative = expense
  description: string;
  type: 'income' | 'expense';
  subcategory?: string;
}

function parseDate(dateStr: string, timeStr?: string): string {
  const s = dateStr.trim();
  // dd/mm/yyyy HH:MM:SS (date and time in one field)
  const dmyT = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[T\s](\d{2}:\d{2}(?::\d{2})?)$/);
  if (dmyT) {
    const [, d, m, y, t] = dmyT;
    const year = y.length === 2 ? '20' + y : y;
    return new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${t}`).toISOString();
  }
  // dd/mm/yyyy or dd-mm-yyyy (date only)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? '20' + y : y;
    const base = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const t = timeStr?.trim().match(/^\d{2}:\d{2}(?::\d{2})?$/) ? timeStr.trim() : null;
    return new Date(t ? `${base}T${t}` : base).toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseAmount(s: string): number {
  // strips €, spaces; handles Italian comma-decimal and dot-thousands
  const clean = s.replace(/[€\s]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

// ─── Heuristic column finder ──────────────────────────────────
function findCol(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseBankCsv(csvText: string): BankTransaction[] {
  // Skip leading non-CSV lines (some banks prepend info rows)
  const rawLines = csvText.trim().split(/\r?\n/);
  const startIdx = rawLines.findIndex(l => /data|date|operazione/i.test(l));
  const lines = (startIdx >= 0 ? rawLines.slice(startIdx) : rawLines).filter(l => l.trim());
  if (lines.length < 2) return [];

  const delim = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

  const dateIdx   = findCol(headers, 'data operazione', 'data registrazione', 'data', 'date');
  const timeIdx   = findCol(headers, 'ora', 'orario', 'time', 'ora operazione');
  const descIdx   = findCol(headers, 'descrizione', 'causale', 'description', 'memo', 'note', 'narrativa');
  const amountIdx = findCol(headers, 'importo', 'amount', 'saldo movimento');
  const inIdx     = findCol(headers, 'entrate', 'accrediti', 'avere', 'credit', 'crediti');
  const outIdx    = findCol(headers, 'uscite', 'addebiti', 'dare', 'debit', 'debiti');

  const results: BankTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    const description = descIdx >= 0 ? cols[descIdx] : '';
    if (!description) continue;

    let amount = 0;
    if (amountIdx >= 0 && cols[amountIdx]) {
      amount = parseAmount(cols[amountIdx]);
    } else if (inIdx >= 0 && outIdx >= 0) {
      const inn = parseAmount(cols[inIdx] || '0');
      const out = parseAmount(cols[outIdx] || '0');
      amount = inn > 0 ? inn : out > 0 ? -out : 0;
    }
    if (amount === 0) continue;

    let date = new Date().toISOString();
    try {
      if (dateIdx >= 0 && cols[dateIdx]) {
        const timeVal = timeIdx >= 0 ? cols[timeIdx] : undefined;
        date = parseDate(cols[dateIdx], timeVal);
      }
    } catch { /* keep today */ }

    results.push({ date, amount, description, type: amount >= 0 ? 'income' : 'expense' });
  }

  return results;
}


export async function importBankCsv(
  csvText: string,
  userId: string,
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> {
  const transactions = parseBankCsv(csvText);
  return importParsedTransactions(transactions, userId, onProgress, 'csv_import');
}

// ─── Duplicate key: YYYY-MM-DD|description_lower|abs_amount ──
function dupKey(date: string, description: string, amount: number): string {
  return `${date.slice(0, 10)}|${description.toLowerCase().trim()}|${Math.abs(amount).toFixed(2)}`;
}

// ─── Fetch existing finance keys for a user ───────────────────
async function fetchExistingFinanceKeys(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('vault')
    .select('data')
    .eq('user_id', userId)
    .eq('category', 'finance');
  if (error || !data) return new Set();
  const keys = new Set<string>();
  for (const row of data) {
    const d = row.data as Record<string, unknown>;
    if (d.date && d.label && d.amount != null) {
      keys.add(dupKey(d.date as string, d.label as string, d.amount as number));
    }
  }
  return keys;
}

// ─── Batch save pre-parsed transactions ───────────────────────
export async function importParsedTransactions(
  txs: BankTransaction[],
  userId: string,
  onProgress?: (done: number, total: number) => void,
  source: string = 'file_import'
): Promise<ImportResult> {
  const existing = await fetchExistingFinanceKeys(userId);
  let imported = 0;
  const duplicates: BankTransaction[] = [];

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    const key = dupKey(tx.date, tx.description, tx.amount);
    if (existing.has(key)) {
      duplicates.push(tx);
      onProgress?.(i + 1, txs.length);
      continue;
    }
    const subcategory = applyRule(userId, tx.description) ?? 'da_associare';
    const saved = await saveEntry(userId, 'finance', {
      type: tx.type,
      amount: Math.abs(tx.amount),
      label: tx.description,
      date: tx.date,
      source,
      raw: tx.description,
      subcategory,
    });
    if (saved) {
      imported++;
      existing.add(key); // prevent intra-import duplicates too
    }
    onProgress?.(i + 1, txs.length);
  }
  return { imported, duplicates };
}

// ─── Parse bank statement from PDF extracted text ─────────────
export function parseBankPdfText(text: string): BankTransaction[] {
  const lines = text.split('\n');
  const results: BankTransaction[] = [];

  for (const line of lines) {
    const l = line.trim();
    if (!l || l.length < 10) continue;

    // Match: date [time] description amount  (e.g. "01/03/2026 Pagamento Amazon -45,90")
    const m = l.match(
      /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)(?:\s+(\d{2}:\d{2}(?::\d{2})?))?[\s\t]+(.+?)[\s\t]+([\+\-]?\d{1,6}(?:[,\.]\d{1,3})?)$/
    );
    if (!m) continue;

    const [, dateStr, timeStr, desc, amtStr] = m;
    const amount = parseAmount(amtStr);
    if (amount === 0) continue;

    const description = desc.trim().replace(/\s{2,}/g, ' ');
    if (!description || description.length < 2) continue;

    try {
      const date = parseDate(dateStr, timeStr);
      results.push({ date, amount, description, type: amount >= 0 ? 'income' : 'expense' });
    } catch { /* skip malformed */ }
  }

  return results;
}

// ─── XLSX import (SheetJS, lazy-loaded) ───────────────────────
export async function importBankXlsx(
  file: File,
  userId: string,
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = await import('xlsx') as any;
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const csvText: string = XLSX.utils.sheet_to_csv(ws);
  return importBankCsv(csvText, userId, onProgress);
}
