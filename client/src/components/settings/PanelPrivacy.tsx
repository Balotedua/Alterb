import { useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button, Modal } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransactionRow {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function rowsToCsv(rows: TransactionRow[]): string {
  const headers: (keyof TransactionRow)[] = [
    'id',
    'user_id',
    'amount',
    'type',
    'category',
    'description',
    'date',
    'created_at',
  ];
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = headers.join(',');
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(',')).join('\n');
  return `${header}\n${body}`;
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PanelPrivacy ─────────────────────────────────────────────────────────────

export function PanelPrivacy() {
  const { user, logout } = useAuth();

  // Export state
  const [jsonLoading, setJsonLoading] = useState<boolean>(false);
  const [csvLoading, setCsvLoading] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string>('');

  // Reset data modal
  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>('');

  // Delete account modal
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  // ─── Fetch transactions helper ───────────────────────────────────────────────

  const fetchTransactions = useCallback(async (): Promise<TransactionRow[]> => {
    if (!user) throw new Error('Utente non autenticato.');
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    return (data ?? []) as TransactionRow[];
  }, [user]);

  // ─── Export JSON ──────────────────────────────────────────────────────────────

  const handleExportJson = useCallback(async () => {
    setJsonLoading(true);
    setExportError('');
    try {
      const rows = await fetchTransactions();
      const content = JSON.stringify(rows, null, 2);
      triggerDownload(content, 'alter-transazioni.json', 'application/json');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setExportError(message);
    } finally {
      setJsonLoading(false);
    }
  }, [fetchTransactions]);

  // ─── Export CSV ───────────────────────────────────────────────────────────────

  const handleExportCsv = useCallback(async () => {
    setCsvLoading(true);
    setExportError('');
    try {
      const rows = await fetchTransactions();
      const content = rowsToCsv(rows);
      triggerDownload(content, 'alter-transazioni.csv', 'text/csv;charset=utf-8;');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setExportError(message);
    } finally {
      setCsvLoading(false);
    }
  }, [fetchTransactions]);

  // ─── Reset dati ───────────────────────────────────────────────────────────────

  const handleResetData = useCallback(async () => {
    if (!user) return;
    setResetLoading(true);
    setResetError('');
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
      setResetModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setResetError(message);
    } finally {
      setResetLoading(false);
    }
  }, [user]);

  // ─── Elimina account ──────────────────────────────────────────────────────────

  const handleDeleteAccount = useCallback(async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      // TODO: chiamare endpoint backend per eliminazione account definitiva (es. supabase admin API)
      await supabase.auth.signOut();
      await logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setDeleteError(message);
      setDeleteLoading(false);
    }
  }, [logout]);

  const deleteConfirmValid = deleteConfirmText === 'ELIMINA';

  return (
    <div className="st-panel">
      {/* Esporta dati */}
      <div className="st-section">
        <p className="st-section__title">Esporta dati</p>
        <div className="st-section__body">
          <p className="st-sublabel" style={{ marginBottom: 16 }}>
            Scarica una copia di tutte le tue transazioni in formato JSON o CSV.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              loading={jsonLoading}
              onClick={handleExportJson}
              type="button"
            >
              Esporta JSON
            </Button>
            <Button
              variant="secondary"
              loading={csvLoading}
              onClick={handleExportCsv}
              type="button"
            >
              Esporta CSV
            </Button>
          </div>
          {exportError && (
            <p style={{ color: '#ef4444', fontSize: 13, margin: '12px 0 0' }}>{exportError}</p>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="st-section st-danger">
        <p className="st-section__title">Danger Zone</p>
        <div className="st-section__body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Reset dati */}
          <div style={{ paddingBottom: 20 }}>
            <p className="st-label" style={{ marginBottom: 4 }}>
              Reset dati
            </p>
            <p className="st-sublabel" style={{ marginBottom: 12 }}>
              Elimina tutte le transazioni. Questa azione è irreversibile.
            </p>
            <Button
              variant="danger"
              onClick={() => {
                setResetError('');
                setResetModalOpen(true);
              }}
              type="button"
            >
              Elimina tutte le transazioni
            </Button>
          </div>

          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--border)',
              margin: '4px 0 20px',
            }}
          />

          {/* Elimina account */}
          <div>
            <p className="st-label" style={{ marginBottom: 4 }}>
              Elimina account
            </p>
            <p className="st-sublabel" style={{ marginBottom: 12 }}>
              Elimina il tuo account e tutti i dati associati in modo permanente.
            </p>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteConfirmText('');
                setDeleteError('');
                setDeleteModalOpen(true);
              }}
              type="button"
            >
              Elimina account
            </Button>
          </div>
        </div>
      </div>

      {/* Modal reset transazioni */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Eliminare tutte le transazioni?"
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
            Stai per eliminare <strong>tutte le transazioni</strong>. Questa operazione è
            irreversibile e non può essere annullata.
          </p>
          {resetError && (
            <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{resetError}</p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => setResetModalOpen(false)}
              type="button"
            >
              Annulla
            </Button>
            <Button
              variant="danger"
              loading={resetLoading}
              onClick={handleResetData}
              type="button"
            >
              Elimina tutto
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal elimina account */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Sei sicuro?"
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
            Stai per eliminare definitivamente il tuo account e tutti i dati associati.
            Questa operazione <strong>non può essere annullata</strong>.
          </p>
          <div className="input-group">
            <label className="input-label" htmlFor="privacy-delete-confirm">
              Digita <strong>ELIMINA</strong> per confermare
            </label>
            <input
              id="privacy-delete-confirm"
              className="input"
              type="text"
              value={deleteConfirmText}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDeleteConfirmText(e.target.value)
              }
              placeholder="ELIMINA"
            />
          </div>
          {deleteError && (
            <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{deleteError}</p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => setDeleteModalOpen(false)}
              type="button"
            >
              Annulla
            </Button>
            <Button
              variant="danger"
              disabled={!deleteConfirmValid}
              loading={deleteLoading}
              onClick={handleDeleteAccount}
              type="button"
            >
              Elimina definitivamente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
