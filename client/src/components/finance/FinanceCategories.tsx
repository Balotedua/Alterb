import { useTransactions } from '@/hooks/useFinance';
import { CAT_CONFIG } from '@/utils/constants';
import { formatCurrency } from '@/utils/formatters';

export function FinanceCategories() {
  const { data: transactions } = useTransactions();

  if (!transactions?.length) return null;

  const now = new Date();
  const expenses = transactions.filter(t => {
    const d = new Date(t.date);
    return t.type === 'expense' &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
  });

  if (!expenses.length) return null;

  const byCategory = expenses.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});

  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);

  const sorted = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="fin-card">
      <div className="fin-card-title">Spese per categoria</div>

      <div className="fin-cat-list">
        {sorted.map(([catId, amount], i) => {
          const cat = CAT_CONFIG.find(c => c.id === catId);
          const pct = (amount / total) * 100;

          return (
            <div key={catId} className="fin-cat-item" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="fin-cat-header">
                <div className="fin-cat-left">
                  <span className="fin-cat-icon">{cat?.icon ?? '📦'}</span>
                  <span>{cat?.label ?? catId}</span>
                </div>
                <span className="fin-cat-amount">{formatCurrency(amount)}</span>
              </div>

              <div className="fin-cat-bar-track">
                <div
                  className="fin-cat-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: cat?.color ?? '#6b7280',
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              </div>

              <div className="fin-cat-pct">{pct.toFixed(1)}% del totale</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
