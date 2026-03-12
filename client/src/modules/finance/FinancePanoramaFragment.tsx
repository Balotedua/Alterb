import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, TrendingUp, TrendingDown, Upload, RefreshCw } from 'lucide-react';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import {
  useTransactions,
  useMonthlyStats,
  useAddTransaction,
  useDeleteTransaction,
  useBulkAddTransactions,
  useFinanceBudgets,
  useUpsertBudget,
  useDeleteBudget,
  useFinanceCategories,
} from '@/hooks/useFinance';
import { FINANCE_DEFAULT_CATS } from '@/utils/constants';
import { FinanceCategoryContent } from '@/modules/finance/FinanceCategoryFragment';
import { GroupedBarChart, MONTHS_IT } from '@/modules/finance/FinanceChartFragment';
import { formatCurrency } from '@/utils/formatters';
import type { TransactionType, Transaction } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function fmtMonth(iso: string) {
  return new Date(iso + '-01').toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'panoramica' | 'budget' | 'abbonamenti' | 'aggiungi' | 'importa' | 'categorie' | 'analisi';

const TABS: { id: TabId; label: string }[] = [
  { id: 'panoramica',  label: 'Panoramica'  },
  { id: 'budget',      label: 'Budget'      },
  { id: 'abbonamenti', label: 'Abbonamenti' },
  { id: 'aggiungi',    label: 'Aggiungi'    },
  { id: 'importa',     label: 'Importa'     },
  { id: 'categorie',   label: 'Categorie'   },
  { id: 'analisi',     label: 'Analisi'     },
];

const TAB_ANIM = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.13 } },
};

// ─── Category icons ───────────────────────────────────────────────────────────

const CAT_ICON: Record<string, string> = {
  food: '🍕', transport: '🚗', shopping: '🛍', health: '💊',
  entertainment: '🎬', utilities: '💡', salary: '💼', other: '📦',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanoramaTab() {
  type F = 'all' | 'income' | 'expense';
  const FILTERS: { id: F; label: string }[] = [
    { id: 'all',     label: 'Tutti'   },
    { id: 'income',  label: 'Entrate' },
    { id: 'expense', label: 'Uscite'  },
  ];

  const { income, expenses, balance, savingsRate } = useMonthlyStats();
  const { data: txns = [] }                        = useTransactions();
  const { mutate: del, isPending: delPending }      = useDeleteTransaction();

  const [filter, setFilter] = useState<F>('all');
  const [page, setPage]     = useState(0);
  const PAGE = 12;

  const rate     = typeof savingsRate === 'string' ? savingsRate : String(savingsRate);
  const filtered = txns.filter((t) => filter === 'all' || t.type === filter);
  const pageTxns = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(filtered.length / PAGE);

  return (
    <div className="fp-section">
      {/* KPI row */}
      <div className="fp-kpi-row">
        <div className="fp-kpi-chip fp-kpi-chip--green">
          <span className="fp-kpi-label">Entrate</span>
          <span className="fp-kpi-value">{formatCurrency(income)}</span>
        </div>
        <div className="fp-kpi-chip fp-kpi-chip--red">
          <span className="fp-kpi-label">Uscite</span>
          <span className="fp-kpi-value">{formatCurrency(expenses)}</span>
        </div>
        <div className={`fp-kpi-chip ${balance >= 0 ? 'fp-kpi-chip--amber' : 'fp-kpi-chip--red'}`}>
          <span className="fp-kpi-label">Saldo</span>
          <span className="fp-kpi-value">{formatCurrency(balance)}</span>
        </div>
        <div className="fp-kpi-chip">
          <span className="fp-kpi-label">Risparmio</span>
          <span className="fp-kpi-value">{rate}%</span>
        </div>
      </div>

      {/* Section label + filter pills */}
      <p className="fp-section-label">In questo mese</p>
      <div className="admin-filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={['admin-filter-tab', filter === f.id ? 'admin-filter-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => { setFilter(f.id); setPage(0); }}
          >
            {f.label}
            <span className="admin-filter-count">
              {f.id === 'all' ? txns.length : txns.filter((t) => t.type === f.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {pageTxns.length === 0 ? (
        <p className="fp-empty">Nessun movimento. Usa "Aggiungi" per iniziare.</p>
      ) : (
        <div className="fp-txn-list">
          {pageTxns.map((t) => (
            <div key={t.id} className="fp-txn-row fp-txn-row--deletable">
              <span className={`fp-txn-dot ${t.type === 'income' ? 'fp-dot--green' : 'fp-dot--red'}`} />
              <span className="fp-txn-date">{fmtDate(t.date)}</span>
              <span className="fp-txn-desc">{t.description || t.category}</span>
              <span className={`fp-txn-amt ${t.type === 'income' ? 'fp-amt--green' : 'fp-amt--red'}`}>
                {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
              </span>
              <button
                className="fp-del-btn"
                onClick={() => del(t.id)}
                disabled={delPending}
                aria-label="Elimina"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="fp-pagination">
          <button className="fp-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="fp-page-info">{page + 1} / {totalPages}</span>
          <button className="fp-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      )}
    </div>
  );
}

const CATEGORIES_LIST = [
  { id: 'food',          label: 'Cibo'        },
  { id: 'transport',     label: 'Trasporti'   },
  { id: 'shopping',      label: 'Shopping'    },
  { id: 'health',        label: 'Salute'      },
  { id: 'entertainment', label: 'Svago'       },
  { id: 'utilities',     label: 'Bollette'    },
  { id: 'salary',        label: 'Stipendio'   },
  { id: 'other',         label: 'Altro'       },
];

function AggiungiTab() {
  const [type, setType]   = useState<TransactionType>('expense');
  const [amount, setAmt]  = useState('');
  const [desc, setDesc]   = useState('');
  const [cat, setCat]     = useState('other');
  const [date, setDate]   = useState(() => new Date().toISOString().split('T')[0]);
  const [done, setDone]   = useState(false);

  const { mutate: add, isPending } = useAddTransaction();

  function submit() {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || isNaN(n) || !desc.trim()) return;
    add(
      { amount: Math.abs(n), type, category: cat, description: desc.trim(), date },
      { onSuccess: () => { setDone(true); setAmt(''); setDesc(''); setTimeout(() => setDone(false), 2000); } },
    );
  }

  return (
    <div className="fp-section">
      {done && <p className="fp-success">✓ Transazione aggiunta</p>}

      {/* Type toggle */}
      <div className="fp-type-toggle">
        <button
          className={['fp-type-btn', type === 'expense' ? 'fp-type-btn--active fp-type-btn--red' : ''].filter(Boolean).join(' ')}
          onClick={() => setType('expense')}
        >
          <TrendingDown size={13} /> Spesa
        </button>
        <button
          className={['fp-type-btn', type === 'income' ? 'fp-type-btn--active fp-type-btn--green' : ''].filter(Boolean).join(' ')}
          onClick={() => setType('income')}
        >
          <TrendingUp size={13} /> Entrata
        </button>
      </div>

      {/* Fields */}
      <div className="fp-fields">
        <div className="fp-field-group">
          <label className="fp-field-label">Importo</label>
          <input
            className="fp-field-input"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmt(e.target.value)}
          />
        </div>
        <div className="fp-field-group">
          <label className="fp-field-label">Descrizione</label>
          <input
            className="fp-field-input"
            type="text"
            placeholder="es. Supermercato"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div className="fp-field-row-2">
          <div className="fp-field-group">
            <label className="fp-field-label">Categoria</label>
            <select className="fp-field-input" value={cat} onChange={(e) => setCat(e.target.value)}>
              {CATEGORIES_LIST.map((c) => (
                <option key={c.id} value={c.id}>{CAT_ICON[c.id] ?? '•'} {c.label}</option>
              ))}
            </select>
          </div>
          <div className="fp-field-group">
            <label className="fp-field-label">Data</label>
            <input className="fp-field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      <button
        className="fp-submit-btn"
        onClick={submit}
        disabled={isPending || !amount || !desc.trim()}
      >
        {isPending ? <RefreshCw size={13} className="fp-spin" /> : null}
        {isPending ? 'Salvataggio…' : `Aggiungi ${type === 'expense' ? 'spesa' : 'entrata'}`}
      </button>
    </div>
  );
}

function ImportaTab() {
  type FileFormat = 'csv' | 'xlsx' | 'pdf';

  function detectDelimiter(line: string): string {
    const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (!inQ && ch in counts) counts[ch]++;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  function splitLine(line: string, delim: string): string[] {
    const result: string[] = [];
    let field = ''; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === delim && !inQ) { result.push(field.trim().replace(/^"|"$/g, '')); field = ''; }
      else { field += ch; }
    }
    result.push(field.trim().replace(/^"|"$/g, ''));
    return result;
  }

  function parseCSV(text: string) {
    const lines = text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [] as string[], rows: [] as Record<string,string>[] };
    const delim = detectDelimiter(lines[0]);
    const headers = splitLine(lines[0], delim);
    const rows = lines.slice(1).map((line) => {
      const vals = splitLine(line, delim);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    }).filter((r) => Object.values(r).some((v) => v.trim()));
    return { headers, rows };
  }

  async function parseXLSX(buffer: ArrayBuffer) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { headers: [] as string[], rows: [] as Record<string,string>[] };
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, dateNF: 'YYYY-MM-DD', defval: '' });
    if (data.length < 2) return { headers: [] as string[], rows: [] as Record<string,string>[] };
    let hIdx = 0;
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      if ((data[i] as string[]).some((v) => String(v).trim())) { hIdx = i; break; }
    }
    const headers = (data[hIdx] as unknown[]).map((h, i) => String(h).trim() || `Col${i + 1}`);
    const rows = (data.slice(hIdx + 1) as unknown[][])
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])))
      .filter((r) => Object.values(r).some((v) => v));
    return { headers, rows };
  }

  async function parsePDF(buffer: ArrayBuffer) {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    interface Item { x: number; y: number; w: number; str: string; }
    const allItems: Item[] = [];
    let pageOffsetY = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      for (const item of tc.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        allItems.push({
          x: item.transform[4],
          y: viewport.height - item.transform[5] + pageOffsetY,
          w: (item as { width?: number }).width ?? item.str.length * 5,
          str: item.str.trim(),
        });
      }
      pageOffsetY += viewport.height + 20;
    }
    if (!allItems.length) return { headers: [] as string[], rows: [] as Record<string,string>[] };
    allItems.sort((a, b) => a.y - b.y || a.x - b.x);
    const lineMap: Map<number, Item[]> = new Map();
    for (const item of allItems) {
      let placed = false;
      for (const [ly, items] of lineMap) {
        if (Math.abs(item.y - ly) <= 4) { items.push(item); placed = true; break; }
      }
      if (!placed) lineMap.set(item.y, [item]);
    }
    const lines = [...lineMap.entries()].sort(([a], [b]) => a - b).map(([, items]) => items.sort((a, b) => a.x - b.x));
    const textRows = lines.map((items) => {
      if (!items.length) return [];
      const cells: string[] = [];
      let cell = items[0].str;
      let lastX = items[0].x + items[0].w;
      for (let i = 1; i < items.length; i++) {
        if (items[i].x - lastX > 15) { cells.push(cell.trim()); cell = items[i].str; }
        else { cell += ' ' + items[i].str; }
        lastX = items[i].x + items[i].w;
      }
      cells.push(cell.trim());
      return cells.filter((c) => c);
    }).filter((r) => r.length > 0);
    if (!textRows.length) return { headers: [] as string[], rows: [] as Record<string,string>[] };
    const DATE_H = ['data','date','transaction date','booking date','data operazione','data valuta'];
    const AMT_H  = ['importo','amount','valore','dare','avere','credit','debit','withdrawal','deposit'];
    let hIdx = -1;
    for (let i = 0; i < Math.min(textRows.length, 30); i++) {
      const t = textRows[i].join(' ').toLowerCase();
      const d = DATE_H.some((h) => t.includes(h));
      const a = AMT_H.some((h) => t.includes(h));
      if (d && a) { hIdx = i; break; }
      if ((d || a) && hIdx === -1) hIdx = i;
    }
    if (hIdx === -1) hIdx = textRows.reduce((b, r, i) => r.length > textRows[b].length ? i : b, 0);
    const headerCells = textRows[hIdx];
    const colCount = Math.max(...textRows.map((r) => r.length));
    const headers = [...headerCells, ...Array.from({ length: Math.max(0, colCount - headerCells.length) }, (_, i) => `Col${i + headerCells.length + 1}`)];
    const rows = textRows.slice(hIdx + 1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))).filter((r) => Object.values(r).some((v) => v.trim()));
    return { headers, rows };
  }

  function normalizeDate(s: string): string | null {
    const str = s.trim().replace(/"/g, '');
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    if (/^\d{8}$/.test(str)) return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
    return null;
  }

  function normalizeAmount(s: string): number | null {
    let str = s.trim().replace(/[€$£\u00a0\s"]/g, '');
    if (!str || str === '-' || str === '+') return null;
    const neg = str.startsWith('-'); const pos = str.startsWith('+');
    str = str.replace(/^[+\-]/, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) str = str.replace(/\./g,'').replace(',','.');
    else if (/^\d+(,\d{1,2})?$/.test(str)) str = str.replace(',','.');
    else str = str.replace(/,(?=\d{3}(?:\.|$))/g,'');
    const n = parseFloat(str);
    if (isNaN(n)) return null;
    return neg ? -n : pos ? n : n;
  }

  const DATE_HINTS = ['data','date','dt','data operazione','data valuta','booking date','transaction date','competenza','giorno','data movimento','data pagamento'];
  const AMT_HINTS  = ['importo','amount','valore','dare','avere','credit','debit','withdrawal','deposit','entrate','uscite','totale','eur'];
  const DESC_HINTS = ['descrizione','causale','description','memo','note','dettaglio','motivo','narrative','beneficiario','merchant','testo'];

  function colScore(col: string, hints: string[]): number {
    const c = col.toLowerCase().trim();
    if (hints.some((h) => c === h)) return 100;
    if (hints.some((h) => c.includes(h))) return 20;
    return 0;
  }

  function autoMap(headers: string[]) {
    const scored = headers.map((h) => ({ h, date: colScore(h, DATE_HINTS), amt: colScore(h, AMT_HINTS), desc: colScore(h, DESC_HINTS) }));
    const pick = (role: 'date'|'amt'|'desc', used: Set<string>) => {
      const c = [...scored].filter((s) => !used.has(s.h) && s[role] > 0).sort((a,b) => b[role]-a[role]);
      return c[0]?.h ?? '';
    };
    const used = new Set<string>();
    const date = pick('date', used); used.add(date);
    const amount = pick('amt', used); used.add(amount);
    let description = pick('desc', used);
    if (!description) description = headers.find((h) => h !== date && h !== amount) ?? headers[0] ?? '';
    return { date, amount, description };
  }

  const [fileName, setFileName] = useState('');
  const [fileFormat, setFileFormat] = useState<FileFormat>('csv');
  const [headers, setHeaders]   = useState<string[]>([]);
  const [rawRows, setRawRows]   = useState<Record<string,string>[]>([]);
  const [colDate, setColDate]   = useState('');
  const [colAmt, setColAmt]     = useState('');
  const [colDesc, setColDesc]   = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [imported, setImported] = useState<number|null>(null);
  const [err, setErr]           = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate: bulkAdd, isPending } = useBulkAddTransactions();
  const { data: existing = [] } = useTransactions();

  const existingKeys = new Set(existing.map((t) => `${t.date}|${t.description.toLowerCase().trim()}`));

  function applyParsed(h: string[], rows: Record<string,string>[], name: string, fmt: FileFormat) {
    if (!h.length) { setErr('File vuoto o formato non riconosciuto.'); setLoading(false); return; }
    setHeaders(h); setRawRows(rows); setFileName(name); setFileFormat(fmt);
    const m = autoMap(h); setColDate(m.date); setColAmt(m.amount); setColDesc(m.description);
    setLoading(false);
  }

  function ingest(file: File) {
    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    const allowed: Record<string,FileFormat> = { csv:'csv', xlsx:'xlsx', xls:'xlsx', pdf:'pdf' };
    const fmt = allowed[ext];
    if (!fmt) { setErr('Seleziona .csv, .xlsx o .pdf'); return; }
    setErr(''); setImported(null); setLoading(true);
    const reader = new FileReader();
    if (fmt === 'csv') {
      reader.onload = (e) => { const { headers: h, rows } = parseCSV(e.target?.result as string); applyParsed(h, rows, file.name, 'csv'); };
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.onload = async (e) => {
        try {
          const buf = e.target?.result as ArrayBuffer;
          const result = fmt === 'pdf' ? await parsePDF(buf) : await parseXLSX(buf);
          applyParsed(result.headers, result.rows, file.name, fmt);
        } catch { setErr('Errore lettura file.'); setLoading(false); }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  interface ParsedRow { date: string; amount: number; type: TransactionType; description: string; ok: boolean; }
  const parsed: ParsedRow[] = rawRows.map((row) => {
    const rawDate = colDate ? (row[colDate] ?? '') : '';
    const rawAmt  = colAmt  ? (row[colAmt]  ?? '') : '';
    let rawDesc   = colDesc ? (row[colDesc] ?? '') : '';
    if (!rawDesc.trim()) { for (const [k,v] of Object.entries(row)) { if (k!==colDate && k!==colAmt && v?.trim()) { rawDesc=v.trim(); break; } } }
    const date = normalizeDate(rawDate);
    const amount = normalizeAmount(rawAmt);
    const ok = date !== null && amount !== null;
    const n = amount ?? 0;
    return { date: date ?? rawDate, amount: Math.abs(n), type: n < 0 ? 'expense' : 'income', description: rawDesc.trim() || (n<0?'Pagamento':'Entrata'), ok };
  });
  const valid = parsed.filter((r) => r.ok);
  const skipped = parsed.length - valid.length;

  function doImport() {
    if (!valid.length) return;
    const inputs = valid.map((r) => ({ amount: r.amount, type: r.type, category: 'other' as const, description: r.description, date: r.date }));
    const dups = inputs.filter((i) => existingKeys.has(`${i.date}|${i.description.toLowerCase().trim()}`));
    const toAdd = dups.length > 0 ? inputs.filter((i) => !existingKeys.has(`${i.date}|${i.description.toLowerCase().trim()}`)) : inputs;
    if (!toAdd.length && dups.length > 0) { setErr(`Tutti i ${dups.length} movimenti sono già presenti.`); return; }
    bulkAdd(toAdd, {
      onSuccess: () => { setImported(toAdd.length); setHeaders([]); setRawRows([]); setFileName(''); },
      onError: () => setErr('Errore importazione. Riprova.'),
    });
  }

  function reset() { setHeaders([]); setRawRows([]); setFileName(''); setColDate(''); setColAmt(''); setColDesc(''); setImported(null); setErr(''); setLoading(false); }

  const FMT_BADGE: Record<FileFormat, string> = { csv: 'CSV', xlsx: 'XLSX', pdf: 'PDF' };
  const hasFile = headers.length > 0;

  return (
    <div className="fp-section">
      {/* Success */}
      {imported !== null && (
        <div className="fp-import-success">
          ✓ {imported} movimenti importati
          <button className="fp-link-btn" onClick={reset}>Importa altro</button>
        </div>
      )}

      {!hasFile && imported === null && (
        <>
          <div
            className={`fp-dropzone ${dragging ? 'fp-dropzone--over' : ''} ${loading ? 'fp-dropzone--loading' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) ingest(f); }}
            onClick={() => !loading && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" style={{ display:'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) ingest(f); e.target.value=''; }} />
            {loading
              ? <><div className="fp-spin-icon" /><span className="fp-drop-label">Lettura…</span></>
              : <><Upload size={20} className="fp-drop-icon" /><span className="fp-drop-label">Trascina o <u>seleziona file</u></span><span className="fp-drop-sub">CSV · XLSX · PDF</span></>
            }
          </div>
          {err && <p className="fp-err">{err}</p>}
        </>
      )}

      {hasFile && imported === null && (
        <>
          <div className="fp-file-info">
            <span className="fp-file-badge">{FMT_BADGE[fileFormat]}</span>
            <span className="fp-file-name">{fileName}</span>
            <span className="fp-file-count">{rawRows.length} righe</span>
            <button className="fp-link-btn" onClick={reset}>✕</button>
          </div>

          {/* Column mapping */}
          <div className="fp-col-map">
            {(['colDate','colAmt','colDesc'] as const).map((key) => {
              const labels: Record<string,string> = { colDate:'Data', colAmt:'Importo', colDesc:'Descrizione' };
              const vals: Record<string,string> = { colDate, colAmt, colDesc };
              const setters: Record<string,(v:string)=>void> = { colDate:setColDate, colAmt:setColAmt, colDesc:setColDesc };
              return (
                <label key={key} className="fp-col-label">
                  {labels[key]}
                  <select className="fp-col-select" value={vals[key]} onChange={(e) => setters[key](e.target.value)}>
                    <option value="">—</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              );
            })}
          </div>

          <p className="fp-import-status">
            {valid.length > 0
              ? <><span className="fp-ok">✓ {valid.length} importabili</span>{skipped > 0 && <span className="fp-muted"> · {skipped} saltate</span>}</>
              : <span className="fp-warn">Nessuna riga valida — verifica le colonne</span>
            }
          </p>

          {/* Mini preview */}
          {parsed.slice(0,4).map((r, i) => (
            <div key={i} className={`fp-txn-row ${r.ok ? '' : 'fp-txn-row--bad'}`}>
              {r.ok && <span className={`fp-txn-dot ${r.type==='income'?'fp-dot--green':'fp-dot--red'}`} />}
              <span className="fp-txn-date">{r.date||'—'}</span>
              <span className="fp-txn-desc">{r.description}</span>
              {r.ok && <span className={`fp-txn-amt ${r.type==='income'?'fp-amt--green':'fp-amt--red'}`}>{r.type==='income'?'+':'−'}{formatCurrency(r.amount)}</span>}
            </div>
          ))}
          {parsed.length > 4 && <p className="fp-muted" style={{fontSize:'0.68rem',textAlign:'center',marginTop:4}}>+{parsed.length-4} elementi</p>}

          {err && <p className="fp-err">{err}</p>}

          <button className="fp-submit-btn" onClick={doImport} disabled={valid.length===0||isPending}>
            {isPending ? 'Importazione…' : `Importa ${valid.length} moviment${valid.length===1?'o':'i'}`}
          </button>
        </>
      )}
    </div>
  );
}


// ── Subscription detection ────────────────────────────────────────────────────

interface Subscription {
  key: string;
  displayName: string;
  amount: number;
  typicalDay: number;
  months: number;
  firstSeen: string;
  icon: string;
}

const SUB_ICONS: [RegExp, string][] = [
  [/netflix/i,                                   '📺'],
  [/amazon|prime video/i,                        '📦'],
  [/disney/i,                                    '🏰'],
  [/spotify|apple music|deezer|tidal/i,          '🎵'],
  [/youtube premium/i,                           '▶️'],
  [/palestra|gym|fitness|fitprime|blaze|virgin/i,'💪'],
  [/adobe/i,                                     '🎨'],
  [/microsoft|office|xbox|gamepass/i,            '💻'],
  [/apple|icloud/i,                              '🍎'],
  [/google one/i,                                '☁️'],
  [/iliad|tim |wind|vodafone|fastweb|tre /i,     '📱'],
  [/assicurazion/i,                              '🛡️'],
  [/affitto|rent/i,                              '🏠'],
  [/mutuo/i,                                     '🏦'],
  [/canone|abbonamento/i,                        '📋'],
];

function subIcon(desc: string): string {
  for (const [re, icon] of SUB_ICONS) if (re.test(desc)) return icon;
  return '↻';
}

/** Tolleranza importo: relativa al prezzo, mai oltre 2 € */
function amtTolerance(median: number): number {
  if (median < 5)   return 0.50;
  if (median < 20)  return 1.00;
  if (median < 100) return 2.00;
  return Math.min(median * 0.03, 5.00);
}

function detectSubscriptions(txns: Transaction[]): Subscription[] {
  const now    = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 8, 1).getTime();
  const recent = txns.filter(t => t.type === 'expense' && new Date(t.date).getTime() >= cutoff);

  // Raggruppa per descrizione normalizzata
  const byDesc = new Map<string, Transaction[]>();
  for (const t of recent) {
    const key = t.description.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
    const arr = byDesc.get(key) ?? [];
    arr.push(t);
    byDesc.set(key, arr);
  }

  const subs: Subscription[] = [];

  for (const [normDesc, group] of byDesc) {
    if (group.length < 3) continue;

    // Importo mediano + tolleranza
    const sorted = [...group].sort((a, b) => a.amount - b.amount);
    const median = sorted[Math.floor(sorted.length / 2)].amount;
    const tol    = amtTolerance(median);

    const amtFiltered = group.filter(t => Math.abs(t.amount - median) <= tol);
    if (amtFiltered.length < 3) continue;

    // Giorno mediano del mese
    const days   = amtFiltered.map(t => parseInt(t.date.slice(8, 10))).sort((a, b) => a - b);
    const medDay = days[Math.floor(days.length / 2)];

    // Filtra per prossimità al giorno (±6, con wrap fine mese)
    const dayFiltered = amtFiltered.filter(t => {
      const d    = parseInt(t.date.slice(8, 10));
      const diff = Math.abs(d - medDay);
      return Math.min(diff, 31 - diff) <= 6;
    });
    if (dayFiltered.length < 3) continue;

    // ≥3 mesi distinti
    const monthKeys = [...new Set(dayFiltered.map(t => t.date.slice(0, 7)))].sort();
    if (monthKeys.length < 3) continue;

    // Mesi consecutivi (gap max 2 mesi tra adiacenti)
    let consecutive = true;
    for (let i = 1; i < monthKeys.length; i++) {
      const [y1, m1] = monthKeys[i - 1].split('-').map(Number);
      const [y2, m2] = monthKeys[i].split('-').map(Number);
      if ((y2 - y1) * 12 + (m2 - m1) > 2) { consecutive = false; break; }
    }
    if (!consecutive) continue;

    const avgAmount  = dayFiltered.reduce((s, t) => s + t.amount, 0) / dayFiltered.length;
    const firstSeen  = [...dayFiltered].sort((a, b) => a.date.localeCompare(b.date))[0].date;
    const displayName = group.find(t =>
      t.description.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60) === normDesc
    )?.description.trim() ?? normDesc;

    subs.push({ key: normDesc, displayName, amount: avgAmount, typicalDay: medDay, months: monthKeys.length, firstSeen, icon: subIcon(normDesc) });
  }

  return subs.sort((a, b) => b.amount - a.amount);
}

// ── SubscriptionsTab ──────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const { data: txns = [] } = useTransactions();
  const [expanded, setExpanded] = useState<string | null>(null);

  const subs         = useMemo(() => detectSubscriptions(txns), [txns]);
  const totalMonthly = subs.reduce((s, sub) => s + sub.amount, 0);

  if (subs.length === 0) return (
    <div className="fp-section">
      <p className="fp-sub-empty">Nessun pagamento ricorrente rilevato.</p>
      <p className="fp-sub-empty-hint">
        Servono almeno 3 addebiti in 3 mesi consecutivi, con importo e giorno del mese simili.
      </p>
    </div>
  );

  return (
    <div className="fp-section">
      <div className="fp-sub-header">
        <span>{subs.length} ricorrenti</span>
        <span className="fp-sub-sep">·</span>
        <span>{formatCurrency(totalMonthly)}<span className="fp-sub-freq">/mese</span></span>
        <span className="fp-sub-sep">·</span>
        <span className="fp-sub-year">{formatCurrency(totalMonthly * 12)}/anno</span>
      </div>

      <div className="fp-sub-list">
        {subs.map((sub) => {
          const isOpen = expanded === sub.key;
          const since  = new Date(sub.firstSeen).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });

          return (
            <div key={sub.key} className="fp-sub-item">
              <div className="fp-sub-row">
                <span className="fp-sub-icon">{sub.icon}</span>
                <div className="fp-sub-info">
                  <span className="fp-sub-name">{sub.displayName}</span>
                  <span className="fp-sub-meta">~{sub.typicalDay} del mese · {sub.months} mesi · da {since}</span>
                </div>
                <div className="fp-sub-right">
                  <span className="fp-sub-amt">{formatCurrency(sub.amount)}<span className="fp-sub-freq">/mese</span></span>
                  <button
                    className={`fp-sub-btn${isOpen ? ' fp-sub-btn--open' : ''}`}
                    onClick={() => setExpanded(isOpen ? null : sub.key)}
                  >
                    {isOpen ? '✕' : 'Cancella?'}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="fp-sub-savings"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <span className="fp-sub-savings-label">Se disdici risparmi</span>
                    <strong className="fp-sub-savings-value">{formatCurrency(sub.amount * 12)} all'anno</strong>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Budget helpers ─────────────────────────────────────────────────────────────

const DEFAULT_CAT_MAP: Record<string, { label: string; icon: string }> = {
  ...Object.fromEntries(FINANCE_DEFAULT_CATS.map(c => [c.id, { label: c.label, icon: c.icon }])),
  other: { label: 'Altro', icon: '📂' },
};

function budgetCatInfo(id: string, userCats: { id: string; label: string; icon?: string }[]) {
  const user = userCats.find(c => c.id === id);
  if (user) return { label: user.label, icon: user.icon ?? '◦' };
  return DEFAULT_CAT_MAP[id] ?? { label: id, icon: '◦' };
}

function pctColor(pct: number): string {
  if (pct > 100) return '#ef4444';
  if (pct > 80)  return '#f87171';
  if (pct > 60)  return '#f59e0b';
  return '#34d399';
}

// ── BudgetTab ──────────────────────────────────────────────────────────────────

function BudgetTab() {
  const { data: txns    = [] } = useTransactions();
  const { data: budgets = [] } = useFinanceBudgets();
  const { data: userCats= [] } = useFinanceCategories();
  const { mutate: upsert, isPending: upserting } = useUpsertBudget();
  const { mutate: remove } = useDeleteBudget();

  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editLimit,  setEditLimit]  = useState('');
  const [addCat,     setAddCat]     = useState('');
  const [addLimit,   setAddLimit]   = useState('');

  const now        = new Date();
  const monthKey   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  // Spese mese corrente per categoria
  const spentByCat = txns
    .filter(t => t.type === 'expense' && t.date.startsWith(monthKey))
    .reduce<Record<string, number>>((acc, t) => {
      const cat = t.category || 'other';
      acc[cat] = (acc[cat] ?? 0) + t.amount;
      return acc;
    }, {});

  // Righe budget arricchite
  const budgetRows = budgets.map(b => ({
    ...b,
    spent: spentByCat[b.category] ?? 0,
    pct:   b.monthly_limit > 0
             ? ((spentByCat[b.category] ?? 0) / b.monthly_limit) * 100
             : 0,
    info:  budgetCatInfo(b.category, userCats),
  })).sort((a, b) => b.pct - a.pct);

  const warnings = budgetRows.filter(b => b.pct >= 80);

  // Categorie con spese ma senza budget
  const budgetedSet  = new Set(budgets.map(b => b.category));
  const unbudgeted   = Object.entries(spentByCat)
    .filter(([cat]) => !budgetedSet.has(cat))
    .sort(([, a], [, b]) => b - a);

  // Categorie disponibili per l'aggiunta budget
  const allCats = [
    ...FINANCE_DEFAULT_CATS,
    ...userCats.map(c => ({ id: c.id, label: c.label, icon: c.icon ?? '◦' })),
    { id: 'other', label: 'Altro', icon: '📂' },
  ].filter(c => !budgetedSet.has(c.id));

  function startEdit(cat: string, currentLimit: number) {
    setEditingCat(cat);
    setEditLimit(String(currentLimit));
  }

  function saveEdit() {
    const n = parseFloat(editLimit.replace(',', '.'));
    if (!editingCat || !n || isNaN(n)) return;
    upsert({ category: editingCat, monthly_limit: n }, { onSuccess: () => setEditingCat(null) });
  }

  function addBudget() {
    const n = parseFloat(addLimit.replace(',', '.'));
    if (!addCat || !n || isNaN(n)) return;
    upsert({ category: addCat, monthly_limit: n }, {
      onSuccess: () => { setAddCat(''); setAddLimit(''); },
    });
  }

  return (
    <div className="fp-section">
      {/* Header contesto giorni */}
      <p className="fp-section-label">
        Giorno {dayOfMonth} di {daysInMonth} &middot; budget mensile
      </p>

      {/* Avvisi soglia 80% */}
      {warnings.length > 0 && (
        <div className="fp-budget-alerts">
          {warnings.map(w => (
            <div
              key={w.category}
              className={['fp-budget-alert', w.pct > 100 ? 'fp-budget-alert--over' : 'fp-budget-alert--warn'].join(' ')}
            >
              <span className="fp-budget-alert-icon">{w.pct > 100 ? '🔴' : '⚠️'}</span>
              <span className="fp-budget-alert-text">
                {w.pct > 100
                  ? `Sforato! ${w.info.label}: +${formatCurrency(w.spent - w.monthly_limit)} oltre il limite`
                  : `${w.info.label} al ${Math.round(w.pct)}% — siamo al giorno ${dayOfMonth}/${daysInMonth}`
                }
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Righe budget */}
      {budgetRows.length === 0 ? (
        <p className="fp-empty">Nessun budget impostato. Aggiungilo qui sotto.</p>
      ) : (
        <div className="fp-budget-list">
          {budgetRows.map(b => (
            <div key={b.category} className="fp-budget-row">
              {editingCat === b.category ? (
                <div className="fp-budget-edit-row">
                  <span className="fp-budget-edit-label">{b.info.icon} {b.info.label}</span>
                  <input
                    className="fp-budget-edit-input"
                    type="number"
                    inputMode="decimal"
                    value={editLimit}
                    onChange={e => setEditLimit(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    autoFocus
                  />
                  <button className="fp-budget-edit-btn fp-budget-edit-btn--save" onClick={saveEdit} disabled={upserting}>✓</button>
                  <button className="fp-budget-edit-btn" onClick={() => setEditingCat(null)}>✕</button>
                </div>
              ) : (
                <>
                  <div className="fp-budget-row-header">
                    <span className="fp-budget-cat-icon">{b.info.icon}</span>
                    <span className="fp-budget-cat-label">{b.info.label}</span>
                    <span className="fp-budget-amounts">
                      <span style={{ color: pctColor(b.pct), fontWeight: 700 }}>{formatCurrency(b.spent)}</span>
                      <span className="fp-budget-sep">/</span>
                      <span>{formatCurrency(b.monthly_limit)}</span>
                    </span>
                    <span className="fp-budget-pct" style={{ color: pctColor(b.pct) }}>
                      {Math.round(Math.min(b.pct, 999))}%
                    </span>
                    <button className="fp-budget-icon-btn" onClick={() => startEdit(b.category, b.monthly_limit)} title="Modifica">✎</button>
                    <button className="fp-budget-icon-btn fp-budget-icon-btn--del" onClick={() => remove(b.id)} title="Rimuovi">✕</button>
                  </div>

                  {/* Termometro */}
                  <div className="fp-budget-bar-track">
                    <motion.div
                      className="fp-budget-bar-fill"
                      style={{ background: pctColor(b.pct) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(b.pct, 100)}%` }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                    />
                    {b.pct > 100 && (
                      <div className="fp-budget-bar-over" style={{ width: `${Math.min((b.pct - 100) / b.pct * 100, 30)}%` }} />
                    )}
                  </div>
                  <div className="fp-budget-bar-labels">
                    <span>0€</span>
                    <span>{formatCurrency(b.monthly_limit / 2)}</span>
                    <span>{formatCurrency(b.monthly_limit)}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Categorie con spese senza budget */}
      {unbudgeted.length > 0 && (
        <>
          <p className="fp-section-label" style={{ marginTop: '1rem' }}>Senza limite impostato</p>
          <div className="fp-budget-unset-list">
            {unbudgeted.map(([cat, amt]) => {
              const info = budgetCatInfo(cat, userCats);
              return (
                <div key={cat} className="fp-budget-unset-row">
                  <span className="fp-budget-cat-icon">{info.icon}</span>
                  <span className="fp-budget-cat-label">{info.label}</span>
                  <span className="fp-amt--red">−{formatCurrency(amt)}</span>
                  <button
                    className="fp-budget-set-btn"
                    onClick={() => { setAddCat(cat); setAddLimit(''); }}
                  >
                    + imposta
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Form aggiungi budget */}
      <p className="fp-section-label" style={{ marginTop: '1rem' }}>Aggiungi budget</p>
      <div className="fp-budget-add-row">
        <select
          className="fp-budget-select"
          value={addCat}
          onChange={e => setAddCat(e.target.value)}
        >
          <option value="">Categoria…</option>
          {allCats.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
        <input
          className="fp-budget-add-input"
          type="number"
          inputMode="decimal"
          placeholder="€/mese"
          value={addLimit}
          onChange={e => setAddLimit(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBudget()}
        />
        <button
          className="fp-budget-add-btn"
          onClick={addBudget}
          disabled={upserting || !addCat || !addLimit}
        >
          {upserting ? '…' : '＋'}
        </button>
      </div>
    </div>
  );
}

// ── Predictive balance ─────────────────────────────────────────────────────────

interface RecurringPattern {
  description: string;
  displayName: string;
  type: 'income' | 'expense';
  typicalDay: number;
  avgAmount: number;
  confidence: number; // 0–100
  months: number;
}

const LOOKBACK = 9;

function detectRecurring(txns: Transaction[]): RecurringPattern[] {
  const now    = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - LOOKBACK + 1, 1).getTime();
  const recent = txns.filter(t => new Date(t.date).getTime() >= cutoff);

  type MonthData = { days: number[]; amounts: number[] };
  const groups = new Map<string, Map<string, MonthData>>();

  for (const t of recent) {
    const normDesc = t.description.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
    const key      = t.type + '|' + normDesc;
    const monthKey = t.date.slice(0, 7);
    const day      = parseInt(t.date.slice(8, 10));

    if (!groups.has(key)) groups.set(key, new Map());
    const byMonth = groups.get(key)!;
    const m       = byMonth.get(monthKey) ?? { days: [], amounts: [] };
    m.days.push(day);
    m.amounts.push(t.amount);
    byMonth.set(monthKey, m);
  }

  const patterns: RecurringPattern[] = [];

  for (const [key, byMonth] of groups) {
    if (byMonth.size < 3) continue;

    const [type, ...rest] = key.split('|');
    const normDesc = rest.join('|');

    const allDays = [...byMonth.values()].flatMap(m => m.days).sort((a, b) => a - b);
    const allAmts = [...byMonth.values()].flatMap(m => m.amounts);
    const medDay  = allDays[Math.floor(allDays.length / 2)];
    const avgAmt  = allAmts.reduce((s, a) => s + a, 0) / allAmts.length;

    // Frequenza: mesi presenti su LOOKBACK
    const freqScore = byMonth.size / LOOKBACK;

    // Consistenza importo: coefficiente di variazione (0 = perfetto)
    const variance = allAmts.reduce((s, a) => s + (a - avgAmt) ** 2, 0) / allAmts.length;
    const cv       = avgAmt > 0 ? Math.sqrt(variance) / avgAmt : 1;
    const amtScore = Math.max(0, 1 - cv * 4);

    // Consistenza giorno: deviazione standard dal giorno mediano
    const dayVar   = allDays.reduce((s, d) => {
      const diff = Math.abs(d - medDay);
      return s + Math.min(diff, 31 - diff) ** 2;
    }, 0) / allDays.length;
    const dayScore = Math.max(0, 1 - Math.sqrt(dayVar) / 12);

    const confidence = Math.round((freqScore * 0.55 + amtScore * 0.25 + dayScore * 0.20) * 100);
    if (confidence < 55) continue;

    const displayName = txns.find(t =>
      t.description.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60) === normDesc
    )?.description.trim() ?? normDesc;

    patterns.push({
      description: normDesc,
      displayName,
      type:        type as 'income' | 'expense',
      typicalDay:  medDay,
      avgAmount:   avgAmt,
      confidence,
      months:      byMonth.size,
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence || b.avgAmount - a.avgAmount);
}

function AnalisiTab() {
  const { data: txns = [] } = useTransactions();

  const patterns = useMemo(() => detectRecurring(txns), [txns]);

  const now        = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
  const nextMonthIdx   = (now.getMonth() + 1) % 12;
  const nextMonthLabel = MONTHS_IT[nextMonthIdx];

  // Build last 6 months (shared for chart + table)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
    const mTxs = txns.filter((t) => t.date.startsWith(key));
    return {
      key,
      label:      MONTHS_IT[d.getMonth()],
      fmtLabel:   fmtMonth(key),
      inc:        mTxs.filter((t) => t.type === 'income').reduce((s,t) => s+t.amount, 0),
      exp:        mTxs.filter((t) => t.type === 'expense').reduce((s,t) => s+t.amount, 0),
      isCurrent:  key === currentKey,
    };
  });

  const avgIncome   = months.reduce((s,m) => s+m.inc, 0) / 6;
  const avgExpenses = months.reduce((s,m) => s+m.exp, 0) / 6;
  const bestMonth   = [...months].sort((a,b) => (b.inc-b.exp)-(a.inc-a.exp))[0];

  // Trend uscite vs mese precedente
  const cur  = months[months.length - 1];
  const prev = months[months.length - 2];
  const expDiff = prev && prev.exp > 0 ? ((cur.exp - prev.exp) / prev.exp) * 100 : null;

  return (
    <div className="fp-section">
      {/* Cashflow chart */}
      <p className="fp-section-label">Cashflow · 6 mesi</p>

      {/* Legend */}
      <div className="fc-legend" style={{ marginBottom: '0.4rem' }}>
        <span className="fc-legend-item"><span className="fc-legend-dot" style={{ background: '#34d399' }} />Entrate</span>
        <span className="fc-legend-item"><span className="fc-legend-dot" style={{ background: '#f87171' }} />Uscite</span>
        {expDiff !== null && (
          <span className="fc-trend-badge" style={{ color: expDiff > 0 ? '#f87171' : '#34d399', fontSize: '0.65rem' }}>
            {expDiff > 0 ? '↑' : '↓'}{Math.abs(expDiff).toFixed(0)}% uscite vs {prev.label}
          </span>
        )}
      </div>

      <div className="fc-chart-wrap" style={{ marginBottom: '0.75rem' }}>
        <GroupedBarChart months={months} />
      </div>

      {/* Avg KPIs */}
      <div className="fp-kpi-row">
        <div className="fp-kpi-chip fp-kpi-chip--green">
          <span className="fp-kpi-label">Media entrate</span>
          <span className="fp-kpi-value">{formatCurrency(avgIncome)}</span>
        </div>
        <div className="fp-kpi-chip fp-kpi-chip--red">
          <span className="fp-kpi-label">Media uscite</span>
          <span className="fp-kpi-value">{formatCurrency(avgExpenses)}</span>
        </div>
        <div className="fp-kpi-chip fp-kpi-chip--amber">
          <span className="fp-kpi-label">Miglior mese</span>
          <span className="fp-kpi-value">{bestMonth?.fmtLabel ?? '—'}</span>
        </div>
      </div>

      {/* Monthly table */}
      <p className="fp-section-label">Dettaglio mesi</p>
      <div className="fp-month-table">
        <div className="fp-month-header">
          <span>Mese</span>
          <span>Entrate</span>
          <span>Uscite</span>
          <span>Saldo</span>
        </div>
        {months.map((m) => {
          const bal = m.inc - m.exp;
          return (
            <div key={m.key} className={['fp-month-row', m.isCurrent ? 'fp-month-row--current' : ''].filter(Boolean).join(' ')}>
              <span className="fp-month-label">{m.fmtLabel}</span>
              <span className="fp-amt--green">{formatCurrency(m.inc)}</span>
              <span className="fp-amt--red">{formatCurrency(m.exp)}</span>
              <span className={bal >= 0 ? 'fp-amt--green' : 'fp-amt--red'}>{formatCurrency(bal)}</span>
            </div>
          );
        })}
      </div>

      {/* ── Previsioni prossimo mese ── */}
      <div className="fp-pred-header">
        <span className="fp-section-label" style={{ margin: 0 }}>
          Previsioni · {nextMonthLabel}
        </span>
        {patterns.length > 0 && (() => {
          const projInc = patterns.filter(p => p.type === 'income').reduce((s, p) => s + p.avgAmount, 0);
          const projExp = patterns.filter(p => p.type === 'expense').reduce((s, p) => s + p.avgAmount, 0);
          const projBal = projInc - projExp;
          return (
            <span className="fp-pred-total" style={{ color: projBal >= 0 ? '#34d399' : '#f87171' }}>
              {projBal >= 0 ? '+' : ''}{formatCurrency(projBal)}
            </span>
          );
        })()}
      </div>

      {patterns.length === 0 ? (
        <p className="fp-pred-empty">
          Dati insufficienti. Servono almeno 3 mesi di movimenti per rilevare ricorrenze.
        </p>
      ) : (
        <div className="fp-pred-list">
          {patterns.map((p, i) => (
            <div key={i} className="fp-pred-row">
              <span
                className="fp-pred-dot"
                style={{ background: p.type === 'income' ? '#34d399' : '#f87171' }}
              />
              <div className="fp-pred-info">
                <span className="fp-pred-desc">{p.displayName}</span>
                <span className="fp-pred-day">~{p.typicalDay} del mese</span>
              </div>
              <span className={p.type === 'income' ? 'fp-amt--green' : 'fp-amt--red'}>
                {p.type === 'income' ? '+' : '−'}{formatCurrency(p.avgAmount)}
              </span>
              <span className="fp-pred-conf">{p.confidence}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main fragment ─────────────────────────────────────────────────────────────

export function FinancePanoramaFragment({ params }: { params: Record<string, unknown> }) {
  const [tab, setTab] = useState<TabId>((params.tab as TabId) ?? 'panoramica');

  return (
    <NebulaCard icon="💰" title="Finanze" variant="finance" closable>
      {/* Tab bar — stile admin */}
      <div className="admin-tabbar fp-tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={['admin-tab', tab === t.id ? 'admin-tab--active fp-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} {...TAB_ANIM}>
          {tab === 'panoramica' && <PanoramaTab />}
          {tab === 'budget'       && <BudgetTab />}
          {tab === 'abbonamenti'  && <SubscriptionsTab />}
          {tab === 'aggiungi'     && <AggiungiTab />}
          {tab === 'importa'    && <ImportaTab />}
          {tab === 'categorie'  && <div className="fp-section"><FinanceCategoryContent /></div>}
          {tab === 'analisi'    && <AnalisiTab />}
        </motion.div>
      </AnimatePresence>
    </NebulaCard>
  );
}
