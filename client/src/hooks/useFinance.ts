import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';
import type { Transaction, TransactionInput } from '@/types';

const QUERY_KEY = ['transactions'];

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

// Elimina una transazione
export function useDeleteTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
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