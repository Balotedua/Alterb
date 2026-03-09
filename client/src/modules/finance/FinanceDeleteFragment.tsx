import { useState } from 'react';
import { useTransactions, useDeleteTransaction, useFinanceCategories } from '@/hooks/useFinance';
import { useDeleteTransactions, type DeleteCriteria } from '@/hooks/useTransactions';
import { formatCurrency } from '@/utils/formatters';
import { NebulaCard } from '@/components/ui/nebula';
import { useNebulaStore } from '@/store/nebulaStore';
import { useAuth } from '@/hooks/useAuth';
import type { Transaction } from '@/types';

interface Props { params: Record<string, unknown> }

export function FinanceDeleteFragment({ params }: Props) {
  const filterDays = typeof params.days === 'number' ? params.days : null;
  const filterType = params.filterType as Transaction['type'] | null ?? null;

  const { data: allTransactions } = useTransactions();
  const { data: categories = [] } = useFinanceCategories();
  const { mutate: delOne, isPending: delOnePending } = useDeleteTransaction();
  const { mutate: deleteByCriteria, isPending: criteriaPending } = useDeleteTransactions();
  const { setFragment } = useNebulaStore();
  const { user } = useAuth();

  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [criteria, setCriteria] = useState<DeleteCriteria>({
    category: '',
    descriptionContains: '',
    startDate: '',
    endDate: '',
    type: undefined,
  });

  // Filter list for display
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

  const handleDeleteByCriteria = () => {
    if (!user) return;
    deleteByCriteria(criteria, {
      onSuccess: () => {
        // Aggiorna la lista locale marcando come eliminate quelle che corrispondono ai criteri
        const toDelete = new Set<string>();
        (allTransactions ?? []).forEach(t => {
          if (criteria.category && t.category !== criteria.category) return;
          if (criteria.descriptionContains && !t.description.toLowerCase().includes(criteria.descriptionContains.toLowerCase())) return;
          if (criteria.startDate && t.date < criteria.startDate) return;
          if (criteria.endDate && t.date > criteria.endDate) return;
          if (criteria.type && t.type !== criteria.type) return;
          toDelete.add(t.id);
        });
        setDeleted(prev => new Set([...prev, ...toDelete]));
        // Reset criteria
        setCriteria({
          category: '',
          descriptionContains: '',
          startDate: '',
          endDate: '',
          type: undefined,
        });
      },
    });
  };

  const close = () => setFragment(null, {}, 'TALK');

  const title =
    filterDays ? `Elimina transazioni (ultimi ${filterDays} giorni)` :
    filterType === 'expense' ? 'Elimina uscite'  :
    filterType === 'income'  ? 'Elimina entrate' :
                               'Elimina transazioni';

  return (
    <NebulaCard icon="🗑" title={title} variant="finance">
      {/* Form per filtraggio avanzato */}
      <div className="fragment-form" style={{ marginBottom: '1.5rem' }}>
        <div className="fragment-field">
          <label className="fragment-label">Categoria</label>
          <select
            className="fragment-input"
            value={criteria.category}
            onChange={(e) => setCriteria({...criteria, category: e.target.value})}
          >
            <option value="">Tutte le categorie</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div className="fragment-field">
          <label className="fragment-label">Descrizione contiene</label>
          <input
            type="text"
            className="fragment-input"
            placeholder="es. supermercato"
            value={criteria.descriptionContains}
            onChange={(e) => setCriteria({...criteria, descriptionContains: e.target.value})}
          />
        </div>
        <div className="fragment-field">
          <label className="fragment-label">Tipo</label>
          <select
            className="fragment-input"
            value={criteria.type || ''}
            onChange={(e) => setCriteria({...criteria, type: e.target.value as 'income' | 'expense' | undefined})}
          >
            <option value="">Tutti i tipi</option>
            <option value="income">Entrata</option>
            <option value="expense">Uscita</option>
          </select>
        </div>
        <div className="fragment-field" style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <label className="fragment-label">Da data</label>
            <input
              type="date"
              className="fragment-input"
              value={criteria.startDate}
              onChange={(e) => setCriteria({...criteria, startDate: e.target.value})}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="fragment-label">A data</label>
            <input
              type="date"
              className="fragment-input"
              value={criteria.endDate}
              onChange={(e) => setCriteria({...criteria, endDate: e.target.value})}
            />
          </div>
        </div>
        <button
          type="button"
          className="fragment-btn fragment-btn--danger"
          onClick={handleDeleteByCriteria}
          disabled={criteriaPending}
          style={{ marginTop: '0.5rem' }}
        >
          {criteriaPending ? 'Eliminazione...' : 'Elimina transazioni con questi filtri'}
        </button>
      </div>

      {/* Lista transazioni */}
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
                  disabled={deleting === t.id || delOnePending || criteriaPending}
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
          disabled={criteriaPending}
        >
          Chiudi
        </button>
        {list.length > 1 && (
          <button
            type="button"
            className="fragment-btn fragment-btn--danger"
            onClick={() => {
              // Elimina tutte le transazioni visibili
              const ids = list.map(t => t.id);
              ids.forEach(id => {
                delOne(id);
              });
              setDeleted(prev => new Set([...prev, ...ids]));
            }}
            disabled={delOnePending || criteriaPending}
          >
            {delOnePending ? '…' : `Elimina tutte visibili (${list.length})`}
          </button>
        )}
      </div>
    </NebulaCard>
  );
}
