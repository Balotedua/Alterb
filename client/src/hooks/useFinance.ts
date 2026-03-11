import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';
import type { Transaction, TransactionInput, CategoryConfig } from '@/types';

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

// Ottieni transazioni non associate (categoria non presente nelle categorie utente)
export function useUncategorizedTransactions() {
  const { data: transactions } = useTransactions();
  const { data: categories } = useFinanceCategories();

  const knownIds = new Set((categories ?? []).map(c => c.id));

  const uncategorized = transactions?.filter(t =>
    t.category === 'other' || !knownIds.has(t.category)
  ) || [];

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
      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id)
        .select();

      console.log('[bulk-delete] result:', { data, error });
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Nessuna transazione eliminata — permesso negato o ID non validi');
      return data.length;
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

  const monthlyTransactions = transactions.filter(t => {
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
    const dayIncome = transactions
      .filter(t => t.date.startsWith(date) && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const dayExpenses = transactions
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
