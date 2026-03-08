import { useState } from 'react';
import { useTransactions, useDeleteTransaction } from '@/hooks/useFinance';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { CAT_CONFIG } from '@/utils/constants';

const PAGE_SIZE = 10;

function getCat(catId: string) {
  return CAT_CONFIG.find(c => c.id === catId);
}

export function FinanceTransactionList() {
  const { data: transactions, isPending } = useTransactions();
  const deleteMutation = useDeleteTransaction();
  const [limit, setLimit] = useState(PAGE_SIZE);

  if (isPending) {
    return (
      <div className="fin-card">
        <div className="fin-card-title">Transazioni</div>
        <div className="fin-loading">
          <span className="fin-loading-dot" />
          <span className="fin-loading-dot" />
          <span className="fin-loading-dot" />
        </div>
      </div>
    );
  }

  if (!transactions?.length) {
    return (
      <div className="fin-card">
        <div className="fin-card-title">Transazioni</div>
        <div className="fin-empty">
          <span className="fin-empty-icon">💸</span>
          <p>Nessuna transazione ancora</p>
          <small>Aggiungi la tua prima dal form</small>
        </div>
      </div>
    );
  }

  const visible = transactions.slice(0, limit);
  const hasMore = transactions.length > limit;

  return (
    <div className="fin-card">
      <div className="fin-card-title">
        Transazioni
        <span className="fin-card-count">{transactions.length} totali</span>
      </div>

      <div className="fin-list">
        {visible.map((t, i) => {
          const cat = getCat(t.category);
          return (
            <div
              key={t.id}
              className="fin-item"
              style={{ animationDelay: `${i * 25}ms` }}
            >
              <div className={`fin-item-avatar ${t.type}`}>
                {cat?.icon ?? '📦'}
              </div>

              <div className="fin-item-body">
                <div className="fin-item-desc">{t.description}</div>
                <div className="fin-item-meta">
                  {formatDate(t.date)} · {cat?.label ?? t.category}
                </div>
              </div>

              <div className="fin-item-right">
                <span className={`fin-item-amount ${t.type}`}>
                  {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                </span>

                {/* Sempre visibile — funziona anche su mobile touch */}
                <button
                  className="fin-item-del"
                  onClick={() => deleteMutation.mutate(t.id)}
                  disabled={deleteMutation.isPending}
                  aria-label="Elimina transazione"
                  title="Elimina"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="fin-more">
          <button
            className="fin-more-btn"
            onClick={() => setLimit(l => l + PAGE_SIZE)}
          >
            Carica altri ({transactions.length - limit} rimasti)
          </button>
        </div>
      )}
    </div>
  );
}
