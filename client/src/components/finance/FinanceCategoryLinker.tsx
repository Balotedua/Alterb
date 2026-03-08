import { useState } from 'react';
import { Tag, ChevronDown, Check, Plus } from 'lucide-react';
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
  const [newCategoryInputs, setNewCategoryInputs] = useState<Record<string, string>>({});
  const [done,       setDone      ] = useState<Set<string>>(new Set());
  const [pending,    setPending   ] = useState<string | null>(null);

  const groups = buildGroups(transactions ?? []);

  if (groups.length === 0) return null;

  const handleLink = async (group: Group) => {
    let cat = selections[group.key];
    // Se la selezione è "new", usa il valore dell'input
    if (cat === 'new') {
      cat = newCategoryInputs[group.key]?.trim();
      if (!cat) return;
    }
    if (!cat) return;
    setPending(group.key);
    try {
      await recategorize.mutateAsync({ description: group.description, category: cat });
      setDone((prev) => new Set([...prev, group.key]));
      // Pulisci gli stati per questo gruppo
      setSelections(prev => {
        const { [group.key]: _, ...rest } = prev;
        return rest;
      });
      setNewCategoryInputs(prev => {
        const { [group.key]: _, ...rest } = prev;
        return rest;
      });
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
          const showNewInput = cat === 'new';
          const newCatValue = newCategoryInputs[g.key] ?? '';

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
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelections((prev) => ({ ...prev, [g.key]: value }));
                      // Se non è "new", pulisci l'input
                      if (value !== 'new') {
                        setNewCategoryInputs(prev => {
                          const { [g.key]: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    disabled={isPending}
                  >
                    <option value="">Categoria…</option>
                    {CAT_CONFIG.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                    <option value="new">➕ Nuova categoria</option>
                  </select>
                  <ChevronDown size={11} className="fin-linker-arrow" />
                </div>

                {showNewInput && (
                  <div className="fin-linker-new-input-wrap">
                    <input
                      type="text"
                      className="fin-linker-new-input"
                      placeholder="Nome nuova categoria"
                      value={newCatValue}
                      onChange={(e) =>
                        setNewCategoryInputs((prev) => ({ ...prev, [g.key]: e.target.value }))
                      }
                      disabled={isPending}
                    />
                  </div>
                )}

                <button
                  className="fin-linker-btn"
                  onClick={() => handleLink(g)}
                  disabled={
                    isPending ||
                    !cat ||
                    (cat === 'new' && !newCatValue.trim())
                  }
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
