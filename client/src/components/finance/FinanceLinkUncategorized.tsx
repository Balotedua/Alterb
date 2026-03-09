import { useState, useEffect } from 'react';
import { useUncategorizedTransactions, useRecategorizeContains } from '@/hooks/useFinance';
import { CAT_CONFIG } from '@/utils/constants';
import { formatCurrency, formatDate } from '@/utils/formatters';

export function FinanceLinkUncategorized() {
  const { data: uncategorized } = useUncategorizedTransactions();
  const recategorizeContains = useRecategorizeContains();
  const [linkError, setLinkError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(CAT_CONFIG?.[0]?.id || '');
  const [newCategory, setNewCategory] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Se non siamo sul client, non renderizzare nulla per evitare mismatch con SSR
  if (!isClient) {
    return null;
  }

  // Se CAT_CONFIG non è disponibile, non mostrare il componente
  if (!CAT_CONFIG || CAT_CONFIG.length === 0) {
    return null;
  }

  // Raggruppa per descrizione (case-insensitive) e ordina per numero di transazioni (decrescente)
  const grouped = uncategorized?.reduce<Record<string, typeof uncategorized>>((acc, t) => {
    const key = t.description.toLowerCase().trim();
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(t);
    return acc;
  }, {}) || {};

  // Converti in array e ordina per numero di transazioni (più transazioni prima)
  const sortedEntries = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);

  const hasUncategorized = uncategorized && uncategorized.length > 0;

  // Se non ci sono transazioni non associate, mostra solo il form per creare categorie
  if (!hasUncategorized) {
    return (
      <div className="fin-card">
        <div className="fin-card-title">
          🔗 Collega transazioni non associate
        </div>
        <div className="fin-empty">
          <span className="fin-empty-icon">✅</span>
          <p>Tutte le transazioni sono già associate a una categoria.</p>
          <small>Puoi comunque creare nuove categorie per pattern futuri.</small>
        </div>
        <div className="fin-uncat-new">
          <h4>Crea nuova categoria</h4>
          <div className="fin-uncat-new-form">
            <input
              type="text"
              className="input"
              placeholder="Nome categoria (es. benzina, supermercato)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button
              className="fin-uncat-btn primary"
              onClick={() => {
                if (!newCategory.trim()) return;
                // Qui dovremmo aggiungere la categoria a CAT_CONFIG
                // Per ora, solo log
                console.log('Nuova categoria:', newCategory);
                setNewCategory('');
              }}
            >
              Crea categoria
            </button>
          </div>
          <p className="fin-uncat-hint">
            La nuova categoria sarà disponibile per collegare transazioni future.
          </p>
        </div>
      </div>
    );
  }

  // Se ci sono transazioni non associate, mostra una scheda alla volta
  const currentEntry = sortedEntries[currentIndex];
  const [desc, transactions] = currentEntry || [];
  const total = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const count = transactions?.length || 0;
  const currentCatId = transactions?.[0]?.category;
  const currentCat = CAT_CONFIG.find(c => c.id === currentCatId);

  const handleLink = (pattern: string, category: string) => {
    if (!pattern || !category) return;
    setLinkError(null);
    recategorizeContains.mutate({ pattern, category }, {
      onError: (err: unknown) => {
        setLinkError(err instanceof Error ? err.message : 'Errore durante il collegamento');
      },
    });
  };

  const handleCreateAndLink = (pattern: string) => {
    if (!pattern || !newCategory.trim()) return;
    handleLink(pattern, newCategory.trim());
    setNewCategory('');
    setShowNewCategoryInput(false);
  };

  const handleNext = () => {
    if (currentIndex < sortedEntries.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="fin-card">
      <div className="fin-card-title">
        🔗 Collega transazioni non associate
        <span className="fin-card-count">
          {currentIndex + 1} di {sortedEntries.length}
        </span>
      </div>

      <div className="fin-uncat-single">
        <div className="fin-uncat-header">
          <div className="fin-uncat-left">
            <span className="fin-uncat-desc">{desc}</span>
            <span className="fin-uncat-meta">
              {count} transazioni · Totale: {formatCurrency(total)}
              {currentCat && (
                <> · Attuale: <span style={{ color: currentCat.color }}>{currentCat.icon} {currentCat.label}</span></>
              )}
            </span>
          </div>
        </div>

        <div className="fin-uncat-details">
          {transactions?.slice(0, 5).map(t => (
            <div key={t.id} className="fin-uncat-detail">
              <span>{formatDate(t.date)}</span>
              <span>{formatCurrency(t.amount)}</span>
              <span className={`fin-uncat-type ${t.type}`}>
                {t.type === 'income' ? 'Entrata' : 'Uscita'}
              </span>
            </div>
          ))}
          {transactions && transactions.length > 5 && (
            <div className="fin-uncat-more">e altre {transactions.length - 5} transazioni...</div>
          )}
        </div>

        <div className="fin-uncat-actions">
          {linkError && (
            <div style={{ color: 'var(--error, #ef4444)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              ⚠ {linkError}
            </div>
          )}
          <div className="fin-uncat-select-row">
            <select
              className="input"
              value={selectedCategory}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__new__') {
                  setShowNewCategoryInput(true);
                  setSelectedCategory('');
                } else {
                  setSelectedCategory(value);
                  setShowNewCategoryInput(false);
                }
              }}
            >
              <option value="">Scegli categoria</option>
              {CAT_CONFIG.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
              <option value="__new__">➕ Crea nuova categoria</option>
            </select>
            <button
              className="fin-uncat-btn"
              onClick={() => handleLink(desc, selectedCategory)}
              disabled={!selectedCategory || recategorizeContains.isPending}
            >
              {recategorizeContains.isPending ? 'Collegamento...' : 'Collega'}
            </button>
          </div>

          {showNewCategoryInput && (
            <div className="fin-uncat-new-form">
              <input
                type="text"
                className="input"
                placeholder="Nome categoria (es. benzina, supermercato)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button
                className="fin-uncat-btn primary"
                onClick={() => handleCreateAndLink(desc)}
                disabled={!newCategory.trim() || recategorizeContains.isPending}
              >
                {recategorizeContains.isPending ? 'Creazione...' : 'Crea e collega'}
              </button>
            </div>
          )}

          <div className="fin-uncat-navigation">
            <button
              className="fin-uncat-btn ghost"
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              ← Precedente
            </button>
            <span className="fin-uncat-nav-info">
              {currentIndex + 1} / {sortedEntries.length}
            </span>
            <button
              className="fin-uncat-btn ghost"
              onClick={handleNext}
              disabled={currentIndex === sortedEntries.length - 1}
            >
              Successiva →
            </button>
          </div>
        </div>
      </div>

      <div className="fin-uncat-hint">
        <strong>Suggerimento:</strong> Collega questa descrizione a una categoria esistente o creane una nuova.
        Tutte le transazioni con descrizione simile verranno automaticamente ricategorizzate.
      </div>
    </div>
  );
}
