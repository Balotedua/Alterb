import { useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Modal } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type PwdState = 'idle' | 'loading' | 'saved' | 'error';

interface Session {
  id: string;
  device: string;
  location: string;
  date: string;
  isCurrentDevice: boolean;
}

// ─── Static stub sessions ─────────────────────────────────────────────────────

const STUB_SESSIONS: Session[] = [
  {
    id: 'sess-1',
    device: 'Chrome su macOS — questo dispositivo',
    location: 'Milano, IT',
    date: '2026-03-08 14:32',
    isCurrentDevice: true,
  },
  {
    id: 'sess-2',
    device: 'Safari su iPhone',
    location: 'Roma, IT',
    date: '2026-03-07 09:10',
    isCurrentDevice: false,
  },
  {
    id: 'sess-3',
    device: 'Firefox su Windows',
    location: 'Torino, IT',
    date: '2026-03-05 20:45',
    isCurrentDevice: false,
  },
];

// ─── PanelAccount ─────────────────────────────────────────────────────────────

export function PanelAccount() {
  const { logout } = useAuth();

  // Password change
  const [currentPwd, setCurrentPwd] = useState<string>('');
  const [newPwd, setNewPwd] = useState<string>('');
  const [confirmPwd, setConfirmPwd] = useState<string>('');
  const [pwdState, setPwdState] = useState<PwdState>('idle');
  const [pwdError, setPwdError] = useState<string>('');

  // Sessions
  const [sessions, setSessions] = useState<Session[]>(STUB_SESSIONS);

  // Delete account modal
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  // ─── Password change handler ───────────────────────────────────────────────

  const handleChangePassword = useCallback(async () => {
    setPwdError('');

    if (newPwd.length < 8) {
      setPwdError('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('La nuova password e la conferma non corrispondono.');
      return;
    }

    setPwdState('loading');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw new Error(error.message);

      setPwdState('saved');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setTimeout(() => setPwdState('idle'), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setPwdError(message);
      setPwdState('error');
    }
  }, [newPwd, confirmPwd]);

  const pwdBtnLabel =
    pwdState === 'loading'
      ? 'Aggiornamento...'
      : pwdState === 'saved'
        ? '✓ Password aggiornata'
        : 'Aggiorna password';

  // ─── Session terminate handler (UI only) ──────────────────────────────────

  const handleTerminateSession = useCallback((id: string) => {
    // TODO: chiamare API reale di revoca sessione
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ─── Delete account handler ────────────────────────────────────────────────

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
      {/* Cambio Password */}
      <div className="st-section">
        <p className="st-section__title">Cambio password</p>
        <div className="st-section__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Password attuale"
            type="password"
            value={currentPwd}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentPwd(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="Nuova password"
            type="password"
            value={newPwd}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPwd(e.target.value)}
            autoComplete="new-password"
            hint="Minimo 8 caratteri"
          />
          <Input
            label="Conferma nuova password"
            type="password"
            value={confirmPwd}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPwd(e.target.value)}
            autoComplete="new-password"
            error={pwdState === 'error' ? pwdError : undefined}
          />
          {pwdError && pwdState !== 'error' && (
            <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{pwdError}</p>
          )}
          <Button
            variant="primary"
            loading={pwdState === 'loading'}
            onClick={handleChangePassword}
            type="button"
          >
            {pwdBtnLabel}
          </Button>
        </div>
      </div>

      {/* Sessioni attive */}
      <div className="st-section">
        <p className="st-section__title">Sessioni attive</p>
        <div className="st-section__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map((session) => (
            <div key={session.id} className="st-row">
              <div>
                <p className="st-label" style={{ margin: 0 }}>{session.device}</p>
                <p className="st-sublabel" style={{ margin: '2px 0 0' }}>
                  {session.location} · {session.date}
                </p>
              </div>
              {session.isCurrentDevice ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    background: 'var(--accent-soft)',
                    borderRadius: 20,
                    padding: '2px 10px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Corrente
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTerminateSession(session.id)}
                  type="button"
                >
                  Termina
                </Button>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="st-sublabel">Nessuna sessione attiva.</p>
          )}
        </div>
      </div>

      {/* Elimina account — Danger Zone */}
      <div className="st-section st-danger">
        <p className="st-section__title">Elimina account</p>
        <div className="st-section__body">
          <p className="st-sublabel" style={{ marginBottom: 16 }}>
            Questa azione è irreversibile. Tutti i tuoi dati verranno eliminati definitivamente e non
            sarà possibile recuperarli.
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

      {/* Modal conferma eliminazione */}
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
            <label className="input-label" htmlFor="delete-confirm-input">
              Digita <strong>ELIMINA</strong> per confermare
            </label>
            <input
              id="delete-confirm-input"
              className="input"
              type="text"
              value={deleteConfirmText}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDeleteConfirmText(e.target.value)}
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
