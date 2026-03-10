import { motion } from 'framer-motion';
import { useTransactions, useMonthlyStats } from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';

const fragmentAnim = {
  initial:    { opacity: 0, scale: 0.93, y: 16 },
  animate:    { opacity: 1, scale: 1,    y: 0   },
  exit:       { opacity: 0, scale: 0.96, y: 10  },
  transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

export function FinanceFragment() {
  const { income, expenses, balance } = useMonthlyStats();
  const { data: transactions } = useTransactions();
  const recent = (transactions ?? []).slice(0, 4);

  return (
    <motion.div className="fragment" {...fragmentAnim}>
      <div className="fragment-header">
        <span className="fragment-icon">💰</span>
        <span className="fragment-title">Finanze · questo mese</span>
      </div>

      <div className="fragment-kpis">
        <div className="fragment-kpi">
          <span className="fragment-kpi-label">Entrate</span>
          <span className="fragment-kpi-value fkv--green">{formatCurrency(income)}</span>
        </div>
        <div className="fragment-kpi">
          <span className="fragment-kpi-label">Uscite</span>
          <span className="fragment-kpi-value fkv--red">{formatCurrency(expenses)}</span>
        </div>
        <div className="fragment-kpi">
          <span className="fragment-kpi-label">Saldo</span>
          <span className={`fragment-kpi-value ${balance >= 0 ? 'fkv--green' : 'fkv--red'}`}>
            {formatCurrency(balance)}
          </span>
        </div>
      </div>

      {recent.length > 0 && (
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
      )}

      {recent.length === 0 && (
        <p className="fragment-empty">Nessuna transazione ancora. Inizia a tracciare!</p>
      )}
    </motion.div>
  );
}
