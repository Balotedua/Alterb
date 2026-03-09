import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/services/api';
import type { Transaction, TransactionInput } from '@/types';

const QUERY_KEY = ['transactions'] as const;

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet<Transaction[]>('/transactions'),
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation<Transaction, Error, TransactionInput>({
    mutationFn: (input) => apiPost<Transaction>('/transactions', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiDelete<void>(`/transactions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export interface DeleteCriteria {
  category?: string;
  descriptionContains?: string;
  startDate?: string;
  endDate?: string;
  type?: 'income' | 'expense';
}

export function useDeleteTransactions() {
  const qc = useQueryClient();
  return useMutation<void, Error, DeleteCriteria>({
    mutationFn: async (criteria) => {
      // Chiamata API per eliminare transazioni in base ai criteri
      // Dobbiamo creare un endpoint API che accetti questi criteri
      // Per ora, usiamo una chiamata POST a /transactions/delete
      return apiPost<void>('/transactions/delete', criteria);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
