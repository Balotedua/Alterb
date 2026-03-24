import { useState, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getDocumentDownloadUrl, getDocumentUrl, deleteDocument } from '../../../import/documentStorage';
import { deleteEntry, saveEntry, getByCategory } from '../../../vault/vaultService';
import { extractDocument, isDocumentFile } from '../../../import/documentOcr';
import { useAlterStore } from '../../../store/alterStore';
import type { VaultEntry } from '../../../types';
import { Stat, EntryRow, TabBar, PIE_PALETTE } from './shared';

// ─── Doc type config ─────────────────────────────────────────
const DOC_TYPE_CONFIG: Record<string, { label: string; icon: string; accent: string }> = {
  utility_bill:    { label: 'Bolletta',           icon: '⚡', accent: '#fbbf24' },
  payslip:         { label: 'Busta paga',          icon: '💼', accent: '#60a5fa' },
  invoice:         { label: 'Fattura',             icon: '📄', accent: '#a78bfa' },
  medical_report:  { label: 'Referto',             icon: '🏥', accent: '#f472b6' },
  contract:        { label: 'Contratto',           icon: '📝', accent: '#34d399' },
  tax:             { label: 'Documento fiscale',   icon: '🏛', accent: '#fb923c' },
  receipt:         { label: 'Ricevuta',            icon: '🧾', accent: '#c084fc' },
  identity:        { label: 'Identità',            icon: '🪪', accent: '#38bdf8' },
  fine:            { label: 'Multa',               icon: '🚨', accent: '#f87171' },
  insurance:       { label: 'Polizza',             icon: '🛡',  accent: '#4ade80' },
  bank_statement:  { label: 'Estratto conto',      icon: '🏦', accent: '#22d3ee' },
  generic:         { label: 'Documento',           icon: '📋', accent: '#6b7280' },
};

// Groups for tab bar
const TAB_GROUPS: { id: string; label: string; types: string[] | null }[] = [
  { id: 'all',           label: 'Tutti',       types: null },
  { id: 'utility_bill',  label: 'Bollette',    types: ['utility_bill'] },
  { id: 'payslip',       label: 'Buste paga',  types: ['payslip'] },
  { id: 'invoice',       label: 'Fatture',     types: ['invoice'] },
  { id: 'medical_report',label: 'Medici',      types: ['medical_report'] },
  { id: 'contract',      label: 'Contratti',   types: ['contract'] },
  { id: 'tax',           label: 'Fiscale',     types: ['tax'] },
  { id: 'other',         label: 'Altri',       types: ['receipt','identity','fine','insurance','bank_statement','generic'] },
];

function parseValue(raw: unknown): number | null {
  if (typeof raw === 'number' && !isNaN(raw)) return raw;
  if (typeof raw === 'string') { const n = parseFloat(raw.replace(',', '.')); return isNaN(n) ? null : n; }
  return null;
}

export default function DocumentRenderer({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const { setActiveWidget, activeWidget, user, upsertStar } = useAlterStore();
  const [tab,          setTab]          = useState('Tutti');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [loadingId,    setLoadingId]    = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [uploadOpen,   setUploadOpen]   = useState(entries.length === 0);
  const [uploading,    setUploading]    = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUploadFile = useCallback(async (file: File) => {
    if (!user) return;
    if (!isDocumentFile(file) && !file.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png|webp|txt)$/)) {
      setUploadStatus('Formato non supportato. Usa PDF, immagine o testo.');
      return;
    }
    setUploading(true);
    setUploadStatus('Lettura documento...');
    try {
      const result = await extractDocument(file);
      if (!result.text.trim()) { setUploadStatus('Nessun testo estratto dal documento.'); setUploading(false); return; }

      setUploadStatus('Caricamento...');
      const { uploadDocument } = await import('../../../import/documentStorage');
      const upload = await uploadDocument(user.id, file);

      setUploadStatus('Analisi AI...');
      const { classifyDocument } = await import('../../../core/aiParser');
      const classification = await classifyDocument(result.text);

      const vaultData: Record<string, unknown> = {
        storagePath:    upload.storagePath,
        filename:       file.name,
        docType:        classification.docType,
        docTypeLabel:   classification.docTypeLabel,
        main_subject:   classification.main_subject,
        doc_date:       classification.doc_date,
        value:          classification.value,
        summary:        classification.summary,
        renderType:     'doc_download',
        tags:           classification.tags,
        extractedText:  result.text.slice(0, 4000),
        charCount:      result.text.length,
        fileSize:       upload.fileSize,
        compressedSize: upload.compressedSize,
        mimeType:       file.type,
        uploadedAt:     new Date().toISOString(),
      };
      if (result.pageCount) vaultData.pageCount = result.pageCount;

      const saved = await saveEntry(user.id, 'documents', vaultData);
      if (!saved) throw new Error('Vault save failed');

      // Refresh widget entries
      const updated = await getByCategory(user.id, 'documents');
      if (activeWidget) setActiveWidget({ ...activeWidget, entries: updated });

      // Update star (no circular import — mutate existing star)
      const stars = (await import('../../../store/alterStore')).useAlterStore.getState().stars;
      const existing = stars.find(s => s.id === 'documents');
      if (existing) {
        upsertStar({ ...existing, entryCount: existing.entryCount + 1, lastEntry: saved.created_at, witherFactor: 1, intensity: Math.min(1, existing.intensity + 0.1) });
      }

      setUploadOpen(false);
      setUploadStatus(null);
    } catch (err) {
      setUploadStatus(`Errore: ${err instanceof Error ? err.message : 'upload fallito'}`);
    } finally {
      setUploading(false);
    }
  }, [user, activeWidget, setActiveWidget, upsertStar]);

  // Build visible tabs (only those with ≥1 entry)
  const presentTypes = new Set(entries.map(e => (e.data.docType as string) ?? 'generic'));
  const visibleTabs = TAB_GROUPS.filter(g =>
    g.types === null || g.types.some(t => presentTypes.has(t))
  );
  const tabLabels = visibleTabs.map(g => g.label);

  // Filter entries by tab + search
  const activeGroup = visibleTabs.find(g => g.label === tab) ?? visibleTabs[0];
  const filtered = entries.filter(e => {
    const dt = (e.data.docType as string) ?? 'generic';
    const matchTab = !activeGroup.types || activeGroup.types.includes(dt);
    if (!matchTab) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      ((e.data.filename     as string) ?? '').toLowerCase().includes(s) ||
      ((e.data.docTypeLabel as string) ?? '').toLowerCase().includes(s) ||
      ((e.data.main_subject as string) ?? '').toLowerCase().includes(s) ||
      ((e.data.summary      as string) ?? '').toLowerCase().includes(s) ||
      ((e.data.extractedText as string) ?? '').toLowerCase().includes(s)
    );
  });

  // ── Stats ──────────────────────────────────────────────────
  const lastDate = entries.length > 0
    ? new Date(entries[0].created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
    : '—';
  const payslips   = entries.filter(e => e.data.docType === 'payslip');
  const bills      = entries.filter(e => e.data.docType === 'utility_bill');
  const lastSalary = payslips.length > 0 ? parseValue(payslips[0].data.value) : null;
  const totalBills = bills.reduce((s, e) => s + (parseValue(e.data.value) ?? 0), 0);
  const showSalary = lastSalary !== null && (tab === 'Tutti' || tab === 'Buste paga');
  const showBills  = totalBills > 0 && (tab === 'Tutti' || tab === 'Bollette');

  // ── Payslip trend chart ────────────────────────────────────
  const payslipChart = payslips
    .slice(0, 12).reverse()
    .map(e => ({
      m: new Date(e.created_at).toLocaleDateString('it-IT', { month: 'short' }),
      v: parseValue(e.data.value) ?? 0,
    }));

  // ── Bills trend chart ──────────────────────────────────────
  const billsChart = bills
    .slice(0, 12).reverse()
    .map(e => ({
      m: new Date(e.created_at).toLocaleDateString('it-IT', { month: 'short' }),
      v: parseValue(e.data.value) ?? 0,
    }));

  const showPayslipChart = tab === 'Buste paga' && payslipChart.length > 1;
  const showBillsChart   = tab === 'Bollette'   && billsChart.length > 1;

  const handleDownload = async (entry: VaultEntry) => {
    const path     = entry.data.storagePath as string | undefined;
    const filename = entry.data.filename    as string | undefined;
    if (!path) return;
    setLoadingId(entry.id);
    try {
      const url = await getDocumentDownloadUrl(path, filename);
      if (url) window.open(url, '_blank');
    } finally { setLoadingId(null); }
  };

  const handlePreview = async (entry: VaultEntry) => {
    const path = entry.data.storagePath as string | undefined;
    if (!path) return;
    const url = await getDocumentUrl(path);
    if (url) window.open(url, '_blank');
  };

  const handleDelete = async (entry: VaultEntry) => {
    setDeletingId(entry.id);
    try {
      await deleteEntry(entry.id);
      const path = entry.data.storagePath as string | undefined;
      if (path) await deleteDocument(path).catch(() => {});
      if (activeWidget) {
        setActiveWidget({ ...activeWidget, entries: activeWidget.entries.filter(e => e.id !== entry.id) });
      }
    } finally { setDeletingId(null); }
  };

  return (
    <div>
      {/* Stats + upload toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Stat label="Documenti" value={String(entries.length)} color={color} />
        {entries.length > 0 && <Stat label="Ultimo" value={lastDate} color={color} />}
        {showSalary && <Stat label="Ultima paga" value={`€${lastSalary!.toFixed(0)}`}  color="#60a5fa" />}
        {showBills  && !showSalary && <Stat label="Tot. bollette" value={`€${totalBills.toFixed(0)}`} color="#fbbf24" />}
        <button
          onClick={() => { setUploadOpen(v => !v); setUploadStatus(null); }}
          style={{
            marginLeft: 'auto', background: uploadOpen ? `${color}22` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${uploadOpen ? color + '45' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8, padding: '5px 12px', fontSize: 10, fontWeight: 500,
            color: uploadOpen ? color : 'rgba(255,255,255,0.35)',
            cursor: 'pointer', letterSpacing: '0.06em', transition: 'all 0.2s',
          }}
        >+ AGGIUNGI</button>
      </div>

      {/* Upload zone */}
      {uploadOpen && (
        <div style={{ marginBottom: 16 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); e.target.value = ''; }}
          />
          {uploading ? (
            <div style={{
              borderRadius: 10, padding: '20px 16px', textAlign: 'center',
              background: 'rgba(255,255,255,0.025)', border: `1px solid ${color}30`,
            }}>
              <div style={{ fontSize: 11, color, letterSpacing: '0.08em', marginBottom: 4 }}>
                {uploadStatus ?? 'Elaborazione...'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
                Attendere prego
              </div>
            </div>
          ) : uploadStatus ? (
            <div style={{
              borderRadius: 10, padding: '14px 16px', textAlign: 'center',
              background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)',
            }}>
              <div style={{ fontSize: 11, color: '#f87171', letterSpacing: '0.05em' }}>{uploadStatus}</div>
              <button
                onClick={() => setUploadStatus(null)}
                style={{ marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
              >riprova</button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUploadFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{
                borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? `${color}10` : 'rgba(255,255,255,0.018)',
                border: `1px dashed ${dragOver ? color : 'rgba(255,255,255,0.10)'}`,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.7 }}>📄</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em', marginBottom: 4 }}>
                Trascina un documento o clicca
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                PDF · immagine · testo
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state (no docs yet) */}
      {entries.length === 0 && !uploadOpen && (
        <p style={{ color: '#2e3347', fontSize: 12, textAlign: 'center', padding: '16px 0', letterSpacing: '0.05em' }}>
          Nessun documento ancora.
        </p>
      )}

      {/* Search */}
      {entries.length > 4 && (
        <input
          placeholder="Cerca per nome, tipo, importo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '7px 12px', fontSize: 11,
            color: 'rgba(255,255,255,0.65)', outline: 'none', marginBottom: 12,
            transition: 'border-color 0.2s',
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = `${color}40`; }}
          onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
        />
      )}

      {/* Tabs */}
      {tabLabels.length > 1 && (
        <TabBar tabs={tabLabels} active={tab} color={color} onChange={setTab} />
      )}

      {/* Trend chart — payslip */}
      {showPayslipChart && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Stipendio netto
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={payslipChart} barSize={16}>
              <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#3a3f52' }} axisLine={false} tickLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'rgba(3,3,7,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 10 }}
                formatter={(v: number) => [`€${v.toFixed(0)}`, 'Netto']}
              />
              <Bar dataKey="v" fill="#60a5fa" fillOpacity={0.82} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trend chart — bills */}
      {showBillsChart && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Importo bollette
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={billsChart} barSize={16}>
              <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#3a3f52' }} axisLine={false} tickLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'rgba(3,3,7,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 10 }}
                formatter={(v: number) => [`€${v.toFixed(0)}`, 'Importo']}
              />
              <Bar dataKey="v" fill="#fbbf24" fillOpacity={0.82} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Document cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <p style={{ color: '#2e3347', fontSize: 11, textAlign: 'center', padding: '20px 0', letterSpacing: '0.05em' }}>
            Nessun documento trovato.
          </p>
        )}
        {filtered.map(entry => {
          const d          = entry.data as Record<string, unknown>;
          const docType    = (d.docType as string)    ?? 'generic';
          const cfg        = DOC_TYPE_CONFIG[docType] ?? DOC_TYPE_CONFIG.generic;
          const filename   = (d.filename      as string) ?? '';
          const label      = (d.docTypeLabel  as string) ?? cfg.label;
          const subject    = (d.main_subject  as string) ?? '';
          const summary    = (d.summary       as string) ?? '';
          const docDate    = (d.doc_date      as string) ?? '';
          const amount     = parseValue(d.value);
          const hasFile    = !!d.storagePath;
          const ocrText    = (d.extractedText as string) ?? '';
          const isExpanded = expandedId === entry.id;
          const isLoading  = loadingId  === entry.id;
          const isDeleting = deletingId === entry.id;

          const displayDate = docDate
            ? docDate
            : new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

          return (
            <div key={entry.id} style={{
              borderRadius: 10,
              background: 'rgba(255,255,255,0.022)',
              border: `1px solid rgba(255,255,255,0.052)`,
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}>
              {/* Card row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                {/* Icon */}
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1, opacity: 0.9 }}>{cfg.icon}</span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11.5, color: 'rgba(255,255,255,0.78)', fontWeight: 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {filename || subject || label}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)', marginTop: 2, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span>{label}</span>
                    {subject && filename && <span style={{ opacity: 0.5 }}>· {subject}</span>}
                    <span style={{ opacity: 0.5 }}>· {displayDate}</span>
                    {amount !== null && (
                      <span style={{ color: cfg.accent, fontWeight: 500, marginLeft: 2 }}>€{amount.toFixed(2)}</span>
                    )}
                  </div>
                  {summary && summary !== label && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {summary}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                  {/* OCR toggle */}
                  {ocrText && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      title="Testo estratto"
                      style={{
                        background: isExpanded ? `${color}22` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isExpanded ? color + '45' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 6, padding: '4px 9px',
                        fontSize: 11, color: isExpanded ? color : 'rgba(255,255,255,0.28)',
                        cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1,
                      }}
                    >≡</button>
                  )}
                  {/* Preview in browser (non-download) */}
                  {hasFile && (
                    <button
                      onClick={() => handlePreview(entry)}
                      title="Apri nel browser"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 6, padding: '4px 9px',
                        fontSize: 11, color: 'rgba(255,255,255,0.3)',
                        cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}
                    >↗</button>
                  )}
                  {/* Download */}
                  {hasFile && (
                    <button
                      onClick={() => handleDownload(entry)}
                      disabled={isLoading}
                      title="Scarica file"
                      style={{
                        background: isLoading ? 'rgba(255,255,255,0.04)' : `${cfg.accent}18`,
                        border: `1px solid ${cfg.accent}30`,
                        borderRadius: 6, padding: '4px 9px',
                        fontSize: 10, fontWeight: 600,
                        color: isLoading ? 'rgba(255,255,255,0.2)' : cfg.accent,
                        cursor: isLoading ? 'default' : 'pointer',
                        transition: 'all 0.15s', letterSpacing: '0.05em', lineHeight: 1,
                      }}
                    >{isLoading ? '…' : '↓'}</button>
                  )}
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(entry)}
                    disabled={isDeleting}
                    title="Elimina"
                    style={{
                      background: 'none', border: 'none',
                      cursor: isDeleting ? 'default' : 'pointer',
                      padding: '4px 5px', fontSize: 10,
                      color: '#3a3f52', transition: 'color 0.2s', lineHeight: 1,
                    }}
                    onMouseEnter={e => { if (!isDeleting) (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3a3f52'; }}
                  >{isDeleting ? '…' : '✕'}</button>
                </div>
              </div>

              {/* OCR preview */}
              {isExpanded && ocrText && (
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  padding: '10px 14px',
                  fontSize: 10, color: 'rgba(255,255,255,0.3)',
                  lineHeight: 1.75, letterSpacing: '0.015em',
                  maxHeight: 200, overflowY: 'auto',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: 'rgba(0,0,0,0.2)',
                }}>
                  {ocrText.slice(0, 1400)}
                  {ocrText.length > 1400 && (
                    <span style={{ color: color, opacity: 0.45 }}>
                      {' '}…[+{ocrText.length - 1400} caratteri]
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DocDownloadList({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleDownload = async (entry: VaultEntry) => {
    const d = entry.data as Record<string, unknown>;
    const path = d.storagePath as string | undefined;
    const filename = d.filename as string | undefined;
    if (!path) return;
    setLoading(prev => ({ ...prev, [entry.id]: true }));
    try {
      const url = await getDocumentDownloadUrl(path, filename);
      if (url) window.open(url, '_blank');
    } finally {
      setLoading(prev => ({ ...prev, [entry.id]: false }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((entry, i) => {
        const d = entry.data as Record<string, unknown>;
        const label    = (d.docTypeLabel as string) ?? (d.docType as string) ?? 'Documento';
        const filename = (d.filename as string) ?? '';
        const date     = new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
        const hasFile  = !!d.storagePath;
        const isLoading = loading[entry.id];
        return (
          <div key={entry.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.055)', borderRadius: 8,
          }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', fontVariantNumeric: 'tabular-nums', minWidth: 14, letterSpacing: '0.04em' }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {filename || label}
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', marginTop: 2, letterSpacing: '0.04em' }}>
                {label} · {date}
              </div>
            </div>
            {hasFile && (
              <button
                onClick={() => handleDownload(entry)}
                disabled={isLoading}
                style={{
                  background: isLoading ? 'rgba(255,255,255,0.04)' : `${color}18`,
                  border: `1px solid ${color}30`, borderRadius: 6, padding: '4px 10px',
                  fontSize: 10, fontWeight: 600, color: isLoading ? 'rgba(255,255,255,0.2)' : color,
                  cursor: isLoading ? 'default' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', letterSpacing: '0.06em',
                }}
              >
                {isLoading ? '…' : '↓ Scarica'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function GenericList({ entries, color }: { entries: VaultEntry[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
      {entries.slice(0, 25).map((e) => {
        const val = e.data.value ?? e.data.amount ?? e.data.score ?? '';
        const lbl = e.data.label ?? e.data.raw ?? e.data.note ?? e.category;
        return (
          <EntryRow key={e.id} entry={e} color={color}
            label={String(lbl)}
            value={String(val)}
          />
        );
      })}
    </div>
  );
}

export function PieRenderer({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const expenses = entries.filter(e => e.data.type === 'expense');
  const income   = entries.filter(e => e.data.type === 'income');
  const totalOut = expenses.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
  const totalIn  = income.reduce((s, e)   => s + ((e.data.amount as number) ?? 0), 0);
  const labelMap = new Map<string, number>();
  for (const e of expenses) {
    const lbl = (e.data.label as string) || 'altro';
    labelMap.set(lbl, (labelMap.get(lbl) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const pieData = [...labelMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Stat label="Uscite"  value={`-€${totalOut.toFixed(2)}`} color="#f87171" />
        <Stat label="Entrate" value={`+€${totalIn.toFixed(2)}`}  color="#4ade80" />
        <Stat label="Netto"   value={`€${(totalIn - totalOut).toFixed(2)}`} color={color} />
      </div>
      <div style={{ fontSize: 9, color: '#3a3f52', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        Distribuzione spese
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={60} dataKey="value" strokeWidth={0}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} fillOpacity={0.88} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'rgba(3,3,7,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 10 }}
              formatter={(v: number, _: string, entry: { name?: string }) => [`€${v.toFixed(2)}`, entry.name ?? '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {pieData.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: PIE_PALETTE[i % PIE_PALETTE.length], flexShrink: 0 }} />
              <span style={{ color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              <span style={{ color: PIE_PALETTE[i % PIE_PALETTE.length], fontWeight: 500, fontSize: 11 }}>€{d.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
        {entries.slice(0, 25).map((e) => (
          <EntryRow key={e.id} entry={e} color={color}
            label={(e.data.label as string) ?? '—'}
            value={`${e.data.type === 'income' ? '+' : '-'}€${(e.data.amount as number)?.toFixed(2) ?? '?'}`}
          />
        ))}
      </div>
    </div>
  );
}
