import { useState } from 'react';
import { useAddTransaction, useTransactions } from '@/hooks/useFinance';
import { Button, Input } from '@/components/ui';
import { CAT_CONFIG } from '@/utils/constants';
import { useAuth } from '@/hooks/useAuth';
import { badgeService } from '@/services/badgeService';
import type { TransactionType } from '@/types';

export function FinanceTransactionForm() {
  const { user }       = useAuth();
  const addMutation    = useAddTransaction();
  const { data: txns } = useTransactions();

  const [type,        setType       ] = useState<TransactionType>('expense');
  const [amount,      setAmount     ] = useState('');
  const [category,    setCategory   ] = useState(CAT_CONFIG[0].id);
  const [description, setDescription] = useState('');
  const [date,        setDate       ] = useState(new Date().toISOString().slice(0, 10));
  const [error,       setError      ] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Inserisci un importo valido'); return; }
    if (!description.trim()) { setError('Inserisci una descrizione'); return; }

    try {
      await addMutation.mutateAsync({ amount: amt, type, category, description: description.trim(), date });

      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().slice(0, 10));

      // ── Trigger gamification event (fire-and-forget) ──
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
            <select
              className="fin-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CAT_CONFIG.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
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

        <Button type="submit" loading={addMutation.isPending} className="fin-submit-btn">
          {type === 'expense' ? '↓ Aggiungi uscita' : '↑ Aggiungi entrata'}
        </Button>
      </form>
    </div>
  );
}
