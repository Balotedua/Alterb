import { useState, useRef } from 'react';
import { useBulkAddTransactions } from '@/hooks/useFinance';
import { NebulaCard } from '@/components/ui/nebula';
import { useNebulaStore } from '@/store/nebulaStore';
import { formatCurrency } from '@/utils/formatters';
import type { TransactionInput, TransactionType } from '@/types';

interface Props { params: Record<string, unknown> }

interface ParsedRow extends TransactionInput { _raw: string; _error?: string }

// ── Date normalizer ───────────────────────────────────────────────────────────
// Handles: YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
function normalizeDate(raw: string): string | null {
  const s = raw.trim().split(' ')[0]; // strip time if present
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

// ── Type from amount sign (Revolut style: negative = expense) ─────────────────
function typeFromAmount(raw: string): { amount: number; type: TransactionType } | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  if (isNaN(val) || val === 0) return null;
  return { amount: Math.abs(val), type: val < 0 ? 'expense' : 'income' };
}

// ── Explicit type column normalizer ──────────────────────────────────────────
function normalizeType(raw: string): TransactionType | null {
  const s = raw.trim().toLowerCase();
  if (['expense','spesa','uscita','out','-','addebito','pagamento','prelievo'].includes(s)) return 'expense';
  if (['income','entrata','entrate','in','+','accredito','stipendio','ricarica','topup','top-up'].includes(s)) return 'income';
  return null;
}

// ── Find column index by list of aliases (case-insensitive, trimmed) ─────────
function findCol(headers: string[], ...aliases: string[]): number {
  const lower = aliases.map(a => a.toLowerCase().trim());
  return headers.findIndex(h => lower.includes(h.toLowerCase().trim()));
}

// ── CSV parser ───────────────────────────────────────────────────────────────
function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Auto-detect separator: ; or ,
  const firstLine = lines[0];
  const sep = (firstLine.match(/;/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? ';' : ',';

  const splitLine = (l: string) =>
    l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));

  const headers = splitLine(firstLine);

  // ── Map columns by aliases ──────────────────────────────────────────────
  // Date: try "data inizio", "started date", "data", "date", "data fine", "completed date"
  const iDate = findCol(headers,
    'data di inizio','data inizio','started date',
    'data di completamento','data fine','completed date',
    'data','date','data operazione','data valuta','transaction date','booking date'
  );
  // Amount: "importo","amount","valore","somma","importo eur"
  const iAmt = findCol(headers,
    'importo','amount','valore','somma','importo eur','amount (eur)','importo (eur)',
    'transaction amount','net amount'
  );
  // Description
  const iDesc = findCol(headers,
    'descrizione','description','riferimento','beneficiario','merchant',
    'merchant name','causale','note','memo','details'
  );
  // Type (optional explicit column)
  const iType = findCol(headers,
    'tipo','type','transaction type','tipo transazione','movimento'
  );
  // Category (optional)
  const iCat = findCol(headers,
    'categoria','category','tag'
  );
  // State (Revolut: filter COMPLETED only)
  const iState = findCol(headers,
    'stato','state','status','stato transazione'
  );

  const rows: ParsedRow[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = splitLine(line);

    const rawDate  = iDate  >= 0 ? cols[iDate]  ?? '' : cols[0] ?? '';
    const rawAmt   = iAmt   >= 0 ? cols[iAmt]   ?? '' : cols[1] ?? '';
    const rawDesc  = iDesc  >= 0 ? cols[iDesc]  ?? '' : cols[2] ?? '';
    const rawType  = iType  >= 0 ? cols[iType]  ?? '' : '';
    const rawCat   = iCat   >= 0 ? cols[iCat]   ?? '' : '';
    const rawState = iState >= 0 ? cols[iState] ?? '' : '';

    // Skip non-completed Revolut transactions
    const stateLower = rawState.toLowerCase();
    if (rawState && !['completed','completato',''].includes(stateLower) &&
        !stateLower.includes('complet')) {
      continue;
    }

    const date = normalizeDate(rawDate);
    const amtParsed = typeFromAmount(rawAmt);
    const errors: string[] = [];

    if (!date) errors.push(`data non riconosciuta: "${rawDate}"`);
    if (!amtParsed) errors.push(`importo non valido: "${rawAmt}"`);

    // Type: prefer explicit column, fallback to sign of amount
    const explicitType = rawType ? normalizeType(rawType) : null;
    const type: TransactionType = explicitType ?? amtParsed?.type ?? 'expense';

    const description = rawDesc || rawCat || rawType || 'Importato';
    const category = rawCat || 'other';

    rows.push({
      _raw: line,
      _error: errors.length ? errors.join(' · ') : undefined,
      date:        date        ?? '',
      amount:      amtParsed?.amount ?? 0,
      type,
      description,
      category,
    });
  }

  return rows;
}

// ── Fragment ─────────────────────────────────────────────────────────────────
export function FinanceCsvFragment(_: Props) {
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [done, setDone]         = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);

  const { mutate: bulkAdd, isPending } = useBulkAddTransactions();
  const { setFragment } = useNebulaStore();

  const validRows   = rows.filter(r => !r._error);
  const invalidRows = rows.filter(r =>  r._error);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCsv(text));
      setDone(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    if (validRows.length === 0) return;
    const inputs = validRows.map(({ _raw: _r, _error: _e, ...rest }) => rest);
    bulkAdd(inputs, {
      onSuccess: () => {
        setDone(true);
        setTimeout(() => setFragment(null, {}, 'TALK'), 2000);
      },
    });
  };

  const close = () => setFragment(null, {}, 'TALK');

  if (done) {
    return (
      <NebulaCard icon="✅" title="Importazione completata" variant="finance">
        <p className="fragment-empty" style={{ color: '#4ade80' }}>
          {validRows.length} transazioni importate correttamente.
        </p>
      </NebulaCard>
    );
  }

  return (
    <NebulaCard icon="📂" title="Importa da CSV" variant="finance">
      {/* Drop zone */}
      <div
        className="csv-dropzone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {fileName
          ? <span className="csv-filename">📄 {fileName}</span>
          : <>
              <span className="csv-drop-icon">⬆️</span>
              <span className="csv-drop-text">Trascina il CSV qui oppure clicca per sceglierlo</span>
            </>
        }
      </div>

      {/* Format hint */}
      <p className="csv-hint">
        Supporta Revolut e qualsiasi CSV con colonne: data, importo, descrizione.
        Separatore <code>,</code> o <code>;</code>
      </p>

      {/* Stats + preview */}
      {rows.length > 0 && (
        <>
          <div className="csv-stats">
            <span className="csv-stat csv-stat--ok">✓ {validRows.length} valide</span>
            {invalidRows.length > 0 && (
              <span className="csv-stat csv-stat--err">✗ {invalidRows.length} ignorate</span>
            )}
          </div>

          <div className="fragment-list">
            {rows.slice(0, 60).map((r, i) => (
              <div key={i} className={`fragment-list-row ${r._error ? 'csv-row--error' : ''}`}>
                {r._error ? (
                  <span className="csv-error-msg">⚠ {r._error}</span>
                ) : (
                  <>
                    <div className="fragment-list-left">
                      <span className="fragment-list-desc">{r.description}</span>
                      <span className="fragment-list-sub">{r.date}</span>
                    </div>
                    <span className={`fragment-list-amt ${r.type === 'income' ? 'fkv--green' : 'fkv--red'}`}>
                      {r.type === 'income' ? '+' : '−'}{formatCurrency(r.amount)}
                    </span>
                  </>
                )}
              </div>
            ))}
            {rows.length > 60 && (
              <p className="csv-hint" style={{ textAlign: 'center' }}>
                ...e altre {rows.length - 60} righe
              </p>
            )}
          </div>
        </>
      )}

      <div className="fragment-actions">
        <button className="fragment-btn" onClick={close} disabled={isPending}>
          Annulla
        </button>
        {validRows.length > 0 && (
          <button
            className="fragment-btn fragment-btn--primary"
            onClick={handleImport}
            disabled={isPending}
          >
            {isPending ? 'Importazione…' : `Importa ${validRows.length} transazioni`}
          </button>
        )}
      </div>
    </NebulaCard>
  );
}
