import { useState } from 'react';
import { useTransactions, useDeleteTransaction } from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';
import { NebulaCard } from '@/components/ui/nebula';
import { useNebulaStore } from '@/store/nebulaStore';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { Transaction } from '@/types';

interface Props { params: Record<string, unknown> }

export function FinanceDeleteFragment({ params }: Props) {
  const filterDays = typeof params.days === 'number' ? params.days : null;
  const filterType = params.filterType as Transaction['type'] | null ?? null;

  const { data: allTransactions } = useTransactions();
  const { mutate: delOne, isPending: delOnePending } = useDeleteTransaction();
  const { setFragment } = useNebulaStore();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());

  // Filter list
  const cutoff = filterDays
    ? new Date(Date.now() - filterDays * 86400_000).toISOString().split('T')[0]
    : null;

  const list = (allTransactions ?? []).filter((t) => {
    if (deleted.has(t.id)) return false;
    if (cutoff && t.date < cutoff) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  });

  const handleDelete = (id: string) => {
    setDeleting(id);
    delOne(id, {
      onSettled: () => {
        setDeleted((prev) => new Set(prev).add(id));
        setDeleting(null);
      },
    });
  };

  const handleDeleteAll = async () => {
    if (!user || list.length === 0) return;
    setBulkPending(true);
    try {
      let q = supabase.from('transactions').delete().eq('user_id', user.id);
      if (cutoff) q = q.gte('date', cutoff);
      if (filterType) q = q.eq('type', filterType);
      await q;
      setDeleted((prev) => {
        const next = new Set(prev);
        list.forEach((t) => next.add(t.id));
        return next;
      });
      await qc.invalidateQueries({ queryKey: ['transactions'] });
    } finally {
      setBulkPending(false);
    }
  };

  const close = () => setFragment(null, {}, 'TALK');

  const title =
    filterDays ? `Ultimi ${filterDays} giorni` :
    filterType === 'expense' ? 'Uscite recenti'  :
    filterType === 'income'  ? 'Entrate recenti' :
                               'Transazioni recenti';

  return (
    <NebulaCard icon="🗑" title={title} variant="finance">
      {list.length === 0 ? (
        <p className="fragment-empty">Nessuna transazione corrispondente.</p>
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
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id || delOnePending || bulkPending}
                  title="Elimina"
                  aria-label="Elimina transazione"
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
        <button
          type="button"
          className="fragment-btn"
          onClick={close}
          disabled={bulkPending}
        >
          Chiudi
        </button>
        {list.length > 1 && (
          <button
            type="button"
            className="fragment-btn fragment-btn--danger"
            onClick={handleDeleteAll}
            disabled={bulkPending || delOnePending}
          >
            {bulkPending ? '…' : `Elimina tutte (${list.length})`}
          </button>
        )}
      </div>
    </NebulaCard>
  );
}
