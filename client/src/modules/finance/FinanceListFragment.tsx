import { useTransactions } from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';
import { NebulaCard } from '@/components/ui/nebula';
import type { Transaction } from '@/types';

interface Props {
  params: Record<string, unknown>;
}

export function FinanceListFragment({ params }: Props) {
  const limit = typeof params.limit === 'number' ? params.limit : 6;
  const filterType = params.type as Transaction['type'] | undefined;
  const { data: transactions } = useTransactions();

  const list = (transactions ?? [])
    .filter((t) => (filterType ? t.type === filterType : true))
    .slice(0, limit);

  const title = filterType === 'income' ? 'Entrate recenti' : filterType === 'expense' ? 'Uscite recenti' : 'Transazioni recenti';

  return (
    <NebulaCard icon="📋" title={title}>
      {list.length > 0 ? (
        <div className="fragment-list">
          {list.map((t) => (
            <div key={t.id} className="fragment-list-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
                <span className="fragment-list-desc">{t.description || t.category}</span>
                <span className="fragment-list-sub">{t.date}</span>
              </div>
              <span className={`fragment-list-amt ${t.type === 'income' ? 'fkv--green' : 'fkv--red'}`}>
                {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="fragment-empty">Nessuna transazione trovata.</p>
      )}
    </NebulaCard>
  );
}
