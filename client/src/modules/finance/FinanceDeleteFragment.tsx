import { useState, useMemo } from 'react';
import { useTransactions, useDeleteTransaction, useDeleteTransactionsBulk } from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';
import { NebulaCard } from '@/components/ui/nebula';
import { useNebulaStore } from '@/store/nebulaStore';
import { toast } from 'sonner';
import type { Transaction } from '@/types';

interface Props { params: Record<string, unknown> }

const MONTH_NAMES: Record<string, string> = {
  1:'gennaio', 2:'febbraio', 3:'marzo', 4:'aprile', 5:'maggio', 6:'giugno',
  7:'luglio', 8:'agosto', 9:'settembre', 10:'ottobre', 11:'novembre', 12:'dicembre',
};

export function FinanceDeleteFragment({ params }: Props) {
  const filterDays    = typeof params.days      === 'number' ? params.days       : null;
  const filterType    = (params.filterType ?? params.type) as Transaction['type'] | null ?? null;
  const filterMonth   = typeof params.month     === 'number' ? params.month      : null;
  const filterYear    = typeof params.year      === 'number' ? params.year       : null;
  const filterLimit   = typeof params.limit     === 'number' ? params.limit      : null;
  const deleteAll     = params.deleteAll === true;

  const { data: allTransactions } = useTransactions();
  const { mutate: delOne,  isPending: delOnePending  } = useDeleteTransaction();
  const { mutate: delBulk, isPending: bulkPending    } = useDeleteTransactionsBulk();
  const { setFragment } = useNebulaStore();

  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [removed,   setRemoved]   = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  // Calcola la lista filtrata
  const list = useMemo(() => {
    let txs = (allTransactions ?? []).filter(t => !removed.has(t.id));

    if (filterType) txs = txs.filter(t => t.type === filterType);

    if (filterMonth !== null) {
      const yr = filterYear ?? new Date().getFullYear();
      const pad = String(filterMonth).padStart(2, '0');
      const prefix = `${yr}-${pad}`;
      txs = txs.filter(t => t.date.startsWith(prefix));
    } else if (filterDays !== null) {
      const cutoff = new Date(Date.now() - filterDays * 86400_000)
        .toISOString().split('T')[0];
      txs = txs.filter(t => t.date >= cutoff);
    }

    if (filterLimit !== null) txs = txs.slice(0, filterLimit);

    return txs;
  }, [allTransactions, removed, filterType, filterMonth, filterYear, filterDays, filterLimit]);

  const handleDeleteOne = (id: string) => {
    setDeleting(id);
    delOne(id, {
      onSuccess: () => {
        setRemoved(prev => new Set(prev).add(id));
        setDeleting(null);
      },
      onError: (err) => {
        setDeleting(null);
        toast.error('Errore: ' + (err as Error).message);
      },
    });
  };

  const handleDeleteAll = () => {
    const ids = list.map(t => t.id);
    if (ids.length === 0) return;
    delBulk(ids, {
      onSuccess: () => {
        setRemoved(prev => new Set([...prev, ...ids]));
        setConfirmed(false);
        toast.success(`${ids.length} transazioni eliminate.`);
      },
      onError: (err) => {
        setConfirmed(false);
        toast.error('Errore: ' + (err as Error).message);
      },
    });
  };

  const close = () => setFragment(null, {}, 'TALK');
  const isBusy = delOnePending || bulkPending;

  // Titolo contestuale
  const title = filterMonth !== null
    ? `Elimina transazioni · ${MONTH_NAMES[filterMonth] ?? filterMonth}${filterYear ? ` ${filterYear}` : ''}`
    : filterLimit !== null
      ? `Elimina ultime ${filterLimit} transazioni`
      : deleteAll
        ? 'Elimina tutte le transazioni'
        : filterDays !== null
          ? `Elimina transazioni · ultimi ${filterDays} giorni`
          : filterType === 'expense'
            ? 'Elimina uscite'
            : filterType === 'income'
              ? 'Elimina entrate'
              : 'Elimina transazioni';

  return (
    <NebulaCard icon="🗑" title={title} variant="finance">
      {list.length === 0 ? (
        <p className="fragment-empty">Nessuna transazione da eliminare.</p>
      ) : (
        <>
          <div className="fragment-list">
            {list.map((t) => (
              <div key={t.id} className="fragment-list-row">
                <div className="fragment-list-left">
                  <span className="fragment-list-desc">{t.description || t.category}</span>
                  <span className="fragment-list-sub">{t.date}</span>
                </div>
                <span className={`fragment-list-amt ${t.type === 'income' ? 'fkv--green' : 'fkv--red'}`}>
                  {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                </span>
                <button
                  className="fragment-delete-btn"
                  onClick={() => handleDeleteOne(t.id)}
                  disabled={isBusy}
                  aria-label="Elimina"
                >
                  {deleting === t.id ? '⏳' : '🗑'}
                </button>
              </div>
            ))}
          </div>
          <p className="fragment-count">{list.length} transazioni</p>
        </>
      )}

      <div className="fragment-actions">
        <button className="fragment-btn" onClick={close} disabled={isBusy}>
          Chiudi
        </button>

        {list.length > 1 && !confirmed && (
          <button
            className="fragment-btn fragment-btn--danger"
            onClick={() => setConfirmed(true)}
            disabled={isBusy}
          >
            Elimina tutte ({list.length})
          </button>
        )}

        {list.length > 1 && confirmed && (
          <button
            className="fragment-btn fragment-btn--danger"
            onClick={handleDeleteAll}
            disabled={isBusy}
          >
            {bulkPending ? 'Eliminazione…' : `Conferma eliminazione (${list.length})`}
          </button>
        )}
      </div>
    </NebulaCard>
  );
}
