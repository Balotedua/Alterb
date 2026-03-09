import { useTransactions, useDeleteTransaction } from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';
import { NebulaCard } from '@/components/ui/nebula';
import type { Transaction } from '@/types';

interface Props { params: Record<string, unknown> }

export function FinanceListFragment({ params }: Props) {
  const limit      = typeof params.limit === 'number' ? params.limit : 8;
  const filterType = params.type as Transaction['type'] | undefined;

  const { data: transactions } = useTransactions();
  const { mutate: del, isPending } = useDeleteTransaction();

  const list = (transactions ?? [])
    .filter((t) => (filterType ? t.type === filterType : true))
    .slice(0, limit);

  const title =
    filterType === 'income'  ? 'Entrate recenti'      :
    filterType === 'expense' ? 'Uscite recenti'       :
                               'Transazioni recenti';

  return (
    <NebulaCard icon="📋" title={title} variant="finance">
      {list.length > 0 ? (
        <>
          <div className="fragment-list">
            {list.map((t) => (
              <div key={t.id} className="fragment-list-row">
                <div className="fragment-list-left">
                  <span className="fragment-list-desc">{t.description || t.category}</span>
                  <span className="fragment-list-sub">{t.date}</span>
                </div>
                <span className={`fragment-list-amt ${t.type === 'income' ? 'fkv--green' : 'fkv--red'}`}>
                  {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                </span>
                <button
                  className="fragment-delete-btn"
                  onClick={() => del(t.id)}
                  disabled={isPending}
                  title="Elimina"
                  aria-label="Elimina transazione"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          <p className="fragment-count">{list.length} di {(transactions ?? []).length}</p>
        </>
      ) : (
        <p className="fragment-empty">Nessuna transazione trovata.</p>
      )}
    </NebulaCard>
  );
}
