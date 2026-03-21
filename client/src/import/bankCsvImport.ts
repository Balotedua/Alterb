import { saveEntry } from '../vault/vaultService';

export interface BankTransaction {
  date: string;
  amount: number;   // positive = income, negative = expense
  description: string;
  type: 'income' | 'expense';
}

function parseDate(s: string): string {
  s = s.trim();
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? '20' + y : y;
    return new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`).toISOString();
  }
  return new Date(s).toISOString();
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
      if (dateIdx >= 0 && cols[dateIdx]) date = parseDate(cols[dateIdx]);
    } catch { /* keep today */ }

    results.push({ date, amount, description, type: amount >= 0 ? 'income' : 'expense' });
  }

  return results;
}

export async function importBankCsv(csvText: string, userId: string): Promise<number> {
  const transactions = parseBankCsv(csvText);
  let count = 0;
  for (const tx of transactions) {
    const saved = await saveEntry(userId, 'finance', {
      type: tx.type,
      amount: Math.abs(tx.amount),
      label: tx.description,
      date: tx.date,
      source: 'csv_import',
      raw: tx.description,
    });
    if (saved) count++;
  }
  return count;
}
