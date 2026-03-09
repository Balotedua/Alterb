import { useState } from 'react';
import { useAddTransaction } from '@/hooks/useFinance';
import { NebulaCard } from '@/components/ui/nebula';
import { useNebulaStore } from '@/store/nebulaStore';
import type { TransactionType } from '@/types';

interface Props { params: Record<string, unknown> }

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'food',          label: 'Cibo' },
  { id: 'transport',     label: 'Trasporti' },
  { id: 'shopping',      label: 'Shopping' },
  { id: 'health',        label: 'Salute' },
  { id: 'entertainment', label: 'Svago' },
  { id: 'utilities',     label: 'Bollette' },
  { id: 'salary',        label: 'Stipendio' },
  { id: 'other',         label: 'Altro' },
];

export function FinanceAddFragment({ params }: Props) {
  const initType   = (params.type as TransactionType) ?? 'expense';
  const initAmount = typeof params.amount === 'number' ? String(params.amount) : '';
  const initDesc   = typeof params.description === 'string' ? params.description : '';

  const [type, setType]       = useState<TransactionType>(initType);
  const [amount, setAmount]   = useState(initAmount);
  const [desc, setDesc]       = useState(initDesc);
  const [cat, setCat]         = useState('other');
  const [date, setDate]       = useState(() => new Date().toISOString().split('T')[0]);
  const [done, setDone]       = useState(false);

  const { mutate: add, isPending } = useAddTransaction();
  const { setFragment }            = useNebulaStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount.replace(',', '.'));
    if (!amtNum || amtNum <= 0) return;

    add(
      { type, amount: amtNum, description: desc.trim() || cat, category: cat, date },
      {
        onSuccess: () => {
          setDone(true);
          setTimeout(() => setFragment(null, {}, 'TALK'), 1200);
        },
      },
    );
  };

  const cancel = () => setFragment(null, {}, 'TALK');

  if (done) {
    return (
      <NebulaCard icon="✅" title="Salvato" variant="finance">
        <p className="fragment-empty" style={{ color: '#4ade80' }}>
          {type === 'income' ? 'Entrata' : 'Spesa'} registrata correttamente.
        </p>
      </NebulaCard>
    );
  }

  return (
    <NebulaCard
      icon={type === 'income' ? '📥' : '📤'}
      title={type === 'income' ? 'Nuova entrata' : 'Nuova spesa'}
      variant="finance"
    >
      <form onSubmit={handleSubmit} className="fragment-form">
        {/* type toggle */}
        <div className="fragment-toggle">
          <button
            type="button"
            className={`fragment-toggle-btn ${type === 'expense' ? 'fragment-toggle-btn--active-expense' : ''}`}
            onClick={() => setType('expense')}
          >
            Spesa
          </button>
          <button
            type="button"
            className={`fragment-toggle-btn ${type === 'income' ? 'fragment-toggle-btn--active-income' : ''}`}
            onClick={() => setType('income')}
          >
            Entrata
          </button>
        </div>

        <div className="fragment-field">
          <label className="fragment-label">Importo (€)</label>
          <input
            className="fragment-input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="fragment-field">
          <label className="fragment-label">Descrizione</label>
          <input
            className="fragment-input"
            type="text"
            placeholder="es. Caffè, Supermercato…"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={60}
          />
        </div>

        <div className="fragment-field">
          <label className="fragment-label">Categoria</label>
          <select
            className="fragment-input"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="fragment-field">
          <label className="fragment-label">Data</label>
          <input
            className="fragment-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="fragment-actions">
          <button type="button" className="fragment-btn" onClick={cancel} disabled={isPending}>
            Annulla
          </button>
          <button type="submit" className="fragment-btn fragment-btn--primary" disabled={isPending}>
            {isPending ? '…' : 'Salva'}
          </button>
        </div>
      </form>
    </NebulaCard>
  );
}
