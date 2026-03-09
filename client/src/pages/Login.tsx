import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import './Login.css';

type Tab = 'login' | 'register';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setFirstName('');
    setLastName('');
    setAvatarUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (tab === 'register') {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Nome e cognome sono obbligatori');
        return;
      }
      if (password !== confirm) {
        setError('Le password non coincidono');
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
        navigate('/nebula');
      } else {
        await register(email, password, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          avatar_url: avatarUrl.trim() || null,
        });
        setSuccess('Controlla la tua email per confermare la registrazione.');
      }
    } catch {
      setError(tab === 'login' ? 'Email o password errati' : 'Registrazione fallita. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-root">

      {/* background animato */}
      <div className="lp-bg" />
      <div className="lp-bg-extra" />
      <div className="lp-bg-grid" />

      {/* card centrale */}
      <div className="lp-card">

        {/* brand */}
        <div className="lp-brand">
          <span className="lp-symbol">✦</span>
          <span className="lp-wordmark">Alter</span>
        </div>

        {/* tabs */}
        <div className="lp-tabs">
          <button
            className={`lp-tab ${tab === 'login' ? 'lp-tab--active' : ''}`}
            onClick={() => switchTab('login')}
            type="button"
          >
            Accedi
          </button>
          <button
            className={`lp-tab ${tab === 'register' ? 'lp-tab--active' : ''}`}
            onClick={() => switchTab('register')}
            type="button"
          >
            Registrati
          </button>
          <span
            className="lp-tab-indicator"
            style={{ transform: `translateX(${tab === 'login' ? '0%' : '100%'})` }}
          />
        </div>

        {/* header */}
        <div className="lp-form-header">
          <h2 className="lp-form-title">
            {tab === 'login' ? 'Bentornato' : 'Crea account'}
          </h2>
          <p className="lp-form-sub">
            {tab === 'login'
              ? 'Inserisci le tue credenziali per accedere'
              : 'Inizia il tuo percorso con Alter'}
          </p>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="lp-form" key={tab}>

          {/* Nome + Cognome (solo registrazione) */}
          {tab === 'register' && (
            <div className="lp-field-row lp-field--anim">
              <div className="lp-field">
                <label className="lp-label" htmlFor="lp-firstname">Nome</label>
                <input
                  id="lp-firstname"
                  className="lp-input"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Mario"
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="lp-field">
                <label className="lp-label" htmlFor="lp-lastname">Cognome</label>
                <input
                  id="lp-lastname"
                  className="lp-input"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rossi"
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
          )}

          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-email">Email</label>
            <input
              id="lp-email"
              className="lp-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-password">Password</label>
            <input
              id="lp-password"
              className="lp-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'register' && (
            <>
              <div className="lp-field lp-field--anim">
                <label className="lp-label" htmlFor="lp-confirm">Conferma password</label>
                <input
                  id="lp-confirm"
                  className="lp-input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="lp-field lp-field--anim">
                <label className="lp-label" htmlFor="lp-avatar">
                  Avatar URL <span className="lp-label-opt">(opzionale)</span>
                </label>
                <input
                  id="lp-avatar"
                  className="lp-input"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  autoComplete="off"
                />
              </div>
            </>
          )}

          {error && <div className="lp-msg lp-msg--error">{error}</div>}
          {success && <div className="lp-msg lp-msg--success">{success}</div>}

          <button type="submit" className="lp-btn" disabled={loading}>
            {loading
              ? <span className="lp-btn__spinner" />
              : tab === 'login' ? 'Accedi' : 'Crea account'}
          </button>

        </form>

        <p className="lp-switch">
          {tab === 'login' ? 'Non hai un account?' : 'Hai già un account?'}
          {' '}
          <button
            type="button"
            className="lp-switch__link"
            onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
          >
            {tab === 'login' ? 'Registrati' : 'Accedi'}
          </button>
        </p>

      </div>
    </div>
  );
}
