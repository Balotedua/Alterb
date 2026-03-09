import { useTransactions, useFinanceCategories } from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';

const DAYS   = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function FinanceAnalytics() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories   = [] } = useFinanceCategories();

  const expenses = transactions.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    return (
      <div className="fan-empty">
        <span>📊</span>
        <p>Nessuna spesa registrata ancora.</p>
      </div>
    );
  }

  // ── Giorno della settimana ────────────────────────────────────────────────
  const byDay = Array(7).fill(0) as number[];
  for (const t of expenses) byDay[new Date(t.date).getDay()] += t.amount;
  const maxDay    = Math.max(...byDay);
  const topDayIdx = byDay.indexOf(maxDay);

  // ── Mesi (ultimi 12) ─────────────────────────────────────────────────────
  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const byMonth: Record<string, { exp: number; inc: number }> = {};
  for (const k of monthKeys) byMonth[k] = { exp: 0, inc: 0 };
  for (const t of transactions) {
    const k = t.date.slice(0, 7);
    if (k in byMonth) {
      if (t.type === 'expense') byMonth[k].exp += t.amount;
      else                      byMonth[k].inc += t.amount;
    }
  }
  const monthExp    = monthKeys.map(k => byMonth[k].exp);
  const maxMonthExp = Math.max(...monthExp, 1);
  const topMonthKey = monthKeys[monthExp.indexOf(Math.max(...monthExp))];

  // ── Categorie top 6 ───────────────────────────────────────────────────────
  const byCat: Record<string, number> = {};
  for (const t of expenses) byCat[t.category] = (byCat[t.category] ?? 0) + t.amount;
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const topCats  = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // ── KPI ───────────────────────────────────────────────────────────────────
  const uniqueDays   = new Set(expenses.map(t => t.date)).size;
  const avgDay       = uniqueDays > 0 ? totalExp / uniqueDays : 0;
  const activeMonths = monthExp.filter(v => v > 0);
  const avgMonth     = activeMonths.length > 0 ? activeMonths.reduce((s, v) => s + v, 0) / activeMonths.length : 0;
  const maxTx        = expenses.reduce((b, t) => t.amount > b.amount ? t : b, expenses[0]);
  const [tmy, tmm]   = topMonthKey.split('-');
  const topMonthLabel = `${MONTHS[parseInt(tmm) - 1]} ${tmy}`;

  return (
    <div className="fan-wrap">

      {/* ── Stat pills ── */}
      <div className="fan-stats">
        <div className="fan-stat">
          <div className="fan-stat-label">Media/giorno</div>
          <div className="fan-stat-value">{formatCurrency(avgDay)}</div>
        </div>
        <div className="fan-stat">
          <div className="fan-stat-label">Media/mese</div>
          <div className="fan-stat-value">{formatCurrency(avgMonth)}</div>
        </div>
        <div className="fan-stat">
          <div className="fan-stat-label">Giorno record</div>
          <div className="fan-stat-value">{DAYS[topDayIdx]}</div>
        </div>
        <div className="fan-stat">
          <div className="fan-stat-label">Mese record</div>
          <div className="fan-stat-value">{topMonthLabel}</div>
        </div>
        <div className="fan-stat fan-stat--wide">
          <div className="fan-stat-label">Spesa più grande</div>
          <div className="fan-stat-value">{formatCurrency(maxTx.amount)}</div>
          <div className="fan-stat-sub">{maxTx.description}</div>
        </div>
      </div>

      <div className="fan-grid">

        {/* ── Spesa per giorno ── */}
        <div className="fin-card fan-card">
          <div className="fan-card-title">Spesa per giorno della settimana</div>
          <div className="fan-bars">
            {DAYS.map((label, i) => {
              const val  = byDay[i];
              const pct  = maxDay > 0 ? (val / maxDay) * 100 : 0;
              const isTop = i === topDayIdx && val > 0;
              return (
                <div key={i} className="fan-bar-col">
                  {isTop && <div className="fan-bar-peak">{formatCurrency(val)}</div>}
                  <div className="fan-bar-track">
                    <div
                      className={`fan-bar-fill ${isTop ? 'fan-bar-fill--top' : ''}`}
                      style={{ height: `${Math.max(pct, val > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <div className={`fan-bar-label ${isTop ? 'fan-bar-label--top' : ''}`}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Top categorie ── */}
        <div className="fin-card fan-card">
          <div className="fan-card-title">Top categorie</div>
          {topCats.length === 0 ? (
            <p className="fan-empty-small">Nessuna spesa categorizzata</p>
          ) : (
            <div className="fan-cats">
              {topCats.map(([catId, amt], i) => {
                const cat = categories.find(c => c.id === catId);
                const pct = totalExp > 0 ? (amt / totalExp) * 100 : 0;
                return (
                  <div key={catId} className="fan-cat">
                    <div className="fan-cat-top">
                      <div className="fan-cat-left">
                        <span className="fan-cat-num">{i + 1}</span>
                        <span className="fan-cat-icon">{cat?.icon ?? '📦'}</span>
                        <span className="fan-cat-name">{cat?.label ?? catId}</span>
                      </div>
                      <div className="fan-cat-right">
                        <span className="fan-cat-pct">{pct.toFixed(0)}%</span>
                        <span className="fan-cat-amt">{formatCurrency(amt)}</span>
                      </div>
                    </div>
                    <div className="fan-cat-bar-bg">
                      <div
                        className="fan-cat-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: cat?.color ?? 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Spesa per mese ── */}
        <div className="fin-card fan-card fan-card--wide">
          <div className="fan-card-title">Spesa mensile — ultimi 12 mesi</div>
          <div className="fan-months">
            {monthKeys.map((key, i) => {
              const exp   = monthExp[i];
              const inc   = byMonth[key].inc;
              const net   = inc - exp;
              const pct   = maxMonthExp > 0 ? (exp / maxMonthExp) * 100 : 0;
              const isTop = key === topMonthKey && exp > 0;
              const [, m] = key.split('-');
              const isCurrent = key === monthKeys[monthKeys.length - 1];
              return (
                <div key={key} className={`fan-month ${isTop ? 'fan-month--top' : ''} ${isCurrent ? 'fan-month--current' : ''}`}>
                  <div className="fan-month-label">{MONTHS[parseInt(m) - 1]}</div>
                  <div className="fan-month-bar-bg">
                    <div
                      className="fan-month-bar-fill"
                      style={{ width: `${Math.max(pct, exp > 0 ? 1 : 0)}%` }}
                    />
                  </div>
                  <div className="fan-month-right">
                    <span className="fan-month-exp">{exp > 0 ? formatCurrency(exp) : '—'}</span>
                    {exp > 0 && (
                      <span className={`fan-month-net ${net >= 0 ? 'fan-month-net--pos' : 'fan-month-net--neg'}`}>
                        {net >= 0 ? '+' : ''}{formatCurrency(net)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
