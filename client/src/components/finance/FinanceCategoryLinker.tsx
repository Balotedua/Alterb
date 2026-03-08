import { useState } from 'react';
import { Tag, ChevronDown, Check } from 'lucide-react';
import { useTransactions, useRecategorize } from '@/hooks/useFinance';
import { CAT_CONFIG } from '@/utils/constants';
import type { Transaction } from '@/types';

interface Group {
  key: string;           // lowercase description (lookup key)
  description: string;   // original casing for display
  transactions: Transaction[];
  total: number;         // sum signed (income positive, expense negative)
}

function buildGroups(transactions: Transaction[]): Group[] {
  const map = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (t.category !== 'other') continue;
    const key = t.description.toLowerCase().trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  return Array.from(map.entries())
    .map(([key, txns]) => ({
      key,
      description: txns[0].description,
      transactions: txns,
      total: txns.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
    }))
    .sort((a, b) => b.transactions.length - a.transactions.length);
}

export function FinanceCategoryLinker() {
  const { data: transactions } = useTransactions();
  const recategorize = useRecategorize();

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [done,       setDone      ] = useState<Set<string>>(new Set());
  const [pending,    setPending   ] = useState<string | null>(null);

  const groups = buildGroups(transactions ?? []);

  if (groups.length === 0) return null;

  const handleLink = async (group: Group) => {
    const cat = selections[group.key];
    if (!cat) return;
    setPending(group.key);
    try {
      await recategorize.mutateAsync({ description: group.description, category: cat });
      setDone((prev) => new Set([...prev, group.key]));
    } finally {
      setPending(null);
    }
  };

  const visibleGroups = groups.filter((g) => !done.has(g.key));
  const doneCount = done.size;

  return (
    <div className="fin-card fin-linker-wrap">
      <div className="fin-card-title">
        <Tag size={14} style={{ color: 'var(--accent)' }} />
        Collega non associate
        <span className="fin-card-count">{visibleGroups.length}</span>
      </div>

      <p className="fin-linker-hint">
        Transazioni senza categoria raggruppate per descrizione.
        Collegando una voce vengono aggiornate <strong>tutte</strong> le transazioni con quella descrizione.
      </p>

      {doneCount > 0 && (
        <div className="fin-linker-done-banner">
          <Check size={13} /> {doneCount} group{doneCount > 1 ? 'i' : 'o'} collegat{doneCount > 1 ? 'i' : 'o'}
        </div>
      )}

      <div className="fin-linker-list">
        {visibleGroups.map((g) => {
          const isPending = pending === g.key;
          const cat = selections[g.key] ?? '';

          return (
            <div key={g.key} className="fin-linker-row">
              {/* Description + meta */}
              <div className="fin-linker-left">
                <span className="fin-linker-desc">{g.description}</span>
                <span className="fin-linker-meta">
                  ×{g.transactions.length}
                  &nbsp;·&nbsp;
                  <span className={g.total >= 0 ? 'fin-linker-pos' : 'fin-linker-neg'}>
                    {g.total >= 0 ? '+' : ''}€{Math.abs(g.total).toFixed(2)}
                  </span>
                </span>
              </div>

              {/* Category selector + button */}
              <div className="fin-linker-right">
                <div className="fin-linker-sel-wrap">
                  <select
                    className="fin-linker-sel"
                    value={cat}
                    onChange={(e) =>
                      setSelections((prev) => ({ ...prev, [g.key]: e.target.value }))
                    }
                    disabled={isPending}
                  >
                    <option value="">Categoria…</option>
                    {CAT_CONFIG.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="fin-linker-arrow" />
                </div>

                <button
                  className="fin-linker-btn"
                  onClick={() => handleLink(g)}
                  disabled={!cat || isPending}
                >
                  {isPending ? '…' : 'Collega'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
