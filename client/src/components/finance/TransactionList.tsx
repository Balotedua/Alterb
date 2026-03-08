import { useTransactions, useDeleteTransaction } from '@/hooks/useTransactions';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { CAT_LABELS } from '@/utils/constants';

export function TransactionList() {
  const { data: transactions = [], isPending } = useTransactions();
  const deleteMutation = useDeleteTransaction();

  if (isPending) return <div className="transaction-list transaction-list--skeleton" aria-busy="true" />;
  if (transactions.length === 0) return <p className="empty-state">Nessuna transazione registrata.</p>;

  return (
    <ul className="transaction-list">
      {transactions.map((t) => (
        <li key={t.id} className={`transaction-item transaction-item--${t.type}`}>
          <span className="transaction-item__category">{CAT_LABELS[t.category] ?? t.category}</span>
          <span className="transaction-item__description">{t.description}</span>
          <span className="transaction-item__date">{formatDate(t.date)}</span>
          <span className="transaction-item__amount">{formatCurrency(t.amount)}</span>
          <button
            className="transaction-item__delete"
            onClick={() => deleteMutation.mutate(t.id)}
            aria-label={`Elimina ${t.description}`}
            disabled={deleteMutation.isPending}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
