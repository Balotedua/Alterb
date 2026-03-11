import { useState } from 'react';
import { useUncategorizedTransactions, useRecategorizeContains, useFinanceCategories, useAddCategory } from '@/hooks/useFinance';
import { formatCurrency, formatDate } from '@/utils/formatters';

export function FinanceCategoryLinker() {
  const { data: uncategorized = [] } = useUncategorizedTransactions();
  const { data: categories = [] }    = useFinanceCategories();
  const recategorize = useRecategorizeContains();
  const addCategory  = useAddCategory();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCat,  setSelectedCat ] = useState('');
  const [showNewInput, setShowNewInput ] = useState(false);
  const [newCatName,   setNewCatName  ] = useState('');
  const [linkErr,      setLinkErr     ] = useState('');

  const grouped = uncategorized.reduce<Record<string, typeof uncategorized>>((acc, t) => {
    const key = t.description.toLowerCase().trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});
  const entries = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);

  const goTo = (idx: number) => {
    setCurrentIndex(idx);
    setSelectedCat('');
    setShowNewInput(false);
    setNewCatName('');
    setLinkErr('');
  };

  const handleLink = (pattern: string, category: string) => {
    if (!pattern || !category) return;
    setLinkErr('');
    recategorize.mutate({ pattern, category }, {
      onSuccess: () => goTo(Math.max(0, Math.min(currentIndex, entries.length - 2))),
      onError: (err) => setLinkErr(err instanceof Error ? err.message : 'Errore durante il collegamento'),
    });
  };

  const handleCreateAndLink = async (pattern: string) => {
    if (!pattern || !newCatName.trim()) return;
    setLinkErr('');
    try {
      const id = await addCategory.mutateAsync({ id: '', label: newCatName.trim(), icon: '🏷️', color: '#6b7280' });
      handleLink(pattern, id);
      setNewCatName('');
      setShowNewInput(false);
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : 'Errore durante la creazione della categoria');
    }
  };

  const currentEntry = entries[currentIndex];
  const [desc, transactions] = currentEntry ?? [];
  const total = transactions?.reduce((s, t) => s + t.amount, 0) ?? 0;

  if (entries.length === 0) {
    if (categories.length > 0) {
      return (
        <div className="fin-card fin-cl-wrap">
          <div className="fin-cl-all-done">✅ Tutte le transazioni sono categorizzate</div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="fin-card fin-cl-wrap">
      <div className="fin-cl-section">
        <div className="fin-cl-section-title">
          Collega non associate
          <span className="fin-card-count">{entries.length}</span>
        </div>

        <div className="fin-cl-card">
          <div className="fin-cl-desc">{desc}</div>
          <div className="fin-cl-meta">
            {transactions?.length} transazioni · {formatCurrency(total)}
          </div>

          <div className="fin-cl-txlist">
            {transactions?.slice(0, 4).map(t => (
              <div key={t.id} className="fin-cl-tx">
                <span className="fin-cl-tx-date">{formatDate(t.date)}</span>
                <span className="fin-cl-tx-amt">{formatCurrency(t.amount)}</span>
                <span className={`fin-cl-tx-type ${t.type}`}>
                  {t.type === 'income' ? 'Entrata' : 'Uscita'}
                </span>
              </div>
            ))}
            {transactions && transactions.length > 4 && (
              <div className="fin-cl-tx-more">+ altre {transactions.length - 4}</div>
            )}
          </div>

          {linkErr && <p className="fin-cl-err">{linkErr}</p>}

          {categories.length === 0 ? (
            <p className="fin-cl-hint">Nessuna categoria disponibile — creane una dal menù Budget o seleziona "Nuova categoria" qui sotto.</p>
          ) : null}

          <div className="fin-cl-link-row">
            <select
              className="fin-cl-select"
              value={selectedCat}
              onChange={e => {
                const v = e.target.value;
                setSelectedCat(v === '__new__' ? '' : v);
                setShowNewInput(v === '__new__');
              }}
            >
              <option value="">Categoria…</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
              <option value="__new__">+ Nuova categoria</option>
            </select>
            {!showNewInput && (
              <button
                className="fin-cl-btn fin-cl-btn-accent"
                onClick={() => handleLink(desc, selectedCat)}
                disabled={!selectedCat || recategorize.isPending}
              >
                {recategorize.isPending ? '…' : 'Collega'}
              </button>
            )}
          </div>

          {showNewInput && (
            <div className="fin-cl-link-row" style={{ marginTop: 6 }}>
              <input
                className="fin-cl-input fin-cl-input-flex"
                type="text"
                placeholder="Nome nuova categoria"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleCreateAndLink(desc)}
                autoFocus
              />
              <button
                className="fin-cl-btn fin-cl-btn-green"
                onClick={() => void handleCreateAndLink(desc)}
                disabled={!newCatName.trim() || recategorize.isPending || addCategory.isPending}
              >
                {addCategory.isPending ? '…' : 'Crea e collega'}
              </button>
            </div>
          )}

          <div className="fin-cl-nav">
            <button
              className="fin-cl-btn fin-cl-btn-ghost"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              ← Prec
            </button>
            <span className="fin-cl-nav-count">{currentIndex + 1} / {entries.length}</span>
            <button
              className="fin-cl-btn fin-cl-btn-ghost"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex >= entries.length - 1}
            >
              Succ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
