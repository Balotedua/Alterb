import { FinanceKPICards } from '@/components/finance/KPICards';
import { FinanceChart } from '@/components/finance/FinanceChart';
import { FinanceTransactionForm } from '@/components/finance/FinanceTransactionForm';
import { FinanceTransactionList } from '@/components/finance/FinanceTransactionList';
import { FinanceCategories } from '@/components/finance/FinanceCategories';
import './Finance.css';

export default function Finance() {
  return (
    <div className="fin-page">
      <header className="fin-header">
        <div>
          <h1>Finanze</h1>
          <p className="fin-header-sub">Tieni traccia delle tue entrate e uscite</p>
        </div>
      </header>

      <FinanceKPICards />

      <div className="fin-grid">
        {/* Left col: chart + list */}
        <div className="fin-col fin-col-left">
          <FinanceChart />
          <FinanceTransactionList />
        </div>

        {/* Right col: form + categories — viene prima su mobile via CSS order */}
        <div className="fin-col fin-col-right">
          <FinanceTransactionForm />
          <FinanceCategories />
        </div>
      </div>
    </div>
  );
}
