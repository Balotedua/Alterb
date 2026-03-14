import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import {
  useTransactions,
  useDeleteTransactionsBulk,
  useFinanceCategories,
} from '@/hooks/useFinance';
import { FINANCE_DEFAULT_CATS } from '@/utils/constants';
import { formatCurrency } from '@/utils/formatters';
import { toast } from 'sonner';
import type { Transaction } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'keyword' | 'category' | 'period' | 'month' | 'day' | 'all';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'keyword',  label: 'Parola chiave', icon: '🔍' },
  { id: 'category', label: 'Categoria',     icon: '📂' },
  { id: 'period',   label: 'Periodo',       icon: '📅' },
  { id: 'month',    label: 'Mese',          icon: '🗓' },
  { id: 'day',      label: 'Giorno',        icon: '📆' },
  { id: 'all',      label: 'Tutte',         icon: '🗑' },
];

const TAB_ANIM = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.13 } },
};

const MONTHS_IT = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

// ─── Preview list ─────────────────────────────────────────────────────────────

function PreviewList({
  items,
  onDeleteAll,
  isPending,
}: {
  items: Transaction[];
  onDeleteAll: () => void;
  isPending: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);

  if (items.length === 0) {
    return <p className="fragment-empty">Nessuna transazione trovata.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="fragment-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
        {items.map((t) => (
          <div key={t.id} className="fragment-list-row">
            <div className="fragment-list-left">
              <span className="fragment-list-desc">{t.description || t.category}</span>
              <span className="fragment-list-sub">{t.date} · {t.category}</span>
            </div>
            <span className={`fragment-list-amt ${t.type === 'income' ? 'fkv--green' : 'fkv--red'}`}>
              {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
            </span>
          </div>
        ))}
      </div>

      <p className="fragment-count">{items.length} transazioni selezionate</p>

      <div className="fragment-actions">
        {!confirmed ? (
          <button
            className="fragment-btn fragment-btn--danger"
            onClick={() => setConfirmed(true)}
            disabled={isPending}
          >
            Elimina {items.length} transazioni
          </button>
        ) : (
          <>
            <button
              className="fragment-btn"
              onClick={() => setConfirmed(false)}
              disabled={isPending}
            >
              Annulla
            </button>
            <button
              className="fragment-btn fragment-btn--danger"
              onClick={onDeleteAll}
              disabled={isPending}
            >
              {isPending ? 'Eliminazione…' : `Conferma (${items.length})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component (also exported as content-only for embedded use) ──────────

export function FinanceDeleteTabContent() {
  const [tab, setTab] = useState<TabId>('keyword');
  const { data: allTx = [] } = useTransactions();
  const { data: userCats = [] } = useFinanceCategories();
  const { mutate: delBulk, isPending } = useDeleteTransactionsBulk();

  // tab: keyword
  const [keyword, setKeyword] = useState('');

  // tab: category
  const [selCat, setSelCat] = useState('');

  // tab: period
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  // tab: month
  const nowYear  = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1; // 1-12
  const [selMonth, setSelMonth] = useState(nowMonth);
  const [selYear,  setSelYear]  = useState(nowYear);

  // tab: day
  const [selDay, setSelDay] = useState('');

  // ─── Filtered list ───────────────────────────────────────────────────────────

  const filtered = useMemo((): Transaction[] => {
    switch (tab) {
      case 'keyword':
        if (!keyword.trim()) return [];
        return allTx.filter(t =>
          (t.description || '').toLowerCase().includes(keyword.toLowerCase()) ||
          (t.notes || '').toLowerCase().includes(keyword.toLowerCase())
        );

      case 'category':
        if (!selCat) return [];
        return allTx.filter(t => t.category === selCat);

      case 'period': {
        if (!fromDate && !toDate) return [];
        return allTx.filter(t => {
          if (fromDate && t.date < fromDate) return false;
          if (toDate   && t.date > toDate)   return false;
          return true;
        });
      }

      case 'month': {
        const pad = String(selMonth).padStart(2, '0');
        const prefix = `${selYear}-${pad}`;
        return allTx.filter(t => t.date.startsWith(prefix));
      }

      case 'day':
        if (!selDay) return [];
        return allTx.filter(t => t.date === selDay);

      case 'all':
        return allTx;

      default:
        return [];
    }
  }, [tab, allTx, keyword, selCat, fromDate, toDate, selMonth, selYear, selDay]);

  // ─── Delete handler ──────────────────────────────────────────────────────────

  const handleDelete = () => {
    const ids = filtered.map(t => t.id);
    if (!ids.length) return;
    delBulk(ids, {
      onSuccess: (n) => toast.success(`${n ?? ids.length} transazioni eliminate.`),
      onError:   (e) => toast.error('Errore: ' + (e as Error).message),
    });
  };

  // ─── All categories (default + custom) ──────────────────────────────────────

  const allCats = useMemo(() => {
    const custom = userCats.map(c => ({ id: c.id, label: c.label, icon: c.icon || '📂' }));
    const customIds = new Set(custom.map(c => c.id));
    return [
      ...FINANCE_DEFAULT_CATS.filter(c => !customIds.has(c.id)),
      ...custom,
    ];
  }, [userCats]);

  // ─── Year options ─────────────────────────────────────────────────────────────

  const yearOptions = useMemo(() => {
    const years = new Set(allTx.map(t => parseInt(t.date.slice(0, 4))));
    if (!years.size) years.add(nowYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [allTx, nowYear]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`frag-tab-btn${tab === t.id ? ' frag-tab-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} {...TAB_ANIM}>
          {tab === 'keyword' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                className="fragment-input"
                placeholder="Es. supermercato, Netflix…"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
              <PreviewList items={filtered} onDeleteAll={handleDelete} isPending={isPending} />
            </div>
          )}

          {tab === 'category' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {allCats.map(c => (
                  <button
                    key={c.id}
                    className={`frag-cat-chip${selCat === c.id ? ' frag-cat-chip--active' : ''}`}
                    onClick={() => setSelCat(prev => prev === c.id ? '' : c.id)}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <PreviewList items={filtered} onDeleteAll={handleDelete} isPending={isPending} />
            </div>
          )}

          {tab === 'period' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="date"
                  className="fragment-input"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
                <input
                  type="date"
                  className="fragment-input"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <PreviewList items={filtered} onDeleteAll={handleDelete} isPending={isPending} />
            </div>
          )}

          {tab === 'month' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  className="fragment-input"
                  value={selMonth}
                  onChange={e => setSelMonth(Number(e.target.value))}
                  style={{ flex: 2 }}
                >
                  {MONTHS_IT.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  className="fragment-input"
                  value={selYear}
                  onChange={e => setSelYear(Number(e.target.value))}
                  style={{ flex: 1 }}
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <PreviewList items={filtered} onDeleteAll={handleDelete} isPending={isPending} />
            </div>
          )}

          {tab === 'day' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="date"
                className="fragment-input"
                value={selDay}
                onChange={e => setSelDay(e.target.value)}
              />
              <PreviewList items={filtered} onDeleteAll={handleDelete} isPending={isPending} />
            </div>
          )}

          {tab === 'all' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Elimina tutte le <strong style={{ color: 'var(--text)' }}>{allTx.length}</strong> transazioni in modo irreversibile.
              </p>
              <PreviewList items={filtered} onDeleteAll={handleDelete} isPending={isPending} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Fragment wrapper (usato da Nebula intent system)
interface Props { params: Record<string, unknown> }
export function FinanceDeleteTabFragment(_: Props) {
  return (
    <NebulaCard icon="🗑" title="Elimina transazioni" variant="finance">
      <FinanceDeleteTabContent />
    </NebulaCard>
  );
}
