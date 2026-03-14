import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';
import { FINANCE_DEFAULT_CAT_IDS } from '@/utils/constants';
import type { Transaction, TransactionInput, CategoryConfig, FinanceBudget, PatrimonioAsset, PatrimonioAssetInput, Prestito, PrestitoInput } from '@/types';

const QUERY_KEY = ['transactions'];
const CAT_QUERY_KEY = ['finance_categories'];

// Ottieni tutte le transazioni dell'utente
export function useTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!user) throw new Error('Utente non autenticato');

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });
}

// Aggiungi una transazione
export function useAddTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      if (!user) throw new Error('Utente non autenticato');

      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          ...input,
          user_id: user.id,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// Aggiorna una transazione (importo, descrizione, note, categoria, data, hidden_from_charts)
export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<TransactionInput & { hidden_from_charts: boolean }>) => {
      const { error } = await supabase
        .from('transactions')
        .update(fields)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Aggiorna la categoria di una singola transazione per ID
export function useUpdateTransactionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ category })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Ricategorizza tutte le transazioni con una certa descrizione
export function useRecategorize() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ description, category }: { description: string; category: string }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ category })
        .eq('user_id', user!.id)
        .ilike('description', description); // case-insensitive exact match
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Ricategorizza tutte le transazioni la cui descrizione contiene una certa stringa
export function useRecategorizeContains() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ pattern, category }: { pattern: string; category: string }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ category })
        .eq('user_id', user!.id)
        .ilike('description', `%${pattern}%`); // contiene la stringa
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Ottieni transazioni non associate:
// - NON in categorie di default (food, transport, ecc.)
// - NON in categorie custom dell'utente su Supabase
// - 'other' è inclusa perché è la scelta "libera" → va associata
export function useUncategorizedTransactions() {
  const { data: transactions } = useTransactions();
  const { data: categories } = useFinanceCategories();

  const userCatIds = new Set((categories ?? []).map(c => c.id));

  const uncategorized = transactions?.filter(t => {
    const cat = t.category;
    if (!cat || cat === 'other') return true;          // non categorizzata o "altro" generico
    if (FINANCE_DEFAULT_CAT_IDS.has(cat)) return false; // già in una default → ok
    if (userCatIds.has(cat)) return false;              // in una custom utente → ok
    return true;                                         // categoria sconosciuta
  }) || [];

  return { data: uncategorized };
}

// Importa transazioni in bulk (da CSV)
export function useBulkAddTransactions() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (inputs: TransactionInput[]) => {
      if (!user) throw new Error('Utente non autenticato');
      const rows = inputs.map((input) => ({
        ...input,
        user_id: user.id,
        created_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('transactions').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Elimina una transazione
export function useDeleteTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Utente non autenticato');
      console.log('[delete] auth user.id:', user.id);
      console.log('[delete] transaction id to delete:', id);

      // Prima verifica: la transazione esiste con quel user_id?
      const { data: check } = await supabase
        .from('transactions')
        .select('id, user_id')
        .eq('id', id)
        .single();
      console.log('[delete] pre-check row:', check);
      console.log('[delete] user_id match:', check?.user_id === user.id);

      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .select();

      console.log('[delete] result data:', data, 'error:', error);
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(`RLS blocca il delete. user.id=${user.id} row.user_id=${check?.user_id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// Elimina più transazioni per ID (bulk)
export function useDeleteTransactionsBulk() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('Utente non autenticato');
      if (ids.length === 0) return;
      console.log('[bulk-delete] user.id:', user.id, 'ids:', ids);
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// Categorie personalizzate dell'utente
export function useFinanceCategories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: CAT_QUERY_KEY,
    queryFn: async () => {
      if (!user) throw new Error('Utente non autenticato');
      const { data, error } = await supabase
        .from('finance_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CategoryConfig[];
    },
    enabled: !!user,
  });
}

// Aggiorna nome e icona di una categoria (update se esiste, insert se è una DEFAULT_CAT)
export function useUpdateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, label, icon }: { id: string; label: string; icon: string }) => {
      if (!user) throw new Error('Utente non autenticato');

      // Prova aggiornamento (categoria già in DB)
      const { data: updated, error: updErr } = await supabase
        .from('finance_categories')
        .update({ label, icon })
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      if (updErr) throw updErr;

      // Se nessuna riga aggiornata (categoria di default non ancora in DB), inseriscila
      if (!updated || updated.length === 0) {
        const { error: insErr } = await supabase
          .from('finance_categories')
          .insert({ id, user_id: user.id, label, icon, color: '#6b7280' });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CAT_QUERY_KEY }),
  });
}

// Escludi/includi intera categoria dai grafici (upsert se è una default non ancora in DB)
export function useToggleCategoryHidden() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      if (!user) throw new Error('Utente non autenticato');
      const { data: updated, error: updErr } = await supabase
        .from('finance_categories')
        .update({ hidden_from_charts: hidden })
        .eq('id', id).eq('user_id', user.id).select();
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        const { error: insErr } = await supabase
          .from('finance_categories')
          .insert({ id, user_id: user.id, hidden_from_charts: hidden, color: '#6b7280' });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CAT_QUERY_KEY }),
  });
}

// Crea una nuova categoria
export function useAddCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (cat: Omit<CategoryConfig, 'user_id'>) => {
      if (!user) throw new Error('Utente non autenticato');
      const id = cat.id || cat.label.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const { error } = await supabase
        .from('finance_categories')
        .insert([{ id, user_id: user.id, label: cat.label, icon: cat.icon, color: cat.color }]);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CAT_QUERY_KEY }),
  });
}

// Statistiche per il mese corrente
export function useMonthlyStats() {
  const { data: transactions } = useTransactions();
  const { data: cats = [] } = useFinanceCategories();

  if (!transactions) {
    return {
      income: 0,
      expenses: 0,
      balance: 0,
      savingsRate: 0,
      monthlyData: [],
    };
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const hiddenCatIds = new Set(cats.filter(c => c.hidden_from_charts).map(c => c.id));
  const visibleTransactions = transactions.filter(t => !t.hidden_from_charts && !hiddenCatIds.has(t.category));

  const monthlyTransactions = visibleTransactions.filter(t => {
    const date = new Date(t.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const income = monthlyTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expenses;
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : '0.0';

  // Dati per grafico ultimi 30 giorni
  const last30Days = [...Array(30)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const dailyData = last30Days.map(date => {
    const dayIncome = visibleTransactions
      .filter(t => t.date.startsWith(date) && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const dayExpenses = visibleTransactions
      .filter(t => t.date.startsWith(date) && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      date,
      income: dayIncome,
      expenses: dayExpenses,
    };
  });

  return {
    income,
    expenses,
    balance,
    savingsRate,
    monthlyData: dailyData,
    transactionCount: monthlyTransactions.length,
  };
}

// Transazioni visibili: esclude hidden_from_charts su singola transazione E su intera categoria
export function useVisibleTransactions(): Transaction[] {
  const { data: txs = [] } = useTransactions();
  const { data: cats = [] } = useFinanceCategories();
  const hiddenCatIds = new Set(cats.filter(c => c.hidden_from_charts).map(c => c.id));
  return txs.filter(t => !t.hidden_from_charts && !hiddenCatIds.has(t.category));
}

// ── Budget hooks ───────────────────────────────────────────────────────────────

const BUDGET_KEY = ['finance_budgets'];

export function useFinanceBudgets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: BUDGET_KEY,
    queryFn: async () => {
      if (!user) throw new Error('Utente non autenticato');
      const { data, error } = await supabase
        .from('finance_budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as FinanceBudget[];
    },
    enabled: !!user,
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ category, monthly_limit }: { category: string; monthly_limit: number }) => {
      if (!user) throw new Error('Utente non autenticato');
      const { error } = await supabase
        .from('finance_budgets')
        .upsert({ user_id: user.id, category, monthly_limit }, { onConflict: 'user_id,category' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BUDGET_KEY }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Utente non autenticato');
      const { error } = await supabase.from('finance_budgets').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BUDGET_KEY }),
  });
}

// ── Patrimonio hooks ──────────────────────────────────────────────────────────

const PATRIMONIO_KEY = ['patrimonio_assets'];

export function usePatrimonioAssets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: PATRIMONIO_KEY,
    queryFn: async () => {
      if (!user) throw new Error('Utente non autenticato');
      const { data, error } = await supabase
        .from('patrimonio_assets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as PatrimonioAsset[];
    },
    enabled: !!user,
  });
}

export function useAddPatrimonioAsset() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: PatrimonioAssetInput) => {
      if (!user) throw new Error('Utente non autenticato');
      const { data, error } = await supabase
        .from('patrimonio_assets')
        .insert([{ ...input, user_id: user.id }])
        .select()
        .single();
      if (error) throw error;
      return data as PatrimonioAsset;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PATRIMONIO_KEY }),
  });
}

export function useUpdatePatrimonioAsset() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...update }: { id: string } & Partial<PatrimonioAssetInput>) => {
      if (!user) throw new Error('Utente non autenticato');
      const { error } = await supabase
        .from('patrimonio_assets')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PATRIMONIO_KEY }),
  });
}

export function useDeletePatrimonioAsset() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Utente non autenticato');
      const { error } = await supabase
        .from('patrimonio_assets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PATRIMONIO_KEY }),
  });
}

// ── Prestiti & Puffi hooks ────────────────────────────────────────────────────

const PRESTITI_KEY = ['finance_prestiti'];

export function usePrestiti() {
  const { user } = useAuth();
  return useQuery({
    queryKey: PRESTITI_KEY,
    queryFn: async () => {
      if (!user) throw new Error('Utente non autenticato');
      const { data, error } = await supabase
        .from('finance_prestiti')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Prestito[];
    },
    enabled: !!user,
  });
}

export function useAddPrestito() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: PrestitoInput) => {
      if (!user) throw new Error('Utente non autenticato');
      const { data, error } = await supabase
        .from('finance_prestiti')
        .insert([{ ...input, user_id: user.id }])
        .select()
        .single();
      if (error) throw error;
      return data as Prestito;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRESTITI_KEY }),
  });
}

export function useTogglePrestitoSaldato() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, saldato }: { id: string; saldato: boolean }) => {
      if (!user) throw new Error('Utente non autenticato');
      const { error } = await supabase
        .from('finance_prestiti')
        .update({ saldato })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRESTITI_KEY }),
  });
}

export function useDeletePrestito() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Utente non autenticato');
      const { error } = await supabase
        .from('finance_prestiti')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRESTITI_KEY }),
  });
}
