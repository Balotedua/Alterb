import { useState } from 'react';
import { useAddTransaction, useTransactions, useFinanceCategories } from '@/hooks/useFinance';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { badgeService } from '@/services/badgeService';
import type { TransactionType } from '@/types';

export function FinanceTransactionForm() {
  const { user }       = useAuth();
  const addMutation    = useAddTransaction();
  const { data: txns } = useTransactions();
  const { data: categories = [] } = useFinanceCategories();

  const [type,        setType       ] = useState<TransactionType>('expense');
  const [amount,      setAmount     ] = useState('');
  const [category,    setCategory   ] = useState('');
  const [description, setDescription] = useState('');
  const [date,        setDate       ] = useState(new Date().toISOString().slice(0, 10));
  const [error,       setError      ] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Inserisci un importo valido'); return; }
    if (!description.trim()) { setError('Inserisci una descrizione'); return; }
    if (!category) { setError('Seleziona una categoria'); return; }

    // Controllo doppioni: stessa data + stesso importo (senza centesimi) + stessa descrizione (senza spazi/maiuscole)
    const descNorm = description.trim().toLowerCase().replace(/\s+/g, '');
    const duplicate = (txns ?? []).find(
      (t) =>
        t.date.slice(0, 10) === date &&
        Math.floor(t.amount) === Math.floor(amt) &&
        t.description.trim().toLowerCase().replace(/\s+/g, '') === descNorm
    );
    if (duplicate) {
      setError(`Duplicato: esiste già "${duplicate.description}" del ${duplicate.date.slice(0, 10)} per €${duplicate.amount.toFixed(2)}.`);
      return;
    }

    try {
      await addMutation.mutateAsync({ amount: amt, type, category, description: description.trim(), date });

      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().slice(0, 10));

      if (user) {
        const newCount = (txns?.length ?? 0) + 1;
        void badgeService.triggerEvent(user.id, 'transaction_added', { count: newCount });
      }
    } catch {
      setError('Errore durante il salvataggio. Riprova.');
    }
  };

  return (
    <div className="fin-card">
      <div className="fin-card-title">Nuova transazione</div>

      <div className="fin-type-toggle">
        <button
          type="button"
          className={`fin-type-btn ${type === 'expense' ? 'active-expense' : ''}`}
          onClick={() => setType('expense')}
        >
          <span>↓</span> Uscita
        </button>
        <button
          type="button"
          className={`fin-type-btn ${type === 'income' ? 'active-income' : ''}`}
          onClick={() => setType('income')}
        >
          <span>↑</span> Entrata
        </button>
      </div>

      <form onSubmit={handleSubmit} className="fin-form">
        <div className="fin-form-row">
          <Input
            label="Importo (€)"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
          <div className="fin-field">
            <label className="fin-label">Categoria</label>
            {categories.length === 0 ? (
              <div className="fin-select fin-select-empty">
                Nessuna categoria — creane una in basso
              </div>
            ) : (
              <select
                className="fin-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Scegli categoria…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <Input
          label="Descrizione"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Es. Spesa al supermercato..."
          required
        />

        <Input
          label="Data"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        {error && <div className="fin-error">{error}</div>}

        <Button
          type="submit"
          loading={addMutation.isPending}
          className="fin-submit-btn"
          disabled={categories.length === 0}
        >
          {type === 'expense' ? '↓ Aggiungi uscita' : '↑ Aggiungi entrata'}
        </Button>
      </form>
    </div>
  );
}
