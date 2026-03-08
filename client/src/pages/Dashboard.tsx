import { useAuth } from '@/hooks/useAuth';
import { useTransactions } from '@/hooks/useTransactions';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: transactions, isPending } = useTransactions();

  const firstName = user?.email?.split('@')[0] ?? 'utente';

  const balance = transactions?.reduce((tot, t) =>
    t.type === 'income' ? tot + t.amount : tot - t.amount, 0) ?? 0;
  const income = transactions?.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0;
  const expenses = transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0;
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : '0.0';

  return (
    <div className="db-root">
      <div className="db-dash">
        {isPending ? (
          <div className="db-dash__loading">
            <span className="db-dash__spinner" />
            Caricamento...
          </div>
        ) : (
          <>
            <div className="db-dash__header">
              <h1 className="db-dash__title">Panoramica</h1>
              <p className="db-dash__sub">Bentornato, {firstName}</p>
            </div>

            <div className="db-kpi-grid">
              <div className="db-kpi">
                <span className="db-kpi__label">Saldo</span>
                <span className="db-kpi__value">€ {balance.toFixed(2)}</span>
                <span className="db-kpi__icon">💰</span>
              </div>
              <div className="db-kpi">
                <span className="db-kpi__label">Entrate</span>
                <span className="db-kpi__value db-kpi__value--pos">€ {income.toFixed(2)}</span>
                <span className="db-kpi__icon">📈</span>
              </div>
              <div className="db-kpi">
                <span className="db-kpi__label">Uscite</span>
                <span className="db-kpi__value db-kpi__value--neg">€ {expenses.toFixed(2)}</span>
                <span className="db-kpi__icon">📉</span>
              </div>
              <div className="db-kpi">
                <span className="db-kpi__label">Risparmio</span>
                <span className="db-kpi__value">{savingsRate}%</span>
                <span className="db-kpi__icon">🎯</span>
              </div>
            </div>

            <div className="db-dash__sections">
              <div className="db-section">
                <h3 className="db-section__title">Attività recente</h3>
                {transactions && transactions.length > 0 ? (
                  <div className="db-tx-list">
                    {transactions.slice(0, 5).map((t) => (
                      <div key={t.id} className="db-tx">
                        <span className="db-tx__label">{t.description ?? t.category}</span>
                        <span className={`db-tx__amount ${t.type === 'income' ? 'db-tx__amount--pos' : 'db-tx__amount--neg'}`}>
                          {t.type === 'income' ? '+' : '-'}€ {t.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="db-empty">Nessuna transazione ancora. Vai in Finanze per iniziare.</p>
                )}
              </div>

              <div className="db-section">
                <h3 className="db-section__title">Badge sbloccati</h3>
                <div className="db-badge-grid">
                  {transactions && transactions.length > 0 ? (
                    <>
                      <div className="db-badge" title="Prima transazione">💰</div>
                      <div className="db-badge" title="Esploratore">🗺️</div>
                      <div className="db-badge" title="Costanza">📊</div>
                    </>
                  ) : (
                    <p className="db-empty">Completa obiettivi per sbloccare badge.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
