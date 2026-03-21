import { saveEntry } from '../vault/vaultService';

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

async function categorizeBankTransactions(txs: BankTransaction[]): Promise<BankTransaction[]> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey || txs.length === 0) return txs;
  const batch = txs.slice(0, 150);
  const lines = batch.map((tx, i) =>
    `${i}|${tx.description.slice(0, 60)}|${tx.amount > 0 ? 'in' : 'out'}`
  );
  const prompt = `Categorizza queste transazioni bancarie italiane. Subcategorie disponibili: food, transport, health, shopping, entertainment, utilities, salary, subscription, other.\nRispondi SOLO con un JSON array di stringhe nell'ordine dato, es: ["food","salary",...].\n\n${lines.join('\n')}`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: Math.min(txs.length, 150) * 6 + 50,
      }),
    });
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      const cats: string[] = JSON.parse(match[0]);
      return txs.map((tx, i) => ({ ...tx, subcategory: cats[i] ?? 'other' }));
    }
  } catch { /* skip, import without subcategory */ }
  return txs;
}

export async function importBankCsv(
  csvText: string,
  userId: string,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  let transactions = parseBankCsv(csvText);
  transactions = await categorizeBankTransactions(transactions);
  let count = 0;
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const saved = await saveEntry(userId, 'finance', {
      type: tx.type,
      amount: Math.abs(tx.amount),
      label: tx.description,
      date: tx.date,
      source: 'csv_import',
      raw: tx.description,
      ...(tx.subcategory ? { subcategory: tx.subcategory } : {}),
    });
    if (saved) count++;
    onProgress?.(i + 1, transactions.length);
  }
  return count;
}
