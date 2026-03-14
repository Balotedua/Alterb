import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Check, X } from 'lucide-react';
import {
  usePrestiti,
  useAddPrestito,
  useTogglePrestitoSaldato,
  useDeletePrestito,
} from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';
import type { Prestito, PrestitoTipo } from '@/types';

// ── Config ────────────────────────────────────────────────────────────────────

interface TipoConfig { label: string; icon: string; color: string; badge: string }

const TIPO_CONFIG: Record<PrestitoTipo, TipoConfig> = {
  dato:     { label: 'Prestato',  icon: '🤝', color: '#34d399', badge: 'Credito' },
  ricevuto: { label: 'Ricevuto',  icon: '💸', color: '#f87171', badge: 'Debito'  },
};

type FilterId = 'tutti' | PrestitoTipo;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'tutti',    label: 'Tutti'    },
  { id: 'dato',     label: 'Prestati' },
  { id: 'ricevuto', label: 'Ricevuti' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PrestitoRow({ p }: { p: Prestito }) {
  const { mutate: toggle, isPending: toggling } = useTogglePrestitoSaldato();
  const { mutate: remove, isPending: removing  } = useDeletePrestito();
  const cfg = TIPO_CONFIG[p.tipo];

  return (
    <motion.div
      layout
      className={`fp-prestito-row${p.saldato ? ' fp-prestito-row--saldato' : ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.18 }}
    >
      <span className="fp-prestito-dot" style={{ background: cfg.color }} />

      <div className="fp-prestito-info">
        <div className="fp-prestito-top">
          <span className="fp-prestito-icon">{cfg.icon}</span>
          <span className="fp-prestito-persona">{p.persona}</span>
          <span className="fp-prestito-badge" style={{ color: cfg.color }}>{cfg.badge}</span>
        </div>
        {p.note && <span className="fp-prestito-note">{p.note}</span>}
        <span className="fp-prestito-date">{fmtDate(p.data)}</span>
      </div>

      <span className="fp-prestito-amt" style={{ color: cfg.color }}>
        {p.tipo === 'ricevuto' ? '-' : '+'}{formatCurrency(p.importo)}
      </span>

      <button
        className={`fp-prestito-check${p.saldato ? ' fp-prestito-check--done' : ''}`}
        onClick={() => toggle({ id: p.id, saldato: !p.saldato })}
        disabled={toggling}
        title={p.saldato ? 'Riapri' : 'Segna saldato'}
      >
        <Check size={13} />
      </button>

      <button
        className="fpa-icon-btn fpa-icon-btn--del"
        onClick={() => remove(p.id)}
        disabled={removing}
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddPrestitoForm({ onDone }: { onDone: () => void }) {
  const { mutate: add, isPending } = useAddPrestito();
  const [tipo,    setTipo   ] = useState<PrestitoTipo>('dato');
  const [persona, setPersona] = useState('');
  const [importo, setImporto] = useState('');
  const [data,    setData   ] = useState(new Date().toISOString().split('T')[0]);
  const [note,    setNote   ] = useState('');
  const [err,     setErr    ] = useState('');

  const submit = () => {
    const amt = parseFloat(importo);
    if (!persona.trim())   { setErr('Inserisci il nome della persona'); return; }
    if (!importo || isNaN(amt) || amt <= 0) { setErr('Inserisci un importo valido'); return; }
    setErr('');
    add(
      { tipo, persona: persona.trim(), importo: amt, data, note: note.trim() || undefined },
      {
        onSuccess: () => { onDone(); setPersona(''); setImporto(''); setNote(''); },
        onError:   (e) => setErr(e.message?.includes('relation') ? 'Tabella non trovata — esegui sql/prestiti_schema.sql su Supabase.' : 'Errore salvataggio.'),
      },
    );
  };

  return (
    <motion.div
      className="fpa-add-form"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      style={{ overflow: 'hidden' }}
    >
      <div className="fpa-add-row">
        <select className="fpa-select" value={tipo} onChange={e => setTipo(e.target.value as PrestitoTipo)}>
          {(Object.entries(TIPO_CONFIG) as [PrestitoTipo, TipoConfig][]).map(([id, c]) => (
            <option key={id} value={id}>{c.icon} {c.label}</option>
          ))}
        </select>
        <input
          className="fpa-input"
          placeholder="Persona"
          value={persona}
          onChange={e => setPersona(e.target.value)}
        />
      </div>
      <div className="fpa-add-row">
        <input
          className="fpa-input fpa-input--amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="€ importo"
          value={importo}
          onChange={e => setImporto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <input
          className="fpa-input"
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
        />
      </div>
      <div className="fpa-add-row">
        <input
          className="fpa-input"
          placeholder="Note (opzionale)"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ flex: 1 }}
        />
      </div>
      <div className="fpa-add-row">
        <button className="fpa-btn fpa-btn--primary" onClick={submit} disabled={isPending || !persona || !importo}>
          {isPending ? '…' : '＋ Aggiungi'}
        </button>
        <button className="fpa-btn fpa-btn--ghost" onClick={onDone}>
          <X size={14} /> Annulla
        </button>
      </div>
      {err && <p className="fpa-form-err">{err}</p>}
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function FinancePrestitiTab() {
  const { data: items = [], isLoading, isError } = usePrestiti();
  const [filter,  setFilter ] = useState<FilterId>('tutti');
  const [showAdd, setShowAdd] = useState(false);

  const aperti   = items.filter(p => !p.saldato);
  const daAvere  = aperti.filter(p => p.tipo === 'dato').reduce((s, p) => s + p.importo, 0);
  const daDare   = aperti.filter(p => p.tipo === 'ricevuto').reduce((s, p) => s + p.importo, 0);
  const saldo    = daAvere - daDare;

  const filtered = items.filter(p => filter === 'tutti' || p.tipo === filter);

  return (
    <div className="fp-section fpa-wrap">
      {/* KPI */}
      <div className="fp-kpi-row">
        <div className="fp-kpi-chip fp-kpi-chip--green">
          <span className="fp-kpi-label">Da riscuotere</span>
          <span className="fp-kpi-value">{isLoading ? '…' : formatCurrency(daAvere)}</span>
        </div>
        <div className="fp-kpi-chip fp-kpi-chip--red">
          <span className="fp-kpi-label">Da restituire</span>
          <span className="fp-kpi-value">{isLoading ? '…' : formatCurrency(daDare)}</span>
        </div>
        <div className={`fp-kpi-chip ${saldo >= 0 ? 'fp-kpi-chip--amber' : 'fp-kpi-chip--red'}`}>
          <span className="fp-kpi-label">Saldo netto</span>
          <span className="fp-kpi-value">{isLoading ? '…' : formatCurrency(saldo)}</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="admin-filter-tabs">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={['admin-filter-tab', filter === f.id ? 'admin-filter-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className="admin-filter-count">
              {f.id === 'tutti' ? items.length : items.filter(p => p.tipo === f.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="fpa-list">
        {isError && (
          <p className="fpa-setup-hint">
            ⚠ Tabella non trovata. Esegui <code>sql/prestiti_schema.sql</code> su Supabase.
          </p>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <p className="fragment-empty">
            {filter === 'tutti' ? 'Nessun prestito. Aggiungi il primo.' : `Nessun elemento in "${FILTERS.find(f => f.id === filter)?.label}".`}
          </p>
        )}
        <AnimatePresence>
          {filtered.map(p => <PrestitoRow key={p.id} p={p} />)}
        </AnimatePresence>
      </div>

      {/* Add */}
      <AnimatePresence>
        {showAdd && <AddPrestitoForm onDone={() => setShowAdd(false)} />}
      </AnimatePresence>
      {!showAdd && (
        <button className="fpa-btn fpa-btn--add" onClick={() => setShowAdd(true)}>
          + Aggiungi prestito
        </button>
      )}
    </div>
  );
}
