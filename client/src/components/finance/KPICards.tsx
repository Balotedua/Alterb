import { useTransactions } from '@/hooks/useTransactions';
import { formatCurrency } from '@/utils/formatters';
import { Card } from '@/components/ui';

export function KPICards() {
  const { data: transactions = [], isPending } = useTransactions();

  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const balance = totals.income - totals.expense;

  if (isPending) return <div className="kpi-cards kpi-cards--skeleton" aria-busy="true" />;

  return (
    <div className="kpi-cards">
      <Card>
        <p className="kpi__label">Saldo</p>
        <p className="kpi__value" style={{ color: balance >= 0 ? 'var(--accent)' : '#ef4444' }}>
          {formatCurrency(balance)}
        </p>
      </Card>
      <Card>
        <p className="kpi__label">Entrate</p>
        <p className="kpi__value">{formatCurrency(totals.income)}</p>
      </Card>
      <Card>
        <p className="kpi__label">Uscite</p>
        <p className="kpi__value">{formatCurrency(totals.expense)}</p>
      </Card>
    </div>
  );
}
