import { useState } from 'react';
import { FinanceKPICards } from '@/components/finance/KPICards';
import { FinanceTransactionForm } from '@/components/finance/FinanceTransactionForm';
import { FinanceTransactionList } from '@/components/finance/FinanceTransactionList';
import { FinanceCategories } from '@/components/finance/FinanceCategories';
import { FinanceCsvImport } from '@/components/finance/FinanceCsvImport';
import { FinanceCategoryLinker } from '@/components/finance/FinanceCategoryLinker';
import { FinanceAnalytics } from '@/components/finance/FinanceAnalytics';
import { FinanceBudget } from '@/components/finance/FinanceBudget';
import './Finance.css';

type Tab = 'panoramica' | 'analisi' | 'budget';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'panoramica', label: 'Panoramica', icon: '💳' },
  { id: 'analisi',    label: 'Analisi',    icon: '📊' },
  { id: 'budget',     label: 'Budget',     icon: '🎯' },
];

export default function Finance() {
  const [tab, setTab] = useState<Tab>('panoramica');

  return (
    <div className="fin-page">
      <header className="fin-header">
        <div>
          <h1>Finanze</h1>
          <p className="fin-header-sub">Tieni traccia delle tue entrate e uscite</p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="fin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`fin-tab-btn ${tab === t.id ? 'fin-tab-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="fin-tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panoramica */}
      {tab === 'panoramica' && (
        <>
          <FinanceKPICards />
          <div className="fin-grid">
            <div className="fin-col fin-col-left">
              <FinanceTransactionList />
            </div>
            <div className="fin-col fin-col-right">
              <FinanceTransactionForm />
              <FinanceCsvImport />
              <FinanceCategories />
              <FinanceCategoryLinker />
            </div>
          </div>
        </>
      )}

      {/* Analisi */}
      {tab === 'analisi' && <FinanceAnalytics />}

      {/* Budget */}
      {tab === 'budget' && <FinanceBudget />}
    </div>
  );
}
