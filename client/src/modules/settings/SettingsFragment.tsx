import { useState } from 'react';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function SettingsFragment() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Stato per l'eliminazione account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Stato per le impostazioni
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [density, setDensity] = useState<'comoda' | 'compatta'>('comoda');
  const [font, setFont] = useState('Inter');
  const [language, setLanguage] = useState('it');
  const [timezone, setTimezone] = useState('Europe/Rome');
  const [aiStyle, setAiStyle] = useState('neutro');
  const [creativity, setCreativity] = useState(50);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'ELIMINA') {
      toast.error('Devi scrivere "ELIMINA" per confermare.');
      return;
    }
    setIsDeleting(true);
    try {
      // Chiamata API per eliminare l'account
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      toast.success('Account eliminato con successo.');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error(err);
      toast.error('Errore durante l\'eliminazione dell\'account.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    toast.info(`Esportazione ${format} in preparazione...`);
    // Qui implementerai la logica di esportazione
  };

  return (
    <NebulaCard title="Impostazioni" variant="default" closable={true}>
      <div className="settings-sections">
        {/* Sezione Profilo */}
        <section className="settings-section">
          <h3 className="settings-section-title">👤 Profilo & Dati utente</h3>
          <div className="settings-grid">
            <div className="settings-field">
              <label>Email</label>
              <input type="text" value={user?.email || ''} readOnly className="settings-input" />
            </div>
            <div className="settings-field">
              <label>Bio</label>
              <textarea className="settings-textarea" placeholder="Una breve descrizione di te..." rows={2} />
            </div>
            <div className="settings-field">
              <label>Lingua</label>
              <select className="settings-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="it">Italiano</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div className="settings-field">
              <label>Zona oraria</label>
              <select className="settings-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="Europe/Rome">Roma (GMT+1)</option>
                <option value="Europe/London">Londra (GMT+0)</option>
                <option value="America/New_York">New York (GMT-5)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Sezione Aspetto */}
        <section className="settings-section">
          <h3 className="settings-section-title">🎨 Aspetto</h3>
          <div className="settings-grid">
            <div className="settings-field">
              <label>Tema</label>
              <div className="settings-radio-group">
                <label className="settings-radio">
                  <input type="radio" name="theme" checked={theme === 'light'} onChange={() => setTheme('light')} />
                  <span>Light</span>
                </label>
                <label className="settings-radio">
                  <input type="radio" name="theme" checked={theme === 'dark'} onChange={() => setTheme('dark')} />
                  <span>Dark</span>
                </label>
                <label className="settings-radio">
                  <input type="radio" name="theme" checked={theme === 'system'} onChange={() => setTheme('system')} />
                  <span>Sistema</span>
                </label>
              </div>
            </div>
            <div className="settings-field">
              <label>Densità interfaccia</label>
              <select className="settings-select" value={density} onChange={(e) => setDensity(e.target.value as any)}>
                <option value="comoda">Comoda</option>
                <option value="compatta">Compatta</option>
              </select>
            </div>
            <div className="settings-field">
              <label>Font</label>
              <select className="settings-select" value={font} onChange={(e) => setFont(e.target.value)}>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Montserrat">Montserrat</option>
              </select>
            </div>
          </div>
        </section>

        {/* Sezione Nebula AI */}
        <section className="settings-section">
          <h3 className="settings-section-title">🤖 Nebula AI</h3>
          <div className="settings-grid">
            <div className="settings-field">
              <label>Stile di comunicazione</label>
              <select className="settings-select" value={aiStyle} onChange={(e) => setAiStyle(e.target.value)}>
                <option value="neutro">Neutro</option>
                <option value="amichevole">Amichevole</option>
                <option value="tecnico">Tecnico</option>
                <option value="motivazionale">Motivazionale</option>
              </select>
            </div>
            <div className="settings-field">
              <label>Creatività: {creativity}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={creativity}
                onChange={(e) => setCreativity(parseInt(e.target.value))}
                className="settings-slider"
              />
            </div>
            <div className="settings-field">
              <button className="settings-btn settings-btn--secondary" onClick={() => toast.info('Memoria resettata')}>
                🔄 Reset memoria
              </button>
            </div>
          </div>
        </section>

        {/* Sezione Sicurezza */}
        <section className="settings-section">
          <h3 className="settings-section-title">🔐 Sicurezza</h3>
          <div className="settings-grid">
            <div className="settings-field">
              <button className="settings-btn settings-btn--secondary" onClick={handleLogout}>
                👤 Disconnetti tutte le sessioni
              </button>
            </div>
            <div className="settings-field">
              <button className="settings-btn settings-btn--secondary" onClick={() => toast.info('2FA non ancora implementato')}>
                🔒 Abilita 2FA
              </button>
            </div>
            <div className="settings-field">
              <button className="settings-btn settings-btn--secondary" onClick={() => toast.info('Cambio password non ancora implementato')}>
                🔑 Cambia Password
              </button>
            </div>
          </div>
        </section>

        {/* Sezione Privacy & Dati */}
        <section className="settings-section">
          <h3 className="settings-section-title">📊 Privacy & Dati</h3>
          <div className="settings-grid">
            <div className="settings-field">
              <label>Esportazione dati</label>
              <div className="settings-btn-group">
                <button className="settings-btn settings-btn--secondary" onClick={() => handleExportData('json')}>
                  JSON
                </button>
                <button className="settings-btn settings-btn--secondary" onClick={() => handleExportData('csv')}>
                  CSV
                </button>
              </div>
            </div>
            <div className="settings-field">
              <label className="settings-danger-label">Danger Zone</label>
              <button
                className="settings-btn settings-btn--danger"
                onClick={() => setShowDeleteModal(true)}
              >
                🗑 Elimina Account
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modale di conferma eliminazione account */}
      {showDeleteModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal">
            <h3 className="settings-modal-title">Conferma eliminazione account</h3>
            <p className="settings-modal-text">
              Questa azione è irreversibile. Tutti i tuoi dati verranno eliminati permanentemente.
              Per confermare, scrivi <strong>ELIMINA</strong> nel campo sottostante.
            </p>
            <input
              type="text"
              className="settings-modal-input"
              placeholder="Scrivi ELIMINA"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
            <div className="settings-modal-actions">
              <button
                className="settings-btn settings-btn--secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Annulla
              </button>
              <button
                className="settings-btn settings-btn--danger"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'ELIMINA' || isDeleting}
              >
                {isDeleting ? 'Eliminazione...' : 'Conferma Eliminazione'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NebulaCard>
  );
}
