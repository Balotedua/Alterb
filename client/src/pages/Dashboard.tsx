import { useTransactions } from '@/hooks/useTransactions';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: transactions, isPending } = useTransactions();

  if (isPending) {
    return <div className="dashboard-loading">Caricamento dashboard</div>;
  }

  const balance = transactions?.reduce((tot, t) =>
    t.type === 'income' ? tot + t.amount : tot - t.amount, 0
  ) ?? 0;

  const income = transactions?.filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0) ?? 0;

  const expenses = transactions?.filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0) ?? 0;

  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

  // Dati per grafico finto per ora
  const chartData = [65, 59, 80, 81, 56, 55, 40];
  const labels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="welcome-message">
          {user ? `Bentornato, ${user.email}` : 'Il tuo riepilogo personale'}
        </p>
      </header>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-content">
            <span className="kpi-icon">💰</span>
            <div>
              <div className="kpi-label">Saldo totale</div>
              <div className="kpi-value">€ {balance.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-content">
            <span className="kpi-icon">📈</span>
            <div>
              <div className="kpi-label">Entrate</div>
              <div className="kpi-value">€ {income.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-content">
            <span className="kpi-icon">📉</span>
            <div>
              <div className="kpi-label">Uscite</div>
              <div className="kpi-value">€ {expenses.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-content">
            <span className="kpi-icon">🎯</span>
            <div>
              <div className="kpi-label">Tasso risparmio</div>
              <div className="kpi-value">{savingsRate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        <Card className="chart-card">
          <h4>Andamento finanziario</h4>
          <div className="chart-container">
            {/* Qui metteremo Chart.js dopo */}
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              padding: '20px 0'
            }}>
              {chartData.map((value, i) => (
                <div key={i} style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '100%',
                    height: `${value}px`,
                    background: 'var(--accent)',
                    borderRadius: '4px 4px 0 0',
                    opacity: 0.7
                  }} />
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {labels[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="chart-card">
          <h4>Badge recenti</h4>
          <div className="badge-mini-grid">
            {transactions && transactions.length > 0 ? (
              <>
                <div className="badge-mini" title="Prima transazione">💰</div>
                <div className="badge-mini" title="Risparmiatore">🎯</div>
                <div className="badge-mini" title="Esploratore">🗺️</div>
                <div className="badge-mini" title="Costanza">📊</div>
              </>
            ) : (
              <p className="empty-badges">
                Aggiungi transazioni per sbloccare badge!
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}