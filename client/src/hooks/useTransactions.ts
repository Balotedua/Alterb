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
