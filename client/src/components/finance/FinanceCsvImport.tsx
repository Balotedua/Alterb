import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { useBulkAddTransactions } from '@/hooks/useFinance';
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

// ── Value normalizers ────────────────────────────────────────────────────────

function normalizeDate(s: string): string | null {
  const str = s.trim().replace(/"/g, '');
  if (!str) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  // DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }

  // DD MMM YYYY  (es. "08 Mar 2026" o "08-mar-2026")
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

  // European: 1.234,56  or  1.234  (solo separatore migliaia)
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(,\d{1,2})?$/.test(str)) {
    // Italian decimal: 1234,56
    str = str.replace(',', '.');
  } else {
    // US: remove thousand commas, keep decimal dot
    str = str.replace(/,(?=\d{3}(?:\.|$))/g, '');
  }

  const n = parseFloat(str);
  if (isNaN(n)) return null;
  return neg ? -n : pos ? n : n;
}

// ── Name-based column matching (primary strategy) ────────────────────────────
// Scoring: exact match = 100, starts-with = 40, contains hint = 15, hint contains col = 8

const DATE_HINTS = [
  'data', 'date', 'datum', 'fecha', 'dt',
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
];

function colScore(col: string, hints: string[]): number {
  const c = col.toLowerCase().trim();
  if (hints.some((h) => c === h))                  return 100;
  if (hints.some((h) => c.startsWith(h)))          return 40;
  if (hints.some((h) => c.includes(h)))            return 15;
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
    const best = [...scored]
      .filter((s) => !used.has(s.h) && s[role] > 0)
      .sort((a, b) => b[role] - a[role])[0];
    return best?.h ?? '';
  };

  const used = new Set<string>();
  const date = pick('date', used); used.add(date);
  const amount = pick('amt', used); used.add(amount);
  const description = pick('desc', used);
  return { date, amount, description };
}

// ── Component ────────────────────────────────────────────────────────────────

interface ParsedRow {
  date: string;
  amount: number;
  type: TransactionType;
  description: string;
  ok: boolean;
}

export function FinanceCsvImport() {
  const bulkAdd = useBulkAddTransactions();

  const [headers,  setHeaders ] = useState<string[]>([]);
  const [rawRows,  setRawRows ] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [colDate,  setColDate ] = useState('');
  const [colAmt,   setColAmt  ] = useState('');
  const [colDesc,  setColDesc ] = useState('');
  const [dragging, setDragging] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [err,      setErr     ] = useState('');


  const fileRef = useRef<HTMLInputElement>(null);

  const ingest = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv')) {
      setErr('Seleziona un file .csv'); return;
    }
    setErr(''); setImported(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows } = parseCSV(text);
      if (!h.length) { setErr('File vuoto o formato non riconosciuto.'); return; }
      setHeaders(h);
      setRawRows(rows);
      setFileName(file.name);
      const m = autoMapColumns(h);
      setColDate(m.date);
      setColAmt(m.amount);
      setColDesc(m.description);
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) ingest(f);
  }, [ingest]);

  const reset = () => {
    setHeaders([]); setRawRows([]); setFileName('');
    setColDate(''); setColAmt(''); setColDesc('');
    setImported(null); setErr('');
  };

  // ── Live parsing ─────────────────────────────────────────────────────────

  const parsed: ParsedRow[] = rawRows.map((row) => {
    const rawDate = colDate ? (row[colDate] ?? '') : '';
    const rawAmt  = colAmt  ? (row[colAmt]  ?? '') : '';
    const rawDesc = colDesc ? (row[colDesc] ?? '') : '';
    const date   = normalizeDate(rawDate);
    const amount = normalizeAmount(rawAmt);
    const ok     = date !== null && amount !== null;
    const n      = amount ?? 0;
    return {
      date:        date ?? rawDate,
      amount:      Math.abs(n),
      type:        n < 0 ? 'expense' : 'income',
      description: rawDesc.trim() || 'Importato da CSV',
      ok,
    };
  });

  const valid   = parsed.filter((r) => r.ok);
  const skipped = parsed.length - valid.length;

  // ── Import ───────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!valid.length) return;
    setErr('');
    const inputs: TransactionInput[] = valid.map((r) => ({
      amount:      r.amount,
      type:        r.type,
      category:    'other',          // non classificate — da assegnare manualmente
      description: r.description,
      date:        r.date,
    }));
    try {
      await bulkAdd.mutateAsync(inputs);
      setImported(inputs.length);
    } catch {
      setErr("Errore durante l'importazione. Riprova.");
    }
  };

  const hasFile = headers.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fin-card fin-csv-wrap">
      <div className="fin-card-title">
        Importa CSV
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
            className={`fin-csv-drop ${dragging ? 'fin-csv-drop--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          >
            <Upload size={22} className="fin-csv-drop-icon" />
            <span className="fin-csv-drop-label">Trascina il CSV o <u>clicca qui</u></span>
            <span className="fin-csv-drop-sub">Virgola · Punto e virgola · Tab</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
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
            <span className="fin-csv-file-count">{rawRows.length} righe</span>
          </div>

          {/* Status */}
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

          {/* Preview */}
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
    </div>
  );
}
