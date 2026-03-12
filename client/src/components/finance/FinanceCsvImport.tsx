import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { useBulkAddTransactions, useTransactions } from '@/hooks/useFinance';
import type { TransactionType, TransactionInput } from '@/types';

// ── CSV parser ───────────────────────────────────────────────────────────────

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
  let field = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === delim && !inQ) { result.push(field.trim().replace(/^"|"$/g, '')); field = ''; }
    else { field += ch; }
  }
  result.push(field.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim);
  const rows = lines
    .slice(1)
    .map((line) => {
      const vals = splitLine(line, delim);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    })
    .filter((r) => Object.values(r).some((v) => v.trim() !== ''));
  return { headers, rows };
}

// ── XLSX parser (SheetJS) ────────────────────────────────────────────────────

async function parseXLSXBuffer(
  buffer: ArrayBuffer,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };

  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    dateNF: 'YYYY-MM-DD',
    defval: '',
  });

  if (data.length < 2) return { headers: [], rows: [] };

  // Find first non-empty row as headers
  let headerIdx = 0;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    if ((data[i] as string[]).some((v) => String(v).trim())) { headerIdx = i; break; }
  }

  const headers = (data[headerIdx] as unknown[]).map((h, i) =>
    String(h).trim() || `Col${i + 1}`,
  );
  const rows = (data.slice(headerIdx + 1) as unknown[][])
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])))
    .filter((r) => Object.values(r).some((v) => v));

  return { headers, rows };
}

// ── PDF parser (pdfjs-dist) ──────────────────────────────────────────────────

async function parsePDFBuffer(
  buffer: ArrayBuffer,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href;

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  interface Item { x: number; y: number; w: number; str: string; }
  const allItems: Item[] = [];
  let pageOffsetY = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = viewport.height - item.transform[5] + pageOffsetY;
      const w = (item as { width?: number }).width ?? item.str.length * 5;
      allItems.push({ x, y, w, str: item.str.trim() });
    }
    pageOffsetY += viewport.height + 20;
  }

  if (!allItems.length) return { headers: [], rows: [] };

  allItems.sort((a, b) => a.y - b.y || a.x - b.x);

  // Cluster items by Y coordinate (same line = within 4pt)
  const lineMap: Map<number, Item[]> = new Map();
  for (const item of allItems) {
    let placed = false;
    for (const [lineY, items] of lineMap) {
      if (Math.abs(item.y - lineY) <= 4) { items.push(item); placed = true; break; }
    }
    if (!placed) lineMap.set(item.y, [item]);
  }

  const lines = [...lineMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, items]) => items.sort((a, b) => a.x - b.x));

  // Convert each line to cells by detecting X gaps
  const textRows = lines
    .map((items) => {
      if (!items.length) return [];
      const cells: string[] = [];
      let cell = items[0].str;
      let lastEndX = items[0].x + items[0].w;
      for (let i = 1; i < items.length; i++) {
        const gap = items[i].x - lastEndX;
        if (gap > 15) { cells.push(cell.trim()); cell = items[i].str; }
        else { cell += ' ' + items[i].str; }
        lastEndX = items[i].x + items[i].w;
      }
      cells.push(cell.trim());
      return cells.filter((c) => c);
    })
    .filter((r) => r.length > 0);

  if (!textRows.length) return { headers: [], rows: [] };

  // Find header row containing date/amount hint words
  let headerIdx = -1;
  for (let i = 0; i < Math.min(textRows.length, 30); i++) {
    const rowText = textRows[i].join(' ').toLowerCase();
    const hasDate = DATE_HINTS.some((h) => rowText.includes(h));
    const hasAmt  = AMT_HINTS.some((h) => rowText.includes(h));
    if (hasDate && hasAmt) { headerIdx = i; break; }
    if ((hasDate || hasAmt) && headerIdx === -1) headerIdx = i;
  }
  if (headerIdx === -1) {
    headerIdx = textRows.reduce((best, row, i) =>
      row.length > textRows[best].length ? i : best, 0);
  }

  const headerCells = textRows[headerIdx];
  const colCount = Math.max(...textRows.map((r) => r.length));
  const headers: string[] = [
    ...headerCells,
    ...Array.from({ length: Math.max(0, colCount - headerCells.length) }, (_, i) =>
      `Col${i + headerCells.length + 1}`),
  ];

  const rows = textRows.slice(headerIdx + 1).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])),
  ).filter((r) => Object.values(r).some((v) => v.trim()));

  return { headers, rows };
}

// ── Value normalizers ────────────────────────────────────────────────────────

function normalizeDate(s: string): string | null {
  const str = s.trim().replace(/"/g, '');
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }

  const months: Record<string, string> = {
    gen:'01', feb:'02', mar:'03', apr:'04', mag:'05', giu:'06',
    lug:'07', ago:'08', set:'09', ott:'10', nov:'11', dic:'12',
    jan:'01', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', dec:'12',
  };
  const mname = str.toLowerCase().match(/^(\d{1,2})[\s\-\/]([a-z]{3})[\s\-\/](\d{4})/);
  if (mname && months[mname[2]])
    return `${mname[3]}-${months[mname[2]]}-${mname[1].padStart(2, '0')}`;

  return null;
}

function normalizeAmount(s: string): number | null {
  let str = s.trim().replace(/[€$£\u00a0\s"]/g, '');
  if (!str || str === '-' || str === '+' || str.toLowerCase() === 'n/a') return null;

  const neg = str.startsWith('-');
  const pos = str.startsWith('+');
  str = str.replace(/^[+\-]/, '');

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(,\d{1,2})?$/.test(str)) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,(?=\d{3}(?:\.|$))/g, '');
  }

  const n = parseFloat(str);
  if (isNaN(n)) return null;
  return neg ? -n : pos ? n : n;
}

// ── Column matching ──────────────────────────────────────────────────────────

const DATE_HINTS = [
  'data', 'date', 'datum', 'fecha', 'dt', 'Dati',
  'data operazione', 'data di operazione', 'data_operazione',
  'data valuta', 'data di valuta', 'data_valuta',
  'data contabile', 'data di contabilizzazione', 'data_contabile',
  'data registrazione', 'data di registrazione', 'data_registrazione',
  'data inizio', 'data di inizio', 'data_inizio', 'start date', 'data inzio',
  'data completamento', 'data di completamento', 'data_completamento', 'completion date', 'end date',
  'data pagamento', 'data di pagamento', 'data_pagamento', 'payment date',
  'data addebito', 'data accredito', 'data esecuzione', 'data di esecuzione',
  'booking date', 'transaction date', 'value date', 'settlement date', 'posting date',
  'operation date', 'op date', 'trans date', 'trade date',
  'competenza', 'data competenza', 'data di competenza',
  'giorno', 'day', 'periodo', 'when', 'timestamp', 'created at', 'created_at',
  'movimento', 'data movimento', 'time', 'datetime', 'data e ora',
];

const AMT_HINTS = [
  'importo', 'amount', 'valore', 'amt', 'importe', 'betrag', 'montant',
  'importo operazione', 'importo transazione', 'importo_operazione',
  'importo netto', 'importo lordo', 'netto', 'lordo', 'net amount', 'gross amount',
  'dare/avere', 'dare', 'avere', 'entrate', 'uscite', 'entrata', 'uscita',
  'accredito', 'addebito', 'accrediti', 'addebiti',
  'credito', 'debito', 'credit', 'debit',
  'withdrawal', 'deposit', 'charge', 'payment',
  'movement', 'movimiento', 'in', 'out',
  'soldi', 'euro', 'eur', 'totale', 'total', 'price', 'prezzo',
  'valore operazione', 'valore_operazione', 'cifra',
  'money', 'cash', 'fee', 'commissione', 'costo', 'cost',
  'saldo variazione', 'variazione saldo',
];

const DESC_HINTS = [
  'descrizione', 'causale', 'description', 'memo', 'note', 'notes',
  'dettaglio', 'motivo', 'reason', 'narrative', 'details', 'reference',
  'testo', 'beneficiario', 'ordinante', 'merchant', 'esercente',
  'descrizione operazione', 'dettaglio operazione', 'causale operazione',
  'causale bonifico', 'causale pagamento', 'causale del movimento',
  'informazioni', 'informazioni aggiuntive', 'additional info',
  'remittance info', 'wording', 'libero', 'controparte', 'intestatario',
  'oggetto', 'subject', 'label', 'etichetta', 'categoria movimenti',
  'tipo', 'tipo operazione', 'tipologia', 'nome', 'name',
  'dati aggiuntivi', 'note aggiuntive', 'product', 'prodotto',
  'commerciante', 'pagamento a', 'pagamento da', 'mittente', 'destinatario',
  'title', 'titolo', 'abstract', 'comment', 'commento',
  'movimento', 'operazione', 'transaction', 'transazione',
  'addebito', 'accredito', 'bonifico', 'pagamento', 'rimborso',
  'ricevuta', 'fattura', 'invoice', 'receipt',
  'desc', 'caus', 'note', 'info', 'detail',
  'descrizione movimento', 'descrizione transazione', 'descrizione pagamento',
  'causale movimento', 'causale transazione', 'causale pagamento',
  'descrizione addebito', 'descrizione accredito', 'descrizione bonifico',
  'descrizione rimborso', 'causale rimborso', 'Descrizione Operazione',
];

function colScore(col: string, hints: string[]): number {
  const c = col.toLowerCase().trim();
  if (hints.some((h) => c === h))                       return 100;
  if (hints.some((h) => c.startsWith(h)))               return 40;
  if (hints.some((h) => c.includes(h)))                 return 15;
  if (hints.some((h) => h.includes(c) && c.length >= 4)) return 8;
  return 0;
}

function autoMapColumns(headers: string[]): { date: string; amount: string; description: string } {
  const scored = headers.map((h) => ({
    h,
    date: colScore(h, DATE_HINTS),
    amt:  colScore(h, AMT_HINTS),
    desc: colScore(h, DESC_HINTS),
  }));

  const pick = (role: 'date' | 'amt' | 'desc', used: Set<string>) => {
    const candidates = [...scored]
      .filter((s) => !used.has(s.h) && s[role] > 0)
      .sort((a, b) => {
        if (b[role] !== a[role]) return b[role] - a[role];
        const aL = a.h.toLowerCase();
        const bL = b.h.toLowerCase();
        const aD = aL.includes('descrizione') || aL.includes('description');
        const bD = bL.includes('descrizione') || bL.includes('description');
        if (aD && !bD) return -1;
        if (!aD && bD) return 1;
        return 0;
      });
    return candidates[0]?.h ?? '';
  };

  const used = new Set<string>();
  const date = pick('date', used); used.add(date);
  const amount = pick('amt', used); used.add(amount);
  let description = pick('desc', used);

  if (!description) {
    for (const header of headers) {
      if (header !== date && header !== amount) { description = header; break; }
    }
  }
  if (!description && headers.length > 0) description = headers[0];

  return { date, amount, description };
}

// ── Component ────────────────────────────────────────────────────────────────

type FileFormat = 'csv' | 'xlsx' | 'pdf';

interface ParsedRow {
  date: string;
  amount: number;
  type: TransactionType;
  description: string;
  ok: boolean;
}

interface DuplicateInfo {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
}

const FORMAT_LABEL: Record<FileFormat, string> = { csv: 'CSV', xlsx: 'XLSX', pdf: 'PDF' };

export function FinanceCsvImport() {
  const bulkAdd = useBulkAddTransactions();
  const { data: existingTxns = [] } = useTransactions();

  const [headers,    setHeaders   ] = useState<string[]>([]);
  const [rawRows,    setRawRows   ] = useState<Record<string, string>[]>([]);
  const [fileName,   setFileName  ] = useState('');
  const [fileFormat, setFileFormat] = useState<FileFormat>('csv');
  const [colDate,    setColDate   ] = useState('');
  const [colAmt,     setColAmt    ] = useState('');
  const [colDesc,    setColDesc   ] = useState('');
  const [dragging,   setDragging  ] = useState(false);
  const [loading,    setLoading   ] = useState(false);
  const [imported,   setImported  ] = useState<number | null>(null);
  const [err,        setErr       ] = useState('');

  const [duplicates,    setDuplicates   ] = useState<DuplicateInfo[]>([]);
  const [pendingInputs, setPendingInputs] = useState<TransactionInput[]>([]);
  const [showDupModal,  setShowDupModal ] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const applyParsed = useCallback(
    (h: string[], rows: Record<string, string>[], name: string, fmt: FileFormat) => {
      if (!h.length) { setErr('File vuoto o formato non riconosciuto.'); setLoading(false); return; }
      setHeaders(h);
      setRawRows(rows);
      setFileName(name);
      setFileFormat(fmt);
      const m = autoMapColumns(h);
      setColDate(m.date);
      setColAmt(m.amount);
      setColDesc(m.description);
      setLoading(false);
    },
    [],
  );

  const ingest = useCallback(
    (file: File) => {
      const ext = file.name.toLowerCase().split('.').pop() ?? '';
      const allowed: Record<string, FileFormat> = { csv: 'csv', xlsx: 'xlsx', xls: 'xlsx', pdf: 'pdf' };
      const fmt = allowed[ext];
      if (!fmt) { setErr('Seleziona un file .csv, .xlsx o .pdf'); return; }

      setErr(''); setImported(null); setLoading(true);
      const reader = new FileReader();

      if (fmt === 'csv') {
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const { headers: h, rows } = parseCSV(text);
          applyParsed(h, rows, file.name, 'csv');
        };
        reader.readAsText(file, 'UTF-8');
      } else {
        reader.onload = async (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          try {
            const result =
              fmt === 'pdf'
                ? await parsePDFBuffer(buffer)
                : await parseXLSXBuffer(buffer);
            applyParsed(result.headers, result.rows, file.name, fmt);
          } catch {
            setErr('Errore nella lettura del file. Verifica che non sia corrotto.');
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    },
    [applyParsed],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault(); setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) ingest(f);
    },
    [ingest],
  );

  const reset = () => {
    setHeaders([]); setRawRows([]); setFileName('');
    setColDate(''); setColAmt(''); setColDesc('');
    setImported(null); setErr(''); setLoading(false);
    setDuplicates([]); setPendingInputs([]); setShowDupModal(false);
  };

  // ── Live parsing ─────────────────────────────────────────────────────────

  const parsed: ParsedRow[] = rawRows.map((row) => {
    const rawDate = colDate ? (row[colDate] ?? '') : '';
    const rawAmt  = colAmt  ? (row[colAmt]  ?? '') : '';
    let rawDesc   = colDesc ? (row[colDesc] ?? '') : '';

    if (!rawDesc.trim()) {
      for (const [key, value] of Object.entries(row)) {
        if (key !== colDate && key !== colAmt && value?.trim()) {
          rawDesc = value.trim(); break;
        }
      }
    }

    const date   = normalizeDate(rawDate);
    const amount = normalizeAmount(rawAmt);
    const ok     = date !== null && amount !== null;
    const n      = amount ?? 0;

    let description = rawDesc.trim();
    if (!description) description = n < 0 ? 'Pagamento' : n > 0 ? 'Rimborso' : 'Importato';

    return {
      date:        date ?? rawDate,
      amount:      Math.abs(n),
      type:        n < 0 ? 'expense' : 'income',
      description,
      ok,
    };
  });

  const valid   = parsed.filter((r) => r.ok);
  const skipped = parsed.length - valid.length;

  // ── Duplicate detection ───────────────────────────────────────────────────

  const existingKeys = new Set(
    existingTxns.map((t) => `${t.date}|${t.description.toLowerCase().trim()}`),
  );

  const findDuplicates = (inputs: TransactionInput[]): DuplicateInfo[] =>
    inputs
      .filter((i) => existingKeys.has(`${i.date}|${i.description.toLowerCase().trim()}`))
      .map((i) => ({ date: i.date, description: i.description, amount: i.amount, type: i.type }));

  // ── Import ───────────────────────────────────────────────────────────────

  const doImport = async (inputs: TransactionInput[]) => {
    setErr('');
    try {
      await bulkAdd.mutateAsync(inputs);
      setImported(inputs.length);
      setShowDupModal(false);
    } catch {
      setErr("Errore durante l'importazione. Riprova.");
      setShowDupModal(false);
    }
  };

  const handleImport = () => {
    if (!valid.length) return;
    const inputs: TransactionInput[] = valid.map((r) => ({
      amount:      r.amount,
      type:        r.type,
      category:    'other',
      description: r.description,
      date:        r.date,
    }));

    const dups = findDuplicates(inputs);
    if (dups.length > 0) {
      setDuplicates(dups);
      setPendingInputs(inputs);
      setShowDupModal(true);
      return;
    }

    void doImport(inputs);
  };

  const handleImportSkipDups = () => {
    const filtered = pendingInputs.filter(
      (i) => !existingKeys.has(`${i.date}|${i.description.toLowerCase().trim()}`),
    );
    void doImport(filtered);
  };

  const handleImportAll = () => { void doImport(pendingInputs); };

  const hasFile = headers.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fin-card fin-csv-wrap">
      <div className="fin-card-title">
        Importa estratto conto
        {hasFile && (
          <button className="fin-csv-reset-btn" onClick={reset} aria-label="Chiudi">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Success */}
      {imported !== null && (
        <div className="fin-csv-success">
          <CheckCircle size={18} />
          <div>
            <strong>{imported} transazioni importate</strong>
            {skipped > 0 && <span> · {skipped} righe saltate</span>}
          </div>
          <button className="fin-csv-link-btn" onClick={reset}>Importa altro</button>
        </div>
      )}

      {/* Drop zone */}
      {!hasFile && imported === null && (
        <>
          <div
            className={`fin-csv-drop ${dragging ? 'fin-csv-drop--over' : ''} ${loading ? 'fin-csv-drop--loading' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !loading && fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && !loading && fileRef.current?.click()}
          >
            {loading ? (
              <>
                <div className="fin-csv-spinner" />
                <span className="fin-csv-drop-label">Lettura in corso…</span>
              </>
            ) : (
              <>
                <Upload size={22} className="fin-csv-drop-icon" />
                <span className="fin-csv-drop-label">Trascina o <u>seleziona un file</u></span>
                <span className="fin-csv-drop-sub">CSV · XLSX · PDF (estratto conto testuale)</span>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) ingest(f); e.target.value = ''; }}
          />
          {err && <p className="fin-csv-err">{err}</p>}
        </>
      )}

      {/* Mapping + preview */}
      {hasFile && imported === null && (
        <>
          <div className="fin-csv-file-row">
            <FileText size={13} />
            <span className="fin-csv-file-name">{fileName}</span>
            <span className="fin-csv-format-badge fin-csv-format-badge--{fileFormat}">
              {FORMAT_LABEL[fileFormat]}
            </span>
            <span className="fin-csv-file-count">{rawRows.length} righe</span>
          </div>

          {/* Column selectors */}
          <div className="fin-csv-col-map">
            <label className="fin-csv-col-label">
              Data
              <select
                className="fin-csv-col-select"
                value={colDate}
                onChange={(e) => setColDate(e.target.value)}
              >
                <option value="">— nessuna —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
            <label className="fin-csv-col-label">
              Importo
              <select
                className="fin-csv-col-select"
                value={colAmt}
                onChange={(e) => setColAmt(e.target.value)}
              >
                <option value="">— nessuna —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
            <label className="fin-csv-col-label">
              Descrizione
              <select
                className="fin-csv-col-select"
                value={colDesc}
                onChange={(e) => setColDesc(e.target.value)}
              >
                <option value="">— nessuna —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          </div>

          <div className="fin-csv-status">
            {valid.length > 0 ? (
              <>
                <span className="fin-csv-status--ok">✓ {valid.length} importabili</span>
                {skipped > 0 && <span className="fin-csv-status--skip">· {skipped} saltate</span>}
              </>
            ) : (
              <span className="fin-csv-status--warn">
                <AlertTriangle size={12} />
                Nessuna riga valida — seleziona le colonne corrette sopra
              </span>
            )}
          </div>

          {parsed.length > 0 && (
            <div className="fin-csv-table-wrap">
              <table className="fin-csv-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Importo</th>
                    <th>Descrizione</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 6).map((r, i) => (
                    <tr key={i} className={r.ok ? '' : 'fin-csv-row--bad'}>
                      <td>{r.date || '—'}</td>
                      <td>
                        {r.ok && (
                          <span className={`fin-csv-pill fin-csv-pill--${r.type}`}>
                            {r.type === 'income' ? '↑' : '↓'}
                          </span>
                        )}
                      </td>
                      <td className={r.ok ? `fin-csv-amt--${r.type}` : ''}>
                        {r.ok ? `€ ${r.amount.toFixed(2)}` : '—'}
                      </td>
                      <td className="fin-csv-td-desc">{r.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 6 && (
                <p className="fin-csv-more">+ altri {parsed.length - 6} elementi</p>
              )}
            </div>
          )}

          {err && <p className="fin-csv-err">{err}</p>}

          <button
            className="fin-csv-import-btn"
            onClick={handleImport}
            disabled={valid.length === 0 || bulkAdd.isPending}
          >
            {bulkAdd.isPending
              ? 'Importazione…'
              : `Importa ${valid.length} transazion${valid.length === 1 ? 'e' : 'i'}`}
          </button>
        </>
      )}

      {/* Modale doppioni */}
      {showDupModal && (
        <div className="fin-dup-overlay" onClick={() => setShowDupModal(false)}>
          <div className="fin-dup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fin-dup-header">
              <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              <span>Possibili doppioni rilevati</span>
            </div>

            <p className="fin-dup-desc">
              {duplicates.length} transazion{duplicates.length === 1 ? 'e' : 'i'} nel file {duplicates.length === 1 ? 'ha' : 'hanno'} stessa data e descrizione di transazioni già presenti.
            </p>

            <div className="fin-dup-list">
              {duplicates.slice(0, 8).map((d, i) => (
                <div key={i} className="fin-dup-item">
                  <span className="fin-dup-date">{d.date}</span>
                  <span className="fin-dup-desc-text">{d.description}</span>
                  <span className={`fin-dup-amt ${d.type}`}>
                    {d.type === 'income' ? '+' : '−'}€{d.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              {duplicates.length > 8 && (
                <p className="fin-dup-more">+ altri {duplicates.length - 8} doppioni…</p>
              )}
            </div>

            <div className="fin-dup-actions">
              <button className="fin-dup-btn fin-dup-btn-skip" onClick={handleImportSkipDups}>
                Salta i doppioni ({pendingInputs.length - duplicates.length} da importare)
              </button>
              <button className="fin-dup-btn fin-dup-btn-all" onClick={handleImportAll}>
                Importa tutto ({pendingInputs.length})
              </button>
              <button className="fin-dup-btn fin-dup-btn-cancel" onClick={() => setShowDupModal(false)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
