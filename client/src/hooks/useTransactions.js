import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../services/api';

export function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // TODO: implement fetch, add, remove
  console.log('useTransactions placeholder');

  return { transactions, loading };
}
