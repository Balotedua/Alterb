import { useTransactions, useMonthlyStats } from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';
import { NebulaCard, NebulaStat } from '@/components/ui/nebula';

interface Props {
  params: Record<string, unknown>;
}

export function FinanceOverviewFragment({ params }: Props) {
  const limit = typeof params.limit === 'number' ? params.limit : 4;
  const { income, expenses, balance } = useMonthlyStats();
  const { data: transactions } = useTransactions();
  const recent = (transactions ?? []).slice(0, limit);

  return (
    <NebulaCard icon="💰" title="Finanze · questo mese">
      <div className="fragment-kpis">
        <NebulaStat label="Entrate"  value={formatCurrency(income)}   color="green" />
        <NebulaStat label="Uscite"   value={formatCurrency(expenses)} color="red"   />
        <NebulaStat label="Saldo"    value={formatCurrency(balance)}  color={balance >= 0 ? 'green' : 'red'} />
      </div>

      {recent.length > 0 ? (
        <div className="fragment-list">
          {recent.map((t) => (
            <div key={t.id} className="fragment-list-row">
              <span className="fragment-list-desc">{t.description || t.category}</span>
              <span className={`fragment-list-amt ${t.type === 'income' ? 'fkv--green' : 'fkv--red'}`}>
                {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="fragment-empty">Nessuna transazione ancora. Inizia a tracciare!</p>
      )}
    </NebulaCard>
  );
}
