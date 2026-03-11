import { useState } from 'react';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { NEBULA_THEMES } from '@/config/nebulaThemes';
import { useNebulaStore } from '@/store/nebulaStore';

export function SettingsFragment(_: { params?: Record<string, unknown> }) {
  const { user } = useAuth();
  const { nebulaTheme, setNebulaTheme } = useNebulaStore();

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'ELIMINA') {
      toast.error('Scrivi "ELIMINA" per confermare.');
      return;
    }
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      toast.success('Account eliminato.');
      await supabase.auth.signOut();
    } catch {
      toast.error('Errore durante l\'eliminazione.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <NebulaCard title="Impostazioni" variant="default" closable={true}>
      <div className="st-body">

        {/* ── Account ── */}
        <div className="st-section-label">Account</div>

        <div className="st-row">
          <span className="st-row-label">Email</span>
          <span className="st-row-value">{user?.email || '—'}</span>
        </div>

        <div className="st-row st-row--action" role="button" tabIndex={0} onClick={handleLogout}
          onKeyDown={e => e.key === 'Enter' && handleLogout()}>
          <span className="st-row-label">Esci dall'account</span>
          <span className="st-row-chevron">→</span>
        </div>

        {/* ── Aspetto ── */}
        <div className="st-section-label">Aspetto</div>

        <div className="nb-theme-grid">
          {NEBULA_THEMES.map(t => (
            <button
              key={t.id}
              className={['nb-theme-swatch', nebulaTheme === t.id ? 'nb-theme-swatch--active' : ''].filter(Boolean).join(' ')}
              onClick={() => { setNebulaTheme(t.id); toast.success(`Tema ${t.label} attivato`); }}
              type="button"
            >
              <span className="nb-theme-orb" style={{ background: t.swatch }} />
              <span className="nb-theme-label">{t.label}</span>
              <span className="nb-theme-desc">{t.description}</span>
              {nebulaTheme === t.id && <span className="nb-theme-check">✓</span>}
            </button>
          ))}
        </div>

        {/* ── Zona pericolosa ── */}
        <div className="st-section-label st-section-label--danger">Zona pericolosa</div>

        {!showDelete ? (
          <div className="st-row st-row--danger" role="button" tabIndex={0}
            onClick={() => setShowDelete(true)}
            onKeyDown={e => e.key === 'Enter' && setShowDelete(true)}>
            <span className="st-row-label">Elimina account</span>
            <span className="st-row-chevron">→</span>
          </div>
        ) : (
          <div className="st-delete-zone">
            <p className="st-delete-warn">
              Azione irreversibile. Tutti i dati verranno eliminati permanentemente.
              Scrivi <strong>ELIMINA</strong> per confermare.
            </p>
            <input
              className="st-delete-input"
              placeholder="ELIMINA"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
            />
            <div className="st-delete-actions">
              <button
                className="st-btn st-btn--ghost"
                onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}
              >
                Annulla
              </button>
              <button
                className="st-btn st-btn--danger"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'ELIMINA' || isDeleting}
              >
                {isDeleting ? 'Eliminazione…' : 'Conferma'}
              </button>
            </div>
          </div>
        )}

      </div>
    </NebulaCard>
  );
}
