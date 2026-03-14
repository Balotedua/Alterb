import { useMemo } from 'react';
import { useVisibleTransactions, useFinanceCategories } from '@/hooks/useFinance';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { formatCurrency } from '@/utils/formatters';
import type { Transaction } from '@/types';

interface Props { params: Record<string, unknown> }

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lun → Dom

function sumAmt(txs: Transaction[]) { return txs.reduce((s, t) => s + t.amount, 0); }
function byType(txs: Transaction[], type: 'expense' | 'income') {
  return txs.filter(t => t.type === type);
}

// ── Horizontal bar row ────────────────────────────────────────────────────────
function HBar({ label, value, max, pct, color, isTop, subLabel }: {
  label: string; value: number; max: number; pct?: number;
  color: string; isTop?: boolean; subLabel?: string;
}) {
  const fill = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={`an2-hbar ${isTop ? 'an2-hbar--top' : ''}`}>
      <div className="an2-hbar-head">
        <span className="an2-hbar-label">{label}</span>
        <div className="an2-hbar-right">
          {pct !== undefined && (
            <span className="an2-hbar-pct">{pct.toFixed(0)}%</span>
          )}
          <span className="an2-hbar-val" style={{ color: isTop ? color : undefined }}>
            {value > 0 ? formatCurrency(value) : '—'}
          </span>
        </div>
      </div>
      {subLabel && <span className="an2-hbar-sub">{subLabel}</span>}
      <div className="an2-hbar-track">
        <div
          className="an2-hbar-fill"
          style={{
            width: `${fill}%`,
            background: color,
            boxShadow: isTop ? `0 0 8px ${color}60` : 'none',
          }}
        />
      </div>
    </div>
  );
}

// ── Smart insight generator ────────────────────────────────────────────────────
function buildInsight(
  totalExp: number,
  totalInc: number,
  prevExp: number,
  topCatLabel: string,
  topCatAmt: number,
  topDayLabel: string,
): string {
  const savingsRate = totalInc > 0 ? ((totalInc - totalExp) / totalInc) * 100 : null;
  const expTrend = prevExp > 0 ? ((totalExp - prevExp) / prevExp) * 100 : null;

  if (totalExp === 0 && totalInc === 0) return 'Nessuna transazione questo mese ancora.';

  const parts: string[] = [];

  if (expTrend !== null) {
    if (expTrend > 15) parts.push(`Le uscite sono aumentate del ${Math.abs(expTrend).toFixed(0)}% rispetto al mese scorso.`);
    else if (expTrend < -15) parts.push(`Ottimo: le uscite sono calate del ${Math.abs(expTrend).toFixed(0)}% rispetto al mese scorso.`);
  }

  if (savingsRate !== null && totalInc > 0) {
    if (savingsRate >= 30) parts.push(`Stai risparmiando il ${Math.round(savingsRate)}% del reddito — eccellente.`);
    else if (savingsRate >= 10) parts.push(`Risparmio al ${Math.round(savingsRate)}% — buon ritmo.`);
    else if (savingsRate < 0) parts.push(`Continua così!`);
    else parts.push(`Risparmio al ${Math.round(savingsRate)}% — puoi migliorare.`);
  }

  if (topCatLabel && topCatAmt > 0) {
    parts.push(`La voce principale è "${topCatLabel}" con ${formatCurrency(topCatAmt)}.`);
  }

  if (topDayLabel) {
    parts.push(`Spendi di più il ${topDayLabel}.`);
  }

  return parts.slice(0, 2).join(' ') || 'Dati insufficienti per generare insight.';
}

// ── Main component ─────────────────────────────────────────────────────────────
export function FinanceAnalyticsFragment(_: Props) {
  const txs = useVisibleTransactions();
  const { data: categories = [] } = useFinanceCategories();

  // ── Mese corrente ──────────────────────────────────────────────────────────
  const thisPrefix = new Date().toISOString().slice(0, 7);
  const prevDate = new Date(); prevDate.setMonth(prevDate.getMonth() - 1);
  const prevPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const { totalExp, totalInc, prevExp, topCats } = useMemo(() => {
    const thisMonth = txs.filter(t => t.date.startsWith(thisPrefix));
    const lastMonth = txs.filter(t => t.date.startsWith(prevPrefix));

    const expenses = byType(thisMonth, 'expense');
    const exp = sumAmt(expenses);
    const inc = sumAmt(byType(thisMonth, 'income'));
    const prev = sumAmt(byType(lastMonth, 'expense'));

    // Top categorie
    const byCat: Record<string, number> = {};
    for (const t of expenses) byCat[t.category] = (byCat[t.category] ?? 0) + t.amount;
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { totalExp: exp, totalInc: inc, prevExp: prev, topCats: sorted };
  }, [txs, thisPrefix, prevPrefix]);

  // ── Pattern giorno della settimana (storico) ───────────────────────────────
  const { dowData, topDow } = useMemo(() => {
    const totals = Array(7).fill(0) as number[];
    const counts = Array(7).fill(0) as number[];
    for (const t of byType(txs, 'expense')) {
      const d = new Date(t.date + 'T00:00:00').getDay();
      totals[d] += t.amount; counts[d]++;
    }
    const data = DOW_ORDER.map(d => ({
      label: DAYS_IT[d],
      avg: counts[d] > 0 ? totals[d] / counts[d] : 0,
      total: totals[d],
    }));
    const top = data.reduce((a, b) => b.avg > a.avg ? b : a, data[0]);
    return { dowData: data, topDow: top };
  }, [txs]);

  const dowMax = Math.max(...dowData.map(d => d.avg), 1);
  const totalExpCats = topCats.reduce((s, [, v]) => s + v, 0);

  // Insight testuale
  const topCatEntry = topCats[0];
  const topCatName = topCatEntry
    ? (categories.find(c => c.id === topCatEntry[0])?.label ?? topCatEntry[0])
    : '';
  const insight = buildInsight(totalExp, totalInc, prevExp, topCatName, topCatEntry?.[1] ?? 0, topDow?.label ?? '');

  const hasData = totalExp > 0 || txs.length > 0;

  return (
    <NebulaCard title="Analisi intelligente" variant="finance" closable>

      {/* ── Insight testuale ──────────────────────────────────────────────── */}
      <div className="an2-insight-box">
        <span className="an2-insight-icon">💡</span>
        <p className="an2-insight-text">{insight}</p>
      </div>

      {/* ── Top categorie ─────────────────────────────────────────────────── */}
      {topCats.length > 0 ? (
        <div className="an2-section">
          <div className="an2-section-title">Dove vanno i soldi · questo mese</div>
          <div className="an2-hbar-list">
            {topCats.map(([catId, amt], i) => {
              const cat = categories.find(c => c.id === catId);
              const pct = totalExpCats > 0 ? (amt / totalExpCats) * 100 : 0;
              const color = cat?.color ?? '#818cf8';
              return (
                <HBar
                  key={catId}
                  label={`${cat?.icon ?? '🏷️'} ${cat?.label ?? catId}`}
                  value={amt}
                  max={topCats[0][1]}
                  pct={pct}
                  color={color}
                  isTop={i === 0}
                />
              );
            })}
          </div>
        </div>
      ) : hasData ? (
        <p className="an2-empty">Nessuna uscita categorizzata questo mese.</p>
      ) : null}

      {/* ── Pattern settimanale ───────────────────────────────────────────── */}
      {dowData.some(d => d.avg > 0) && (
        <div className="an2-section">
          <div className="an2-section-title">Quando spendi · media storica</div>
          <div className="an2-hbar-list an2-hbar-list--dow">
            {dowData.map(d => (
              <HBar
                key={d.label}
                label={d.label}
                value={d.avg}
                max={dowMax}
                color="#a78bfa"
                isTop={d.label === topDow?.label && d.avg > 0}
              />
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <p className="an2-empty" style={{ textAlign: 'center', marginTop: '1rem' }}>
          Aggiungi transazioni per vedere le analisi.
        </p>
      )}

    </NebulaCard>
  );
}
