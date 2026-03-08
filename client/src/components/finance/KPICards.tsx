import { useMonthlyStats } from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';

export function FinanceKPICards() {
  const { income, expenses, balance, savingsRate, transactionCount } = useMonthlyStats();

  const cards = [
    {
      icon: '💳',
      label: 'Saldo mese',
      value: formatCurrency(balance),
      color: balance >= 0 ? '#22c55e' : '#ef4444',
      badge: balance >= 0 ? 'positive' : 'negative',
      badgeText: balance >= 0 ? '▲ Attivo' : '▼ Deficit',
    },
    {
      icon: '📈',
      label: 'Entrate',
      value: formatCurrency(income),
      color: '#22c55e',
      badge: null,
      badgeText: null,
    },
    {
      icon: '📉',
      label: 'Uscite',
      value: formatCurrency(expenses),
      color: '#ef4444',
      badge: null,
      badgeText: null,
    },
    {
      icon: '🎯',
      label: 'Risparmio',
      value: `${savingsRate}%`,
      color: 'var(--accent)',
      badge: null,
      badgeText: `${transactionCount ?? 0} transazioni`,
    },
  ];

  const accentColors = ['#22c55e', '#22c55e', '#ef4444', 'var(--accent)'];

  return (
    <div className="fin-kpi-grid">
      {cards.map((card, i) => (
        <div
          key={i}
          className="fin-kpi-card"
          style={{ '--fin-kpi-accent': accentColors[i] } as React.CSSProperties}
        >
          <span className="fin-kpi-icon">{card.icon}</span>
          <div className="fin-kpi-label">{card.label}</div>
          <div className="fin-kpi-value" style={{ color: card.color }}>
            {card.value}
          </div>
          {card.badge && (
            <span className={`fin-kpi-badge ${card.badge}`}>{card.badgeText}</span>
          )}
          {!card.badge && card.badgeText && (
            <span className="fin-kpi-sub">{card.badgeText}</span>
          )}
        </div>
      ))}
    </div>
  );
}
