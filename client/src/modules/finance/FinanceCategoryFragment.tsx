import { useState, useMemo } from 'react';
import {
  useTransactions,
  useFinanceCategories,
  useAddCategory,
  useUpdateTransactionCategory,
  useRecategorize,
} from '@/hooks/useFinance';
import { NebulaCard } from '@/components/ui/nebula';
import { formatCurrency } from '@/utils/formatters';
import { toast } from 'sonner';
import type { Transaction } from '@/types';

interface Props { params: Record<string, unknown> }

const DEFAULT_CATS: Record<string, string> = {
  food: 'Cibo', transport: 'Trasporti', shopping: 'Shopping',
  health: 'Salute', entertainment: 'Svago', utilities: 'Bollette',
  salary: 'Stipendio', other: 'Altro',
};

function catLabel(id: string, userCats: { id: string; label: string }[]) {
  const found = userCats.find(c => c.id === id);
  if (found) return found.label;
  return DEFAULT_CATS[id] ?? id;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ── Recategorize panel ────────────────────────────────────────────────────────
interface RecatPanelProps {
  tx: Transaction;
  userCats: { id: string; label: string }[];
  onDone: () => void;
}

function RecatPanel({ tx, userCats, onDone }: RecatPanelProps) {
  const [catInput, setCatInput]   = useState('');
  const [scope, setScope]         = useState<'single' | 'all'>('single');
  const [creating, setCreating]   = useState(false);

  const { mutate: updateOne,  isPending: p1 } = useUpdateTransactionCategory();
  const { mutate: updateAll,  isPending: p2 } = useRecategorize();
  const { mutate: addCat,     isPending: p3 } = useAddCategory();

  const isPending = p1 || p2 || p3;
  const allCats   = [...Object.entries(DEFAULT_CATS).map(([id,label]) => ({id,label})), ...userCats];
  const [selected, setSelected]   = useState(tx.category || 'other');
  const isNew = catInput.trim() !== '' && !allCats.find(c => c.label.toLowerCase() === catInput.toLowerCase());

  const targetCatId = isNew
    ? slugify(catInput)
    : allCats.find(c => c.label.toLowerCase() === catInput.toLowerCase())?.id ?? selected;

  const handleSave = async () => {
    const catId = catInput.trim() ? targetCatId : selected;
    if (!catId) return;

    const doUpdate = () => {
      if (scope === 'single') {
        updateOne({ id: tx.id, category: catId }, {
          onSuccess: () => { toast.success('Transazione aggiornata.'); onDone(); },
          onError: () => toast.error('Errore aggiornamento.'),
        });
      } else {
        updateAll({ description: tx.description, category: catId }, {
          onSuccess: () => { toast.success(`Tutte le transazioni "${tx.description}" aggiornate.`); onDone(); },
          onError: () => toast.error('Errore aggiornamento.'),
        });
      }
    };

    if (isNew) {
      addCat({ id: catId, label: catInput.trim(), icon: '📦', color: '#888' }, {
        onSuccess: doUpdate,
        onError: () => toast.error('Errore creazione categoria.'),
      });
    } else {
      doUpdate();
    }
  };

  return (
    <div className="recat-panel">
      <p className="recat-desc">"{tx.description}"</p>

      {/* Category picker */}
      <div className="recat-row">
        <label className="fragment-label">Categoria</label>
        <select
          className="fragment-input"
          value={catInput ? '' : selected}
          onChange={e => { setSelected(e.target.value); setCatInput(''); }}
        >
          {allCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="recat-row">
        <label className="fragment-label">Oppure crea nuova</label>
        <input
          className="fragment-input"
          placeholder="es. Benzina, Abbonamenti…"
          value={catInput}
          onChange={e => { setCatInput(e.target.value); setCreating(true); }}
        />
        {isNew && <span className="recat-new-badge">+ nuova</span>}
      </div>

      {/* Scope */}
      <div className="recat-scope">
        <label className={`recat-scope-btn ${scope === 'single' ? 'active' : ''}`}>
          <input type="radio" name="scope" checked={scope === 'single'} onChange={() => setScope('single')} />
          Solo questa
        </label>
        <label className={`recat-scope-btn ${scope === 'all' ? 'active' : ''}`}>
          <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
          Tutte con questa descrizione
        </label>
      </div>

      <div className="fragment-actions" style={{ marginTop: '0.5rem' }}>
        <button className="fragment-btn" onClick={onDone} disabled={isPending}>Annulla</button>
        <button className="fragment-btn fragment-btn--primary" onClick={handleSave} disabled={isPending}>
          {isPending ? '…' : 'Salva'}
        </button>
      </div>
    </div>
  );
}

// ── Main fragment ─────────────────────────────────────────────────────────────
export function FinanceCategoryFragment({ params }: Props) {
  const filterType = (params.type as Transaction['type']) ?? null;

  const { data: transactions = [] } = useTransactions();
  const { data: userCats = [] }     = useFinanceCategories();
  const [activeCat, setActiveCat]   = useState<string | null>(null);
  const [recatTx, setRecatTx]       = useState<Transaction | null>(null);

  // Filter by type if requested
  const txs = useMemo(() =>
    filterType ? transactions.filter(t => t.type === filterType) : transactions,
    [transactions, filterType]
  );

  // Group by category — totals
  const grouped = useMemo(() => {
    const map = new Map<string, { total: number; count: number; txs: Transaction[] }>();
    for (const t of txs) {
      const cat = t.category || 'other';
      const existing = map.get(cat) ?? { total: 0, count: 0, txs: [] };
      map.set(cat, {
        total: existing.total + (t.type === 'expense' ? t.amount : -t.amount),
        count: existing.count + 1,
        txs:   [...existing.txs, t],
      });
    }
    // Sort: "other" last, rest by total desc
    return [...map.entries()]
      .sort(([a,,], [b,,]) => {
        if (a === 'other') return 1;
        if (b === 'other') return -1;
        return (map.get(b)!.total) - (map.get(a)!.total);
      });
  }, [txs]);

  const activeTxs = activeCat ? (grouped.find(([id]) => id === activeCat)?.[1].txs ?? []) : [];

  return (
    <NebulaCard icon="📊" title="Spese per categoria" variant="finance">
      {/* Category list */}
      <div className="cat-list">
        {grouped.map(([catId, { total, count }]) => {
          const label = catLabel(catId, userCats);
          const isOther = catId === 'other';
          const isActive = activeCat === catId;
          return (
            <div
              key={catId}
              className={`cat-row ${isActive ? 'cat-row--active' : ''} ${isOther ? 'cat-row--other' : ''}`}
              onClick={() => {
                setActiveCat(isActive ? null : catId);
                setRecatTx(null);
              }}
            >
              <span className="cat-label">{isOther ? '📂 Non categorizzate' : label}</span>
              <span className="cat-meta">
                <span className="cat-count">{count}</span>
                <span className="cat-total">{formatCurrency(Math.abs(total))}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Transaction list for selected category */}
      {activeCat && activeTxs.length > 0 && (
        <div className="cat-txlist">
          <p className="cat-txlist-title">
            {catLabel(activeCat, userCats)} — {activeTxs.length} transazioni
          </p>
          {recatTx ? (
            <RecatPanel
              tx={recatTx}
              userCats={userCats}
              onDone={() => setRecatTx(null)}
            />
          ) : (
            <div className="fragment-list">
              {activeTxs.slice(0, 30).map(t => (
                <div key={t.id} className="fragment-list-row">
                  <div className="fragment-list-left">
                    <span className="fragment-list-desc">{t.description}</span>
                    <span className="fragment-list-sub">{t.date}</span>
                  </div>
                  <span className={`fragment-list-amt ${t.type === 'income' ? 'fkv--green' : 'fkv--red'}`}>
                    {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                  </span>
                  <button
                    className="fragment-delete-btn"
                    title="Ricategorizza"
                    onClick={() => setRecatTx(t)}
                  >
                    📁
                  </button>
                </div>
              ))}
              {activeTxs.length > 30 && (
                <p className="fragment-count">+{activeTxs.length - 30} altre</p>
              )}
            </div>
          )}
        </div>
      )}
    </NebulaCard>
  );
}
