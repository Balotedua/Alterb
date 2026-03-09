import { useState } from 'react';
import { useTransactions, useFinanceCategories } from '@/hooks/useFinance';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/formatters';

type Budgets = Record<string, number>;

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function FinanceBudget() {
  const { user }                       = useAuth();
  const { data: transactions = [] }    = useTransactions();
  const { data: categories   = [] }    = useFinanceCategories();
  const [budgets, setBudgets]          = useLocalStorage<Budgets>(`alter_budgets_${user?.id}`, {});
  const [editing,  setEditing ]        = useState<string | null>(null);
  const [inputVal, setInputVal]        = useState('');

  const now             = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel      = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  if (categories.length === 0) {
    return (
      <div className="fbu-empty">
        <span>🎯</span>
        <p>Crea prima delle categorie per impostare i budget mensili.</p>
      </div>
    );
  }

  const spentThisMonth: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type === 'expense' && t.date.startsWith(currentMonthKey))
      spentThisMonth[t.category] = (spentThisMonth[t.category] ?? 0) + t.amount;
  }

  const totalBudget = Object.entries(budgets)
    .filter(([id]) => categories.some(c => c.id === id))
    .reduce((s, [, v]) => s + v, 0);
  const totalSpent  = categories.reduce((s, c) => s + (spentThisMonth[c.id] ?? 0), 0);
  const totalPct    = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const totalOver   = totalBudget > 0 && totalSpent > totalBudget;
  const totalWarn   = !totalOver && totalPct >= 80;

  const startEdit = (id: string) => {
    setEditing(id);
    setInputVal(budgets[id] !== undefined ? String(budgets[id]) : '');
  };

  const saveEdit = (id: string) => {
    const val = parseFloat(inputVal);
    if (!isNaN(val) && val > 0) {
      setBudgets({ ...budgets, [id]: val });
    } else {
      const next = { ...budgets };
      delete next[id];
      setBudgets(next);
    }
    setEditing(null);
  };

  return (
    <div className="fbu-wrap">

      {/* ── Riepilogo totale ── */}
      {totalBudget > 0 && (
        <div className="fin-card fbu-summary">
          <div className="fbu-sum-row">
            <div className="fbu-sum-left">
              <div className="fbu-sum-label">{monthLabel}</div>
              <div className="fbu-sum-amounts">
                <span className={`fbu-sum-spent ${totalOver ? 'fbu-sum-spent--over' : ''}`}>
                  {formatCurrency(totalSpent)}
                </span>
                <span className="fbu-sum-sep">/</span>
                <span className="fbu-sum-total">{formatCurrency(totalBudget)}</span>
              </div>
              <div className={`fbu-sum-sub ${totalOver ? 'fbu-sum-sub--over' : ''}`}>
                {totalOver
                  ? `⚠ Superato di ${formatCurrency(totalSpent - totalBudget)}`
                  : `Rimangono ${formatCurrency(totalBudget - totalSpent)} · ${(100 - totalPct).toFixed(0)}%`}
              </div>
            </div>
            <div className="fbu-sum-ring-wrap">
              <svg className="fbu-ring" viewBox="0 0 36 36">
                <circle className="fbu-ring-bg"  cx="18" cy="18" r="15.9" />
                <circle
                  className={`fbu-ring-fill ${totalOver ? 'fbu-ring-fill--over' : totalWarn ? 'fbu-ring-fill--warn' : ''}`}
                  cx="18" cy="18" r="15.9"
                  strokeDasharray={`${totalPct} ${100 - totalPct}`}
                  strokeDashoffset="25"
                />
              </svg>
              <div className="fbu-ring-pct">{Math.round(totalPct)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista categorie ── */}
      <div className="fin-card fbu-card">
        <div className="fbu-card-header">
          <div className="fin-card-title">Budget {monthLabel}</div>
          <div className="fbu-card-hint">Clicca per impostare</div>
        </div>

        <div className="fbu-list">
          {categories.map(cat => {
            const spent    = spentThisMonth[cat.id] ?? 0;
            const budget   = budgets[cat.id];
            const has      = budget !== undefined && budget > 0;
            const pct      = has ? Math.min((spent / budget) * 100, 100) : 0;
            const over     = has && spent > budget;
            const warn     = has && pct >= 80 && !over;
            const isEdit   = editing === cat.id;

            return (
              <div
                key={cat.id}
                className={`fbu-row ${over ? 'fbu-row--over' : ''} ${!has ? 'fbu-row--unset' : ''}`}
                onClick={() => !isEdit && startEdit(cat.id)}
              >
                {/* Left: icon + name */}
                <div className="fbu-row-cat">
                  <span className="fbu-cat-dot" style={{ background: cat.color }} />
                  <span className="fbu-cat-icon">{cat.icon}</span>
                  <span className="fbu-cat-name">{cat.label}</span>
                </div>

                {/* Right: amounts or edit */}
                <div className="fbu-row-right" onClick={e => isEdit && e.stopPropagation()}>
                  {isEdit ? (
                    <div className="fbu-edit">
                      <span className="fbu-edit-eur">€</span>
                      <input
                        className="fbu-input"
                        type="number"
                        min="0"
                        step="10"
                        placeholder="0"
                        value={inputVal}
                        autoFocus
                        onChange={e => setInputVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  saveEdit(cat.id);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        onBlur={() => saveEdit(cat.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div className="fbu-amounts">
                      {has ? (
                        <>
                          <span className={`fbu-spent ${over ? 'fbu-spent--over' : ''}`}>{formatCurrency(spent)}</span>
                          <span className="fbu-of">/ {formatCurrency(budget)}</span>
                        </>
                      ) : (
                        <>
                          <span className="fbu-spent-only">{spent > 0 ? formatCurrency(spent) : '—'}</span>
                          <span className="fbu-set-cta">+ budget</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Bar — full width below */}
                {has && !isEdit && (
                  <div className="fbu-bar-bg">
                    <div
                      className="fbu-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: over ? '#ef4444' : warn ? '#f59e0b' : cat.color,
                        opacity: over || warn ? 1 : 0.75,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
