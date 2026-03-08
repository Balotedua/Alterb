import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAddTransaction } from '@/hooks/useTransactions';
import { CAT_CONFIG } from '@/utils/constants';
import { Button, Input } from '@/components/ui';
import type { TransactionType } from '@/types';

export function TransactionForm() {
  const addMutation = useAddTransaction();
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CAT_CONFIG[0].id);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Inserisci un importo valido');
      return;
    }
    try {
      await addMutation.mutateAsync({ amount: amt, type, category, description, date });
      setAmount('');
      setDescription('');
    } catch {
      setError('Errore durante il salvataggio');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="transaction-form__type">
        {(['expense', 'income'] as TransactionType[]).map((t) => (
          <button
            key={t}
            type="button"
            className={['type-btn', type === t ? 'type-btn--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setType(t)}
          >
            {t === 'expense' ? '↓ Uscita' : '↑ Entrata'}
          </button>
        ))}
      </div>
      <Input
        label="Importo (€)"
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <div className="input-group">
        <label className="input-label" htmlFor="category">Categoria</label>
        <select
          id="category"
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CAT_CONFIG.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.label}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Descrizione"
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        label="Data"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      {error ? <p className="form-error">{error}</p> : null}
      <Button type="submit" loading={addMutation.isPending}>
        Aggiungi
      </Button>
    </form>
  );
}
