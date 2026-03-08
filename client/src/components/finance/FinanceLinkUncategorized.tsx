import { useState, useEffect } from 'react';
import { useUncategorizedTransactions, useRecategorizeContains } from '@/hooks/useFinance';
import { CAT_CONFIG } from '@/utils/constants';
import { formatCurrency, formatDate } from '@/utils/formatters';

export function FinanceLinkUncategorized() {
  const { data: uncategorized } = useUncategorizedTransactions();
  const recategorizeContains = useRecategorizeContains();
  const [selectedPattern, setSelectedPattern] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(CAT_CONFIG?.[0]?.id || '');
  const [newCategory, setNewCategory] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

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

  // Raggruppa per descrizione (case-insensitive)
  const grouped = uncategorized?.reduce<Record<string, typeof uncategorized>>((acc, t) => {
    const key = t.description.toLowerCase().trim();
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(t);
    return acc;
  }, {}) || {};

  const handleLink = (pattern: string, category: string) => {
    if (!pattern || !category) return;
    recategorizeContains.mutate({ pattern, category });
  };

  const handleCreateAndLink = () => {
    if (!selectedPattern || !newCategory.trim()) return;
    handleLink(selectedPattern, newCategory.trim());
    setNewCategory('');
  };

  const hasUncategorized = uncategorized && uncategorized.length > 0;

  return (
    <div className="fin-card">
      <div className="fin-card-title">
        🔗 Collega transazioni non associate
        {hasUncategorized && (
          <span className="fin-card-count">{uncategorized.length} non associate</span>
        )}
      </div>

      {!hasUncategorized ? (
        <div className="fin-empty">
          <span className="fin-empty-icon">✅</span>
          <p>Tutte le transazioni sono già associate a una categoria.</p>
          <small>Puoi comunque creare nuove categorie per pattern futuri.</small>
        </div>
      ) : (
        <div className="fin-uncat-list">
          {Object.entries(grouped).map(([desc, transactions]) => {
            const total = transactions.reduce((sum, t) => sum + t.amount, 0);
            const count = transactions.length;
            // Trova la categoria attuale (se presente)
            const currentCatId = transactions[0]?.category;
            const currentCat = CAT_CONFIG.find(c => c.id === currentCatId);
            return (
              <div key={desc} className="fin-uncat-item">
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
                  <div className="fin-uncat-right">
                    <select
                      className="input"
                      value={selectedPattern === desc ? selectedCategory : ''}
                      onChange={(e) => {
                        setSelectedPattern(desc);
                        setSelectedCategory(e.target.value);
                      }}
                    >
                      <option value="">Scegli categoria</option>
                      {CAT_CONFIG.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="fin-uncat-btn"
                      onClick={() => handleLink(desc, selectedCategory)}
                      disabled={!selectedCategory || selectedPattern !== desc || recategorizeContains.isPending}
                    >
                      {recategorizeContains.isPending ? 'Collegamento...' : 'Collega'}
                    </button>
                  </div>
                </div>
                <div className="fin-uncat-details">
                  {transactions.slice(0, 3).map(t => (
                    <div key={t.id} className="fin-uncat-detail">
                      <span>{formatDate(t.date)}</span>
                      <span>{formatCurrency(t.amount)}</span>
                      <span className={`fin-uncat-type ${t.type}`}>
                        {t.type === 'income' ? 'Entrata' : 'Uscita'}
                      </span>
                    </div>
                  ))}
                  {transactions.length > 3 && (
                    <div className="fin-uncat-more">e altre {transactions.length - 3} transazioni...</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="fin-uncat-new">
        <h4>Crea nuova categoria e collega</h4>
        <div className="fin-uncat-new-form">
          <input
            type="text"
            className="input"
            placeholder="Pattern nella descrizione (es. q8, basko)"
            value={selectedPattern}
            onChange={(e) => setSelectedPattern(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder="Nuova categoria (es. benzina, supermercato)"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button
            className="fin-uncat-btn primary"
            onClick={handleCreateAndLink}
            disabled={!selectedPattern || !newCategory.trim() || recategorizeContains.isPending}
          >
            {recategorizeContains.isPending ? 'Creazione...' : 'Crea e collega'}
          </button>
        </div>
        <p className="fin-uncat-hint">
          Tutte le transazioni la cui descrizione contiene il pattern verranno collegate alla nuova categoria.
        </p>
      </div>
    </div>
  );
}
